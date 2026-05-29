/* ============================================================
   Mijn Werkagenda — alle logica
   Data wordt lokaal opgeslagen in de browser (localStorage).
   ============================================================ */

(() => {
  "use strict";

  const STORE_KEY = "werkagenda.v1";
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ---------- Standaardcategorieën ---------- */
  const DEFAULT_CATEGORIES = [
    { id: "werk", name: "Werk", color: "#6366f1" },
    { id: "vergadering", name: "Vergadering", color: "#0ea5e9" },
    { id: "persoonlijk", name: "Persoonlijk", color: "#22c55e" },
    { id: "urgent", name: "Urgent", color: "#ef4444" },
  ];

  /* ---------- State ---------- */
  let state = loadState();
  let currentView = "today";
  let activeCategory = null;
  let searchTerm = "";

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          tasks: parsed.tasks || [],
          categories: parsed.categories || DEFAULT_CATEGORIES,
          theme: parsed.theme || "light",
        };
      }
    } catch (e) {
      console.warn("Kon opgeslagen data niet laden:", e);
    }
    return { tasks: [], categories: DEFAULT_CATEGORIES, theme: "light" };
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Datum-helpers ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  function dueDate(task) {
    if (!task.date) return null;
    const t = task.time || "23:59";
    return new Date(`${task.date}T${t}`);
  }

  function isToday(task) { return task.date === todayStr(); }

  function isThisWeek(task) {
    if (!task.date) return false;
    const d = new Date(task.date + "T00:00");
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // maandag
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  }

  function isOverdue(task) {
    if (task.done) return false;
    const due = dueDate(task);
    return due && due < new Date();
  }

  const fmtDate = (str) => {
    if (!str) return "";
    const d = new Date(str + "T00:00");
    const today = todayStr();
    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    const tmrStr = `${tmr.getFullYear()}-${pad(tmr.getMonth() + 1)}-${pad(tmr.getDate())}`;
    if (str === today) return "Vandaag";
    if (str === tmrStr) return "Morgen";
    return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
  };

  /* ============================================================
     RENDER
     ============================================================ */
  function render() {
    renderHeaderDate();
    renderCategories();
    renderBadges();
    renderStats();
    renderTasks();
  }

  function renderHeaderDate() {
    $("#today-label").textContent = new Date().toLocaleDateString("nl-NL", {
      weekday: "long", day: "numeric", month: "long",
    });
  }

  function catById(id) { return state.categories.find((c) => c.id === id); }

  function renderCategories() {
    const list = $("#cat-list");
    list.innerHTML = "";
    const all = document.createElement("li");
    all.innerHTML = `<span class="cat-dot" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"></span> Alle categorieën`;
    all.classList.toggle("active", activeCategory === null);
    all.onclick = () => { activeCategory = null; render(); };
    list.appendChild(all);

    state.categories.forEach((cat) => {
      const count = state.tasks.filter((t) => t.category === cat.id && !t.done).length;
      const li = document.createElement("li");
      li.classList.toggle("active", activeCategory === cat.id);
      li.innerHTML = `<span class="cat-dot" style="background:${cat.color}"></span>
        ${escapeHtml(cat.name)} <span class="cat-count">${count}</span>`;
      li.onclick = () => { activeCategory = cat.id; render(); };
      list.appendChild(li);
    });

    // Populate category select in modal
    const sel = $("#f-category");
    sel.innerHTML = "";
    state.categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      sel.appendChild(opt);
    });
  }

  function renderBadges() {
    $("#badge-today").textContent = state.tasks.filter((t) => isToday(t) && !t.done).length;
    $("#badge-all").textContent = state.tasks.filter((t) => !t.done).length;
  }

  function renderStats() {
    const open = state.tasks.filter((t) => !t.done).length;
    const done = state.tasks.filter((t) => t.done).length;
    const overdue = state.tasks.filter((t) => isOverdue(t)).length;
    const total = open + done;
    const pct = total ? Math.round((done / total) * 100) : 0;

    $("#stats").innerHTML = `
      <div class="stat-card"><div class="stat-num">${open}</div><div class="stat-label">Openstaand</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--danger)">${overdue}</div><div class="stat-label">Te laat</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--success)">${done}</div><div class="stat-label">Afgerond</div></div>
      <div class="stat-card">
        <div class="stat-num">${pct}%</div><div class="stat-label">Voortgang</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  const VIEW_META = {
    today: { title: "Vandaag", sub: "Je taken voor vandaag" },
    week: { title: "Deze week", sub: "Alles van maandag t/m zondag" },
    all: { title: "Alle taken", sub: "Een compleet overzicht" },
    done: { title: "Afgerond", sub: "Goed bezig! 🎉" },
  };

  function filterForView(tasks) {
    let list = tasks.slice();
    if (currentView === "today") list = list.filter((t) => isToday(t) && !t.done);
    else if (currentView === "week") list = list.filter((t) => isThisWeek(t) && !t.done);
    else if (currentView === "all") list = list.filter((t) => !t.done);
    else if (currentView === "done") list = list.filter((t) => t.done);

    if (activeCategory) list = list.filter((t) => t.category === activeCategory);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((t) =>
        t.title.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q));
    }
    return list;
  }

  function sortTasks(tasks) {
    const prioRank = { high: 0, medium: 1, low: 2 };
    return tasks.sort((a, b) => {
      const da = dueDate(a), db = dueDate(b);
      if (da && db) return da - db;
      if (da) return -1;
      if (db) return 1;
      return prioRank[a.priority] - prioRank[b.priority];
    });
  }

  function renderTasks() {
    const meta = VIEW_META[currentView];
    $("#view-title").textContent = meta.title;
    $("#view-subtitle").textContent = meta.sub;

    const area = $("#task-area");
    let tasks = sortTasks(filterForView(state.tasks));

    if (!tasks.length) {
      area.innerHTML = `
        <div class="empty">
          <div class="empty-emoji">${currentView === "done" ? "🌱" : "🎯"}</div>
          <h3>${currentView === "done" ? "Nog niets afgerond" : "Geen taken hier"}</h3>
          <p>${currentView === "done" ? "Afgevinkte taken verschijnen hier." : "Voeg een taak toe met de knop rechtsboven."}</p>
        </div>`;
      return;
    }

    // Group by date for relevant views
    area.innerHTML = "";
    if (currentView === "all" || currentView === "week") {
      const groups = {};
      tasks.forEach((t) => {
        const key = t.date || "geen";
        (groups[key] = groups[key] || []).push(t);
      });
      Object.keys(groups).sort((a, b) => (a === "geen" ? 1 : b === "geen" ? -1 : a.localeCompare(b)))
        .forEach((key) => {
          const title = document.createElement("div");
          title.className = "task-group-title";
          title.textContent = key === "geen" ? "Zonder datum" : fmtDate(key);
          area.appendChild(title);
          groups[key].forEach((t) => area.appendChild(taskEl(t)));
        });
    } else {
      tasks.forEach((t) => area.appendChild(taskEl(t)));
    }
  }

  function taskEl(task) {
    const el = document.createElement("div");
    el.className = `task prio-${task.priority}${task.done ? " done" : ""}`;
    const cat = catById(task.category);

    const metaChips = [];
    if (task.time || task.date) {
      const overdue = isOverdue(task);
      const label = `${task.date ? fmtDate(task.date) : ""}${task.time ? " · " + task.time : ""}`.trim();
      metaChips.push(`<span class="chip ${overdue ? "chip-overdue" : "chip-time"}">${overdue ? "⏰ Te laat: " : "🕒 "}${escapeHtml(label)}</span>`);
    }
    if (cat) metaChips.push(`<span class="chip chip-cat"><span class="cat-dot" style="background:${cat.color}"></span>${escapeHtml(cat.name)}</span>`);
    if (task.reminder && !task.done) metaChips.push(`<span class="chip chip-reminder">🔔 Herinnering</span>`);

    el.innerHTML = `
      <div class="check ${task.done ? "checked" : ""}">${task.done ? "✓" : ""}</div>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ""}
        ${metaChips.length ? `<div class="task-meta">${metaChips.join("")}</div>` : ""}
      </div>`;

    el.querySelector(".check").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDone(task.id);
    });
    el.addEventListener("click", () => openModal(task));
    return el;
  }

  /* ============================================================
     TAAK-ACTIES
     ============================================================ */
  function toggleDone(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    if (task.done) { task.notified = true; toast("Taak afgerond! ✅"); }
    save();
    render();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    save();
    render();
    toast("Taak verwijderd");
  }

  /* ============================================================
     MODAL
     ============================================================ */
  const backdrop = $("#modal-backdrop");

  function openModal(task = null) {
    $("#modal-title").textContent = task ? "Taak bewerken" : "Nieuwe taak";
    $("#task-id").value = task ? task.id : "";
    $("#f-title").value = task ? task.title : "";
    $("#f-notes").value = task ? task.notes || "" : "";
    $("#f-date").value = task ? task.date || "" : todayStr();
    $("#f-time").value = task ? task.time || "" : "";
    $("#f-priority").value = task ? task.priority : "medium";
    $("#f-category").value = task ? task.category || state.categories[0].id : state.categories[0].id;
    $("#f-reminder").checked = task ? !!task.reminder : false;
    $("#delete-task").hidden = !task;
    backdrop.hidden = false;
    setTimeout(() => $("#f-title").focus(), 50);
  }

  function closeModal() { backdrop.hidden = true; }

  $("#task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("#task-id").value;
    const data = {
      title: $("#f-title").value.trim(),
      notes: $("#f-notes").value.trim(),
      date: $("#f-date").value,
      time: $("#f-time").value,
      priority: $("#f-priority").value,
      category: $("#f-category").value,
      reminder: $("#f-reminder").checked,
    };
    if (!data.title) return;

    if (id) {
      const task = state.tasks.find((t) => t.id === id);
      Object.assign(task, data);
      task.notified = false; // opnieuw kunnen herinneren na bewerken
      toast("Taak bijgewerkt");
    } else {
      state.tasks.push({ id: uid(), done: false, notified: false, created: Date.now(), ...data });
      toast("Taak toegevoegd 🎉");
    }
    save();
    render();
    closeModal();
  });

  $("#delete-task").addEventListener("click", () => {
    const id = $("#task-id").value;
    if (id && confirm("Deze taak verwijderen?")) { deleteTask(id); closeModal(); }
  });
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-cancel").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  $("#add-task-btn").addEventListener("click", () => openModal());

  /* ============================================================
     NAVIGATIE / ZOEKEN
     ============================================================ */
  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentView = btn.dataset.view;
      render();
    });
  });

  $("#search").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    renderTasks();
  });

  /* ============================================================
     THEMA
     ============================================================ */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    $("#theme-toggle").textContent = state.theme === "dark" ? "☀️ Thema" : "🌙 Thema";
  }
  $("#theme-toggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    save();
    applyTheme();
  });

  /* ============================================================
     FOCUS-TIMER (Pomodoro)
     ============================================================ */
  let timer = { total: 25 * 60, remaining: 25 * 60, running: false, interval: null };

  function updateTimerDisplay() {
    const m = Math.floor(timer.remaining / 60);
    const s = timer.remaining % 60;
    $("#timer-display").textContent = `${pad(m)}:${pad(s)}`;
    $("#timer-display").classList.toggle("running", timer.running);
  }

  function startTimer() {
    if (timer.running) {
      clearInterval(timer.interval);
      timer.running = false;
      $("#timer-start").textContent = "Verder";
    } else {
      timer.running = true;
      $("#timer-start").textContent = "Pauze";
      timer.interval = setInterval(() => {
        timer.remaining--;
        if (timer.remaining <= 0) {
          clearInterval(timer.interval);
          timer.running = false;
          timer.remaining = timer.total;
          $("#timer-start").textContent = "Start";
          notify("⏱️ Timer afgelopen!", "Tijd voor een pauze of de volgende taak.");
          toast("⏱️ Timer afgelopen!");
        }
        updateTimerDisplay();
      }, 1000);
    }
    updateTimerDisplay();
  }

  function resetTimer() {
    clearInterval(timer.interval);
    timer.running = false;
    timer.remaining = timer.total;
    $("#timer-start").textContent = "Start";
    updateTimerDisplay();
  }

  $("#timer-start").addEventListener("click", startTimer);
  $("#timer-reset").addEventListener("click", resetTimer);
  $$(".tmode").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tmode").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      timer.total = parseInt(btn.dataset.min, 10) * 60;
      resetTimer();
    });
  });

  /* ============================================================
     HERINNERINGEN (notificaties)
     ============================================================ */
  $("#notif-toggle").addEventListener("click", async () => {
    if (!("Notification" in window)) { toast("Notificaties niet ondersteund"); return; }
    const perm = await Notification.requestPermission();
    toast(perm === "granted" ? "Meldingen staan aan 🔔" : "Meldingen geweigerd");
  });

  function notify(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "icon.svg" });
    }
  }

  // Check elke 30 sec op verlopen herinneringen
  function checkReminders() {
    const now = new Date();
    state.tasks.forEach((task) => {
      if (task.reminder && !task.done && !task.notified) {
        const due = dueDate(task);
        if (due && due <= now) {
          notify("🔔 Herinnering: " + task.title, task.notes || "Deze taak staat gepland.");
          task.notified = true;
          save();
        }
      }
    });
  }
  setInterval(checkReminders, 30 * 1000);

  /* ============================================================
     OVERIG
     ============================================================ */
  let toastTimeout;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => (el.hidden = true), 2500);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Sneltoetsen
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.hidden) closeModal();
    if ((e.key === "n" || e.key === "N") && backdrop.hidden &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      openModal();
    }
  });

  // Service worker voor offline gebruik
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }

  /* ---------- Init ---------- */
  applyTheme();
  updateTimerDisplay();
  render();
  checkReminders();
})();
