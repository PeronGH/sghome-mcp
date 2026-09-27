import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import {
	AREAS,
	AVAILABILITY,
	DISTRICTS,
	FACILITIES,
	FLOOR_LEVEL,
	FURNISHING,
	HDB_ESTATES,
	keys,
	LEASE_TERM,
	PLACE_TYPES,
	PROPERTY_GROUP,
	PROPERTY_TYPES,
	SORT,
	TENANCY_CONDITIONS,
	UNIT_FEATURES,
} from "./catalog";
import {
	autocomplete,
	compactListing,
	fetchNextData,
	listingDetail,
	listingUrl,
	placeQuery,
	type Query,
	rentalSearchUrl,
} from "./propertyguru";

const readOnly = { readOnlyHint: true, openWorldHint: true } as const;

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });

const placeSchema = z
	.object({
		objectType: z.enum(PLACE_TYPES),
		objectId: z.string(),
		displayText: z.string(),
		latitude: z.number().optional(),
		longitude: z.number().optional(),
	})
	.describe("A `place` object returned by resolve_location, passed through unchanged.");

const searchSchema = z.object({
	districts: z
		.array(z.enum(keys(DISTRICTS)))
		.optional()
		.describe(
			`Postal districts. ${Object.entries(DISTRICTS)
				.map(([k, v]) => `${k} ${v}`)
				.join("; ")}.`,
		),
	hdbEstates: z.array(z.enum(keys(HDB_ESTATES))).optional().describe("HDB estates (a location, independent of propertyGroup)."),
	areas: z.array(z.enum(keys(AREAS))).optional().describe("Planning areas."),
	mrtStations: z
		.array(z.string().regex(/^[A-Z]{2}\d{1,2}$/))
		.optional()
		.describe("MRT/LRT station codes, e.g. EW15, NS22, CC9. Listings near any of the stations."),
	place: placeSchema.optional(),
	radiusKm: z
		.literal([0.5, 1, 1.5, 2, 2.5, 3, 4, 5])
		.optional()
		.describe("Search radius around `place` when it has coordinates (MRT station or school)."),

	unitType: z.enum(["entire", "room"]).optional().describe("Whole unit or room rental. Omit for both."),
	propertyGroup: z.enum(keys(PROPERTY_GROUP)).optional(),
	propertyTypes: z
		.array(z.enum([...PROPERTY_TYPES.condo, ...PROPERTY_TYPES.hdb, ...PROPERTY_TYPES.landed]))
		.optional()
		.describe(
			"Subtypes; must belong to propertyGroup. condo: CONDO, APT (apartment), WALK (walk-up), CLUS (cluster house), EXCON (executive condo). " +
				"hdb: 1R … 5S flat models, 6J (jumbo), EA/EM (executive apt/maisonette), MG (multi-generation), TE (terrace). " +
				"landed: TERRA (terraced), DETAC, SEMI, CORN (corner terrace), LBUNG (bungalow), BUNG (good class bungalow), SHOPH, RLAND (land only), TOWN, CON (conservation), LCLUS (cluster).",
		),
	minPrice: z.number().positive().optional().describe("Minimum monthly rent, SGD."),
	maxPrice: z.number().positive().optional().describe("Maximum monthly rent, SGD."),
	bedrooms: z
		.array(z.number().int().min(0).max(5))
		.optional()
		.describe("Any of these bedroom counts. 0 = studio, 5 = 5 or more. Ignored for room rentals."),
	bathrooms: z.array(z.number().int().min(1).max(5)).optional().describe("Any of these bathroom counts. 5 = 5 or more."),
	minSizeSqft: z.number().positive().optional(),
	maxSizeSqft: z.number().positive().optional(),
	minPsf: z.number().positive().optional().describe("Minimum monthly rent per sqft, SGD."),
	maxPsf: z.number().positive().optional().describe("Maximum monthly rent per sqft, SGD."),
	minBuiltYear: z.number().int().optional(),
	maxBuiltYear: z.number().int().optional(),
	furnishing: z.array(z.enum(keys(FURNISHING))).optional(),
	floorLevel: z.array(z.enum(keys(FLOOR_LEVEL))).optional(),
	leaseTerm: z.array(z.enum(keys(LEASE_TERM))).optional(),
	availability: z.array(z.enum(keys(AVAILABILITY))).optional().describe("When the unit can be moved into."),
	maxDistanceToMrtKm: z
		.literal([0.25, 0.5, 0.75, 1, 1.5])
		.optional(),
	unitFeatures: z.array(z.enum(keys(UNIT_FEATURES))).optional(),
	facilities: z.array(z.enum(keys(FACILITIES))).optional(),
	postedWithinDays: z.literal([3, 7, 14, 31]).optional(),
	verifiedOnly: z.boolean().optional().describe("Only PropertyGuru-verified listings."),
	keyword: z.string().optional().describe("Free-text keyword matched against listing text (not a location)."),
	room: z
		.object({
			roomType: z.array(z.enum(["master", "common", "shared"])).optional().describe("master = private bathroom, common = shared bathroom, shared = shared room."),
			maxTenants: z.array(z.number().int().min(1).max(4)).optional().describe("Max tenants in the room; 4 = 4 or more."),
			tenantGender: z.array(z.enum(["male", "female", "any"])).optional(),
			cooking: z.array(z.enum(["none", "light", "any"])).optional(),
			conditions: z.array(z.enum(keys(TENANCY_CONDITIONS))).optional(),
		})
		.optional()
		.describe("Room-rental filters. Setting this implies unitType=room."),

	sort: z.enum(keys(SORT)).default("recommended"),
	page: z.number().int().min(1).default(1).describe("1-based page; 20 listings per page."),
});

type SearchInput = z.infer<typeof searchSchema>;

function buildQuery(a: SearchInput): Query {
	const q: Query = [["page", a.page]];
	const add = (k: string, v: string | number | boolean | undefined) => v !== undefined && q.push([k, v]);
	const addAll = (k: string, vs: readonly (string | number)[] | undefined) => vs?.forEach((v) => q.push([k, v]));

	addAll("districtCode", a.districts);
	addAll("hdbEstate", a.hdbEstates?.map((n) => HDB_ESTATES[n]));
	addAll("zoneIds", a.areas?.map((n) => AREAS[n]));
	addAll("mrtStations", a.mrtStations);
	if (a.place) q.push(...placeQuery(a.place, a.radiusKm));

	const room = a.unitType === "room" || a.room !== undefined;
	add("entireUnitOrRoom", room ? "room" : a.unitType === "entire" ? "ent" : undefined);
	add("propertyTypeGroup", a.propertyGroup && PROPERTY_GROUP[a.propertyGroup]);
	addAll("propertyTypeCode", a.propertyTypes);
	add("minPrice", a.minPrice);
	add("maxPrice", a.maxPrice);
	if (!room) addAll("bedrooms", a.bedrooms);
	addAll("bathrooms", a.bathrooms);
	add("minSize", a.minSizeSqft);
	add("maxSize", a.maxSizeSqft);
	add("minPricePerArea", a.minPsf);
	add("maxPricePerArea", a.maxPsf);
	add("minTopYear", a.minBuiltYear);
	add("maxTopYear", a.maxBuiltYear);
	addAll("furnishing", a.furnishing?.map((v) => FURNISHING[v]));
	addAll("floorLevel", a.floorLevel?.map((v) => FLOOR_LEVEL[v]));
	addAll("leaseTerm", a.leaseTerm?.map((v) => LEASE_TERM[v]));
	addAll("availability", a.availability?.map((v) => AVAILABILITY[v]));
	add("distanceToMRT", a.maxDistanceToMrtKm);
	addAll("unitFeatures", a.unitFeatures?.map((v) => UNIT_FEATURES[v]));
	addAll("projectFeatures", a.facilities?.map((v) => FACILITIES[v]));
	add("lastPosted", a.postedWithinDays);
	if (a.verifiedOnly) add("isVerified", true);
	add("keyword", a.keyword);
	if (room && a.room) {
		addAll("roomType", a.room.roomType);
		addAll("maxTenants", a.room.maxTenants);
		addAll("tenantGender", a.room.tenantGender);
		addAll("cookingType", a.room.cooking);
		addAll("tenancyConditions", a.room.conditions?.map((v) => TENANCY_CONDITIONS[v]));
	}
	const sort = SORT[a.sort];
	if (sort) q.push(["sort", sort[0]], ["order", sort[1]]);
	return q;
}

function createServer() {
	const server = new McpServer({ name: "sghome", version: "0.1.0" });

	server.registerTool(
		"resolve_location",
		{
			title: "Resolve location",
			description:
				"Look up Singapore locations on PropertyGuru (MRT stations, schools, condos/HDB blocks, streets, districts, estates, neighbourhoods). " +
				"The same name can match several kinds of place, so pick the candidate whose type fits the user's intent and pass its `place` object to search_rentals. " +
				"Not needed for districts, HDB estates, planning areas or MRT station codes, which search_rentals accepts directly.",
			inputSchema: z.object({
				query: z.string().min(1).describe("Place name; typo-tolerant."),
				types: z.array(z.enum(PLACE_TYPES)).min(1).default([...PLACE_TYPES]).describe("Restrict to these place kinds."),
				limit: z.number().int().min(1).max(20).default(10),
			}),
			annotations: readOnly,
		},
		async ({ query, types, limit }) => json(await autocomplete(query, types, limit)),
	);

	server.registerTool(
		"search_rentals",
		{
			title: "Search rentals",
			description:
				"Search residential rental listings on PropertyGuru Singapore. Returns 20 listings per page with the total count and a link to the same search on propertyguru.com.sg. " +
				"Use one location selector (districts, hdbEstates, areas, mrtStations or place); omit all for island-wide. Multi-value filters match any of the values. Use get_listing for full details and the lister's phone/WhatsApp.",
			inputSchema: searchSchema,
			annotations: readOnly,
		},
		async (args) => {
			const url = rentalSearchUrl(buildQuery(args));
			const pageData = (await fetchNextData(url)).props.pageProps.pageData;
			const { locale, ...appliedFilters } = pageData.searchParams;
			const pagination = pageData.data.paginationData;
			return json({
				searchUrl: url,
				totalResults: pageData.resultCount,
				page: pagination?.currentPage ?? args.page,
				totalPages: pagination?.totalPages,
				appliedFilters,
				listings: pageData.data.listingsData.flatMap((x: any) => (x.listingData ? [compactListing(x.listingData)] : [])),
			});
		},
	);

	server.registerTool(
		"get_listing",
		{
			title: "Get listing",
			description:
				"Get full details of one PropertyGuru listing: description, unit details and tenancy rules, facilities, project info, nearby MRT stations and schools, photos and floor plans, " +
				"and the lister's contact (name, phone, WhatsApp link with a prefilled enquiry, CEA licence, agency). Share the contact with the user when they want to enquire or view.",
			inputSchema: z.object({
				listingId: z.number().int().positive().describe("Listing `id` from search_rentals, or the number at the end of a listing URL."),
			}),
			annotations: readOnly,
		},
		async ({ listingId }) => json(listingDetail((await fetchNextData(listingUrl(listingId))).props.pageProps.pageData.data)),
	);

	return server;
}

const handler = createMcpHandler(createServer);

export default {
	fetch(request, env, ctx) {
		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
