# sghome-mcp

A stateless [MCP](https://modelcontextprotocol.io/) server on Cloudflare Workers for searching Singapore residential rentals on [PropertyGuru](https://www.propertyguru.com.sg/property-for-rent).

Search and listing pages are fetched through [Kitesurf](https://kitesurf.dev) (Cloudflare's headless browser), because PropertyGuru challenges direct requests from Workers. Location lookup calls PropertyGuru's autocomplete API directly.

## Tools

| Tool | Purpose |
| --- | --- |
| `resolve_location` | Look up MRT stations, schools, condos/HDB blocks, streets, districts, estates and neighbourhoods; returns a `place` to search around. |
| `search_rentals` | Search rental listings by location, unit or room type, price, bedrooms, size, furnishing, availability, lease term, MRT distance and more. 20 results per page. |
| `get_listing` | Full details of one listing: description, tenancy rules, facilities, nearby MRT/schools, captioned photos, floor plans, and the lister's phone and WhatsApp link. |

## Usage

```sh
bun install
bunx wrangler dev      # http://localhost:8787/mcp
bunx wrangler deploy   # https://sghome.<your-subdomain>.workers.dev/mcp
```

Connect any MCP client that supports Streamable HTTP to the `/mcp` endpoint, for example the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```sh
bunx @modelcontextprotocol/inspector
```

## Example

Ask your agent:

> Find 2–3 bedroom condos for rent within 1 km of Tanjong Pagar MRT, S$4,000–7,000 a month, cheapest first, and show me the contact for the best one.

The agent calls `resolve_location` for "Tanjong Pagar", passes the MRT station's `place` to `search_rentals` with `radiusKm: 1`, `bedrooms: [2, 3]`, `minPrice: 4000`, `maxPrice: 7000` and `sort: "price_asc"`, then calls `get_listing` on the chosen result.
