/* agenda.js
   Agenda page only logic
   Works with storage key: trip.agendaState
*/
(() => {
  "use strict";

  const STORAGE_KEY = "trip.agendaState";

  const $ = (sel, root = document) => root.querySelector(sel);

  const safeParse = (txt, fallback) => {
    try {
      return JSON.parse(txt);
    } catch {
      return fallback;
    }
  };

  const getState = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? safeParse(raw, {}) : {};
  };

  const saveState = (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  // Default checklist template (Day 1~7)
  const defaultChecklist = {
    "1": ["Passport / documents", "Airport transfer", "Hotel check-in", "Dinner plan"],
    "2": ["Train to Otaru", "Canal walk", "Seafood lunch", "Return to Sapporo"],
    "3": ["Ski / Onsen booking", "Weather check", "Transport pass"],
    "4": ["Asahikawa tickets", "Zoo route", "Ramen village"],
    "5": ["Odori Park", "Nijo Market", "Shopping list"],
    "6": ["Noboribetsu transport", "Onsen towel set", "Return time check"],
    "7": ["Pack luggage", "Last-minute shopping", "Airport transfer"]
  };

  document.addEventListener("DOMContentLoaded", () => {
    const daySelect = $("#agendaDaySelect");
    const checklistContainer = $("#checklistContainer");
    const notesInput = $("#dayNotes");
    const linksInput = $("#dayLinks");
    const linksPreview = $("#linksPreview");

    // Optional buttons
    const clearDayBtn = $("#clearDayBtn");
    const clearAllBtn = $("#clearAllAgendaBtn");

    // If page doesn't contain agenda components, skip
    if (!daySelect && !checklistContainer && !notesInput && !linksInput) return;

    const state = getState();
    let currentDay = String(daySelect?.value || "1");

    const ensureDay = (day) => {
      if (!state[day]) state[day] = { checked: [], notes: "", links: "" };
      return state[day];
    };

    const renderLinksPreview = (raw) => {
      if (!linksPreview) return;
      linksPreview.innerHTML = "";

      const lines = String(raw || "")
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

    const renderChecklist = (day) => {
      if (!checklistContainer) return;

      const items = defaultChecklist[day] || ["Plan item 1", "Plan item 2"];
      const dayState = ensureDay(day);

      checklistContainer.innerHTML = "";
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
          saveState(state);
        });

        const span = document.createElement("span");
        span.textContent = text;

        li.appendChild(cb);
        li.appendChild(span);
        ul.appendChild(li);
      });

      checklistContainer.appendChild(ul);
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

    // Events
    if (daySelect) {
      daySelect.addEventListener("change", () => {
        renderDay(String(daySelect.value || "1"));
      });
    }

    if (notesInput) {
      notesInput.addEventListener("input", () => {
        ensureDay(currentDay).notes = notesInput.value;
        saveState(state);
      });
    }

    if (linksInput) {
      linksInput.addEventListener("input", () => {
        ensureDay(currentDay).links = linksInput.value;
        saveState(state);
        renderLinksPreview(linksInput.value);
      });
    }

    if (clearDayBtn) {
      clearDayBtn.addEventListener("click", () => {
        state[currentDay] = { checked: [], notes: "", links: "" };
        saveState(state);
        renderDay(currentDay);
      });
    }

    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        if (!confirm("Clear all agenda data for all days?")) return;
        for (let d = 1; d <= 7; d++) {
          state[String(d)] = { checked: [], notes: "", links: "" };
        }
        saveState(state);
        renderDay(currentDay);
      });
    }

    // Initial render
    renderDay(currentDay);

    // React to changes from other tabs/windows
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) {
        const latest = getState();
        Object.keys(state).forEach((k) => delete state[k]);
        Object.assign(state, latest);
        renderDay(currentDay);
      }
    });
  });
})();

