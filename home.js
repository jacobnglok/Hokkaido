/* home.js
   Home page only logic (works with common.js storage schema)
*/
(() => {
  "use strict";

  const STORAGE = {
    DISPLAY_CURRENCY: "trip.displayCurrency", // HKD | JPY
    EXCHANGE_RATE: "trip.exchangeRate",       // 1 HKD = ? JPY
    AGENDA_STATE: "trip.agendaState",
    BUDGET_STATE: "trip.budgetState",
    FLIGHT_STATE: "trip.flightState"
  };

  const DEFAULTS = {
    displayCurrency: "HKD",
    exchangeRate: 19.5,
    tripStart: "2026-12-15"
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const safeJSONParse = (txt, fallback = null) => {
    try { return JSON.parse(txt); } catch { return fallback; }
  };

  const getLS = (key, fallback = null) => {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : safeJSONParse(raw, fallback);
  };

  const parseNum = (v, fallback = 0) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
    if (v == null) return fallback;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : fallback;
  };

  const getDisplayCurrency = () => {
    const c = String(getLS(STORAGE.DISPLAY_CURRENCY, DEFAULTS.displayCurrency) || "HKD").toUpperCase();
    return c === "JPY" ? "JPY" : "HKD";
  };

  const getExchangeRate = () => {
    const n = parseNum(getLS(STORAGE.EXCHANGE_RATE, DEFAULTS.exchangeRate), DEFAULTS.exchangeRate);
    return n > 0 ? n : DEFAULTS.exchangeRate;
  };

  const formatMoneyFromHKD = (amountHKD, currency = getDisplayCurrency()) => {
    const rate = getExchangeRate();
    const amount = currency === "JPY" ? amountHKD * rate : amountHKD;
    return new Intl.NumberFormat(currency === "JPY" ? "ja-JP" : "en-HK", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2
    }).format(amount || 0);
  };

  const setBoundText = (bindKey, value) => {
    const byId = document.getElementById(bindKey);
    if (byId) byId.textContent = value;
    $$(`[data-bind="${bindKey}"]`).forEach(el => { el.textContent = value; });
  };

  // --- KPI calculations ---

  const calcBudgetTotals = () => {
    // common.js persists as key -> number(HKD)
    // Try to separate budget vs actual using key names:
    // budget keys: starts with b_, includes "budget"
    // actual keys: starts with a_, includes "actual"
    const state = getLS(STORAGE.BUDGET_STATE, {}) || {};
    let totalBudget = 0;
    let totalActual = 0;

    Object.entries(state).forEach(([k, v]) => {
      const val = parseNum(v, 0);
      const key = String(k).toLowerCase();

      const isBudget = key.startsWith("b_") || key.includes("budget");
      const isActual = key.startsWith("a_") || key.includes("actual");

      if (isBudget && !isActual) totalBudget += val;
      else if (isActual && !isBudget) totalActual += val;
      else {
        // unknown key: ignore from split totals
      }
    });

    return { totalBudget, totalActual };
  };

  const calcAgendaProgress = () => {
    const state = getLS(STORAGE.AGENDA_STATE, {}) || {};

    // same template sizes as common.js default checklist
    const dayItemCount = { 1: 4, 2: 4, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 };

    let totalItems = 0;
    let checkedItems = 0;

    for (let d = 1; d <= 7; d++) {
      totalItems += dayItemCount[d] || 0;
      const day = state[String(d)];
      const checked = Array.isArray(day?.checked) ? day.checked.length : 0;
      checkedItems += checked;
    }

    const pct = totalItems ? Math.round((checkedItems / totalItems) * 100) : 0;
    return { checkedItems, totalItems, pct };
  };

  const calcCountdown = () => {
    const target = new Date(DEFAULTS.tripStart + "T00:00:00");
    if (Number.isNaN(target.getTime())) return "--";
    const now = new Date();
    const ms = target.getTime() - now.getTime();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} days`;
    if (days === 0) return "Today";
    return "Started";
  };

  const renderRecentAgendaLinks = () => {
    const box = $("#recentLinksPreview");
    if (!box) return;

    const agenda = getLS(STORAGE.AGENDA_STATE, {}) || {};
    const urls = [];

    for (let d = 1; d <= 7; d++) {
      const raw = String(agenda[String(d)]?.links || "");
      raw.split("\n").map(s => s.trim()).filter(Boolean).forEach(u => {
        urls.push({ day: d, url: u });
      });
    }

    box.innerHTML = "";
    if (!urls.length) {
      box.textContent = "No links yet.";
      return;
    }

    urls.slice(0, 6).forEach(item => {
      let href = item.url;
      if (!/^https?:\/\//i.test(href)) href = `https://${href}`;

      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `Day ${item.day}: ${item.url}`;
      box.appendChild(a);
    });
  };

  const renderHome = () => {
    const currency = getDisplayCurrency();
    const rate = getExchangeRate();

    const { totalBudget, totalActual } = calcBudgetTotals();
    const remaining = totalBudget - totalActual;

    const agenda = calcAgendaProgress();
    const flight = getLS(STORAGE.FLIGHT_STATE, {}) || {};
    const flightPriceHKD = parseNum(flight.priceHKD, NaN);

    setBoundText("kpiCurrency", currency);
    setBoundText("kpiRate", `1 HKD = ${rate} JPY`);

    setBoundText("kpiBudget", formatMoneyFromHKD(totalBudget, currency));
    setBoundText("kpiActual", formatMoneyFromHKD(totalActual, currency));
    setBoundText("kpiRemaining", formatMoneyFromHKD(Math.abs(remaining), currency));
    setBoundText("kpiRemainingLabel", remaining >= 0 ? "Remaining" : "Over Budget");

    setBoundText("kpiAgendaProgress", `${agenda.checkedItems}/${agenda.totalItems} (${agenda.pct}%)`);

    setBoundText(
      "kpiFlightPrice",
      Number.isFinite(flightPriceHKD) ? formatMoneyFromHKD(flightPriceHKD, currency) : "--"
    );

    setBoundText("kpiTripCountdown", calcCountdown());

    renderRecentAgendaLinks();
  };

  document.addEventListener("DOMContentLoaded", renderHome);
  document.addEventListener("trip:currencyChanged", renderHome);
  window.addEventListener("storage", (e) => {
    if (Object.values(STORAGE).includes(e.key)) renderHome();
  });
})();

