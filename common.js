/* common.js
   Shared logic for:
   - index.html (Home)
   - agenda.html
   - budget.html
*/

(() => {
  "use strict";

  // ===============================
  // Config / Storage Keys
  // ===============================
  const STORAGE = {
    DISPLAY_CURRENCY: "trip.displayCurrency", // HKD | JPY
    EXCHANGE_RATE: "trip.exchangeRate", // 1 HKD = ? JPY
    AGENDA_STATE: "trip.agendaState",
    BUDGET_STATE: "trip.budgetState",
    FLIGHT_STATE: "trip.flightState"
  };

  const DEFAULTS = {
    displayCurrency: "HKD",
    exchangeRate: 19.5, // fallback
    days: [1, 2, 3, 4, 5, 6, 7]
  };

  // ===============================
  // Helpers
  // ===============================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const safeJSONParse = (txt, fallback = null) => {
    try {
      return JSON.parse(txt);
    } catch {
      return fallback;
    }
  };

  const getLS = (key, fallback = null) => {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return safeJSONParse(raw, fallback);
  };

  const setLS = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const clampNumber = (n, min = -Infinity, max = Infinity) =>
    Math.min(Math.max(n, min), max);

  const parseNum = (v, fallback = 0) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
    if (v == null) return fallback;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : fallback;
  };

  const getDisplayCurrency = () =>
    (getLS(STORAGE.DISPLAY_CURRENCY, DEFAULTS.displayCurrency) || "HKD").toUpperCase() === "JPY"
      ? "JPY"
      : "HKD";

  const getExchangeRate = () => {
    const rate = parseNum(getLS(STORAGE.EXCHANGE_RATE, DEFAULTS.exchangeRate), DEFAULTS.exchangeRate);
    return rate > 0 ? rate : DEFAULTS.exchangeRate;
  };

  const formatMoney = (amountHKD, currency = getDisplayCurrency()) => {
    const rate = getExchangeRate();
    const amount = currency === "JPY" ? amountHKD * rate : amountHKD;
    return new Intl.NumberFormat(currency === "JPY" ? "ja-JP" : "en-HK", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2
    }).format(amount || 0);
  };

  // Update text for any element containing data-money-hkd="1234"
  const refreshMoneyDOM = () => {
    const currency = getDisplayCurrency();
    $$("[data-money-hkd]").forEach((el) => {
      const hkd = parseNum(el.getAttribute("data-money-hkd"), 0);
      el.textContent = formatMoney(hkd, currency);
    });

    // Optional currency label targets
    $$("[data-currency-label]").forEach((el) => {
      el.textContent = currency;
    });
  };

  // Set element text by ID or [data-bind]
  const setBoundText = (bindKey, value) => {
    const byId = document.getElementById(bindKey);
    if (byId) byId.textContent = value;
    $$(`[data-bind="${bindKey}"]`).forEach((el) => (el.textContent = value));
  };

  // ===============================
  // Bottom Nav Active State
  // ===============================
  const initBottomNav = () => {
    const links = $$(".bottom-nav a");
    if (!links.length) return;

    const path = location.pathname.toLowerCase();
    const file = (path.split("/").pop() || "index.html").toLowerCase();

    links.forEach((a) => {
      const href = (a.getAttribute("href") || "").toLowerCase();
      const active =
        (file === "" || file === "index.html") && (href.endsWith("index.html") || href === "./" || href === "/")
          ? true
          : href.endsWith(file);
      a.classList.toggle("active", active);
    });
  };

  // ===============================
  // Home: Currency Helper
  // Supports:
  // - #exchangeRateInput
  // - #displayCurrency (select)
  // - input[name="displayCurrency"] radios
  // ===============================
  const initCurrencyControls = () => {
    const rateInput = $("#exchangeRateInput");
    const select = $("#displayCurrency");
    const radios = $$('input[name="displayCurrency"]');

    // Init UI from storage
    const currency = getDisplayCurrency();
    const rate = getExchangeRate();

    if (rateInput) rateInput.value = String(rate);
    if (select) select.value = currency;
    radios.forEach((r) => (r.checked = r.value.toUpperCase() === currency));

    const commit = () => {
      if (rateInput) {
        const nextRate = clampNumber(parseNum(rateInput.value, DEFAULTS.exchangeRate), 0.0001, 10000);
        setLS(STORAGE.EXCHANGE_RATE, nextRate);
      }

      let nextCurrency = currency;
      if (select) nextCurrency = (select.value || "HKD").toUpperCase();
      if (radios.length) {
        const checked = radios.find((r) => r.checked);
        if (checked) nextCurrency = (checked.value || "HKD").toUpperCase();
      }
      setLS(STORAGE.DISPLAY_CURRENCY, nextCurrency === "JPY" ? "JPY" : "HKD");

      refreshMoneyDOM();
      // Let page-specific modules recompute totals in display currency
      document.dispatchEvent(new CustomEvent("trip:currencyChanged"));
    };

    if (rateInput) {
      rateInput.addEventListener("change", commit);
      rateInput.addEventListener("blur", commit);
    }
    if (select) select.addEventListener("change", commit);
    radios.forEach((r) => r.addEventListener("change", commit));

    refreshMoneyDOM();
  };

  // ===============================
  // Home: Flight Tracker (optional)
  // Expected optional IDs:
  // - #flightCurrentPrice
  // - #flightLastUpdated
  // - #flightStatus
  // - #refreshFlightBtn
  // - #openGoogleFlightsBtn
  //
  // Optional global:
  // window.FLIGHT_API_ENDPOINT
  // API expected response examples:
  // { priceHKD: 2890, updatedAt: "2026-06-30T12:00:00Z" }
  // ===============================
  const initFlightTracker = () => {
    const priceEl = $("#flightCurrentPrice");
    const updatedEl = $("#flightLastUpdated");
    const statusEl = $("#flightStatus");
    const refreshBtn = $("#refreshFlightBtn");
    const openBtn = $("#openGoogleFlightsBtn");

    if (!priceEl && !updatedEl && !refreshBtn && !openBtn) return;

    const state = getLS(STORAGE.FLIGHT_STATE, {
      priceHKD: null,
      updatedAt: null
    });

    const render = () => {
      const currency = getDisplayCurrency();
      if (state.priceHKD == null) {
        if (priceEl) priceEl.textContent = currency === "JPY" ? "JPY --" : "HKD --";
      } else {
        if (priceEl) priceEl.textContent = formatMoney(state.priceHKD, currency);
      }

      if (updatedEl) {
        if (!state.updatedAt) updatedEl.textContent = "--";
        else {
          const d = new Date(state.updatedAt);
          updatedEl.textContent = Number.isNaN(d.getTime()) ? "--" : d.toLocaleString();
        }
      }
    };

    const setStatus = (txt) => {
      if (statusEl) statusEl.textContent = txt || "";
    };

    const fetchPrice = async () => {
      const endpoint = window.FLIGHT_API_ENDPOINT;
      if (!endpoint) {
        setStatus("Not connected");
        render();
        return;
      }

      try {
        setStatus("Refreshing...");
        const res = await fetch(endpoint, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const p = parseNum(data.priceHKD, NaN);
        if (!Number.isFinite(p)) throw new Error("Invalid priceHKD from API");

        state.priceHKD = p;
        state.updatedAt = data.updatedAt || new Date().toISOString();
        setLS(STORAGE.FLIGHT_STATE, state);

        setStatus("Updated");
        render();
      } catch (err) {
        console.error(err);
        setStatus("Failed to refresh");
      }
    };

    // Open Google Flights route for HKG↔CTS
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        const url =
          "https://www.google.com/travel/flights?hl=en#flt=HKG.CTS.2026-12-15*CTS.HKG.2026-12-21";
        window.open(url, "_blank", "noopener,noreferrer");
      });
    }

    if (refreshBtn) refreshBtn.addEventListener("click", fetchPrice);

    // Auto-refresh every 24h if endpoint exists
    const shouldAutoRefresh = () => {
      if (!window.FLIGHT_API_ENDPOINT) return false;
      if (!state.updatedAt) return true;
      const last = new Date(state.updatedAt).getTime();
      if (Number.isNaN(last)) return true;
      return Date.now() - last >= 24 * 60 * 60 * 1000;
    };

    render();
    if (shouldAutoRefresh()) fetchPrice();

    document.addEventListener("trip:currencyChanged", render);
  };

  // ===============================
  // Agenda Page
  // Expected optional IDs:
  // - #agendaDaySelect
  // - #checklistContainer
  // - #dayNotes
  // - #dayLinks
  // - #linksPreview
  //
  // Checklist items are rendered from internal template.
  // ===============================
  const initAgendaPage = () => {
    const daySelect = $("#agendaDaySelect");
    const checklistWrap = $("#checklistContainer");
    const notesInput = $("#dayNotes");
    const linksInput = $("#dayLinks");
    const linksPreview = $("#linksPreview");

    if (!daySelect && !checklistWrap && !notesInput && !linksInput) return;

    const defaultChecklist = {
      1: ["Passport / documents", "Airport transfer", "Hotel check-in", "Dinner plan"],
      2: ["Train to Otaru", "Canal walk", "Seafood lunch", "Return to Sapporo"],
      3: ["Ski / Onsen booking", "Weather check", "Transport pass"],
      4: ["Asahikawa tickets", "Zoo route", "Ramen village"],
      5: ["Odori Park", "Nijo Market", "Shopping list"],
      6: ["Noboribetsu transport", "Onsen towel set", "Return time check"],
      7: ["Pack luggage", "Last-minute shopping", "Airport transfer"]
    };

    const state = getLS(STORAGE.AGENDA_STATE, {}); // { "1": { checked:[], notes:"", links:"" }, ... }
    let currentDay = String(parseNum(daySelect?.value, 1) || 1);

    const ensureDay = (day) => {
      if (!state[day]) {
        state[day] = { checked: [], notes: "", links: "" };
      }
      return state[day];
    };

    const save = () => setLS(STORAGE.AGENDA_STATE, state);

    const renderChecklist = (day) => {
      if (!checklistWrap) return;
      const dayState = ensureDay(day);
      const items = defaultChecklist[day] || ["Plan item 1", "Plan item 2"];
      checklistWrap.innerHTML = "";

      const ul = document.createElement("ul");
      ul.className = "checklist";

      items.forEach((text, idx) => {
        const key = `${day}-${idx}`;
        const li = document.createElement("li");

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = dayState.checked.includes(key);
        cb.addEventListener("change", () => {
          const set = new Set(dayState.checked);
          if (cb.checked) set.add(key);
          else set.delete(key);
          dayState.checked = Array.from(set);
          save();
        });

        const span = document.createElement("span");
        span.textContent = text;

        li.appendChild(cb);
        li.appendChild(span);
        ul.appendChild(li);
      });

      checklistWrap.appendChild(ul);
    };

    const renderLinksPreview = (rawText) => {
      if (!linksPreview) return;
      linksPreview.innerHTML = "";
      const lines = String(rawText || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      if (!lines.length) {
        linksPreview.textContent = "No links yet.";
        return;
      }

      lines.forEach((url) => {
        let href = url;
        if (!/^https?:\/\//i.test(href)) href = `https://${href}`;

        const a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = url;
        linksPreview.appendChild(a);
      });
    };

    const renderDay = (day) => {
      currentDay = day;
      const dayState = ensureDay(day);

      if (daySelect && daySelect.value !== day) daySelect.value = day;
      if (notesInput) notesInput.value = dayState.notes || "";
      if (linksInput) linksInput.value = dayState.links || "";

      renderChecklist(day);
      renderLinksPreview(dayState.links || "");
    };

    if (daySelect) {
      daySelect.addEventListener("change", () => renderDay(String(parseNum(daySelect.value, 1) || 1)));
    }

    if (notesInput) {
      notesInput.addEventListener("input", () => {
        ensureDay(currentDay).notes = notesInput.value;
        save();
      });
    }

    if (linksInput) {
      linksInput.addEventListener("input", () => {
        ensureDay(currentDay).links = linksInput.value;
        save();
        renderLinksPreview(linksInput.value);
      });
    }

    renderDay(currentDay);
  };

  // ===============================
  // Budget Page
  // Input support:
  // - .budget-input or [data-role="budget"]
  // - .actual-input or [data-role="actual"]
  // Should include data-key attr for persistence.
  // For day totals: actual inputs should include data-day="1..7"
  //
  // Summary targets:
  // - #totalBudget / [data-bind="totalBudget"]
  // - #totalActual / [data-bind="totalActual"]
  // - #day1Total ... #day7Total OR [data-bind="day1Total"] ...
  // ===============================
  const initBudgetPage = () => {
    const budgetInputs = $$('.budget-input, [data-role="budget"]');
    const actualInputs = $$('.actual-input, [data-role="actual"]');
    if (!budgetInputs.length && !actualInputs.length) return;

    const state = getLS(STORAGE.BUDGET_STATE, {}); // key -> number(HKD)

    const allInputs = [...budgetInputs, ...actualInputs];

    const inputKey = (el, idx) =>
      el.getAttribute("data-key") ||
      el.id ||
      `${el.classList.contains("budget-input") || el.getAttribute("data-role") === "budget" ? "b" : "a"}_${idx}`;

    // Load saved values
    allInputs.forEach((el, i) => {
      const key = inputKey(el, i);
      const saved = parseNum(state[key], NaN);
      if (Number.isFinite(saved)) el.value = saved;
    });

    const persistInput = (el, idx) => {
      const key = inputKey(el, idx);
      state[key] = parseNum(el.value, 0);
      setLS(STORAGE.BUDGET_STATE, state);
    };

    const sumInputs = (arr) => arr.reduce((acc, el) => acc + parseNum(el.value, 0), 0);

    const recalc = () => {
      const currency = getDisplayCurrency();

      const totalBudgetHKD = sumInputs(budgetInputs);
      const totalActualHKD = sumInputs(actualInputs);

      setBoundText("totalBudget", formatMoney(totalBudgetHKD, currency));
      setBoundText("totalActual", formatMoney(totalActualHKD, currency));

      // Day totals from actual inputs with data-day
      for (let day = 1; day <= 7; day++) {
        const daySumHKD = actualInputs
          .filter((el) => parseNum(el.getAttribute("data-day"), 0) === day)
          .reduce((acc, el) => acc + parseNum(el.value, 0), 0);

        setBoundText(`day${day}Total`, formatMoney(daySumHKD, currency));
      }

      // Optional over-budget indicator
      const diff = totalActualHKD - totalBudgetHKD;
      const diffEl = $("#budgetDifference");
      if (diffEl) {
        const label = diff >= 0 ? "Over Budget: " : "Under Budget: ";
        diffEl.textContent = label + formatMoney(Math.abs(diff), currency);
        diffEl.style.color = diff >= 0 ? "#dc2626" : "#16a34a";
      }
    };

    allInputs.forEach((el, i) => {
      el.addEventListener("input", () => {
        persistInput(el, i);
        recalc();
      });
      el.addEventListener("change", () => {
        persistInput(el, i);
        recalc();
      });
    });

    document.addEventListener("trip:currencyChanged", recalc);

    recalc();
  };

  // ===============================
  // Boot
  // ===============================
  document.addEventListener("DOMContentLoaded", () => {
    initBottomNav();
    initCurrencyControls();
    initFlightTracker();
    initAgendaPage();
    initBudgetPage();
  });
})();
