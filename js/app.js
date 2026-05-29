/* ===========================================================
   Werkagenda — applicatielogica
   Data wordt lokaal in de browser opgeslagen (localStorage).
   =========================================================== */
(() => {
  "use strict";

  const STORE_KEY = "werkagenda.v2";
  const $ = (s) => document.querySelector(s);
  const qa = (s) => Array.from(document.querySelectorAll(s));

  /* ---- SVG-iconen ---- */
  const I = {
    check: '<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    clock: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
    bell: '<svg class="icon" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    plus: '<svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    inbox: '<svg class="icon" viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/></svg>',
  };

  const DEFAULT_CATEGORIES = [
    { id: "werk", name: "Werk", color: "#2f6a52" },
    { id: "vergadering", name: "Overleg", color: "#3a6ea5" },
    { id: "persoonlijk", name: "Persoonlijk", color: "#9a7430" },
    { id: "urgent", name: "Urgent", color: "#a8443a" },
  ];

  let state = loadState();
  let currentView = "today";
  let activeCategory = null;
  let searchTerm = "";

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { tasks: p.tasks || [], categories: p.categories || DEFAULT_CATEGORIES };
      }
    } catch (e) { console.warn(e); }
    return { tasks: [], categories: DEFAULT_CATEGORIES };
  }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---- datum-helpers ---- */
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => iso(new Date());

  function dueDate(t) {
    if (!t.date) return null;
    return new Date(`${t.date}T${t.time || "23:59"}`);
  }
  const isToday = (t) => t.date === todayStr();
  function weekStart() {
    const n = new Date();
    const s = new Date(n);
    s.setDate(n.getDate() - ((n.getDay() + 6) % 7));
    s.setHours(0, 0, 0, 0);
    return s;
  }
  function isThisWeek(t) {
    if (!t.date) return false;
    const d = new Date(t.date + "T00:00");
    const s = weekStart();
    const e = new Date(s); e.setDate(s.getDate() + 7);
    return d >= s && d < e;
  }
  function isOverdue(t) {
    if (t.done) return false;
    const d = dueDate(t);
    return d && d < new Date();
  }
  const WD = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  const WD_SHORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  function fmtDate(str) {
    if (!str) return "";
    const d = new Date(str + "T00:00");
    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    if (str === todayStr()) return "Vandaag";
    if (str === iso(tmr)) return "Morgen";
    return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  }

  /* ---- render ---- */
  function render() {
    $("#brand-date").textContent = new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
    renderCategories();
    renderCounts();
    renderSummary();
    renderMain();
  }

  const catById = (id) => state.categories.find((c) => c.id === id);

  function renderCategories() {
    const list = $("#cat-list");
    list.innerHTML = "";
    const mkLi = (label, color, active, onClick, count) => {
      const li = document.createElement("li");
      if (active) li.classList.add("active");
      li.innerHTML = `<span class="cat-dot" style="background:${color}"></span>${esc(label)}` +
        (count != null ? `<span class="cat-count">${count}</span>` : "");
      li.onclick = onClick;
      return li;
    };
    list.appendChild(mkLi("Alle categorieën", "linear-gradient(135deg,#2f6a52,#3a6ea5)", activeCategory === null, () => { activeCategory = null; render(); }, null));
    state.categories.forEach((c) => {
      const count = state.tasks.filter((t) => t.category === c.id && !t.done).length;
      list.appendChild(mkLi(c.name, c.color, activeCategory === c.id, () => { activeCategory = c.id; render(); }, count));
    });

    const sel = $("#f-category");
    sel.innerHTML = "";
    state.categories.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.id; o.textContent = c.name; sel.appendChild(o);
    });
  }

  function renderCounts() {
    $("#count-today").textContent = state.tasks.filter((t) => isToday(t) && !t.done).length;
    $("#count-all").textContent = state.tasks.filter((t) => !t.done).length;
  }

  function renderSummary() {
    const open = state.tasks.filter((t) => !t.done).length;
    const overdue = state.tasks.filter((t) => isOverdue(t)).length;
    const today = state.tasks.filter((t) => isToday(t) && !t.done).length;
    const done = state.tasks.filter((t) => t.done).length;
    $("#summary").innerHTML = `
      <div class="item"><span class="num">${today}</span><span class="lbl">Vandaag</span></div>
      <div class="item"><span class="num">${open}</span><span class="lbl">Openstaand</span></div>
      <div class="item"><span class="num danger">${overdue}</span><span class="lbl">Te laat</span></div>
      <div class="item"><span class="num accent">${done}</span><span class="lbl">Afgerond</span></div>`;
  }

  const META = {
    today: ["Vandaag", () => new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })],
    week:  ["Deze week", () => { const s = weekStart(), e = new Date(s); e.setDate(s.getDate() + 6); return `${s.getDate()} – ${e.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}`; }],
    all:   ["Alle taken", () => "Een volledig overzicht van wat openstaat"],
    done:  ["Afgerond", () => "Wat je hebt afgevinkt"],
  };

  function applyFilters(tasks) {
    let l = tasks.slice();
    if (currentView === "today") l = l.filter((t) => isToday(t) && !t.done);
    else if (currentView === "week") l = l.filter((t) => isThisWeek(t));
    else if (currentView === "all") l = l.filter((t) => !t.done);
    else if (currentView === "done") l = l.filter((t) => t.done);
    if (activeCategory) l = l.filter((t) => t.category === activeCategory);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      l = l.filter((t) => t.title.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q));
    }
    return l;
  }
  function sortTasks(tasks) {
    const rank = { high: 0, medium: 1, low: 2 };
    return tasks.sort((a, b) => {
      const da = dueDate(a), db = dueDate(b);
      if (da && db && +da !== +db) return da - db;
      if (da && !db) return -1;
      if (db && !da) return 1;
      return rank[a.priority] - rank[b.priority];
    });
  }

  function renderMain() {
    const [title, subFn] = META[currentView];
    $("#view-title").textContent = title;
    $("#view-sub").textContent = subFn();
    const c = $("#content");
    c.innerHTML = "";
    if (currentView === "week") { renderWeek(c); return; }

    const tasks = sortTasks(applyFilters(state.tasks));
    if (!tasks.length) { c.appendChild(emptyState()); return; }

    if (currentView === "all") {
      const groups = {};
      tasks.forEach((t) => { const k = t.date || "_"; (groups[k] = groups[k] || []).push(t); });
      Object.keys(groups).sort((a, b) => (a === "_" ? 1 : b === "_" ? -1 : a.localeCompare(b))).forEach((k) => {
        const h = document.createElement("div");
        h.className = "group-title";
        h.textContent = k === "_" ? "Zonder datum" : fmtDate(k);
        c.appendChild(h);
        groups[k].forEach((t) => c.appendChild(taskRow(t)));
      });
    } else {
      tasks.forEach((t) => c.appendChild(taskRow(t)));
    }
  }

  function emptyState() {
    const d = document.createElement("div");
    d.className = "empty";
    d.innerHTML = `${I.inbox}<h3>${currentView === "done" ? "Nog niets afgerond" : "Niets gepland"}</h3>
      <p>${currentView === "done" ? "Afgevinkte taken verschijnen hier." : "Voeg een taak toe met de knop rechtsboven."}</p>`;
    return d;
  }

  function taskRow(t) {
    const el = document.createElement("div");
    el.className = "task" + (t.done ? " done" : "");
    const cat = catById(t.category);
    const bits = [];
    if (t.date || t.time) {
      const od = isOverdue(t);
      const label = `${t.date ? fmtDateShort(t.date) : ""}${t.time ? (t.date ? " · " : "") + t.time : ""}`;
      bits.push(`<span class="meta-bit${od ? " overdue" : ""}">${I.clock}${esc(label)}</span>`);
    }
    const prioLabel = { high: "Hoog", medium: "Normaal", low: "Laag" }[t.priority];
    bits.push(`<span class="prio ${t.priority}"><span class="dot"></span>${prioLabel}</span>`);
    if (cat) bits.push(`<span class="cat-tag"><span class="cat-dot" style="background:${cat.color}"></span>${esc(cat.name)}</span>`);
    if (t.reminder && !t.done) bits.push(`<span class="meta-bit">${I.bell}Herinnering</span>`);

    el.innerHTML = `
      <div class="check${t.done ? " checked" : ""}">${t.done ? I.check : ""}</div>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : ""}
        <div class="task-meta">${bits.join("")}</div>
      </div>`;
    el.querySelector(".check").addEventListener("click", (e) => { e.stopPropagation(); toggleDone(t.id); });
    el.addEventListener("click", () => openModal(t));
    return el;
  }

  function fmtDateShort(str) {
    const d = new Date(str + "T00:00");
    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    if (str === todayStr()) return "Vandaag";
    if (str === iso(tmr)) return "Morgen";
    return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
  }

  function renderWeek(c) {
    const grid = document.createElement("div");
    grid.className = "week";
    const s = weekStart();
    for (let i = 0; i < 7; i++) {
      const day = new Date(s); day.setDate(s.getDate() + i);
      const key = iso(day);
      const col = document.createElement("div");
      col.className = "day-col" + (key === todayStr() ? " today" : "");
      let dayTasks = state.tasks.filter((t) => t.date === key);
      if (activeCategory) dayTasks = dayTasks.filter((t) => t.category === activeCategory);
      dayTasks = sortTasks(dayTasks);
      col.innerHTML = `<div class="day-head"><div class="day-name">${WD_SHORT[day.getDay()]}</div><div class="day-num">${day.getDate()}</div></div>`;
      const body = document.createElement("div");
      body.className = "day-body";
      dayTasks.forEach((t) => {
        const dt = document.createElement("div");
        dt.className = `day-task prio-${t.priority}` + (t.done ? " done" : "");
        dt.innerHTML = `${t.time ? `<div class="dt-time">${esc(t.time)}</div>` : ""}<div class="dt-title">${esc(t.title)}</div>`;
        dt.addEventListener("click", () => openModal(t));
        body.appendChild(dt);
      });
      const add = document.createElement("button");
      add.className = "day-add";
      add.innerHTML = `${I.plus}`;
      add.title = "Taak op deze dag";
      add.addEventListener("click", () => openModal(null, key));
      body.appendChild(add);
      col.appendChild(body);
      grid.appendChild(col);
    }
    c.appendChild(grid);
  }

  /* ---- acties ---- */
  function toggleDone(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    if (t.done) { t.notified = true; toast("Taak afgerond"); }
    save(); render();
  }
  function deleteTask(id) {
    state.tasks = state.tasks.filter((x) => x.id !== id);
    save(); render(); toast("Taak verwijderd");
  }

  /* ---- modal ---- */
  const backdrop = $("#modal-backdrop");
  let formPriority = "medium";

  function setPriority(p) {
    formPriority = p;
    qa("#prio-seg button").forEach((b) => b.classList.toggle("active", b.dataset.p === p));
  }

  function openModal(task = null, presetDate = null) {
    $("#modal-title").textContent = task ? "Taak bewerken" : "Nieuwe taak";
    $("#task-id").value = task ? task.id : "";
    $("#f-title").value = task ? task.title : "";
    $("#f-notes").value = task ? task.notes || "" : "";
    $("#f-date").value = task ? task.date || "" : (presetDate || todayStr());
    $("#f-time").value = task ? task.time || "" : "";
    setPriority(task ? task.priority : "medium");
    $("#f-category").value = task ? (task.category || state.categories[0].id) : state.categories[0].id;
    $("#f-reminder").checked = task ? !!task.reminder : false;
    $("#delete-task").hidden = !task;
    backdrop.hidden = false;
    setTimeout(() => $("#f-title").focus(), 40);
  }
  const closeModal = () => { backdrop.hidden = true; };

  $("#task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("#task-id").value;
    const data = {
      title: $("#f-title").value.trim(),
      notes: $("#f-notes").value.trim(),
      date: $("#f-date").value,
      time: $("#f-time").value,
      priority: formPriority,
      category: $("#f-category").value,
      reminder: $("#f-reminder").checked,
    };
    if (!data.title) return;
    if (id) {
      const t = state.tasks.find((x) => x.id === id);
      Object.assign(t, data); t.notified = false;
      toast("Taak bijgewerkt");
    } else {
      state.tasks.push({ id: uid(), done: false, notified: false, created: Date.now(), ...data });
      toast("Taak toegevoegd");
    }
    save(); render(); closeModal();
  });

  $("#prio-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (b) setPriority(b.dataset.p);
  });
  $("#delete-task").addEventListener("click", () => {
    const id = $("#task-id").value;
    if (id && confirm("Deze taak verwijderen?")) { deleteTask(id); closeModal(); }
  });
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-cancel").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  $("#add-task").addEventListener("click", () => openModal());

  /* ---- navigatie / zoeken ---- */
  qa(".nav-btn").forEach((b) => b.addEventListener("click", () => {
    qa(".nav-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    currentView = b.dataset.view;
    render();
  }));
  $("#search").addEventListener("input", (e) => { searchTerm = e.target.value; renderMain(); });

  /* ---- herinneringen ---- */
  const notifBtn = $("#notif-toggle");
  function syncNotifBtn() {
    const granted = "Notification" in window && Notification.permission === "granted";
    notifBtn.classList.toggle("on", granted);
    $("#notif-label").textContent = granted ? "Herinneringen aan" : "Herinneringen aanzetten";
  }
  notifBtn.addEventListener("click", async () => {
    if (!("Notification" in window)) { toast("Meldingen niet ondersteund in deze browser"); return; }
    if (Notification.permission === "granted") { toast("Herinneringen staan al aan"); return; }
    const p = await Notification.requestPermission();
    syncNotifBtn();
    toast(p === "granted" ? "Herinneringen ingeschakeld" : "Meldingen geweigerd");
  });
  function notify(title, body) {
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
  }
  function checkReminders() {
    const now = new Date();
    let changed = false;
    state.tasks.forEach((t) => {
      if (t.reminder && !t.done && !t.notified) {
        const d = dueDate(t);
        if (d && d <= now) { notify("Herinnering: " + t.title, t.notes || "Deze taak staat gepland."); t.notified = true; changed = true; }
      }
    });
    if (changed) save();
  }
  setInterval(checkReminders, 30000);

  /* ---- overig ---- */
  let toastT;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2400);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.hidden) closeModal();
    if ((e.key === "n" || e.key === "N") && backdrop.hidden &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      e.preventDefault(); openModal();
    }
  });

  /* ---- init ---- */
  syncNotifBtn();
  render();
  checkReminders();
})();
