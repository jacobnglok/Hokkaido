import { writeFile } from "fs/promises";

const apiKey = process.env.SERPAPI_KEY;
if (!apiKey) throw new Error("Missing SERPAPI_KEY");

const params = new URLSearchParams({
  engine: "google_flights",
  departure_id: "HKG",
  arrival_id: "CTS",
  outbound_date: "2026-12-15",
  return_date: "2026-12-21",
  currency: "HKD",
  hl: "en",
  gl: "hk",
  stops: "0",              // nonstop only
  include_airlines: "HB",  // Greater Bay Airlines
  api_key: apiKey
});

const url = `https://serpapi.com/search.json?${params.toString()}`;
console.log("Fetching:", url.replace(apiKey, "***"));

const res = await fetch(url);
const data = await res.json().catch(() => ({}));

if (!res.ok) {
  throw new Error(`SerpAPI HTTP ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
}
if (data?.error) {
  throw new Error(`SerpAPI error: ${data.error}`);
}

const parsePrice = (v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// Extra safety filter in code
const all = [...(data?.best_flights ?? []), ...(data?.other_flights ?? [])];

const isDirect = (it) => (it?.layovers?.length ?? 0) === 0;
const isGBA = (it) =>
  (it?.flights ?? []).every((seg) => {
    const code = (seg?.airline_code || seg?.airline_iata || "").toUpperCase();
    const name = (seg?.airline || "").toLowerCase();
    return code === "HB" || name.includes("greater bay");
  });

const matches = all.filter((it) => isDirect(it) && isGBA(it));

let price = null;
for (const it of matches) {
  price = parsePrice(it?.price);
  if (price != null) break;
}

if (price == null) {
  console.log("No direct Greater Bay result found.");
  throw new Error("No direct Greater Bay Airlines price found in API response");
}

const output = {
  priceHKD: price,
  lastUpdated: new Date().toISOString(),
  source: "Google Flights via SerpAPI",
  airline: "Greater Bay Airlines (HB)",
  directOnly: true
};

await writeFile("flight.json", JSON.stringify(output, null, 2), "utf-8");
console.log("flight.json updated:", output);
