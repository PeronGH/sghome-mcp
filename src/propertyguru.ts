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

export async function fetchNextData(url: string): Promise<any> {
	// Cloudflare challenges paginated/sorted searches that arrive without an on-site Referer.
	const res = await fetch(url, { headers: { Referer: `${SITE}/` } });
	const chunks: string[] = [];
	await new HTMLRewriter()
		.on("script#__NEXT_DATA__", {
			text(t) {
				chunks.push(t.text);
			},
		})
		.transform(res)
		.body!.pipeTo(new WritableStream());
	if (chunks.length === 0) throw new Error(`No page data in PropertyGuru response (HTTP ${res.status}) for ${url}`);
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
