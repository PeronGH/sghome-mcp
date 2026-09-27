import { PLACE_TYPES } from "./catalog";

const SITE = "https://www.propertyguru.com.sg";
const AUTOCOMPLETE = "https://autocomplete.propertyguru.com/v1/search";

export type PlaceType = (typeof PLACE_TYPES)[number];

export interface Place {
	objectType: PlaceType;
	objectId: string;
	displayText: string;
	latitude?: number;
	longitude?: number;
}

export type Query = [string, string | number | boolean][];

interface AutocompleteItem {
	objectId: string;
	objectType: string;
	displayText: string;
	displayType?: string;
	displayDescription?: string | null;
	properties?: { latitude?: number; longitude?: number; district?: string } | null;
	stationCode?: string;
}

export async function autocomplete(query: string, types: readonly PlaceType[], limit: number) {
	const params = new URLSearchParams({ marketplace: "pgsg", locale: "en", limit: String(limit), query });
	params.append("property_type_group_exclude[0]", "COMMERCIAL");
	params.append("property_type_group_exclude[1]", "OTHER");
	types.forEach((t, i) => params.append(`object_type[${i}]`, t));

	const res = await fetch(`${AUTOCOMPLETE}?${params}`);
	if (!res.ok) throw new Error(`PropertyGuru autocomplete returned HTTP ${res.status}`);
	const items = (await res.json()) as AutocompleteItem[];

	return items.map((x) => {
		const place: Place = {
			objectType: x.objectType as PlaceType,
			objectId: x.objectId,
			displayText: x.displayText,
			latitude: x.properties?.latitude,
			longitude: x.properties?.longitude,
		};
		return {
			place,
			type: x.displayType,
			description: x.displayDescription ?? undefined,
			district: x.properties?.district,
			stationCode: x.stationCode,
		};
	});
}

export function placeQuery(place: Place, radiusKm?: number): Query {
	const q: Query = [["_freetextDisplay", place.displayText]];
	const id = place.objectId;
	switch (place.objectType) {
		case "MRT_STATION":
			q.push(["poiId", parseInt(id, 10)]);
			break;
		case "SCHOOL":
			q.push(["school", Number(id)]);
			break;
		case "DISTRICT":
			q.push(["districtCode", id]);
			break;
		case "HDB_ESTATE":
			q.push(["hdbEstate", id]);
			break;
		case "NEIGHBOURHOOD":
			q.push(["zoneIds", id]);
			break;
		case "SUBNEIGHBOURHOOD":
			q.push(["subZoneIds", id]);
			break;
		case "PROPERTY":
			q.push(["propertyId", id]);
			break;
		case "STREET":
			q.push(["street", Number(id)], ["freetext", place.displayText]);
			break;
	}
	if (place.latitude !== undefined && place.longitude !== undefined) {
		q.push(["centerLatitude", place.latitude], ["centerLongitude", place.longitude]);
		if (radiusKm !== undefined) q.push(["distanceFromCentre", radiusKm]);
	}
	return q;
}

export function rentalSearchUrl(query: Query): string {
	const params = new URLSearchParams({ listingType: "rent", isCommercial: "false" });
	for (const [k, v] of query) params.append(k, String(v));
	return `${SITE}/property-for-rent?${params}`;
}

export function listingUrl(id: number): string {
	return `${SITE}/listing/${id}`;
}

const KITESURF = "https://kitesurf.dev/html";

// PropertyGuru challenges direct requests from Workers, so pages are fetched through Kitesurf.
// Blocking scripts and assets returns the server-rendered HTML untouched by hydration, and quickly.
export async function fetchNextData(url: string): Promise<any> {
	const res = await fetch(KITESURF, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			url,
			gotoOptions: { waitUntil: "domcontentloaded" },
			rejectResourceTypes: ["script", "image", "stylesheet", "font", "media", "xhr", "fetch"],
		}),
	});
	const chunks: string[] = [];
	await new HTMLRewriter()
		.on("script#__NEXT_DATA__", {
			text(t) {
				chunks.push(t.text);
			},
		})
		.transform(res)
		.body!.pipeTo(new WritableStream());
	// Kitesurf answers 200 for any loaded page, so a missing listing shows up only as absent page data.
	if (chunks.length === 0) throw new Error(`No page data for ${url} (Kitesurf HTTP ${res.status}); the page may not exist`);
	return JSON.parse(chunks.join(""));
}

export function compactListing(l: any) {
	const badge = (name: string) => l.badges?.find((b: any) => b.name === name)?.text as string | undefined;
	return {
		id: l.id,
		title: l.localizedTitle,
		url: l.url,
		price: l.price?.value,
		priceText: l.price?.pretty,
		priceQualifier: l.price?.type?.text ?? undefined,
		bedrooms: l.bedrooms,
		bathrooms: l.bathrooms,
		floorAreaSqft: l.floorArea,
		psf: l.pricePerArea?.localeStringValue,
		propertyType: l.property?.subTypeText,
		address: l.fullAddress,
		district: l.additionalData?.districtCode || undefined,
		tenure: l.additionalData?.tenure || undefined,
		builtYear: badge("launch")?.replace(/^Built:\s*/, ""),
		mrt: l.mrt?.nearbyText,
		availability: l.availabilityInfo || undefined,
		postedOn: l.postedOn?.text,
		verified: l.isVerified,
		agent: l.agent?.name,
		agency: l.agency?.name,
	};
}

export function listingDetail(data: any) {
	const d = data.listingDetail;
	const u = d.unitDetails ?? {};
	const project = d.project?.metaByType?.verified;
	const card = data.contactAgentData?.contactAgentCard;
	const lister = card?.agentInfoProps?.agent;
	const phone: string | undefined = lister?.mobile || undefined;
	const whatsappHref: string | undefined = card?.contactActions?.find((a: any) => a.type === "whatsapp")?.href;
	const sqft = (size: any[] | undefined) => size?.find((s) => s.uom === "sqft")?.value;
	const photo = (m: any) => m.urlTemplate.replace("${viewType}", "V800");
	return {
		id: d.id,
		url: d.urls?.listing?.desktop,
		status: d.statusCode,
		title: d.title?.en,
		headline: d.headlines?.[0]?.text,
		price: d.price?.min,
		priceText: d.price?.formatted,
		priceQualifier: d.price?.type?.text ?? undefined,
		psf: d.price?.perArea?.floor?.[0]?.text,
		propertyType: data.listingData?.propertyType,
		rentalType: u.rentalType?.description,
		bedrooms: u.configuration?.bedrooms?.value ?? undefined,
		bathrooms: u.configuration?.bathrooms?.value ?? undefined,
		floorAreaSqft: sqft(u.dimensions?.floor?.size),
		roomSizeSqft: sqft(u.dimensions?.room?.size),
		address: d.location?.address?.formatted,
		postalCode: d.location?.address?.postalCode ?? undefined,
		district: data.listingData?.districtCode || undefined,
		coordinates: d.location?.point && { lat: d.location.point.lat, lng: d.location.point.lon },
		details: data.detailsData?.metatable?.items?.map((i: any) => i.value),
		description: d.descriptions?.[0]?.text,
		facilities: data.facilitiesData?.data?.map((f: any) => f.text.trim()),
		project: project && {
			name: project.name,
			completionYear: project.completionYear ?? undefined,
			totalUnits: project.totalUnits ?? undefined,
			floors: project.floors ?? undefined,
		},
		nearbyMrt: d.pointOfInterest?.mrt?.map((m: any) => ({
			name: m.name,
			walkingDistanceKm: m.walkingDistanceKm,
			walkingMins: m.walkingDurationMins,
		})),
		nearbySchools: d.pointOfInterest?.schools?.slice(0, 5).map((s: any) => ({
			name: s.name,
			type: s.subcategory,
			walkingDistanceKm: s.walkingDistanceKm,
		})),
		firstPosted: d.dates?.firstPosted?.date,
		lastPosted: d.dates?.lastPosted?.date,
		contact: lister && {
			name: lister.name,
			listerType: d.lister?.type,
			phone,
			whatsappUrl: phone && whatsappHref?.replace("{{phone}}", phone.replace(/\D/g, "")),
			license: d.lister?.metaByType?.agent?.license,
			agency: d.organization?.name ?? card.agency?.name,
			profileUrl: lister.profileUrl && new URL(lister.profileUrl.split("#")[0], SITE).href,
		},
		photos: d.media?.listingImages?.map((m: any) => ({ url: photo(m), caption: m.caption ?? undefined })),
		floorPlans: d.media?.listingFloorPlans?.map(photo),
	};
}
