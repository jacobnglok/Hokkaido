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

const candidates = [
  data?.best_flights?.[0]?.price,
  data?.other_flights?.[0]?.price,
  data?.price_insights?.lowest_price,
  data?.price_insights?.price
];

let price = null;
for (const c of candidates) {
  price = parsePrice(c);
  if (price != null) break;
}

if (price == null) {
  console.log("No price found. Top-level keys:", Object.keys(data || {}));
  console.log("best_flights length:", data?.best_flights?.length ?? 0);
  console.log("other_flights length:", data?.other_flights?.length ?? 0);
  console.log("price_insights:", data?.price_insights ?? null);
  throw new Error("No price found in API response");
}

const output = {
  priceHKD: price,
  updatedAt: new Date().toISOString(),
  source: "Google Flights via SerpAPI"
};

await writeFile("flight.json", JSON.stringify(output, null, 2), "utf-8");
console.log("flight.json updated:", output);
