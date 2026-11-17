/* Money tracker is a local-first demo app. Client-side authentication is for demonstration,
   not a substitute for a server-authoritative production identity system. */
(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const app = $("#app");
  const dateISO = (date = new Date()) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const daysAgo = days => dateISO(new Date(Date.now() - days * 86400000));
  const monthStart = (offset = 0) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() + offset);
    return dateISO(date);
  };
  const uid = () => globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const initialState = () => ({
    users: [],
    transactions: [
      { id: uid(), userId: "demo-user", name: "Monthly salary", category: "Salary", type: "income", amount: 95000, date: daysAgo(14), note: "Acme Technologies", receipt: "" },
      { id: uid(), userId: "demo-user", name: "Freelance project", category: "Freelance", type: "income", amount: 18000, date: daysAgo(8), note: "Website project", receipt: "" },
      { id: uid(), userId: "demo-user", name: "Apartment rent", category: "Housing", type: "expense", amount: 26000, date: daysAgo(13), note: "Monthly rent", receipt: "" },
      { id: uid(), userId: "demo-user", name: "Groceries", category: "Food", type: "expense", amount: 6450, date: daysAgo(8), note: "Weekly shopping", receipt: "" },
      { id: uid(), userId: "demo-user", name: "Metro & cabs", category: "Transport", type: "expense", amount: 2300, date: daysAgo(5), note: "Commute", receipt: "" },
      { id: uid(), userId: "demo-user", name: "Electricity bill", category: "Utilities", type: "expense", amount: 1850, date: daysAgo(3), note: "Power bill", receipt: "" },
      { id: uid(), userId: "demo-user", name: "Dinner with friends", category: "Dining", type: "expense", amount: 1750, date: daysAgo(2), note: "Weekend dinner", receipt: "" },
      { id: uid(), userId: "demo-user", name: "Investment dividend", category: "Investment", type: "income", amount: 4200, date: daysAgo(1), note: "Quarterly payout", receipt: "" }
    ],
    budgets: [
      { id: uid(), userId: "demo-user", category: "Food", limit: 10000 },
      { id: uid(), userId: "demo-user", category: "Transport", limit: 5000 },
      { id: uid(), userId: "demo-user", category: "Housing", limit: 30000 },
      { id: uid(), userId: "demo-user", category: "Dining", limit: 4000 },
      { id: uid(), userId: "demo-user", category: "Utilities", limit: 5000 }
    ],
    goals: [
      { id: uid(), userId: "demo-user", name: "Emergency fund", emoji: "🛟", target: 200000, saved: 112000, deadline: monthStart(6) },
      { id: uid(), userId: "demo-user", name: "Japan holiday", emoji: "✈️", target: 150000, saved: 68500, deadline: monthStart(10) },
      { id: uid(), userId: "demo-user", name: "New laptop", emoji: "💻", target: 95000, saved: 42000, deadline: monthStart(3) }
    ],
    recurring: [
      { id: uid(), userId: "demo-user", name: "Rent", category: "Housing", type: "expense", amount: 26000, frequency: "monthly", nextDate: monthStart() },
      { id: uid(), userId: "demo-user", name: "Salary", category: "Salary", type: "income", amount: 95000, frequency: "monthly", nextDate: monthStart() },
      { id: uid(), userId: "demo-user", name: "Streaming subscription", category: "Entertainment", type: "expense", amount: 649, frequency: "monthly", nextDate: monthStart(1) }
    ],
    notifications: [
      { id: uid(), userId: "demo-user", text: "Your monthly budget is ready. Keep an eye on your Food spending.", date: new Date().toISOString(), read: false, icon: "◉" },
      { id: uid(), userId: "demo-user", text: "Nice work — you are making progress toward your Emergency fund.", date: new Date(Date.now() - 86400000 * 2).toISOString(), read: false, icon: "✦" }
    ],
    settings: { theme: "light", currency: "INR", notifications: true }
  });
  let state;
  let db = null;
  let storageMode = "indexedDB";
  let currentUser = null;
  let route = "dashboard";
  let transactionFilter = { query: "", type: "all" };
  let toastTimer;
  const routeTitles = {
    dashboard: "Dashboard", income: "Income", expenses: "Expenses", transactions: "Transactions",
    budgets: "Budget management", goals: "Savings goals", recurring: "Recurring transactions",
    reports: "Reports", notifications: "Notifications", profile: "My profile", settings: "Settings", admin: "Admin dashboard"
  };
  const navGroups = [
    { label: "Overview", items: [["dashboard", "⌂", "Dashboard"]] },
    { label: "Your money", items: [["income", "↗", "Income"], ["expenses", "↘", "Expenses"], ["transactions", "⇄", "Transactions"]] },
    { label: "Plan ahead", items: [["budgets", "▤", "Budgets"], ["goals", "◎", "Savings goals"], ["recurring", "↻", "Recurring"]] },
    { label: "Insights", items: [["reports", "▥", "Reports"], ["notifications", "♧", "Notifications"]] }
  ];
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const encode = (value) => encodeURIComponent(value);
  const userRows = (key) => (state[key] || []).filter(row => row.userId === currentUser.id);
  const money = (amount) => {
    const currency = state.settings.currency || "INR";
    try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount) || 0); }
    catch { return `₹${new Intl.NumberFormat("en-IN").format(Number(amount) || 0)}`; }
  };
  const fmtDate = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const monthTx = () => userRows("transactions").filter(t => t.date && t.date.slice(0, 7) === dateISO().slice(0, 7));
  const total = (rows, type) => rows.filter(t => t.type === type).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const visibleTransactions = () => userRows("transactions").filter(t =>
    (route !== "income" && route !== "expenses" || t.type === (route === "income" ? "income" : "expense")) &&
    (transactionFilter.type === "all" || t.type === transactionFilter.type) &&
    (!transactionFilter.query || `${t.name} ${t.category} ${t.note || ""}`.toLowerCase().includes(transactionFilter.query.toLowerCase()))
  ).sort((a, b) => b.date.localeCompare(a.date));
  const getMonthTotals = (offset = 0) => {
    const date = new Date();
    date.setMonth(date.getMonth() + offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const tx = userRows("transactions").filter(t => t.date.startsWith(key));
    return { label: date.toLocaleDateString("en-IN", { month: "short" }), income: total(tx, "income"), expense: total(tx, "expense") };
  };
  const toast = (message, error = false) => {
    const node = $("#toast");
    node.textContent = message;
    node.classList.toggle("error", error);
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 2800);
  };
  const notify = async (text, icon = "◉") => {
    if (!state.settings.notifications) return;
    state.notifications.unshift({ id: uid(), userId: currentUser.id, text, date: new Date().toISOString(), read: false, icon });
    await saveState();
  };
  async function openDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
      const request = indexedDB.open("paisa-local", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("app", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open IndexedDB"));
      request.onblocked = () => reject(new Error("IndexedDB is blocked"));
    });
  }
  async function readState() {
    if (storageMode === "indexedDB" && db) {
      try {
        return await new Promise((resolve, reject) => {
          const request = db.transaction("app", "readonly").objectStore("app").get("state");
          request.onsuccess = () => resolve(request.result && request.result.value);
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.warn("IndexedDB read failed; using LocalStorage.", error);
        storageMode = "localStorage";
      }
    }
    try {
      const raw = localStorage.getItem("paisa-state");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      throw new Error(`Could not read local data: ${error.message}`);
    }
  }
  async function saveState() {
    if (storageMode === "indexedDB" && db) {
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction("app", "readwrite");
          tx.objectStore("app").put({ id: "state", value: state });
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
          tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted"));
        });
        return;
      } catch (error) {
        console.warn("IndexedDB write failed; switching to LocalStorage.", error);
        storageMode = "localStorage";
      }
    }
    try {
      localStorage.setItem("paisa-state", JSON.stringify(state));
    } catch (error) {
      throw new Error(`Could not save your data. Storage may be full or disabled: ${error.message}`);
    }
  }
  const bytesToHex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
  async function hashPassword(password, salt) {
    if (!window.crypto || !crypto.subtle) throw new Error("Web Crypto is unavailable in this browser context. Open this app using a local web server.");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
    return bytesToHex(digest);
  }
  async function makeUser({ id = uid(), name, email, password, role = "user" }) {
    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    return { id, name, email: email.toLowerCase().trim(), role, salt, passwordHash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
  }
  async function seedUsers() {
    if (state.users.length) return;
    state.users.push(
      await makeUser({ id: "demo-user", name: "Shammu Ajju", email: "demo@paisa.app", password: "demo123", role: "user" }),
      await makeUser({ id: "admin-user", name: "Paisa Admin", email: "admin@paisa.app", password: "admin123", role: "admin" })
    );
    await saveState();
  }
  function getPage(name) {
    if (!currentUser) return authPage(name === "register" || name === "forgot" ? name : "login");
    if (name === "admin" && currentUser.role !== "admin") {
      route = "dashboard";
      return dashboardPage();
    }
    switch (name) {
      case "income": case "expenses": return transactionPage(name);
      case "transactions": return transactionPage("transactions");
      case "budgets": return budgetsPage();
      case "goals": return goalsPage();
      case "recurring": return recurringPage();
      case "reports": return reportsPage();
      case "notifications": return notificationsPage();
      case "profile": return profilePage();
      case "settings": return settingsPage();
      case "admin": return adminPage();
      default: return dashboardPage();
    }
  }
  function authPage(kind) {
    const register = kind === "register";
    const forgot = kind === "forgot";
    const title = register ? "Create your account" : forgot ? "Reset your password" : "Welcome back";
    const intro = register ? "Start making confident decisions with your money." : forgot ? "We'll help you get back into your account." : "Your money, all in one calm and clear place.";
    return `<main class="auth-screen">
      <section class="auth-visual"><div class="auth-logo"><span class="brand-mark">₹</span> paisa</div><div><h1>Make every rupee count.</h1><p>A clearer picture of your money starts with one simple step. Track, plan and grow — all in one place.</p><div class="auth-art">◒</div></div><small>Personal finance, made clear.</small></section>
      <section class="auth-panel"><form class="auth-box" data-form="${kind}"><div class="brand auth-logo" style="padding:0 0 25px"><span class="brand-mark">₹</span> paisa</div><h2>${title}</h2><p>${intro}</p>
        ${register ? `<div class="field"><label for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="name" required></div>` : ""}
        <div class="field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required></div>
        ${!forgot ? `<div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" minlength="${register ? 8 : 1}" autocomplete="${register ? "new-password" : "current-password"}" required></div>` : ""}
        <button class="btn" type="submit">${register ? "Create account" : forgot ? "Send reset instructions" : "Sign in"}</button>
        <div class="auth-links"><a href="#" data-route="${register || forgot ? "login" : "forgot"}">${register || forgot ? "Back to sign in" : "Forgot password?"}</a>${!register && !forgot ? '<a href="#" data-route="register">Create account</a>' : ""}</div>
        ${!register && !forgot ? `<div class="demo-note"><strong>Try the demo</strong><br>User: demo@paisa.app / demo123<br>Admin: admin@paisa.app / admin123</div>` : ""}
      </form></section></main>`;
  }
  function sidebar() {
    return `<aside class="sidebar" id="sidebar"><div class="brand"><span class="brand-mark">₹</span> paisa</div>
      ${navGroups.map(group => `<div class="nav-label">${group.label}</div>${group.items.map(([id, icon, label]) => `<button class="nav-item ${route === id ? "active" : ""}" data-route="${id}"><span class="nav-icon">${icon}</span>${label}</button>`).join("")}`).join("")}
      <div class="sidebar-bottom">
      ${currentUser.role === "admin" ? `<button class="nav-item ${route === "admin" ? "active" : ""}" data-route="admin"><span class="nav-icon">⬡</span>Admin dashboard</button>` : ""}
      <button class="nav-item ${route === "profile" ? "active" : ""}" data-route="profile"><span class="nav-icon">♙</span>My profile</button>
      <button class="nav-item ${route === "settings" ? "active" : ""}" data-route="settings"><span class="nav-icon">⚙</span>Settings</button>
      <button class="nav-item" data-action="logout"><span class="nav-icon">⇥</span>Sign out</button></div></aside>`;
  }
  function shell(content) {
    const unread = userRows("notifications").filter(n => !n.read).length;
    return `<div class="app-shell">${sidebar()}<div class="mobile-overlay" id="mobile-overlay"></div><main class="main">
      <header class="topbar"><div class="topbar-left"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Open menu">☰</button><div><h1 class="page-title">${routeTitles[route] || "Dashboard"}</h1><div class="date-label">${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div></div></div>
      <div class="top-actions"><button class="icon-btn" data-route="notifications" aria-label="Notifications">♧${unread ? `<span class="badge-dot"></span>` : ""}</button><button class="avatar-btn" data-route="profile">${escapeHtml(currentUser.name.split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase())}</button></div></header>
      <section class="content">${content}</section></main></div>`;
  }
  function statCard(label, value, icon, foot, color = "") {
    return `<article class="card stat-card"><div class="stat-head">${label}<span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot ${color}">${foot}</div></article>`;
  }
  function transactionRows(rows, actions = true) {
    if (!rows.length) return `<tr><td colspan="5"><div class="empty-state">No transactions here yet. Add one to get started.</div></td></tr>`;
    return rows.map(t => `<tr><td><div class="transaction-name"><span class="transaction-icon">${t.type === "income" ? "↗" : "↘"}</span><span>${escapeHtml(t.name)}<small style="display:block;color:var(--muted);font-size:10px;font-weight:400;margin-top:3px">${escapeHtml(t.note || t.category)}${t.receipt ? ` · <a href="${escapeHtml(t.receipt)}" download="${escapeHtml(t.name)}-receipt" style="color:var(--accent)">Receipt</a>` : ""}</small></span></div></td><td>${escapeHtml(t.category)}</td><td>${fmtDate(t.date)}</td><td><span class="pill ${t.type}">${t.type === "income" ? "Income" : "Expense"}</span></td><td class="${t.type === "income" ? "positive" : ""}" style="font-weight:700">${t.type === "expense" ? "−" : "+"}${money(t.amount)}</td>${actions ? `<td><button class="btn ghost" style="padding:6px 9px" data-action="delete-transaction" data-id="${encode(t.id)}" aria-label="Delete ${escapeHtml(t.name)}">×</button></td>` : ""}</tr>`).join("");
  }
  function transactionTable(rows, actions = true) {
    return `<div class="table-wrap"><table><thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th>Type</th><th>Amount</th>${actions ? "<th></th>" : ""}</tr></thead><tbody>${transactionRows(rows, actions)}</tbody></table></div>`;
  }
  function dashboardPage() {
    const tx = monthTx();
    const incomes = total(tx, "income"), expenses = total(tx, "expense");
    const budgets = userRows("budgets");
    const saved = userRows("goals").reduce((n, g) => n + Number(g.saved), 0);
    const recent = userRows("transactions").slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    return `<div class="grid-4">${statCard("Total income", money(incomes), "↗", "This month", "positive")}${statCard("Total expenses", money(expenses), "↘", "This month", "negative")}${statCard("Available balance", money(incomes - expenses), "◈", "Income minus expenses")}${statCard("Total savings", money(saved), "◎", `${userRows("goals").length} active goals`)}</div>
      <div class="grid-2"><article class="card"><div class="section-head"><div><h2 class="section-title">Cash flow</h2><div class="section-subtitle">Income and expenses over the last 6 months</div></div><span class="pill">6 months</span></div><div class="chart-wrap"><canvas id="cashflow-chart" aria-label="Cash flow chart"></canvas></div></article>
      <article class="card"><div class="section-head"><div><h2 class="section-title">Spending breakdown</h2><div class="section-subtitle">Where your money went this month</div></div><button class="btn ghost" data-route="reports">View report</button></div>${categoryChart(tx)}</article></div>
      <div class="grid-2"><article class="card"><div class="section-head"><div><h2 class="section-title">Recent transactions</h2><div class="section-subtitle">Your latest money moves</div></div><button class="btn secondary" data-route="transactions">View all</button></div>${transactionTable(recent, false)}</article>
      <article class="card"><div class="section-head"><div><h2 class="section-title">Budget snapshot</h2><div class="section-subtitle">Monthly spending against your limits</div></div><button class="btn secondary" data-route="budgets">Manage</button></div>${budgetSummary(budgets, tx)}</article></div>`;
  }
  const chartColors = ["#6658e8", "#24a77a", "#f2ad40", "#e46d75", "#47a5ca", "#a46bd1", "#78b45a", "#e4874d"];
  function categoryChart(tx) {
    const expenses = tx.filter(t => t.type === "expense");
    const group = {};
    expenses.forEach(t => group[t.category] = (group[t.category] || 0) + Number(t.amount));
    const items = Object.entries(group).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const sum = items.reduce((a, [, v]) => a + v, 0);
    if (!sum) return `<div class="empty-state">Add expenses to see your spending breakdown.</div>`;
    let offset = 0;
    const paths = items.map(([name, value], i) => {
      const length = value / sum * 100;
      const circle = `<circle cx="60" cy="60" r="44" fill="none" stroke="${chartColors[i % chartColors.length]}" stroke-width="14" stroke-dasharray="${length} ${100 - length}" stroke-dashoffset="${-offset}" pathLength="100" transform="rotate(-90 60 60)"/>`;
      offset += length;
      return circle;
    }).join("");
    return `<div class="donut-layout"><svg class="donut-svg" viewBox="0 0 120 120" role="img" aria-label="Spending by category">${paths}<text x="60" y="58" text-anchor="middle" fill="var(--text)" font-size="12" font-weight="700">${money(sum)}</text><text x="60" y="72" text-anchor="middle" fill="var(--muted)" font-size="7">spent</text></svg><div class="legend">${items.map(([name, value], i) => `<div class="legend-row"><span class="legend-name"><i class="legend-dot" style="background:${chartColors[i % chartColors.length]}"></i>${escapeHtml(name)}</span><strong>${Math.round(value / sum * 100)}%</strong></div>`).join("")}</div></div>`;
  }
  function budgetSummary(budgets, tx) {
    if (!budgets.length) return `<div class="empty-state">No budgets set up yet.</div>`;
    return budgets.slice(0, 4).map(b => {
      const spent = tx.filter(t => t.type === "expense" && t.category === b.category).reduce((s, t) => s + Number(t.amount), 0);
      const pct = spent > b.limit ? Math.max(101, Math.round(spent / b.limit * 100)) : Math.round(spent / b.limit * 100);
      const over = spent > b.limit;
      const warn = !over && spent > b.limit * .8;
      const cls = over ? "over" : warn ? "warn" : "";
      return `<div class="budget-row"><div class="budget-info"><div class="budget-meta"><strong>${escapeHtml(b.category)}</strong><span>${money(spent)} / ${money(b.limit)}</span></div><div class="progress ${cls}"><span style="width:${Math.min(100, pct)}%"></span></div></div><span class="pill ${over ? "expense" : warn ? "warning" : ""}">${pct}%</span></div>`;
    }).join("");
  }
  function transactionPage(kind) {
    const title = kind === "income" ? "Income" : kind === "expenses" ? "Expenses" : "All transactions";
    const rows = visibleTransactions();
    return `<article class="card"><div class="section-head"><div><h2 class="section-title">${title}</h2><div class="section-subtitle">Track and manage every money movement</div></div><button class="btn" data-action="new-transaction" ${kind === "income" ? 'data-type="income"' : kind === "expenses" ? 'data-type="expense"' : ""}>＋ Add ${kind === "income" ? "income" : kind === "expenses" ? "expense" : "transaction"}</button></div>
      <div class="toolbar" style="margin-bottom:13px"><input aria-label="Search transactions" placeholder="Search transactions…" value="${escapeHtml(transactionFilter.query)}" data-filter="query"><select aria-label="Filter transaction type" data-filter="type"><option value="all" ${transactionFilter.type === "all" ? "selected" : ""}>All types</option><option value="income" ${transactionFilter.type === "income" ? "selected" : ""}>Income</option><option value="expense" ${transactionFilter.type === "expense" ? "selected" : ""}>Expenses</option></select><span class="section-subtitle">${rows.length} transactions</span></div>${transactionTable(rows) }
      </article>`;
  }
  function budgetsPage() {
    const budgets = userRows("budgets");
    const tx = monthTx();
    return `<article class="card"><div class="section-head"><div><h2 class="section-title">Monthly budgets</h2><div class="section-subtitle">Stay ahead with category spending limits</div></div><button class="btn" data-action="new-budget">＋ Create budget</button></div>${budgets.length ? budgets.map(b => {
      const spent = tx.filter(t => t.type === "expense" && t.category === b.category).reduce((s, t) => s + Number(t.amount), 0);
      const pct = spent > b.limit ? Math.max(101, Math.round(spent / b.limit * 100)) : Math.round(spent / b.limit * 100);
      const over = spent > b.limit;
      const warn = !over && spent > b.limit * .8;
      const cls = over ? "over" : warn ? "warn" : "";
      return `<div class="budget-row"><div class="budget-info"><div class="budget-meta"><strong>${escapeHtml(b.category)}</strong><span>${money(spent)} spent of ${money(b.limit)}</span></div><div class="progress ${cls}"><span style="width:${Math.min(100, pct)}%"></span></div></div><div style="display:flex;align-items:center;gap:8px"><span class="pill ${over ? "expense" : warn ? "warning" : ""}">${pct}%</span><button class="btn ghost" style="padding:6px 9px" data-action="delete-budget" data-id="${encode(b.id)}" aria-label="Delete ${escapeHtml(b.category)} budget">×</button></div></div>${over ? `<div class="section-subtitle negative">${escapeHtml(b.category)} budget exceeded by ${money(spent - b.limit)}.</div>` : warn ? `<div class="section-subtitle" style="color:#b8790c">${escapeHtml(b.category)} budget is over 80% used.</div>` : ""}`;
    }).join("") : `<div class="empty-state">No budgets yet. Create one to set your monthly spending limits.</div>`}</article>
      <article class="card"><h2 class="section-title">How alerts work</h2><p class="section-subtitle">You’ll see a heads-up when a category passes 80% of its limit and a clear breach alert when spending passes 100%.</p></article>`;
  }
  function goalsPage() {
    const goals = userRows("goals");
    return `<div class="section-head"><div><h2 class="section-title">Goals worth saving for</h2><div class="section-subtitle">Small steps add up to something big</div></div><button class="btn" data-action="new-goal">＋ New goal</button></div>
      ${goals.length ? `<div class="grid-2">${goals.map(g => {
        const pct = Math.round(g.saved / g.target * 100);
        return `<article class="card goal-card"><div><span class="goal-emoji">${escapeHtml(g.emoji || "◎")}</span><h2 class="section-title" style="margin-top:11px">${escapeHtml(g.name)}</h2><div class="section-subtitle">Target date · ${fmtDate(g.deadline)}</div></div><div class="goal-amount">${pct}%</div><div class="progress"><span style="width:${Math.min(100, pct)}%"></span></div><div class="section-subtitle">${money(g.saved)} saved of ${money(g.target)}</div><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn secondary" data-action="contribute-goal" data-id="${encode(g.id)}">＋ Add savings</button><button class="btn ghost" data-action="delete-goal" data-id="${encode(g.id)}">×</button></div></article>`;
      }).join("")}</div>` : `<article class="card empty-state">No savings goals yet. Create one and start making progress.</article>`}`;
  }
  function recurringPage() {
    const items = userRows("recurring").sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    const due = items.filter(item => item.nextDate <= dateISO());
    return `<article class="card"><div class="section-head"><div><h2 class="section-title">Recurring transactions</h2><div class="section-subtitle">Automate the entries that happen on a schedule</div></div><div class="toolbar"><button class="btn secondary" data-action="process-due" ${due.length ? "" : "disabled"}>Process due (${due.length})</button><button class="btn" data-action="new-recurring">＋ Add recurring</button></div></div>
      ${items.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Category</th><th>Frequency</th><th>Next due</th><th>Amount</th><th></th></tr></thead><tbody>${items.map(item => `<tr><td><div class="transaction-name">${escapeHtml(item.name)}</div></td><td>${escapeHtml(item.category)}</td><td><span class="pill">${escapeHtml(item.frequency)}</span></td><td>${fmtDate(item.nextDate)} ${item.nextDate <= dateISO() ? '<span class="pill warning">Due</span>' : ""}</td><td>${item.type === "expense" ? "−" : "+"}${money(item.amount)}</td><td><button class="btn ghost" style="padding:6px 9px" data-action="delete-recurring" data-id="${encode(item.id)}">×</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No recurring entries. Add rent, salary, subscriptions or other scheduled payments.</div>`}</article>`;
  }
  function reportsPage() {
    const tx = monthTx();
    const years = [...new Set(userRows("transactions").map(t => t.date.slice(0, 4)))].sort().reverse();
    return `<article class="card"><div class="section-head"><div><h2 class="section-title">Your money, in perspective</h2><div class="section-subtitle">Monthly performance and category insights</div></div><div class="toolbar"><button class="btn secondary" data-action="export-csv">⇩ Export Excel (CSV)</button><button class="btn" data-action="export-pdf">⇩ Export PDF</button></div></div>
      <div class="grid-4">${statCard("Income this month", money(total(tx, "income")), "↗", "Current month", "positive")}${statCard("Expenses this month", money(total(tx, "expense")), "↘", "Current month", "negative")}${statCard("Net savings", money(total(tx, "income") - total(tx, "expense")), "◈", "Income less expenses")}${statCard("Savings rate", `${total(tx, "income") ? Math.round((total(tx, "income") - total(tx, "expense")) / total(tx, "income") * 100) : 0}%`, "◎", "This month")}</div></article>
      <div class="grid-2"><article class="card"><div class="section-head"><div><h2 class="section-title">Monthly cash flow</h2><div class="section-subtitle">Compare income and expenses</div></div></div><div class="chart-wrap"><canvas id="cashflow-chart"></canvas></div></article><article class="card"><div class="section-head"><div><h2 class="section-title">Spending by category</h2></div></div>${categoryChart(tx)}</article></div>
      <article class="card"><div class="section-head"><div><h2 class="section-title">All activity</h2><div class="section-subtitle">Transactions from ${years[0] || new Date().getFullYear()} onward</div></div></div>${transactionTable(userRows("transactions").slice().sort((a, b) => b.date.localeCompare(a.date)), false)}</article>`;
  }
  function notificationsPage() {
    const items = userRows("notifications").sort((a, b) => b.date.localeCompare(a.date));
    return `<article class="card"><div class="section-head"><div><h2 class="section-title">Your notifications</h2><div class="section-subtitle">Stay in the loop with your finances</div></div><button class="btn secondary" data-action="mark-read">Mark all as read</button></div>${items.length ? items.map(n => `<div class="notification"><span class="notification-icon">${escapeHtml(n.icon || "◉")}</span><div style="flex:1"><p style="${n.read ? "color:var(--muted)" : ""}">${escapeHtml(n.text)}</p><small>${new Date(n.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small></div>${n.read ? "" : '<span class="badge-dot" style="position:static"></span>'}</div>`).join("") : `<div class="empty-state">You’re all caught up. New updates will appear here.</div>`}</article>`;
  }
  function profilePage() {
    return `<article class="card"><div class="section-head"><div><h2 class="section-title">Personal details</h2><div class="section-subtitle">The basics of your Paisa account</div></div></div><div class="profile-head"><div class="profile-photo">${escapeHtml(currentUser.name.split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase())}</div><div><strong>${escapeHtml(currentUser.name)}</strong><div class="section-subtitle">${escapeHtml(currentUser.email)} · ${currentUser.role === "admin" ? "Administrator" : "Personal account"}</div></div></div><form data-form="profile"><div class="form-grid"><div class="field"><label for="profile-name">Full name</label><input id="profile-name" name="name" value="${escapeHtml(currentUser.name)}" required></div><div class="field"><label>Email address</label><input value="${escapeHtml(currentUser.email)}" disabled></div></div><div class="form-actions"><button class="btn" type="submit">Save changes</button></div></form></article>
      <article class="card"><div class="section-head"><div><h2 class="section-title">Security</h2><div class="section-subtitle">Your password is hashed locally with a unique salt</div></div></div><button class="btn secondary" data-action="change-password">Change password</button></article>`;
  }
  function settingsPage() {
    return `<article class="card"><div class="section-head"><div><h2 class="section-title">Preferences</h2><div class="section-subtitle">Make Paisa feel like yours</div></div></div>
      <div class="settings-row"><div><strong>Appearance</strong><p>Choose a light or dark interface</p></div><button class="switch ${state.settings.theme === "dark" ? "on" : ""}" role="switch" aria-checked="${state.settings.theme === "dark"}" data-action="toggle-theme" aria-label="Toggle dark theme"></button></div>
      <div class="settings-row"><div><strong>Currency</strong><p>Used for totals and reports</p></div><select data-setting="currency" aria-label="Currency"><option value="INR" ${state.settings.currency === "INR" ? "selected" : ""}>INR · Indian Rupee (₹)</option><option value="USD" ${state.settings.currency === "USD" ? "selected" : ""}>USD · US Dollar ($)</option><option value="EUR" ${state.settings.currency === "EUR" ? "selected" : ""}>EUR · Euro (€)</option><option value="GBP" ${state.settings.currency === "GBP" ? "selected" : ""}>GBP · Pound (£)</option></select></div>
      <div class="settings-row"><div><strong>Financial notifications</strong><p>Budget and savings goal updates</p></div><button class="switch ${state.settings.notifications ? "on" : ""}" role="switch" aria-checked="${Boolean(state.settings.notifications)}" data-action="toggle-notifications" aria-label="Toggle notifications"></button></div>
      </article><article class="card"><div class="section-head"><div><h2 class="section-title">Your local data</h2><div class="section-subtitle">Data stays in this browser. Current storage: ${storageMode === "indexedDB" ? "IndexedDB" : "LocalStorage fallback"}.</div></div></div><button class="btn danger" data-action="clear-data">Clear my transactions and plans</button></article>`;
  }
  function adminPage() {
    const tx = state.transactions;
    const users = state.users;
    return `<div class="grid-4">${statCard("Registered users", users.length, "♙", "On this browser")}${statCard("Transactions", tx.length, "⇄", "Across all users")}${statCard("Total tracked", money(tx.reduce((n, t) => n + Number(t.amount), 0)), "◈", "Income and expenses")}${statCard("Storage", storageMode === "indexedDB" ? "IndexedDB" : "Local", "▤", "Client-side persistence")}</div><article class="card"><div class="section-head"><div><h2 class="section-title">Accounts on this device</h2><div class="section-subtitle">Admin access is restricted to administrator accounts</div></div></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead><tbody>${users.map(u => `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td><span class="pill">${escapeHtml(u.role)}</span></td><td>${new Date(u.createdAt).toLocaleDateString("en-IN")}</td></tr>`).join("")}</tbody></table></div></article><article class="card"><strong>Local-only security note</strong><p class="section-subtitle">This dashboard and its data are stored in the browser. Client-side roles are suitable for a demo, not production access control. Use a trusted backend before handling real accounts or financial data.</p></article>`;
  }
  function drawChart() {
    const canvas = $("#cashflow-chart");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    const data = [-5, -4, -3, -2, -1, 0].map(getMonthTotals);
    const max = Math.max(10000, ...data.flatMap(d => [d.income, d.expense]));
    const w = rect.width, h = rect.height, pad = { l: 43, r: 12, t: 12, b: 28 };
    const plotH = h - pad.t - pad.b, plotW = w - pad.l - pad.r;
    const css = getComputedStyle(document.body);
    ctx.font = "10px DM Sans, sans-serif";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + plotH * i / 3;
      ctx.strokeStyle = css.getPropertyValue("--line");
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillStyle = css.getPropertyValue("--muted");
      const value = max * (1 - i / 3);
      ctx.textAlign = "right";
      ctx.fillText(value >= 100000 ? `${Math.round(value / 100000)}L` : `${Math.round(value / 1000)}k`, pad.l - 8, y);
    }
    const groupW = plotW / data.length, barW = Math.min(19, groupW * .25);
    data.forEach((d, i) => {
      const center = pad.l + groupW * (i + .5);
      [[d.income, "#6658e8", -barW / 2], [d.expense, "#24a77a", barW / 2]].forEach(([value, color, shift]) => {
        const bh = Math.max(1, Number(value) / max * plotH);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.roundRect(center + shift - barW / 2, pad.t + plotH - bh, barW, bh, [4, 4, 0, 0]); ctx.fill();
      });
      ctx.fillStyle = css.getPropertyValue("--muted");
      ctx.textAlign = "center";
      ctx.fillText(d.label, center, h - 10);
    });
  }
  async function render() {
    document.body.classList.toggle("dark", Boolean(state && state.settings.theme === "dark"));
    if (!currentUser) {
      app.innerHTML = authPage(route === "register" || route === "forgot" ? route : "login");
      return;
    }
    app.innerHTML = shell(getPage(route));
    requestAnimationFrame(drawChart);
  }
  function openModal(title, body) {
    const existing = $("#modal-backdrop");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h3 id="modal-title">${title}</h3><button class="icon-btn" data-action="close-modal" aria-label="Close dialog">×</button></div>${body}</section></div>`);
    const first = $("#modal-backdrop input");
    if (first) first.focus();
  }
  function formField(label, name, options = {}) {
    const { type = "text", value = "", required = true, placeholder = "", min = "", step = "", full = false, choices = null } = options;
    const attrs = `name="${name}" ${required ? "required" : ""} ${min !== "" ? `min="${min}"` : ""} ${step ? `step="${step}"` : ""} placeholder="${placeholder}" value="${escapeHtml(value)}"`;
    const input = choices ? `<select name="${name}" ${required ? "required" : ""}>${choices.map(c => `<option value="${escapeHtml(c)}" ${c === value ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select>` :
      type === "textarea" ? `<textarea name="${name}" ${required ? "required" : ""} placeholder="${placeholder}">${escapeHtml(value)}</textarea>` :
      `<input type="${type}" ${attrs}>`;
    return `<div class="field ${full ? "full" : ""}"><label>${label}</label>${input}</div>`;
  }
  function openTransactionModal(type) {
    const selected = type || "expense";
    const body = `<form data-form="transaction" class="form-grid">${formField("Name", "name", { placeholder: "e.g. Grocery shopping" })}${formField("Type", "type", { value: selected, choices: ["expense", "income"] })}${formField("Category", "category", { value: selected === "income" ? "Salary" : "Food", choices: selected === "income" ? ["Salary", "Freelance", "Investment", "Gift", "Other"] : ["Food", "Housing", "Transport", "Dining", "Utilities", "Health", "Shopping", "Entertainment", "Education", "Other"] })}${formField("Amount (₹)", "amount", { type: "number", min: "0.01", step: "0.01" })}${formField("Date", "date", { type: "date", value: dateISO() })}${formField("Note", "note", { required: false, placeholder: "Optional details", full: true })}${formField("Receipt attachment", "receipt", { type: "file", required: false, full: true })}<div class="form-actions field full"><button class="btn ghost" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit">Save transaction</button></div></form>`;
    openModal("Add transaction", body);
  }
  function openBudgetModal() {
    openModal("Create a budget", `<form data-form="budget" class="form-grid">${formField("Category", "category", { value: "Food", choices: ["Food", "Housing", "Transport", "Dining", "Utilities", "Health", "Shopping", "Entertainment", "Education", "Other"] })}${formField("Monthly limit (₹)", "limit", { type: "number", min: "1", step: "1" })}<div class="form-actions field full"><button class="btn ghost" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit">Create budget</button></div></form>`);
  }
  function openGoalModal() {
    openModal("Create savings goal", `<form data-form="goal" class="form-grid">${formField("Goal name", "name", { placeholder: "e.g. New home" })}${formField("Icon", "emoji", { value: "◎" })}${formField("Target amount (₹)", "target", { type: "number", min: "1", step: "1" })}${formField("Target date", "deadline", { type: "date" })}<div class="form-actions field full"><button class="btn ghost" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit">Create goal</button></div></form>`);
  }
  function openRecurringModal() {
    openModal("Add recurring transaction", `<form data-form="recurring" class="form-grid">${formField("Name", "name", { placeholder: "e.g. Monthly rent" })}${formField("Type", "type", { value: "expense", choices: ["expense", "income"] })}${formField("Category", "category", { value: "Housing", choices: ["Housing", "Salary", "Food", "Transport", "Utilities", "Entertainment", "Other"] })}${formField("Amount (₹)", "amount", { type: "number", min: "0.01", step: "0.01" })}${formField("Frequency", "frequency", { value: "monthly", choices: ["weekly", "monthly", "quarterly", "yearly"] })}${formField("Next due date", "nextDate", { type: "date", value: dateISO() })}<div class="form-actions field full"><button class="btn ghost" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit">Save schedule</button></div></form>`);
  }
  async function fileAsData(file) {
    if (!file) return "";
    if (file.size > 2 * 1024 * 1024) throw new Error("Receipt must be 2 MB or smaller.");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read receipt attachment."));
      reader.readAsDataURL(file);
    });
  }
  async function handleForm(form) {
    const kind = form.dataset.form;
    const data = new FormData(form);
    const value = name => String(data.get(name) || "").trim();
    if (kind === "login") {
      const account = state.users.find(u => u.email === value("email").toLowerCase());
      if (!account || account.passwordHash !== await hashPassword(value("password"), account.salt)) throw new Error("Email or password is incorrect.");
      currentUser = account;
      localStorage.setItem("paisa-session", account.id);
      route = "dashboard";
      await render();
      return;
    }
    if (kind === "register") {
      if (state.users.some(u => u.email === value("email").toLowerCase())) throw new Error("An account with this email already exists.");
      if (value("password").length < 8) throw new Error("Use at least 8 characters for your password.");
      const user = await makeUser({ name: value("name"), email: value("email"), password: value("password") });
      state.users.push(user);
      currentUser = user;
      localStorage.setItem("paisa-session", user.id);
      await saveState();
      route = "dashboard";
      await render();
      toast("Your account is ready.");
      return;
    }
    if (kind === "forgot") {
      const account = state.users.find(u => u.email === value("email").toLowerCase());
      toast(account ? "This local demo has no email server. Sign in or use Change password in your profile." : "If that email has an account, reset instructions would be sent.");
      return;
    }
    if (kind === "transaction") {
      const file = form.elements.receipt.files[0];
      const receipt = await fileAsData(file);
      state.transactions.unshift({ id: uid(), userId: currentUser.id, name: value("name"), category: value("category"), type: value("type"), amount: Number(value("amount")), date: value("date"), note: value("note"), receipt });
      const affected = userRows("budgets").find(b => b.category === value("category"));
      if (value("type") === "expense" && affected && value("date").slice(0, 7) === dateISO().slice(0, 7)) {
        const spent = monthTx().filter(t => t.type === "expense" && t.category === affected.category).reduce((n, t) => n + Number(t.amount), 0);
        const before = spent - Number(value("amount"));
        if (spent > affected.limit && before <= affected.limit) await notify(`${affected.category} spending has passed its budget limit of ${money(affected.limit)}.`, "!");
        else if (spent > affected.limit * .8 && before <= affected.limit * .8) await notify(`${affected.category} spending is over 80% of its monthly budget.`, "!");
      }
      await saveState();
      $("#modal-backdrop").remove();
      await render();
      toast("Transaction saved.");
      return;
    }
    if (kind === "budget") {
      if (userRows("budgets").some(b => b.category === value("category"))) throw new Error("You already have a budget for this category.");
      state.budgets.push({ id: uid(), userId: currentUser.id, category: value("category"), limit: Number(value("limit")) });
      await saveState(); $("#modal-backdrop").remove(); await render(); toast("Budget created."); return;
    }
    if (kind === "goal") {
      state.goals.push({ id: uid(), userId: currentUser.id, name: value("name"), emoji: value("emoji") || "◎", target: Number(value("target")), saved: 0, deadline: value("deadline") });
      await saveState(); $("#modal-backdrop").remove(); await render(); toast("Savings goal created."); return;
    }
    if (kind === "contribute") {
      const goal = userRows("goals").find(g => g.id === form.dataset.id);
      if (!goal) throw new Error("That savings goal could not be found.");
      goal.saved += Number(value("amount"));
      await saveState(); $("#modal-backdrop").remove(); await render(); toast("Savings added to your goal."); return;
    }
    if (kind === "recurring") {
      state.recurring.push({ id: uid(), userId: currentUser.id, name: value("name"), type: value("type"), category: value("category"), amount: Number(value("amount")), frequency: value("frequency"), nextDate: value("nextDate") });
      await saveState(); $("#modal-backdrop").remove(); await render(); toast("Recurring transaction scheduled."); return;
    }
    if (kind === "profile") {
      currentUser.name = value("name");
      const user = state.users.find(u => u.id === currentUser.id);
      user.name = currentUser.name;
      await saveState(); await render(); toast("Profile updated."); return;
    }
    if (kind === "password") {
      const user = state.users.find(u => u.id === currentUser.id);
      if (user.passwordHash !== await hashPassword(value("oldPassword"), user.salt)) throw new Error("Current password is incorrect.");
      if (value("newPassword").length < 8) throw new Error("Use at least 8 characters for your new password.");
      const updated = await makeUser({ id: user.id, name: user.name, email: user.email, password: value("newPassword"), role: user.role });
      Object.assign(user, { salt: updated.salt, passwordHash: updated.passwordHash });
      await saveState(); $("#modal-backdrop").remove(); toast("Password updated."); return;
    }
  }
  function exportCSV() {
    const rows = userRows("transactions").slice().sort((a, b) => a.date.localeCompare(b.date));
    const csv = [["Date", "Name", "Type", "Category", "Amount", "Note"], ...rows.map(t => [t.date, t.name, t.type, t.category, t.amount, t.note || ""])]
      .map(row => row.map(cell => {
        const text = String(cell);
        const safe = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
        return `"${safe.replace(/"/g, '""')}"`;
      }).join(",")).join("\r\n");
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.href = url;
    link.download = `paisa-report-${dateISO()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Excel-compatible CSV downloaded.");
  }
  function advanceDate(date, frequency) {
    const next = new Date(`${date}T00:00:00`);
    if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else {
      const day = next.getDate();
      if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1, next.getMonth(), 1);
      else {
        next.setDate(1);
        next.setMonth(next.getMonth() + (frequency === "quarterly" ? 3 : 1));
      }
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
    }
    return dateISO(next);
  }
  async function processDue() {
    const due = userRows("recurring").filter(item => item.nextDate <= dateISO());
    if (!due.length) return toast("There are no recurring transactions due today.");
    due.forEach(item => {
      state.transactions.unshift({ id: uid(), userId: currentUser.id, name: item.name, category: item.category, type: item.type, amount: Number(item.amount), date: item.nextDate, note: `Recurring · ${item.frequency}`, receipt: "" });
      item.nextDate = advanceDate(item.nextDate, item.frequency);
    });
    await saveState();
    await notify(`${due.length} due recurring transaction${due.length === 1 ? "" : "s"} processed.`, "↻");
    await render();
    toast(`${due.length} recurring transaction${due.length === 1 ? "" : "s"} processed.`);
  }
  document.addEventListener("click", async event => {
    const routeEl = event.target.closest("[data-route]");
    if (routeEl) {
      event.preventDefault();
      route = routeEl.dataset.route;
      transactionFilter = { query: "", type: "all" };
      $("#sidebar")?.classList.remove("open");
      $("#mobile-overlay")?.classList.remove("show");
      await render();
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    try {
      if (action === "menu") { $("#sidebar")?.classList.add("open"); $("#mobile-overlay")?.classList.add("show"); }
      if (action === "logout") { currentUser = null; route = "login"; localStorage.removeItem("paisa-session"); await render(); }
      if (action === "new-transaction") openTransactionModal(button.dataset.type);
      if (action === "new-budget") openBudgetModal();
      if (action === "new-goal") openGoalModal();
      if (action === "new-recurring") openRecurringModal();
      if (action === "close-modal") $("#modal-backdrop")?.remove();
      if (action === "delete-transaction") {
        const row = userRows("transactions").find(t => t.id === decodeURIComponent(button.dataset.id));
        if (row && confirm(`Delete "${row.name}"?`)) { state.transactions = state.transactions.filter(t => t.id !== row.id); await saveState(); await render(); toast("Transaction deleted."); }
      }
      if (action === "delete-budget") { state.budgets = state.budgets.filter(b => b.id !== decodeURIComponent(button.dataset.id) || b.userId !== currentUser.id); await saveState(); await render(); toast("Budget deleted."); }
      if (action === "delete-goal") { state.goals = state.goals.filter(g => g.id !== decodeURIComponent(button.dataset.id) || g.userId !== currentUser.id); await saveState(); await render(); toast("Goal deleted."); }
      if (action === "delete-recurring") { state.recurring = state.recurring.filter(r => r.id !== decodeURIComponent(button.dataset.id) || r.userId !== currentUser.id); await saveState(); await render(); toast("Schedule deleted."); }
      if (action === "contribute-goal") {
        openModal("Add savings", `<form data-form="contribute" data-id="${escapeHtml(decodeURIComponent(button.dataset.id))}" class="form-grid">${formField("Amount to add (₹)", "amount", { type: "number", min: "0.01", step: "0.01" })}<div class="form-actions field full"><button class="btn ghost" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit">Add savings</button></div></form>`);
      }
      if (action === "process-due") await processDue();
      if (action === "export-csv") exportCSV();
      if (action === "export-pdf") window.print();
      if (action === "mark-read") { userRows("notifications").forEach(n => n.read = true); await saveState(); await render(); toast("Notifications marked as read."); }
      if (action === "toggle-theme") { state.settings.theme = state.settings.theme === "dark" ? "light" : "dark"; await saveState(); await render(); }
      if (action === "toggle-notifications") { state.settings.notifications = !state.settings.notifications; await saveState(); await render(); }
      if (action === "change-password") openModal("Change password", `<form data-form="password" class="form-grid">${formField("Current password", "oldPassword", { type: "password" })}${formField("New password", "newPassword", { type: "password", min: "8" })}<div class="form-actions field full"><button class="btn ghost" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit">Update password</button></div></form>`);
      if (action === "clear-data" && confirm("Delete all your transactions, budgets, goals and recurring schedules? Your account will remain.")) {
        ["transactions", "budgets", "goals", "recurring", "notifications"].forEach(key => { state[key] = state[key].filter(row => row.userId !== currentUser.id); });
        await saveState(); await render(); toast("Your local financial data was cleared.");
      }
    } catch (error) { console.error(error); toast(error.message || "That action could not be completed.", true); }
  });
  document.addEventListener("submit", async event => {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try { await handleForm(form); }
    catch (error) { console.error(error); toast(error.message || "Could not save your changes.", true); }
    finally { if (submit && submit.isConnected) submit.disabled = false; }
  });
  app.addEventListener("input", event => {
    if (event.target.dataset.filter === "query") {
      transactionFilter.query = event.target.value;
      const selection = event.target.selectionStart;
      const content = transactionPage(route);
      const card = app.querySelector(".content");
      card.innerHTML = content;
      const search = $('[data-filter="query"]');
      search?.focus();
      search?.setSelectionRange(selection, selection);
    }
  });
  app.addEventListener("change", async event => {
    const filter = event.target.dataset.filter;
    if (filter === "type") { transactionFilter.type = event.target.value; await render(); }
    if (event.target.dataset.setting === "currency") {
      state.settings.currency = event.target.value;
      await saveState();
      await render();
      toast("Currency preference saved.");
    }
  });
  window.addEventListener("resize", () => requestAnimationFrame(drawChart));
  async function boot() {
    try {
      try { db = await openDB(); } catch (error) { console.warn("IndexedDB unavailable; using LocalStorage.", error); storageMode = "localStorage"; }
      state = await readState() || initialState();
      ["users", "transactions", "budgets", "goals", "recurring", "notifications"].forEach(key => { if (!Array.isArray(state[key])) state[key] = []; });
      state.settings = Object.assign({ theme: "light", currency: "INR", notifications: true }, state.settings || {});
      await seedUsers();
      const id = localStorage.getItem("paisa-session");
      currentUser = state.users.find(u => u.id === id) || null;
      if (id && !currentUser) localStorage.removeItem("paisa-session");
      await render();
    } catch (error) {
      console.error(error);
      app.innerHTML = `<main class="auth-panel"><section class="auth-box"><h2>Couldn’t load Paisa</h2><p>${escapeHtml(error.message)}</p><button class="btn" onclick="location.reload()">Try again</button></section></main>`;
    }
  }
  boot();
})();
