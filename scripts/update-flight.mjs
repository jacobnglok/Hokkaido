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
const res = await fetch(url);
if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);

const data = await res.json();

// Try to find a price safely
const getPrice = (obj) => {
  if (!obj) return null;
  if (typeof obj.price === "number") return obj.price;
  if (typeof obj.price === "string") {
    const n = Number(obj.price.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

let price =
  getPrice(data?.best_flights?.[0]) ??
  getPrice(data?.other_flights?.[0]) ??
  null;

if (price == null) throw new Error("No price found in API response");

const output = {
  priceHKD: price,
  updatedAt: new Date().toISOString(),
  source: "Google Flights via SerpAPI"
};

await writeFile("flight.json", JSON.stringify(output, null, 2), "utf-8");
console.log("flight.json updated:", output);
