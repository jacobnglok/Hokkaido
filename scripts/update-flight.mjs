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

const normalizeFlightNo = (seg) => {
  // Handles formats like "880", "HB880", or separate airline_code + flight_number
  const code = String(seg?.airline_code || seg?.airline_iata || "").toUpperCase();
  const rawNo = String(seg?.flight_number || "").toUpperCase().replace(/\s+/g, "");
  if (!rawNo) return "";
  return rawNo.startsWith(code) ? rawNo : `${code}${rawNo}`;
};

const getOutboundSegments = (it) =>
  it?.flights || it?.departure_flights || it?.outbound_flights || [];

const getReturnSegments = (it) =>
  it?.return_flights || it?.return || [];

const isDirectLeg = (segments) => Array.isArray(segments) && segments.length === 1;

const isRoute = (seg, from, to) => {
  const dep = (seg?.departure_airport?.id || seg?.departure_airport || "").toUpperCase();
  const arr = (seg?.arrival_airport?.id || seg?.arrival_airport || "").toUpperCase();
  return dep === from && arr === to;
};

const isHBFlight = (seg, exactNo) => {
  const airlineCode = (seg?.airline_code || seg?.airline_iata || "").toUpperCase();
  const airlineName = (seg?.airline || "").toLowerCase();
  const normalized = normalizeFlightNo(seg); // e.g. "HB880"
  return (airlineCode === "HB" || airlineName.includes("greater bay")) && normalized === exactNo;
};

const all = [...(data?.best_flights ?? []), ...(data?.other_flights ?? [])];

const exactMatches = all.filter((it) => {
  const outSegs = getOutboundSegments(it);
  const retSegs = getReturnSegments(it);

  if (!isDirectLeg(outSegs) || !isDirectLeg(retSegs)) return false;

  const out = outSegs[0];
  const ret = retSegs[0];

  const outboundOk =
    isRoute(out, "HKG", "CTS") &&
    isHBFlight(out, "HB880");

  const returnOk =
    isRoute(ret, "CTS", "HKG") &&
    isHBFlight(ret, "HB881");

  return outboundOk && returnOk;
});

let price = null;
for (const it of exactMatches) {
  price = parsePrice(it?.price);
  if (price != null) break;
}

if (price == null) {
  console.log("No exact HB880/HB881 round-trip found.");
  console.log("best_flights:", data?.best_flights?.length ?? 0);
  console.log("other_flights:", data?.other_flights?.length ?? 0);
  throw new Error("No matching HB880 outbound + HB881 return fare found");
}

const
