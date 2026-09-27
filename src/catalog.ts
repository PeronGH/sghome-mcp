export const DISTRICTS = {
	D01: "Boat Quay / Raffles Place / Marina",
	D02: "Chinatown / Tanjong Pagar",
	D03: "Alexandra / Commonwealth",
	D04: "Harbourfront / Telok Blangah",
	D05: "Buona Vista / West Coast / Clementi New Town",
	D06: "City Hall / Clarke Quay",
	D07: "Beach Road / Bugis / Rochor",
	D08: "Farrer Park / Serangoon Rd",
	D09: "Orchard / River Valley",
	D10: "Tanglin / Holland / Bukit Timah",
	D11: "Newton / Novena",
	D12: "Balestier / Toa Payoh",
	D13: "Macpherson / Potong Pasir",
	D14: "Eunos / Geylang / Paya Lebar",
	D15: "East Coast / Marine Parade",
	D16: "Bedok / Upper East Coast",
	D17: "Changi Airport / Changi Village",
	D18: "Pasir Ris / Tampines",
	D19: "Hougang / Punggol / Sengkang",
	D20: "Ang Mo Kio / Bishan / Thomson",
	D21: "Clementi Park / Upper Bukit Timah",
	D22: "Boon Lay / Jurong / Tuas",
	D23: "Dairy Farm / Bukit Panjang / Choa Chu Kang",
	D24: "Lim Chu Kang / Tengah",
	D25: "Admiralty / Woodlands",
	D26: "Mandai / Upper Thomson",
	D27: "Sembawang / Yishun",
	D28: "Seletar / Yio Chu Kang",
} as const;

export const HDB_ESTATES = {
	"Ang Mo Kio": 1,
	Bedok: 2,
	Bishan: 3,
	"Bukit Batok": 4,
	"Bukit Merah": 5,
	"Bukit Panjang": 6,
	"Bukit Timah": 7,
	"Central Area": 8,
	"Choa Chu Kang": 9,
	Clementi: 10,
	Geylang: 11,
	Hougang: 12,
	"Jurong East": 13,
	"Jurong West": 14,
	"Kallang/Whampoa": 15,
	"Marine Parade": 17,
	"Pasir Ris": 18,
	Punggol: 19,
	Queenstown: 20,
	Sembawang: 21,
	Sengkang: 22,
	Serangoon: 23,
	Tampines: 24,
	Tengah: 28,
	"Toa Payoh": 25,
	Woodlands: 26,
	Yishun: 27,
} as const;

export const AREAS = {
	"Ang Mo Kio": 40052,
	Bedok: 40001,
	Bishan: 40051,
	"Bukit Batok": 40003,
	"Bukit Merah": 40004,
	"Bukit Panjang": 40005,
	"Bukit Timah": 40006,
	"Choa Chu Kang": 40009,
	Clementi: 40010,
	"Downtown Core": 40040,
	Geylang: 40053,
	Hillview: 41188,
	Hougang: 40011,
	"Jurong East": 40012,
	"Jurong West": 40013,
	Kallang: 40022,
	Katong: 41072,
	Kovan: 41162,
	"Marine Parade": 40039,
	Museum: 40043,
	Newton: 40044,
	Novena: 40025,
	Orchard: 40045,
	Outram: 40046,
	"Pasir Ris": 40014,
	Punggol: 40016,
	Queenstown: 40017,
	"River Valley": 40034,
	"Robertson Quay": 41015,
	Rochor: 40035,
	Sembawang: 40019,
	Sengkang: 40020,
	Sentosa: 41031,
	Serangoon: 40021,
	Simei: 41196,
	"Singapore River": 40036,
	Tampines: 40047,
	Tanglin: 40048,
	Tengah: 40049,
	"Tiong Bahru": 41007,
	"Toa Payoh": 40029,
	Woodlands: 40033,
	Yishun: 40055,
} as const;

export const PROPERTY_TYPES = {
	condo: ["CONDO", "APT", "WALK", "CLUS", "EXCON"],
	hdb: [
		"1R", "2A", "2I", "2S", "2RF", "3A", "3NG", "3Am", "3NGm", "3I", "3Im", "3S", "3STD", "3PA",
		"4A", "4NG", "4PA", "4I", "4S", "4STD", "5A", "5I", "5PA", "5S", "6J", "EA", "EM", "MG", "TE",
	],
	landed: ["TERRA", "DETAC", "SEMI", "CORN", "LBUNG", "BUNG", "SHOPH", "RLAND", "TOWN", "CON", "LCLUS"],
} as const;

export const PROPERTY_GROUP = { condo: "N", landed: "L", hdb: "H" } as const;

export const FURNISHING = { unfurnished: "UNFUR", partial: "PART", full: "FULL" } as const;

export const FLOOR_LEVEL = { ground: "GND", low: "LOW", mid: "MID", high: "HIGH", penthouse: "PENT" } as const;

export const LEASE_TERM = { "1y": "1YR", "2y": "2YR", "3y_plus": "3YR", short_term: "ST", flexible: "FL" } as const;

export const AVAILABILITY = {
	immediate: 0,
	within_1_month: 1,
	"1_2_months": 2,
	"2_3_months": 3,
	after_3_months: 4,
} as const;

export const UNIT_FEATURES = {
	aircon: "AIRC",
	balcony: "BAL",
	bathtub: "BATH",
	corner_unit: "CORN",
	helper_room: "MAID",
	private_pool: "PPOOL",
	renovated: "RENO",
	terrace: "TERR",
} as const;

export const FACILITIES = { gym: "GYM", parking: "PARK", swimming_pool: "SWIM", tennis_court: "TEN" } as const;

export const TENANCY_CONDITIONS = {
	aircon: "hasAircon",
	no_owner_staying: "ownerStays",
	pets_allowed: "allowPets",
	utilities_included: "hasUtilities",
	visitors_allowed: "allowVisitors",
	wifi: "hasWifi",
} as const;

export const SORT = {
	recommended: undefined,
	newest: ["date", "desc"],
	price_asc: ["price", "asc"],
	price_desc: ["price", "desc"],
	psf_asc: ["psf", "asc"],
	psf_desc: ["psf", "desc"],
	size_asc: ["size", "asc"],
	size_desc: ["size", "desc"],
} as const;

export const PLACE_TYPES = [
	"MRT_STATION",
	"SCHOOL",
	"DISTRICT",
	"HDB_ESTATE",
	"NEIGHBOURHOOD",
	"SUBNEIGHBOURHOOD",
	"PROPERTY",
	"STREET",
] as const;

export const keys = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
