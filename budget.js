/* budget.js
Budget page only logic
Works with storage key: trip.budgetState
*/

(() => {
  "use strict";

  const STORAGE = {
    BUDGET_STATE: "trip.budgetState",
    DISPLAY_CURRENCY: "trip.displayCurrency", // HKD | JPY
    EXCHANGE_RATE: "trip.exchangeRate" // 1 HKD = ? JPY
  };

  const DEFAULTS = {
    displayCurrency: "HKD",
    exchangeRate: 19.5
  };

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
    return raw == null ? fallback : safeJSONParse(raw, fallback);
  };

  const setLS = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const parseNum = (v, fallback = 0) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
    if (v == null) return fallback;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : fallback;
  };

  const clamp = (n, min = -Infinity, max = Infinity) => Math.min(Math.max(n, min), max);

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
    $$(`[data-bind="${bindKey}"]`).forEach((el) => (el.textContent = value));
  };

  document.addEventListener("DOMContentLoaded", () => {
    const budgetInputs = $$(".budget-input, [data-role='budget']");
    const actualInputs = $$(".actual-input, [data-role='actual']");
    const allInputs = [...budgetInputs, ...actualInputs];

    // Optional action buttons
    const clearBudgetBtn = $("#clearBudgetBtn");
    const clearActualBtn = $("#clearActualBtn");
    const resetAllBtn = $("#resetBudgetBtn");

    // If this page doesn't contain budget fields, skip
    if (!allInputs.length && !clearBudgetBtn && !clearActualBtn && !resetAllBtn) return;

    const state = getLS(STORAGE.BUDGET_STATE, {}) || {};

    const inputKey = (el, idx) => {
      return (
        el.getAttribute("data-key") ||
        el.id ||
        `${el.matches(".budget-input, [data-role='budget']") ? "budget" : "actual"}_${idx}`
      );
    };

    const saveState = () => setLS(STORAGE.BUDGET_STATE, state);

    const loadToInputs = () => {
      allInputs.forEach((el, i) => {
        const key = inputKey(el, i);
        const saved = parseNum(state[key], NaN);
        if (Number.isFinite(saved)) {
          el.value = String(saved);
        }
      });
    };

    const persistInput = (el, idx) => {
      const key = inputKey(el, idx);
      const val = clamp(parseNum(el.value, 0), -1e12, 1e12);
      state[key] = val;
      saveState();
    };

    const sumInputs = (arr) => arr.reduce((acc, el) => acc + parseNum(el.value, 0), 0);

    const recalc = () => {
      const currency = getDisplayCurrency();

      const totalBudgetHKD = sumInputs(budgetInputs);
      const totalActualHKD = sumInputs(actualInputs);
      const diffHKD = totalActualHKD - totalBudgetHKD; // >0 means over budget
      const remainingHKD = totalBudgetHKD - totalActualHKD;

      setBoundText("totalBudget", formatMoneyFromHKD(totalBudgetHKD, currency));
      setBoundText("totalActual", formatMoneyFromHKD(totalActualHKD, currency));
      setBoundText("remainingAmount", formatMoneyFromHKD(Math.abs(remainingHKD), currency));
      setBoundText("remainingLabel", remainingHKD >= 0 ? "Remaining" : "Over Budget");

      // Day totals (from actual inputs with data-day="1..7")
      for (let day = 1; day <= 7; day++) {
        const daySumHKD = actualInputs
          .filter((el) => parseNum(el.getAttribute("data-day"), 0) === day)
          .reduce((acc, el) => acc + parseNum(el.value, 0), 0);

        setBoundText(`day${day}Total`, formatMoneyFromHKD(daySumHKD, currency));
      }

      // Difference display
      const diffEl = $("#budgetDifference");
      if (diffEl) {
        const label = diffHKD >= 0 ? "Over Budget: " : "Under Budget: ";
        diffEl.textContent = label + formatMoneyFromHKD(Math.abs(diffHKD), currency);
        diffEl.style.color = diffHKD >= 0 ? "#dc2626" : "#16a34a";
      }

      // Optional warning box
      const warningBox = $("#overBudgetWarning");
      if (warningBox) {
        if (diffHKD > 0) {
          warningBox.hidden = false;
          warningBox.textContent = `You are over budget by ${formatMoneyFromHKD(diffHKD, currency)}.`;
        } else {
          warningBox.hidden = true;
          warningBox.textContent = "";
        }
      }

      // Optional plain currency labels
      $$("[data-currency-label]").forEach((el) => (el.textContent = currency));
    };

    // Bind events
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

    // Optional buttons
    if (clearBudgetBtn) {
      clearBudgetBtn.addEventListener("click", () => {
        budgetInputs.forEach((el, i) => {
          el.value = "";
          state[inputKey(el, i)] = 0;
        });
        saveState();
        recalc();
      });
    }

    if (clearActualBtn) {
      clearActualBtn.addEventListener("click", () => {
        actualInputs.forEach((el, i) => {
          el.value = "";
          // offset index so key mapping stays stable with full list
          const idxInAll = allInputs.indexOf(el);
          state[inputKey(el, idxInAll)] = 0;
        });
        saveState();
        recalc();
      });
    }

    if (resetAllBtn) {
      resetAllBtn.addEventListener("click", () => {
        if (!confirm("Reset all budget and actual values?")) return;
        allInputs.forEach((el, i) => {
          el.value = "";
          state[inputKey(el, i)] = 0;
        });
        saveState();
        recalc();
      });
    }

    // React when currency changes (from common.js)
    document.addEventListener("trip:currencyChanged", recalc);

    // React to storage changes from other tabs/windows
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE.BUDGET_STATE) {
        const latest = getLS(STORAGE.BUDGET_STATE, {}) || {};
        Object.keys(state).forEach((k) => delete state[k]);
        Object.assign(state, latest);
        loadToInputs();
        recalc();
      }

      if (e.key === STORAGE.DISPLAY_CURRENCY || e.key === STORAGE.EXCHANGE_RATE) {
        recalc();
      }
    });

    // Initial
    loadToInputs();
    recalc();
  });
})();

