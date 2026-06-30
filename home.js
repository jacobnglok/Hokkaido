/* home.js
 * Home page logic:
 * - Currency helper
 * - Flight price tracker
 */

(() => {
  "use strict";

  // -----------------------------
  // Config
  // -----------------------------
  const STORAGE_KEYS = {
    amount: "home_currency_amount",
    from: "home_currency_from",
    to: "home_currency_to"
  };

  // Use your local flight.json file
  const FLIGHT_JSON_URL = "./flight.json";

  // -----------------------------
  // Small helpers
  // -----------------------------
  function qs(selectors) {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function safeNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function money(value, currency = "USD") {
    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency,
        maximumFractionDigits: 2
      }).format(value);
    } catch {
      return `${currency} ${safeNumber(value).toFixed(2)}`;
    }
  }

  // ✅ Hong Kong time formatter (what you asked for)
  function formatHongKongTime(dateInput) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return "Invalid date";

    return new Intl.DateTimeFormat("en-HK", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  }

  // -----------------------------
  // Currency Helper
  // -----------------------------
  const currencyEls = {
    amount: qs(["#currency-amount", "#amount"]),
    from: qs(["#currency-from", "#from-currency"]),
    to: qs(["#currency-to", "#to-currency"]),
    result: qs(["#currency-result", "#converted-result", "#conversion-result"]),
    rate: qs(["#currency-rate", "#rate-info"]),
    swapBtn: qs(["#currency-swap", "#swap-currency"]),
    convertBtn: qs(["#currency-convert", "#convert-btn"])
  };

  async function convertCurrency() {
    if (!currencyEls.amount || !currencyEls.from || !currencyEls.to) return;

    const amount = safeNumber(currencyEls.amount.value, 0);
    const from = currencyEls.from.value;
    const to = currencyEls.to.value;

    if (!from || !to) return;

    // Save user choices
    localStorage.setItem(STORAGE_KEYS.amount, String(amount));
    localStorage.setItem(STORAGE_KEYS.from, from);
    localStorage.setItem(STORAGE_KEYS.to, to);

    if (from === to) {
      if (currencyEls.result) {
        currencyEls.result.textContent = money(amount, to);
      }
      if (currencyEls.rate) {
        currencyEls.rate.textContent = `1 ${from} = 1 ${to}`;
      }
      return;
    }

    try {
      // Free endpoint (no key needed)
      const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
      const data = await res.json();

      if (!data || data.result !== "success" || !data.rates || data.rates[to] == null) {
        throw new Error("Rate data unavailable");
      }

      const rate = Number(data.rates[to]);
      const converted = amount * rate;

      if (currencyEls.result) {
        currencyEls.result.textContent = money(converted, to);
      }
      if (currencyEls.rate) {
        currencyEls.rate.textContent = `1 ${from} = ${rate.toFixed(4)} ${to}`;
      }
    } catch (err) {
      if (currencyEls.result) {
        currencyEls.result.textContent = "Unable to convert right now.";
      }
      if (currencyEls.rate) {
        currencyEls.rate.textContent = "Please try again.";
      }
      console.error("[Currency] conversion failed:", err);
    }
  }

  function restoreCurrencyInputs() {
    if (!currencyEls.amount || !currencyEls.from || !currencyEls.to) return;

    const savedAmount = localStorage.getItem(STORAGE_KEYS.amount);
    const savedFrom = localStorage.getItem(STORAGE_KEYS.from);
    const savedTo = localStorage.getItem(STORAGE_KEYS.to);

    if (savedAmount != null) currencyEls.amount.value = savedAmount;
    if (savedFrom && [...currencyEls.from.options].some(o => o.value === savedFrom)) {
      currencyEls.from.value = savedFrom;
    }
    if (savedTo && [...currencyEls.to.options].some(o => o.value === savedTo)) {
      currencyEls.to.value = savedTo;
    }
  }

  function bindCurrencyEvents() {
    if (currencyEls.convertBtn) {
      currencyEls.convertBtn.addEventListener("click", convertCurrency);
    }

    if (currencyEls.swapBtn && currencyEls.from && currencyEls.to) {
      currencyEls.swapBtn.addEventListener("click", () => {
        const temp = currencyEls.from.value;
        currencyEls.from.value = currencyEls.to.value;
        currencyEls.to.value = temp;
        convertCurrency();
      });
    }

    [currencyEls.amount, currencyEls.from, currencyEls.to].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", convertCurrency);
    });

    if (currencyEls.amount) {
      currencyEls.amount.addEventListener("keyup", (e) => {
        if (e.key === "Enter") convertCurrency();
      });
    }
  }

  // -----------------------------
  // Flight Price Tracker
  // -----------------------------
  const flightEls = {
    status: qs(["#flight-status"]),
    list: qs(["#flight-list", "#flight-container"]),
    lastUpdated: qs(["#last-updated", "#flight-last-updated"])
  };

  function normalizeFlightItems(data) {
    // Supports multiple possible JSON shapes:
    // { flights: [...] } OR { routes: [...] } OR [...]
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.flights)) return data.flights;
    if (Array.isArray(data?.routes)) return data.routes;
    if (Array.isArray(data?.prices)) return data.prices;
    return [];
  }

  function renderFlightList(items) {
    if (!flightEls.list) return;

    if (!items.length) {
      flightEls.list.innerHTML = `<p>No flight data available.</p>`;
      return;
    }

    flightEls.list.innerHTML = items
      .map((item) => {
        const from = item.from || item.origin || "-";
        const to = item.to || item.destination || "-";
        const airline = item.airline || item.carrier || "";
        const date = item.date || item.departureDate || "";
        const price = safeNumber(item.price, NaN);
        const currency = item.currency || "HKD";
        const note = item.note || "";

        const priceText = Number.isFinite(price) ? money(price, currency) : "N/A";
        const route = `${from} → ${to}`;

        return `
          <article class="flight-item">
            <div><strong>${route}</strong>${airline ? ` · ${airline}` : ""}</div>
            <div>${date ? `Date: ${date}` : ""}</div>
            <div>Price: <strong>${priceText}</strong></div>
            ${note ? `<div class="muted">${note}</div>` : ""}
          </article>
        `;
      })
      .join("");
  }

  async function loadFlightData() {
    if (flightEls.status) flightEls.status.textContent = "Loading flight data...";

    try {
      // cache: "no-store" to avoid stale browser cache for latest prices
      const res = await fetch(FLIGHT_JSON_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const items = normalizeFlightItems(data);
      renderFlightList(items);

      // lastUpdated from JSON preferred; fallback to now
      const ts = data?.lastUpdated || new Date().toISOString();
      if (flightEls.lastUpdated) {
        flightEls.lastUpdated.textContent = `Last updated: ${formatHongKongTime(ts)} (HKT)`;
      }

      if (flightEls.status) {
        flightEls.status.textContent = `Loaded ${items.length} flight option${items.length === 1 ? "" : "s"}.`;
      }
    } catch (err) {
      console.error("[Flight] load failed:", err);
      if (flightEls.status) flightEls.status.textContent = "Unable to load flight data.";
      if (flightEls.list) flightEls.list.innerHTML = `<p>Please try again later.</p>`;
    }
  }

  // -----------------------------
  // Init
  // -----------------------------
  document.addEventListener("DOMContentLoaded", () => {
    restoreCurrencyInputs();
    bindCurrencyEvents();

    // auto-run once on page load if currency UI exists
    if (currencyEls.amount && currencyEls.from && currencyEls.to) {
      convertCurrency();
    }

    loadFlightData();
  });
})();
