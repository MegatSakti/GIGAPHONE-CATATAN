const STORAGE_KEY = "gigaphone-finance-v1";

const TRANSACTION_TYPES = [
  "Service / JB HP",
  "Top Up DANA",
  "Top Up GoPay",
  "Top Up OVO",
  "Paket Data",
  "Tarik Tunai",
  "Belanja Kebutuhan"
];

const ACCOUNT_DEFAULTS = [
  { id: "cash", name: "Cash", openingBalance: 0 },
  { id: "seabank", name: "SeaBank", openingBalance: 0 },
  { id: "bri", name: "BRI", openingBalance: 0 },
  { id: "mandiri", name: "Bank Mandiri", openingBalance: 500000 },
  { id: "bca", name: "BCA", openingBalance: 0 }
];

let state = loadState();
let deferredInstallPrompt = null;

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const el = {
  totalBalance: document.querySelector("#totalBalance"),
  todayProfit: document.querySelector("#todayProfit"),
  todayCount: document.querySelector("#todayCount"),
  monthProfit: document.querySelector("#monthProfit"),
  dashboardAccounts: document.querySelector("#dashboardAccounts"),
  dailyBalanceShortcut: document.querySelector("#dailyBalanceShortcut"),
  quickActions: document.querySelector("#quickActions"),
  recentTransactions: document.querySelector("#recentTransactions"),
  transactionForm: document.querySelector("#transactionForm"),
  transactionId: document.querySelector("#transactionId"),
  typeInput: document.querySelector("#typeInput"),
  dateInput: document.querySelector("#dateInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  costInput: document.querySelector("#costInput"),
  sellInput: document.querySelector("#sellInput"),
  accountInput: document.querySelector("#accountInput"),
  costField: document.querySelector("#costField span"),
  sellField: document.querySelector("#sellField span"),
  previewIn: document.querySelector("#previewIn"),
  previewProfit: document.querySelector("#previewProfit"),
  formTitle: document.querySelector("#formTitle"),
  saveButton: document.querySelector("#saveButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  searchInput: document.querySelector("#searchInput"),
  historyTypeFilter: document.querySelector("#historyTypeFilter"),
  historyAccountFilter: document.querySelector("#historyAccountFilter"),
  historyDateFilter: document.querySelector("#historyDateFilter"),
  historyList: document.querySelector("#historyList"),
  reportTodayProfit: document.querySelector("#reportTodayProfit"),
  reportWeekProfit: document.querySelector("#reportWeekProfit"),
  reportMonthProfit: document.querySelector("#reportMonthProfit"),
  reportTotalIn: document.querySelector("#reportTotalIn"),
  reportTotalOut: document.querySelector("#reportTotalOut"),
  reportTotalCount: document.querySelector("#reportTotalCount"),
  typeBreakdown: document.querySelector("#typeBreakdown"),
  accountBreakdown: document.querySelector("#accountBreakdown"),
  settingsAccounts: document.querySelector("#settingsAccounts"),
  dailyBalanceForm: document.querySelector("#dailyBalanceForm"),
  dailyBalanceDate: document.querySelector("#dailyBalanceDate"),
  dailyBalanceInputs: document.querySelector("#dailyBalanceInputs"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  installButton: document.querySelector("#installButton")
};

init();

function init() {
  ensureAccountDefaults();
  populateSelects();
  bindEvents();
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}

function loadState() {
  const fallback = {
    accounts: ACCOUNT_DEFAULTS,
    transactions: [],
    dailyBalances: {}
  };

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || !Array.isArray(stored.transactions)) return fallback;
    return {
      accounts: Array.isArray(stored.accounts) ? stored.accounts : ACCOUNT_DEFAULTS,
      transactions: stored.transactions,
      dailyBalances: stored.dailyBalances || {}
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureAccountDefaults() {
  const existing = new Map(state.accounts.map((account) => [account.id, account]));
  state.accounts = ACCOUNT_DEFAULTS.map((account) => ({
    ...account,
    ...(existing.get(account.id) || {})
  }));
  saveState();
}

function populateSelects() {
  el.typeInput.innerHTML = TRANSACTION_TYPES.map(optionTag).join("");
  el.historyTypeFilter.innerHTML = `<option value="">Semua Jenis</option>${TRANSACTION_TYPES.map(optionTag).join("")}`;
  refreshAccountSelects();
}

function refreshAccountSelects() {
  const accountOptions = state.accounts.map((account) => `<option value="${account.id}">${account.name}</option>`).join("");
  el.accountInput.innerHTML = accountOptions;
  el.historyAccountFilter.innerHTML = `<option value="">Semua Akun</option>${accountOptions}`;
}

function bindEvents() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.nav));
  });

  el.quickActions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-type]");
    if (!button) return;
    resetForm();
    el.typeInput.value = button.dataset.type;
    updateTransactionFormLabels();
    navigate("transaction");
  });

  el.transactionForm.addEventListener("submit", saveTransaction);
  el.dailyBalanceShortcut.addEventListener("click", () => {
    navigate("settings");
    el.dailyBalanceDate.focus();
    el.dailyBalanceDate.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  el.dailyBalanceForm.addEventListener("submit", saveDailyBalances);
  el.dailyBalanceDate.addEventListener("change", renderDailyBalanceInputs);
  el.cancelEditButton.addEventListener("click", resetForm);
  el.typeInput.addEventListener("change", updateTransactionFormLabels);
  el.costInput.addEventListener("input", renderPreview);
  el.sellInput.addEventListener("input", renderPreview);

  [el.searchInput, el.historyTypeFilter, el.historyAccountFilter, el.historyDateFilter].forEach((input) => {
    input.addEventListener("input", renderHistory);
  });

  el.historyList.addEventListener("click", handleHistoryAction);
  el.exportButton.addEventListener("click", exportBackup);
  el.importInput.addEventListener("change", importBackup);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    el.installButton.hidden = false;
  });

  el.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    el.installButton.hidden = true;
  });
}

function navigate(page) {
  document.querySelectorAll(".page").forEach((section) => section.classList.remove("active"));
  document.querySelector(`#page-${page}`).classList.add("active");

  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === page);
  });

  const title = document.querySelector(`#page-${page}`).dataset.title;
  document.querySelector(".topbar h1").textContent = title === "Dashboard" ? "GigaPhone Finance" : title;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveTransaction(event) {
  event.preventDefault();

  const type = el.typeInput.value;
  const cost = toNumber(el.costInput.value);
  const sellRaw = toNumber(el.sellInput.value);
  const isCashWithdraw = type === "Tarik Tunai";
  const isExpense = type === "Belanja Kebutuhan";
  const moneyIn = isExpense ? 0 : isCashWithdraw ? cost + sellRaw : sellRaw;

  const transaction = {
    id: el.transactionId.value || crypto.randomUUID(),
    type,
    date: el.dateInput.value,
    description: el.descriptionInput.value.trim(),
    cost,
    sell: moneyIn,
    fee: isCashWithdraw ? sellRaw : null,
    expense: isExpense,
    accountId: el.accountInput.value,
    createdAt: el.transactionId.value ? getExistingCreatedAt(el.transactionId.value) : new Date().toISOString()
  };

  const index = state.transactions.findIndex((item) => item.id === transaction.id);
  if (index >= 0) {
    state.transactions[index] = transaction;
  } else {
    state.transactions.push(transaction);
  }

  saveState();
  resetForm();
  navigate("dashboard");
  render();
}

function getExistingCreatedAt(id) {
  return state.transactions.find((item) => item.id === id)?.createdAt || new Date().toISOString();
}

function handleHistoryAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const transaction = state.transactions.find((item) => item.id === button.dataset.id);
  if (!transaction) return;

  if (button.dataset.action === "edit") {
    editTransaction(transaction);
    return;
  }

  if (confirm("Hapus transaksi ini? Saldo akan dihitung ulang otomatis.")) {
    state.transactions = state.transactions.filter((item) => item.id !== transaction.id);
    saveState();
    render();
  }
}

function editTransaction(transaction) {
  el.transactionId.value = transaction.id;
  el.typeInput.value = transaction.type;
  el.dateInput.value = transaction.date;
  el.descriptionInput.value = transaction.description || "";
  el.costInput.value = transaction.cost;
  el.sellInput.value = getEditableSellValue(transaction);
  el.accountInput.value = transaction.accountId;
  el.formTitle.textContent = "Edit Transaksi";
  el.saveButton.textContent = "Simpan Perubahan";
  el.cancelEditButton.hidden = false;
  updateTransactionFormLabels();
  navigate("transaction");
}

function getEditableSellValue(transaction) {
  if (transaction.type === "Tarik Tunai") {
    return transaction.fee || transaction.sell - transaction.cost;
  }
  if (transaction.type === "Belanja Kebutuhan" || transaction.expense) {
    return "";
  }
  return transaction.sell;
}

function resetForm() {
  el.transactionForm.reset();
  el.transactionId.value = "";
  el.dateInput.value = todayISO();
  el.formTitle.textContent = "Tambah Transaksi";
  el.saveButton.textContent = "Simpan Transaksi";
  el.cancelEditButton.hidden = true;
  updateTransactionFormLabels();
}

function updateTransactionFormLabels() {
  const isCashWithdraw = el.typeInput.value === "Tarik Tunai";
  const isExpense = el.typeInput.value === "Belanja Kebutuhan";
  el.costField.textContent = isExpense ? "Nominal Belanja" : isCashWithdraw ? "Nominal Tarik Tunai" : "Modal / Nominal Keluar";
  el.sellField.textContent = isExpense ? "Uang Masuk" : isCashWithdraw ? "Fee" : "Harga Jual / Fee";
  el.sellInput.placeholder = isCashWithdraw ? "Contoh: 5000" : "0";
  el.sellInput.disabled = isExpense;
  el.sellInput.required = !isExpense;
  if (isExpense) el.sellInput.value = "";
  renderPreview();
}

function renderPreview() {
  const cost = toNumber(el.costInput.value);
  const sell = toNumber(el.sellInput.value);
  const isCashWithdraw = el.typeInput.value === "Tarik Tunai";
  const isExpense = el.typeInput.value === "Belanja Kebutuhan";
  el.previewIn.textContent = money(isExpense ? 0 : isCashWithdraw ? cost + sell : sell);
  el.previewProfit.textContent = money(isExpense ? -cost : isCashWithdraw ? sell : sell - cost);
}

function render() {
  el.dateInput.value ||= todayISO();
  el.dailyBalanceDate.value ||= todayISO();
  renderDashboard();
  renderHistory();
  renderReports();
  renderSettings();
  renderDailyBalanceInputs();
  updateTransactionFormLabels();
}

function renderDashboard() {
  const balances = getDashboardAccountSummaries();
  const todayTransactions = filterByToday(state.transactions);
  const monthTransactions = filterByCurrentMonth(state.transactions);

  el.totalBalance.textContent = money(balances.reduce((sum, account) => sum + account.balance, 0));
  el.todayProfit.textContent = money(sumProfit(todayTransactions));
  el.todayCount.textContent = todayTransactions.length;
  el.monthProfit.textContent = money(sumProfit(monthTransactions));

  el.dashboardAccounts.innerHTML = balances.map((account) => `
    <article class="account-card" title="${account.name}" aria-label="${account.name}">
      <span class="account-logo ${getAccountLogo(account.id).className}" aria-hidden="true">${getAccountLogo(account.id).label}</span>
      <strong>${money(account.balance)}</strong>
      <small>${account.usesDailyBalance ? "Awal hari ini" : "Awal"} ${money(account.startingBalance)}</small>
    </article>
  `).join("");

  el.quickActions.innerHTML = TRANSACTION_TYPES.map((type) => `
    <button type="button" data-type="${type}" aria-label="${type}" title="${type}">
      <span class="quick-logo ${getQuickActionIcon(type).className}" aria-hidden="true">${getQuickActionIcon(type).label}</span>
    </button>
  `).join("");

  renderTransactionList(el.recentTransactions, getSortedTransactions().slice(0, 5), { compact: true });
}

function renderHistory() {
  const search = el.searchInput.value.trim().toLowerCase();
  const type = el.historyTypeFilter.value;
  const account = el.historyAccountFilter.value;
  const date = el.historyDateFilter.value;

  const filtered = getSortedTransactions().filter((transaction) => {
    const accountName = getAccountName(transaction.accountId).toLowerCase();
    const text = `${transaction.type} ${transaction.description || ""} ${accountName}`.toLowerCase();
    return (!search || text.includes(search)) &&
      (!type || transaction.type === type) &&
      (!account || transaction.accountId === account) &&
      (!date || transaction.date === date);
  });

  renderTransactionList(el.historyList, filtered, { actions: true });
}

function renderReports() {
  el.reportTodayProfit.textContent = money(sumProfit(filterByToday(state.transactions)));
  el.reportWeekProfit.textContent = money(sumProfit(filterByCurrentWeek(state.transactions)));
  el.reportMonthProfit.textContent = money(sumProfit(filterByCurrentMonth(state.transactions)));
  el.reportTotalIn.textContent = money(state.transactions.reduce((sum, item) => sum + item.sell, 0));
  el.reportTotalOut.textContent = money(state.transactions.reduce((sum, item) => sum + item.cost, 0));
  el.reportTotalCount.textContent = state.transactions.length;

  el.typeBreakdown.innerHTML = TRANSACTION_TYPES.map((type) => {
    const items = state.transactions.filter((item) => item.type === type);
    return breakdownItem(type, items.length, sumProfit(items), sumIn(items), sumOut(items));
  }).join("");

  el.accountBreakdown.innerHTML = getAccountSummaries().map((account) => {
    const items = state.transactions.filter((item) => item.accountId === account.id);
    return breakdownItem(account.name, items.length, sumProfit(items), account.totalIn, account.totalOut);
  }).join("");
}

function renderSettings() {
  el.settingsAccounts.innerHTML = getAccountSummaries().map((account) => `
    <article class="breakdown-item">
      <div class="breakdown-row">
        <strong>${account.name}</strong>
        <strong>${money(account.balance)}</strong>
      </div>
      <div class="account-line"><span>Saldo awal</span><span>${money(account.openingBalance)}</span></div>
      <div class="account-line"><span>Total masuk</span><span class="money-in">${money(account.totalIn)}</span></div>
      <div class="account-line"><span>Total keluar</span><span class="money-out">${money(account.totalOut)}</span></div>
      <div class="account-line"><span>Saldo saat ini</span><strong>${money(account.balance)}</strong></div>
    </article>
  `).join("");
}

function renderDailyBalanceInputs() {
  const selectedDate = el.dailyBalanceDate.value || todayISO();
  const savedBalances = state.dailyBalances?.[selectedDate] || {};
  const fallbackBalances = getAccountSummaries();

  el.dailyBalanceInputs.innerHTML = state.accounts.map((account) => {
    const fallback = fallbackBalances.find((item) => item.id === account.id)?.balance || 0;
    const value = savedBalances[account.id] ?? fallback;
    return `
      <label>
        <span>${account.name}</span>
        <input type="number" min="0" step="1" inputmode="numeric" data-daily-account="${account.id}" value="${value}" required>
      </label>
    `;
  }).join("");
}

function saveDailyBalances(event) {
  event.preventDefault();
  const date = el.dailyBalanceDate.value || todayISO();
  const balances = {};

  el.dailyBalanceInputs.querySelectorAll("[data-daily-account]").forEach((input) => {
    balances[input.dataset.dailyAccount] = toNumber(input.value);
  });

  state.dailyBalances ||= {};
  state.dailyBalances[date] = balances;
  saveState();
  render();
  alert("Saldo awal harian berhasil disimpan.");
}

function renderTransactionList(container, transactions, options = {}) {
  if (!transactions.length) {
    container.innerHTML = document.querySelector("#emptyTemplate").innerHTML;
    return;
  }

  container.innerHTML = transactions.map((transaction) => {
    const profit = getProfit(transaction);
    const detail = transaction.description || "-";
    return `
      <article class="transaction-item">
        <div>
          <div class="transaction-head">
            <strong>${transaction.type}</strong>
            <small>${formatDate(transaction.date)}</small>
          </div>
          <p>${detail}</p>
          <small>${getAccountName(transaction.accountId)}</small>
        </div>
        <div class="transaction-money">
          <div>
            <small>Keluar</small>
            <strong class="money-out">${money(transaction.cost)}</strong>
          </div>
          <div>
            <small>Masuk</small>
            <strong class="money-in">${money(transaction.sell)}</strong>
          </div>
          <div>
            <small>Profit</small>
            <strong class="${profit >= 0 ? "profit-positive" : "profit-negative"}">${money(profit)}</strong>
          </div>
        </div>
        ${options.actions ? `
          <div class="transaction-actions">
            <button type="button" data-action="edit" data-id="${transaction.id}">Edit</button>
            <button class="delete" type="button" data-action="delete" data-id="${transaction.id}">Hapus</button>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
}

function breakdownItem(title, count, profit, totalIn, totalOut) {
  return `
    <article class="breakdown-item">
      <div class="breakdown-row">
        <strong>${title}</strong>
        <small>${count} transaksi</small>
      </div>
      <div class="account-line"><span>Masuk</span><span class="money-in">${money(totalIn)}</span></div>
      <div class="account-line"><span>Keluar</span><span class="money-out">${money(totalOut)}</span></div>
      <div class="account-line"><span>Profit</span><strong class="${profit >= 0 ? "profit-positive" : "profit-negative"}">${money(profit)}</strong></div>
    </article>
  `;
}

function getQuickActionIcon(type) {
  const icons = {
    "Service / JB HP": { label: "HP", className: "logo-phone" },
    "Top Up DANA": { label: "DANA", className: "logo-dana" },
    "Top Up GoPay": { label: "GoPay", className: "logo-gopay" },
    "Top Up OVO": { label: "OVO", className: "logo-ovo" },
    "Paket Data": { label: "DATA", className: "logo-data" },
    "Tarik Tunai": { label: "CASH", className: "logo-cash" },
    "Belanja Kebutuhan": { label: "BELANJA", className: "logo-expense" }
  };
  return icons[type] || { label: "", className: "" };
}

function getAccountLogo(accountId) {
  const logos = {
    cash: { label: "CASH", className: "account-cash" },
    seabank: { label: "SeaBank", className: "account-seabank" },
    bri: { label: "BRI", className: "account-bri" },
    mandiri: { label: "MANDIRI", className: "account-mandiri" },
    bca: { label: "BCA", className: "account-bca" }
  };
  return logos[accountId] || { label: accountId, className: "account-default" };
}

function getAccountSummaries() {
  return state.accounts.map((account) => {
    const items = state.transactions.filter((item) => item.accountId === account.id);
    const totalIn = sumIn(items);
    const totalOut = sumOut(items);
    return {
      ...account,
      totalIn,
      totalOut,
      balance: account.openingBalance + totalIn - totalOut
    };
  });
}

function getDashboardAccountSummaries() {
  const today = todayISO();
  const dailyBalances = state.dailyBalances?.[today];

  if (!dailyBalances) {
    return getAccountSummaries().map((account) => ({
      ...account,
      startingBalance: account.openingBalance,
      usesDailyBalance: false
    }));
  }

  return state.accounts.map((account) => {
    const items = state.transactions.filter((item) => item.accountId === account.id && item.date === today);
    const totalIn = sumIn(items);
    const totalOut = sumOut(items);
    const startingBalance = dailyBalances[account.id] ?? account.openingBalance;

    return {
      ...account,
      totalIn,
      totalOut,
      startingBalance,
      usesDailyBalance: true,
      balance: startingBalance + totalIn - totalOut
    };
  });
}

function getSortedTransactions() {
  return [...state.transactions].sort((a, b) => {
    const dateCompare = new Date(b.date) - new Date(a.date);
    if (dateCompare !== 0) return dateCompare;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function getProfit(transaction) {
  if (transaction.type === "Tarik Tunai") {
    return transaction.fee ?? transaction.sell - transaction.cost;
  }
  if (transaction.type === "Belanja Kebutuhan" || transaction.expense) {
    return -transaction.cost;
  }
  return transaction.sell - transaction.cost;
}

function sumProfit(transactions) {
  return transactions.reduce((sum, item) => sum + getProfit(item), 0);
}

function sumIn(transactions) {
  return transactions.reduce((sum, item) => sum + item.sell, 0);
}

function sumOut(transactions) {
  return transactions.reduce((sum, item) => sum + item.cost, 0);
}

function getAccountName(accountId) {
  return state.accounts.find((account) => account.id === accountId)?.name || accountId;
}

function filterByToday(transactions) {
  const today = todayISO();
  return transactions.filter((item) => item.date === today);
}

function filterByCurrentMonth(transactions) {
  const now = new Date();
  return transactions.filter((item) => {
    const date = asLocalDate(item.date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
}

function filterByCurrentWeek(transactions) {
  const now = new Date();
  const start = new Date(now);
  const day = now.getDay() || 7;
  start.setDate(now.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return transactions.filter((item) => {
    const date = asLocalDate(item.date);
    return date >= start && date < end;
  });
}

function exportBackup() {
  const backup = {
    app: "GigaPhone Finance",
    exportedAt: new Date().toISOString(),
    version: 1,
    data: state
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gigaphone-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());
    const imported = backup.data || backup;
    if (!Array.isArray(imported.accounts) || !Array.isArray(imported.transactions)) {
      throw new Error("Format backup tidak valid.");
    }

    state = {
      accounts: imported.accounts,
      transactions: imported.transactions,
      dailyBalances: imported.dailyBalances || {}
    };
    ensureAccountDefaults();
    saveState();
    render();
    alert("Backup berhasil diimport.");
  } catch (error) {
    alert(error.message || "Import backup gagal.");
  } finally {
    el.importInput.value = "";
  }
}

function optionTag(value) {
  return `<option value="${value}">${value}</option>`;
}

function toNumber(value) {
  return Number(value || 0);
}

function money(value) {
  return rupiah.format(value || 0).replace(/\s/g, "");
}

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asLocalDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDate(value) {
  return asLocalDate(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}
