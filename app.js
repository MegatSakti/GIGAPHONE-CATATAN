const STORAGE_KEY = "gigaphone-finance-v1";
const LAST_OBSERVED_DATE_KEY = "gigaphone-finance-last-observed-date";
const DAILY_REMINDER_DATE_KEY = "gigaphone-finance-daily-reminder-date";
const DISMISSED_DAILY_REMINDER_DATE_KEY = "gigaphone-finance-dismissed-daily-reminder-date";
const DANA_ADMIN_FEE = 400;

const TRANSACTION_TYPES = [
  "Jual Beli HP",
  "Service HP",
  "Service / JB HP",
  "Gadai HP",
  "Top Up DANA",
  "Top Up GoPay",
  "Top Up OVO",
  "Paket Data",
  "Tarik Tunai",
  "Belanja Kebutuhan",
  "Setor Tunai"
];

const QUICK_ACTION_TYPES = TRANSACTION_TYPES.filter((type) => type !== "Service / JB HP");
const HP_SERVICE_TYPES = new Set(["Jual Beli HP", "Service HP", "Service / JB HP"]);

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
  pawnTotal: document.querySelector("#pawnTotal"),
  dashboardAccounts: document.querySelector("#dashboardAccounts"),
  accountBalanceDialog: document.querySelector("#accountBalanceDialog"),
  accountBalanceForm: document.querySelector("#accountBalanceForm"),
  accountBalanceTitle: document.querySelector("#accountBalanceTitle"),
  balanceAccountId: document.querySelector("#balanceAccountId"),
  balanceValueInput: document.querySelector("#balanceValueInput"),
  cancelBalanceUpdate: document.querySelector("#cancelBalanceUpdate"),
  dailyBalanceShortcut: document.querySelector("#dailyBalanceShortcut"),
  dashboardNote: document.querySelector("#dashboardNote"),
  dashboardNoteForm: document.querySelector("#dashboardNoteForm"),
  dashboardNoteInput: document.querySelector("#dashboardNoteInput"),
  quickActions: document.querySelector("#quickActions"),
  hpServiceActions: document.querySelector("#hpServiceActions"),
  hpServiceTransactions: document.querySelector("#hpServiceTransactions"),
  hpServiceTodayProfit: document.querySelector("#hpServiceTodayProfit"),
  hpServiceTotalProfit: document.querySelector("#hpServiceTotalProfit"),
  mandiriAccount: document.querySelector("#mandiriAccount"),
  mandiriTransactions: document.querySelector("#mandiriTransactions"),
  transactionForm: document.querySelector("#transactionForm"),
  transactionId: document.querySelector("#transactionId"),
  typeInput: document.querySelector("#typeInput"),
  dateInput: document.querySelector("#dateInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  costInput: document.querySelector("#costInput"),
  sellInput: document.querySelector("#sellInput"),
  accountInput: document.querySelector("#accountInput"),
  accountFieldLabel: document.querySelector("#accountField span"),
  adminFeeNotice: document.querySelector("#adminFeeNotice"),
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
  installButton: document.querySelector("#installButton"),
  dailyRolloverNotice: document.querySelector("#dailyRolloverNotice"),
  dailyRolloverSetup: document.querySelector("#dailyRolloverSetup"),
  dailyRolloverClose: document.querySelector("#dailyRolloverClose")
};

init();

function init() {
  ensureAccountDefaults();
  populateSelects();
  bindEvents();
  render();
  checkDateRollover();
  window.setInterval(checkDateRollover, 60_000);
  window.addEventListener("pageshow", checkDateRollover);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkDateRollover();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}

function loadState() {
  const fallback = {
    accounts: ACCOUNT_DEFAULTS,
    transactions: [],
    dailyBalances: {},
    dashboardNote: ""
  };

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || !Array.isArray(stored.transactions)) return fallback;
    return {
      ...stored,
      accounts: Array.isArray(stored.accounts) ? stored.accounts : ACCOUNT_DEFAULTS,
      transactions: stored.transactions,
      dailyBalances: stored.dailyBalances || {},
      dashboardNote: typeof stored.dashboardNote === "string" ? stored.dashboardNote : ""
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureAccountDefaults() {
  const savedAccounts = Array.isArray(state.accounts) ? state.accounts : [];
  const existing = new Map(savedAccounts.map((account) => [account.id, account]));
  const defaultIds = new Set(ACCOUNT_DEFAULTS.map((account) => account.id));
  state.accounts = ACCOUNT_DEFAULTS.map((account) => ({
    ...account,
    ...(existing.get(account.id) || {})
  })).concat(savedAccounts.filter((account) => !defaultIds.has(account.id)));
  saveState();
}

function populateSelects() {
  el.typeInput.innerHTML = TRANSACTION_TYPES.map(optionTag).join("");
  el.historyTypeFilter.innerHTML = `<option value="">Semua Jenis</option>${TRANSACTION_TYPES.map(optionTag).join("")}`;
  refreshAccountSelects();
}

function refreshAccountSelects() {
  const accountOptions = state.accounts.map((account) => `<option value="${account.id}">${account.name}</option>`).join("");
  el.historyAccountFilter.innerHTML = `<option value="">Semua Akun</option>${accountOptions}`;
  updateTransactionAccountOptions();
}

function updateTransactionAccountOptions() {
  const selected = el.accountInput.value;
  const type = el.typeInput.value;
  if (type === "Top Up DANA") {
    const seabank = state.accounts.find((account) => account.id === "seabank");
    el.accountInput.innerHTML = seabank ? `<option value="${seabank.id}">${seabank.name}</option>` : "";
    el.accountInput.value = seabank?.id || "";
    el.accountInput.disabled = true;
    return;
  }
  el.accountInput.disabled = false;
  if (isHpServiceType(type)) {
    const mandiri = state.accounts.find((account) => account.id === "mandiri");
    el.accountInput.innerHTML = mandiri ? `<option value="${mandiri.id}">${mandiri.name}</option>` : "";
    return;
  }
  const bankOnly = isTopUp(type) || type === "Tarik Tunai" || type === "Setor Tunai";
  const accounts = bankOnly ? state.accounts.filter((account) => account.id !== "cash") : state.accounts;
  el.accountInput.innerHTML = accounts.map((account) => `<option value="${account.id}">${account.name}</option>`).join("");
  if (accounts.some((account) => account.id === selected)) {
    el.accountInput.value = selected;
  }
}

function isTopUp(type) {
  return ["Top Up DANA", "Top Up GoPay", "Top Up OVO", "Paket Data"].includes(type);
}

function isHpServiceType(type) {
  return HP_SERVICE_TYPES.has(type);
}

function bindEvents() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.nav));
  });

  [el.quickActions, el.hpServiceActions].forEach((container) => container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-type]");
    if (!button) return;
    resetForm();
    el.typeInput.value = button.dataset.type;
    updateTransactionFormLabels();
    navigate("transaction");
  }));

  el.transactionForm.addEventListener("submit", saveTransaction);
  el.dashboardAccounts.addEventListener("click", openAccountBalanceDialog);
  el.mandiriAccount.addEventListener("click", openAccountBalanceDialog);
  el.accountBalanceForm.addEventListener("submit", saveAccountBalance);
  el.cancelBalanceUpdate.addEventListener("click", () => el.accountBalanceDialog.close());
  el.dailyBalanceShortcut.addEventListener("click", () => {
    openDailyBalanceSettings();
  });
  el.dailyRolloverSetup.addEventListener("click", openDailyBalanceSettings);
  el.dailyRolloverClose.addEventListener("click", dismissDateRolloverNotice);
  el.dailyBalanceForm.addEventListener("submit", saveDailyBalances);
  el.dashboardNoteForm.addEventListener("submit", saveDashboardNote);
  el.dailyBalanceDate.addEventListener("change", renderDailyBalanceInputs);
  el.cancelEditButton.addEventListener("click", resetForm);
  el.typeInput.addEventListener("change", updateTransactionFormLabels);
  [el.costInput, el.sellInput].forEach((input) => {
    input.addEventListener("input", () => {
      formatAmountInput(input);
      renderPreview();
    });
  });

  [el.searchInput, el.historyTypeFilter, el.historyAccountFilter, el.historyDateFilter].forEach((input) => {
    input.addEventListener("input", renderHistory);
  });

  el.historyList.addEventListener("click", handleHistoryAction);
  el.hpServiceTransactions.addEventListener("click", handleHistoryAction);
  el.mandiriTransactions.addEventListener("click", handleHistoryAction);
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

function checkDateRollover() {
  const today = todayISO();
  const lastObservedDate = localStorage.getItem(LAST_OBSERVED_DATE_KEY);
  if (lastObservedDate && lastObservedDate !== today) {
    localStorage.setItem(DAILY_REMINDER_DATE_KEY, today);
  } else if (!lastObservedDate) {
    const lastActivityDate = [
      ...Object.keys(state.dailyBalances || {}),
      ...state.transactions.map((transaction) => transaction.date).filter(Boolean)
    ].sort().at(-1);
    if (lastActivityDate && lastActivityDate < today) {
      localStorage.setItem(DAILY_REMINDER_DATE_KEY, today);
    }
  }
  const reminderDate = localStorage.getItem(DAILY_REMINDER_DATE_KEY);
  el.dailyRolloverNotice.hidden = reminderDate !== today ||
    localStorage.getItem(DISMISSED_DAILY_REMINDER_DATE_KEY) === today;
  localStorage.setItem(LAST_OBSERVED_DATE_KEY, today);
}

function dismissDateRolloverNotice() {
  localStorage.setItem(DISMISSED_DAILY_REMINDER_DATE_KEY, todayISO());
  el.dailyRolloverNotice.hidden = true;
}

function openDailyBalanceSettings() {
  dismissDateRolloverNotice();
  el.dailyBalanceDate.value = todayISO();
  renderDailyBalanceInputs();
  navigate("settings");
  el.dailyBalanceDate.focus();
  el.dailyBalanceDate.scrollIntoView({ behavior: "smooth", block: "center" });
}

function saveTransaction(event) {
  event.preventDefault();

  const type = el.typeInput.value;
  const cost = parseAmount(el.costInput.value);
  const sellRaw = parseAmount(el.sellInput.value);
  const isTopUpTransaction = isTopUp(type);
  const isDanaTopUp = type === "Top Up DANA";
  const isCashWithdraw = type === "Tarik Tunai";
  const isExpense = type === "Belanja Kebutuhan";
  const isCashDeposit = type === "Setor Tunai";
  const isPawn = type === "Gadai HP";
  const moneyIn = isExpense || isPawn ? 0 : isCashWithdraw ? cost + sellRaw : isCashDeposit ? cost : sellRaw;
  const selectedAccountId = isDanaTopUp ? "seabank" : isHpServiceType(type) ? "mandiri" : el.accountInput.value;
  const cashId = state.accounts.find((account) => account.id === "cash")?.id || "cash";
  const sourceAccountId = isTopUpTransaction ? selectedAccountId : isCashWithdraw || isCashDeposit ? cashId : selectedAccountId;
  const destinationAccountId = isTopUpTransaction ? cashId : selectedAccountId;
  const movements = isTopUpTransaction
    ? [{ accountId: sourceAccountId, amount: -(cost + (isDanaTopUp ? DANA_ADMIN_FEE : 0)) }, { accountId: destinationAccountId, amount: sellRaw }]
    : isCashWithdraw
      ? [{ accountId: sourceAccountId, amount: -cost }, { accountId: destinationAccountId, amount: moneyIn }]
      : isCashDeposit
        ? [{ accountId: sourceAccountId, amount: -cost }, { accountId: destinationAccountId, amount: moneyIn }]
      : isExpense || isPawn
        ? [{ accountId: selectedAccountId, amount: -cost }]
        : [{ accountId: selectedAccountId, amount: -cost }, { accountId: selectedAccountId, amount: sellRaw }];

  const transaction = {
    id: el.transactionId.value || crypto.randomUUID(),
    type,
    date: el.dateInput.value,
    description: el.descriptionInput.value.trim(),
    cost,
    sell: moneyIn,
    fee: isCashWithdraw ? sellRaw : null,
    ...(isDanaTopUp ? { adminFee: DANA_ADMIN_FEE } : {}),
    expense: isExpense,
    accountId: selectedAccountId,
    sourceAccountId,
    destinationAccountId,
    movements,
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

function openAccountBalanceDialog(event) {
  const button = event.target.closest("[data-update-account]");
  if (!button) return;
  const account = state.accounts.find((item) => item.id === button.dataset.updateAccount);
  const summary = getDashboardAccountSummaries().find((item) => item.id === button.dataset.updateAccount);
  if (!account || !summary) return;

  el.balanceAccountId.value = account.id;
  el.accountBalanceTitle.textContent = `Update Saldo ${account.name}`;
  el.balanceValueInput.value = summary.balance;
  el.accountBalanceDialog.showModal();
  el.balanceValueInput.focus();
  el.balanceValueInput.select();
}

function saveAccountBalance(event) {
  event.preventDefault();
  const accountId = el.balanceAccountId.value;
  const targetBalance = toNumber(el.balanceValueInput.value);
  const today = todayISO();
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) return;

  const todayTransactions = state.transactions.filter((transaction) => transaction.date === today);
  const currentBalances = getDashboardAccountSummaries();
  const openingBalance = Number(account.openingBalance) || 0;
  const lifetimeBalance = getAccountSummaries().find((item) => item.id === accountId)?.balance ?? openingBalance;
  account.openingBalance = openingBalance + targetBalance - lifetimeBalance;

  state.dailyBalances ||= {};
  state.dailyBalances[today] = Object.fromEntries(state.accounts.map((account) => {
    const currentBalance = currentBalances.find((item) => item.id === account.id)?.balance ?? account.openingBalance;
    const { totalIn, totalOut } = getAccountMovementTotals(account.id, todayTransactions);
    const startingBalance = currentBalance - totalIn + totalOut;
    return [account.id, account.id === accountId ? targetBalance - totalIn + totalOut : startingBalance];
  }));

  saveState();
  el.accountBalanceDialog.close();
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
  el.costInput.value = formatAmount(transaction.cost);
  el.sellInput.value = formatAmount(getEditableSellValue(transaction));
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
  if (transaction.type === "Belanja Kebutuhan" || transaction.type === "Setor Tunai" || transaction.expense) {
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
  updateTransactionAccountOptions();
  const isCashWithdraw = el.typeInput.value === "Tarik Tunai";
  const isTopUpTransaction = isTopUp(el.typeInput.value);
  const isDanaTopUp = el.typeInput.value === "Top Up DANA";
  const isExpense = el.typeInput.value === "Belanja Kebutuhan";
  const isCashDeposit = el.typeInput.value === "Setor Tunai";
  const isPawn = el.typeInput.value === "Gadai HP";
  el.costField.textContent = isPawn ? "Nominal Gadai" : isExpense ? "Nominal Belanja" : isCashWithdraw ? "Nominal Tarik Tunai (keluar Cash)" : isCashDeposit ? "Nominal Setor Tunai (keluar Cash)" : isTopUpTransaction ? "Modal (keluar bank)" : "Modal / Nominal Keluar";
  el.sellField.textContent = isPawn ? "Profit Gadai HP (Rp0)" : isExpense ? "Uang Masuk" : isCashWithdraw ? "Fee" : isCashDeposit ? "Uang Masuk Bank" : isTopUpTransaction ? "Harga Jual (masuk Cash)" : "Harga Jual / Fee";
  el.accountFieldLabel.textContent = isHpServiceType(el.typeInput.value) ? "Akun Bank Mandiri" : isDanaTopUp ? "Akun Sumber (SeaBank)" : isTopUpTransaction ? "Akun Bank Sumber" : isCashWithdraw || isCashDeposit ? "Akun Bank Tujuan" : "Akun";
  el.adminFeeNotice.hidden = !isDanaTopUp;
  el.sellInput.placeholder = isCashWithdraw ? "Contoh: 5000" : "0";
  el.sellInput.disabled = isExpense || isCashDeposit || isPawn;
  el.sellInput.required = !isExpense && !isCashDeposit && !isPawn;
  if (isExpense || isCashDeposit || isPawn) el.sellInput.value = "";
  renderPreview();
}

function renderPreview() {
  const cost = parseAmount(el.costInput.value);
  const sell = parseAmount(el.sellInput.value);
  const isCashWithdraw = el.typeInput.value === "Tarik Tunai";
  const isExpense = el.typeInput.value === "Belanja Kebutuhan";
  const isCashDeposit = el.typeInput.value === "Setor Tunai";
  const isPawn = el.typeInput.value === "Gadai HP";
  const profit = isExpense || isCashDeposit || isPawn ? 0 : isCashWithdraw ? sell : sell - cost;
  el.previewIn.textContent = money(isExpense || isPawn ? 0 : isCashWithdraw ? cost + sell : isCashDeposit ? cost : sell);
  el.previewProfit.textContent = money(profit);
  el.previewProfit.className = profit < 0 ? "profit-negative" : "profit-positive";
}

function render() {
  el.dateInput.value ||= todayISO();
  el.dailyBalanceDate.value ||= todayISO();
  renderDashboard();
  renderHpService();
  renderHistory();
  renderReports();
  renderSettings();
  renderDailyBalanceInputs();
  updateTransactionFormLabels();
}

function renderDashboard() {
  const balances = getDashboardAccountSummaries().filter((account) => account.id !== "mandiri");
  const todayTransactions = filterByToday(state.transactions);
  const monthTransactions = filterByCurrentMonth(state.transactions);

  el.totalBalance.textContent = money(balances.reduce((sum, account) => sum + account.balance, 0));
  el.todayProfit.textContent = money(sumDashboardProfit(todayTransactions));
  el.todayCount.textContent = todayTransactions.length;
  el.monthProfit.textContent = money(sumDashboardProfit(monthTransactions));
  el.pawnTotal.textContent = money(sumPawnNominal(state.transactions));

  el.dashboardAccounts.innerHTML = balances.map((account) => `
    <article class="account-card" title="${account.name}" aria-label="${account.name}">
      <button class="account-logo-button" type="button" data-update-account="${account.id}" aria-label="Update saldo ${account.name}" title="Klik logo untuk update saldo" aria-haspopup="dialog">
        <img class="account-logo" src="${getAccountLogo(account.id)}" alt="" aria-hidden="true" width="160" height="48">
      </button>
      <strong>${money(account.balance)}</strong>
      <small>${account.usesDailyBalance ? "Awal hari ini" : "Awal"} ${money(account.startingBalance)}</small>
    </article>
  `).join("");

  el.dashboardNote.textContent = state.dashboardNote || "Belum ada catatan.";

  el.quickActions.innerHTML = QUICK_ACTION_TYPES.map((type) => `
    <button type="button" data-type="${type}" aria-label="${getQuickActionLabel(type)}" title="${getQuickActionLabel(type)}">
      <span class="quick-logo ${getQuickActionIcon(type).className}" aria-hidden="true">${getQuickActionIcon(type).label}</span>
      <span>${getQuickActionLabel(type)}</span>
    </button>
  `).join("");

}

function renderHpService() {
  const mandiri = getDashboardAccountSummaries().find((account) => account.id === "mandiri");
  if (mandiri) {
    el.mandiriAccount.innerHTML = `
      <article class="account-card" title="${mandiri.name}" aria-label="${mandiri.name}">
        <button class="account-logo-button" type="button" data-update-account="${mandiri.id}" aria-label="Update saldo ${mandiri.name}" title="Klik logo untuk update saldo" aria-haspopup="dialog">
          <img class="account-logo" src="${getAccountLogo(mandiri.id)}" alt="" aria-hidden="true" width="160" height="48">
        </button>
        <strong>${money(mandiri.balance)}</strong>
        <small>${mandiri.usesDailyBalance ? "Awal hari ini" : "Awal"} ${money(mandiri.startingBalance)}</small>
      </article>
    `;
  } else {
    el.mandiriAccount.replaceChildren();
  }

  const hpServiceTransactions = getSortedTransactions().filter((transaction) => isHpServiceType(transaction.type));
  const todayHpServiceTransactions = filterByToday(hpServiceTransactions);
  const todayProfit = sumProfit(todayHpServiceTransactions);
  const totalProfit = sumProfit(hpServiceTransactions);
  el.hpServiceTodayProfit.textContent = money(todayProfit);
  el.hpServiceTodayProfit.className = todayProfit < 0 ? "profit-negative" : "profit-positive";
  el.hpServiceTotalProfit.textContent = money(totalProfit);
  el.hpServiceTotalProfit.className = totalProfit < 0 ? "profit-negative" : "profit-positive";
  const mandiriTransactions = getSortedTransactions().filter((transaction) =>
    getTransactionMovements(transaction).some((movement) => movement.accountId === "mandiri")
  );
  renderTransactionList(el.hpServiceTransactions, hpServiceTransactions, { actions: true });
  renderTransactionList(el.mandiriTransactions, mandiriTransactions, { actions: true });
}

function renderHistory() {
  const search = el.searchInput.value.trim().toLowerCase();
  const type = el.historyTypeFilter.value;
  const account = el.historyAccountFilter.value;
  const date = el.historyDateFilter.value;

  const filtered = getSortedTransactions().filter((transaction) => {
    const accountIds = getTransactionMovements(transaction).map((movement) => movement.accountId);
    const accountNames = [...new Set(accountIds)].map(getAccountName);
    const text = `${transaction.type} ${transaction.description || ""} ${accountNames.join(" ")}`.toLowerCase();
    return (!search || text.includes(search)) &&
      (!type || transaction.type === type) &&
      (!account || accountIds.includes(account)) &&
      (!date || transaction.date === date);
  });

  renderTransactionList(el.historyList, filtered, { actions: true });
}

function renderReports() {
  el.reportTodayProfit.textContent = money(sumProfit(filterByToday(state.transactions)));
  el.reportWeekProfit.textContent = money(sumProfit(filterByCurrentWeek(state.transactions)));
  el.reportMonthProfit.textContent = money(sumProfit(filterByCurrentMonth(state.transactions)));
  el.reportTotalIn.textContent = money(sumIn(state.transactions));
  el.reportTotalOut.textContent = money(sumOut(state.transactions));
  el.reportTotalCount.textContent = state.transactions.length;

  el.typeBreakdown.innerHTML = TRANSACTION_TYPES.map((type) => {
    const items = state.transactions.filter((item) => item.type === type);
    return breakdownItem(type, items.length, sumProfit(items), sumIn(items), sumOut(items));
  }).join("");

  el.accountBreakdown.innerHTML = getAccountSummaries().map((account) => {
    const items = state.transactions.filter((item) => getTransactionMovements(item).some((movement) => movement.accountId === account.id));
    return breakdownItem(account.name, items.length, account.totalIn - account.totalOut, account.totalIn, account.totalOut, "Perubahan saldo");
  }).join("");
}

function renderSettings() {
  el.dashboardNoteInput.value = state.dashboardNote || "";
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

function saveDashboardNote(event) {
  event.preventDefault();
  state.dashboardNote = el.dashboardNoteInput.value;
  saveState();
  renderDashboard();
}

function renderTransactionList(container, transactions, options = {}) {
  if (!transactions.length) {
    container.innerHTML = document.querySelector("#emptyTemplate").innerHTML;
    return;
  }

  container.innerHTML = transactions.map((transaction) => {
    const profit = getProfit(transaction);
    const showProfit = !(options.hideHpServiceProfit && isHpServiceType(transaction.type));
    const detail = transaction.description || "-";
    const totals = getMovementTotals(transaction);
    return `
      <article class="transaction-item">
        <div>
          <div class="transaction-head">
            <strong>${transaction.type}</strong>
            <small>${formatDate(transaction.date)}</small>
          </div>
          <p>${detail}</p>
          <small class="account-flow">${getAccountFlowLabel(transaction)}</small>
        </div>
        <div class="transaction-money">
          <div>
            <small>Keluar</small>
            <strong class="money-out">${money(totals.out)}</strong>
          </div>
          <div>
            <small>Masuk</small>
            <strong class="money-in">${money(totals.in)}</strong>
          </div>
          ${showProfit ? `<div>
            <small>Profit</small>
            <strong class="${profit >= 0 ? "profit-positive" : "profit-negative"}">${money(profit)}</strong>
          </div>` : ""}
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

function breakdownItem(title, count, metricValue, totalIn, totalOut, metricLabel = "Profit") {
  return `
    <article class="breakdown-item">
      <div class="breakdown-row">
        <strong>${title}</strong>
        <small>${count} transaksi</small>
      </div>
      <div class="account-line"><span>Masuk</span><span class="money-in">${money(totalIn)}</span></div>
      <div class="account-line"><span>Keluar</span><span class="money-out">${money(totalOut)}</span></div>
      <div class="account-line"><span>${metricLabel}</span><strong class="${metricValue >= 0 ? "profit-positive" : "profit-negative"}">${money(metricValue)}</strong></div>
    </article>
  `;
}

function getQuickActionIcon(type) {
  const icons = {
    "Service / JB HP": { label: "HP", className: "logo-phone" },
    "Jual Beli HP": { label: "JUAL HP", className: "logo-phone" },
    "Service HP": { label: "SERVICE", className: "logo-phone" },
    "Gadai HP": { label: "GADAI", className: "logo-pawn" },
    "Top Up DANA": { label: "DANA", className: "logo-dana" },
    "Top Up GoPay": { label: "GoPay", className: "logo-gopay" },
    "Top Up OVO": { label: "OVO", className: "logo-ovo" },
    "Paket Data": { label: "DATA", className: "logo-data" },
    "Tarik Tunai": { label: "CASH", className: "logo-cash" },
    "Belanja Kebutuhan": { label: "BELANJA", className: "logo-expense" },
    "Setor Tunai": { label: "SETOR", className: "logo-cash" }
  };
  return icons[type] || { label: "", className: "" };
}

function getQuickActionLabel(type) {
  return type === "Belanja Kebutuhan" ? "Belanja" : type;
}

function getAccountLogo(accountId) {
  const logos = {
    cash: "cash",
    seabank: "seabank",
    bri: "bri",
    mandiri: "mandiri",
    bca: "bca"
  };
  return `assets/account-logos/${logos[accountId] || "default"}.svg`;
}

function getAccountSummaries() {
  return state.accounts.map((account) => {
    const { totalIn, totalOut } = getAccountMovementTotals(account.id, state.transactions);
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
    const todayTransactions = state.transactions.filter((item) => item.date === today);
    const { totalIn, totalOut } = getAccountMovementTotals(account.id, todayTransactions);
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
  if (transaction.type === "Gadai HP") return 0;
  if (transaction.type === "Tarik Tunai") {
    return transaction.fee ?? transaction.sell - transaction.cost;
  }
  if (transaction.type === "Belanja Kebutuhan" || transaction.type === "Setor Tunai" || transaction.expense) {
    return 0;
  }
  return transaction.sell - transaction.cost;
}

function sumProfit(transactions) {
  return transactions.reduce((sum, item) => sum + getProfit(item), 0);
}

function sumDashboardProfit(transactions) {
  return sumProfit(transactions.filter((transaction) => !isHpServiceType(transaction.type) && transaction.type !== "Gadai HP"));
}

function sumPawnNominal(transactions) {
  return transactions
    .filter((transaction) => transaction.type === "Gadai HP")
    .reduce((sum, transaction) => sum + (Number(transaction.cost) || 0), 0);
}

function sumIn(transactions) {
  return transactions.reduce((sum, item) => sum + getMovementTotals(item).in, 0);
}

function sumOut(transactions) {
  return transactions.reduce((sum, item) => sum + getMovementTotals(item).out, 0);
}

function getTransactionMovements(transaction) {
  if (Array.isArray(transaction.movements)) {
    return transaction.movements
      .filter((movement) => movement && movement.accountId && Number.isFinite(Number(movement.amount)))
      .map((movement) => ({ accountId: movement.accountId, amount: Number(movement.amount) }));
  }

  // Legacy transactions only stored accountId; preserve their original single-account net effect.
  const accountId = transaction.accountId;
  if (!accountId) return [];
  const cost = Number(transaction.cost) || 0;
  const sell = Number(transaction.sell) || 0;
  if (transaction.type === "Belanja Kebutuhan" || transaction.type === "Gadai HP" || transaction.expense) {
    return [{ accountId, amount: -cost }];
  }
  return [{ accountId, amount: -cost }, { accountId, amount: sell }];
}

function getMovementTotals(transaction) {
  return getTransactionMovements(transaction).reduce((totals, movement) => {
    if (movement.amount > 0) totals.in += movement.amount;
    if (movement.amount < 0) totals.out += Math.abs(movement.amount);
    return totals;
  }, { in: 0, out: 0 });
}

function getAccountMovementTotals(accountId, transactions) {
  return transactions.reduce((totals, transaction) => {
    getTransactionMovements(transaction).forEach((movement) => {
      if (movement.accountId !== accountId) return;
      if (movement.amount > 0) totals.totalIn += movement.amount;
      if (movement.amount < 0) totals.totalOut += Math.abs(movement.amount);
    });
    return totals;
  }, { totalIn: 0, totalOut: 0 });
}

function getAccountFlowLabel(transaction) {
  const movements = getTransactionMovements(transaction);
  const from = [...new Set(movements.filter((movement) => movement.amount < 0).map((movement) => movement.accountId))];
  const to = [...new Set(movements.filter((movement) => movement.amount > 0).map((movement) => movement.accountId))];
  if (from.length && to.length) {
    if (from.length === 1 && to.length === 1 && from[0] === to[0]) return getAccountName(from[0]);
    return `${from.map(getAccountName).join(" + ")} → ${to.map(getAccountName).join(" + ")}`;
  }
  const ids = [...new Set(movements.map((movement) => movement.accountId))];
  return ids.length ? ids.map(getAccountName).join(" + ") : getAccountName(transaction.accountId);
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
      ...imported,
      accounts: imported.accounts,
      transactions: imported.transactions,
      dailyBalances: imported.dailyBalances || {},
      dashboardNote: typeof imported.dashboardNote === "string" ? imported.dashboardNote : ""
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

function parseAmount(value) {
  return Number(String(value || "").replace(/\D/g, "") || 0);
}

function formatAmount(value) {
  const digits = String(value ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatAmountInput(input) {
  const cursor = input.selectionStart ?? input.value.length;
  const digitsBeforeCursor = input.value.slice(0, cursor).replace(/\D/g, "").length;
  const formatted = formatAmount(input.value);
  input.value = formatted;

  let nextCursor = 0;
  let digitsSeen = 0;
  while (nextCursor < formatted.length && digitsSeen < digitsBeforeCursor) {
    if (/\d/.test(formatted[nextCursor])) digitsSeen += 1;
    nextCursor += 1;
  }
  input.setSelectionRange(nextCursor, nextCursor);
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
