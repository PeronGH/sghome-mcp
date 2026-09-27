const BASE = "https://eservice.ura.gov.sg/property-market-information";
// URA serves a JavaScript challenge instead of the page when a request has no User-Agent, as Workers' fetch does by default.
const USER_AGENT = { "user-agent": "Mozilla/5.0 (compatible; sghome-mcp)" };

export const URA_PROPERTY_TYPES = { landed: "1", non_landed: "2", ec: "3" } as const;
export type UraPropertyType = keyof typeof URA_PROPERTY_TYPES;

interface Session {
	cookie: string;
	csrf: string;
	latestMonth: string;
}

interface Catalog {
	projects: Map<string, string>;
	districts: Map<string, string>;
}

// Cached per isolate. A URA session and its CSRF token serve any number of searches, including concurrent ones,
// so requests share one and only rebuild it when URA rejects it.
let session: Session | undefined;
let catalog: Catalog | undefined;

const decode = (s: string) =>
	s
		.replace(/&#0*39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.trim();

async function getSession(): Promise<Session> {
	if (session) return session;
	const res = await fetch(`${BASE}/pmiResidentialRentalSearch`, { headers: USER_AGENT });
	const html = await res.text();
	const csrf = html.match(/name="_csrf"[^>]*value="([^"]+)"/)?.[1];
	const selected = (name: string) =>
		html.match(new RegExp(`name="${name}"[\\s\\S]*?<option value="(\\d+)" selected`))?.[1];
	const year = selected("contractYearTo");
	const month = selected("contractMonthTo");
	if (!csrf || !year || !month) throw new Error(`Unexpected URA search form (HTTP ${res.status})`);
	session = {
		cookie: res.headers
			.getSetCookie()
			.map((c) => c.split(";")[0])
			.join("; "),
		csrf,
		latestMonth: `${year}-${month.padStart(2, "0")}`,
	};
	return session;
}

async function post(path: string, fields: [string, string][], retry = true): Promise<Response> {
	const s = await getSession();
	const res = await fetch(`${BASE}/${path}`, {
		method: "POST",
		headers: { ...USER_AGENT, cookie: s.cookie },
		body: new URLSearchParams([...fields, ["_csrf", s.csrf]]),
		redirect: "manual",
	});
	if (res.status >= 300 && res.status < 400) {
		await res.body?.cancel();
		if (!retry) throw new Error(`URA rejected the request (redirect to ${res.headers.get("location")})`);
		session = undefined;
		return post(path, fields, false);
	}
	if (!res.ok) throw new Error(`URA returned HTTP ${res.status}`);
	return res;
}

async function getCatalog(): Promise<Catalog> {
	if (catalog) return catalog;
	const s = await getSession();
	const res = await fetch(`${BASE}/pmiSearchResidentialRentalLocationPopup?locationTypes=Project,PostalDistrict`, {
		headers: { ...USER_AGENT, cookie: s.cookie },
	});
	const html = await res.text();
	const split = html.indexOf('id="postalDistrict"');
	if (split < 0) throw new Error(`Unexpected URA location catalog (HTTP ${res.status})`);
	const projects = new Map<string, string>();
	for (const m of html.slice(0, split).matchAll(/<input type=checkbox value="([^"]+)">/g)) {
		const name = decode(m[1]);
		projects.set(name.toUpperCase(), name);
	}
	const districts = new Map<string, string>();
	for (const m of html.slice(split).matchAll(/<input type=checkbox value="(\d+)">([^<]+)</g)) districts.set(m[1], decode(m[2]));
	catalog = { projects, districts };
	return catalog;
}

export async function resolveProjects(names: string[]): Promise<string[]> {
	const { projects } = await getCatalog();
	return names.map((n) => {
		const exact = projects.get(n.trim().toUpperCase());
		if (exact) return exact;
		const q = n.trim().toUpperCase();
		const suggestions = [...projects.keys()].filter((k) => k.includes(q) || q.includes(k)).slice(0, 10);
		throw new Error(
			`No URA project named "${n}". ` +
				(suggestions.length ? `Closest URA names: ${suggestions.join("; ")}.` : "Only private projects with rental contracts in the last 5 years are listed."),
		);
	});
}

export async function districtLabel(code: string): Promise<string> {
	const label = (await getCatalog()).districts.get(code.slice(1));
	if (!label) throw new Error(`Unknown district ${code}`);
	return label;
}

function parseCsv(text: string): string[][] {
	return text
		.split(/\r?\n/)
		.filter((line) => line.trim())
		.map((line) => [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map((m) => m[1].replace(/^"|"$/g, "").replace(/""/g, '"')));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function leaseMonth(s: string): string | undefined {
	const [mon, yy] = s.split("-");
	const i = MONTHS.indexOf(mon);
	return i < 0 || !yy ? undefined : `20${yy}-${String(i + 1).padStart(2, "0")}`;
}

const num = (s: string) => {
	const n = Number(s.replace(/,/g, ""));
	return Number.isFinite(n) && s.trim() !== "" ? n : undefined;
};

function quantile(sorted: number[], q: number): number {
	const pos = (sorted.length - 1) * q;
	const lo = Math.floor(pos);
	return Math.round(sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (pos - lo));
}

export interface ContractQuery {
	location: [string, ...string[]];
	propertyType?: UraPropertyType;
	from?: string;
	to?: string;
	minBedrooms?: number;
	maxBedrooms?: number;
	minRent?: number;
	maxRent?: number;
}

const STATS_LIMIT = 2000;

export async function rentalContracts(q: ContractQuery) {
	const { latestMonth } = await getSession();
	const to = q.to ?? latestMonth;
	const from = q.from ?? shiftMonth(to, -11);
	const [fy, fm] = from.split("-").map(Number);
	const [ty, tm] = to.split("-").map(Number);
	const str = (n: number | undefined) => (n === undefined ? "" : String(n));

	const base: [string, string][] = [
		["locationDetails", JSON.stringify(q.location)],
		["propertyTypeGroupNo", q.propertyType ? URA_PROPERTY_TYPES[q.propertyType] : ""],
		["contractYearFrom", String(fy)],
		["contractMonthFrom", String(fm)],
		["contractYearTo", String(ty)],
		["contractMonthTo", String(tm)],
		["noofBedroomFrom", str(q.minBedrooms)],
		["noofBedroomTo", str(q.maxBedrooms)],
		["monthlyRentFrom", str(q.minRent)],
		["monthlyRentTo", str(q.maxRent)],
		["resultPerPage", "20"],
		["displayResult", "true"],
		["displayChart", "true"],
		["dashboardDisplay", "false"],
		["sortBy", "9"],
		["sortAsc", "0"],
		["gotoPage", "1"],
	];

	const [list, analysis] = await Promise.all([
		post("pmiResidentialRentalSearch", [...base, ["displayResultHeader", "true"], ["loadAnalysis", "false"], ["displayAnalysis", "false"]]).then((r) =>
			r.text(),
		),
		post("pmiResidentialRentalSearch", [
			...base,
			["displayResultHeader", "0"],
			["loadAnalysis", "0"],
			["displayAnalysis", "1"],
			["displayAnalysisFilters", "0"],
			["variableNo", "2"],
			["dataSet1No", "1"],
		]).then((r) => r.text()),
	]);

	const period = { from, to };
	if (list.includes("has not generated any result")) return { period, totalContracts: 0 };
	const total = num(list.match(/of ([\d,]+) results/)?.[1] ?? "");
	if (total === undefined) throw new Error("Unexpected URA search response");

	const chart = analysis.match(/data-selector="chartData1"[^>]*>([\s\S]*?)<\/script>/)?.[1];
	const medianRentPsf = chart
		? Object.fromEntries(
				((c) => c.labels.map((label: string, i: number) => [label, c.datasets[0].data[i]]))(JSON.parse(chart)),
			)
		: undefined;

	if (total > STATS_LIMIT) {
		return {
			period,
			totalContracts: total,
			medianRentPsf,
			note: `Rent statistics and contract rows are only returned for up to ${STATS_LIMIT} contracts; narrow the period, bedrooms or location.`,
		};
	}

	const csv = await post("pmiSearchResidentialRentalDownload", [
		...base,
		...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i): [string, string] => ["selectColumn", String(i)]),
		["_selectColumn", "1"],
		["downloadType", "downloadCSV"],
	]).then((r) => r.text());

	const contracts = parseCsv(csv)
		.slice(1)
		.map((c) => ({
			project: c[0],
			street: c[1],
			district: c[2] ? `D${c[2]}` : undefined,
			propertyType: c[3],
			bedrooms: num(c[4]),
			monthlyRent: num(c[5]),
			floorAreaSqft: c[7],
			leaseStart: leaseMonth(c[8]),
		}));

	const byBedrooms = new Map<string, number[]>();
	for (const c of contracts) {
		if (c.monthlyRent === undefined) continue;
		const key = c.bedrooms === undefined ? "unknown" : String(c.bedrooms);
		byBedrooms.set(key, [...(byBedrooms.get(key) ?? []), c.monthlyRent]);
	}
	const rentByBedrooms = [...byBedrooms.entries()]
		.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
		.map(([bedrooms, rents]) => {
			rents.sort((a, b) => a - b);
			return {
				bedrooms,
				contracts: rents.length,
				min: rents[0],
				p25: quantile(rents, 0.25),
				median: quantile(rents, 0.5),
				p75: quantile(rents, 0.75),
				max: rents[rents.length - 1],
			};
		});

	return { period, totalContracts: total, medianRentPsf, rentByBedrooms, recentContracts: contracts.slice(0, 20) };
}

function shiftMonth(ym: string, delta: number): string {
	const [y, m] = ym.split("-").map(Number);
	const d = new Date(Date.UTC(y, m - 1 + delta, 1));
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
