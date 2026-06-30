// Shared keys (same as your current app)
const STORAGE_KEY = "hokkaido_trip_budget_v1";
const FX_KEY = "hokkaido_trip_fx_v1";
const CHECKLIST_KEY = "hokkaido_trip_checklist_v1";
const NOTES_KEY = "hokkaido_trip_notes_v1";

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function hkd(v) {
  return "HKD " + (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function jpy(v) {
  return "JPY " + Math.round(Number(v) || 0).toLocaleString();
}
function getFxState() {
  return readJSON(FX_KEY, { rate: 20, display: "HKD" });
}
function jpyFromHkd(hkdValue, rate) {
  return (Number(hkdValue) || 0) * (Number(rate) || 20);
}
function displayMoney(hkdValue) {
  const fx = getFxState();
  return fx.display === "JPY" ? jpy(jpyFromHkd(hkdValue, fx.rate)) : hkd(hkdValue);
}

function initBottomNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll(".bottom-nav a").forEach(a => {
    if (a.dataset.page === page) a.classList.add("active");
  });
}
document.addEventListener("DOMContentLoaded", initBottomNav);
