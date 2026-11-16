const STORAGE_KEY = "gigaphone-finance-v1";
const LAST_OBSERVED_DATE_KEY = "gigaphone-finance-last-observed-date";
const DAILY_REMINDER_DATE_KEY = "gigaphone-finance-daily-reminder-date";
const DISMISSED_DAILY_REMINDER_DATE_KEY = "gigaphone-finance-dismissed-daily-reminder-date";
const DANA_ADMIN_FEE = 400;
const GOPAY_ADMIN_FEE = 1000;

const TRANSACTION_TYPES = [
  "Jual Beli HP",
  "Service HP",
  "Aksesoris",
  "Service / JB HP",
  "Gadai HP",
  "Top Up DANA",
  "Top Up GoPay",
  "Top Up OVO",
  "Paket Data",
  "Tarik Tunai",
  "Belanja Kebutuhan",
  "Transfer Bank",
  "Setor Tunai"
];

const HP_SERVICE_TYPES = new Set(["Jual Beli HP", "Service HP", "Aksesoris", "Service / JB HP"]);
const QUICK_ACTION_TYPES = TRANSACTION_TYPES.filter((type) =>
  !HP_SERVICE_TYPES.has(type) && type !== "Transfer Bank" && type !== "Setor Tunai" && type !== "Tebus Gadai"
);

const ACCOUNT_DEFAULTS = [
  { id: "cash", name: "Cash", openingBalance: 0 },
  { id: "seabank", name: "SeaBank", openingBalance: 0 },
  { id: "bri", name: "BRI", openingBalance: 0 },
  { id: "mandiri", name: "Bank Mandiri", openingBalance: 0 },
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
  cashHpServiceTodayTotal: document.querySelector("#cashHpServiceTodayTotal"),
  cashHpServiceNotifications: document.querySelector("#cashHpServiceNotifications"),
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
  typeField: document.querySelector("#typeField"),
  bankTabs: document.querySelector("#bankTabs"),
  pawnTabs: document.querySelector("#pawnTabs"),
  pawnSelectionField: document.querySelector("#pawnSelectionField"),
  pawnSelectionInput: document.querySelector("#pawnSelectionInput"),
  pawnEmptyNotice: document.querySelector("#pawnEmptyNotice"),
  redemptionAmountField: document.querySelector("#redemptionAmountField"),
  redemptionAmountInput: document.querySelector("#redemptionAmountInput"),
  transactionValidationMessage: document.querySelector("#transactionValidationMessage"),
  transactionConfirmDialog: document.querySelector("#transactionConfirmDialog"),
  confirmTransactionType: document.querySelector("#confirmTransactionType"),
  confirmTransactionCost: document.querySelector("#confirmTransactionCost"),
  confirmTransactionSell: document.querySelector("#confirmTransactionSell"),
  confirmTransactionProfit: document.querySelector("#confirmTransactionProfit"),
  confirmTransactionMoneyFlow: document.querySelector("#confirmTransactionMoneyFlow"),
  confirmTransactionWarning: document.querySelector("#confirmTransactionWarning"),
  cancelTransactionConfirm: document.querySelector("#cancelTransactionConfirm"),
  acceptTransactionConfirm: document.querySelector("#acceptTransactionConfirm"),
  accountInput: document.querySelector("#accountInput"),
  accountField: document.querySelector("#accountField"),
  accountFieldLabel: document.querySelector("#accountField span"),
  adminFeeNotice: document.querySelector("#adminFeeNotice"),
  costField: document.querySelector("#costField span"),
  sellField: document.querySelector("#sellField span"),
  previewOut: document.querySelector("#previewOut"),
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

let pendingTransaction = null;

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
  const mandiri = state.accounts.find((account) => account.id === "mandiri");
  const hasMandiriMovements = state.transactions.some((transaction) =>
    getAccountMovements(transaction).some((movement) => movement.accountId === "mandiri")
  );
  if (mandiri?.openingBalance === 500000 && !hasMandiriMovements) {
    mandiri.openingBalance = 0;
  }
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
  refreshTransactionAccountOptions();
}

function refreshTransactionAccountOptions() {
  const selected = el.accountInput.value;
  const type = el.typeInput.value;
  el.accountInput.disabled = false;
  if (isFeeTopUp(type)) {
    const accounts = state.accounts.filter((account) => ["seabank", "bca"].includes(account.id));
    const editingAccountId = el.transactionId.value
      ? state.transactions.find((transaction) => transaction.id === el.transactionId.value)?.accountId
      : "";
    const legacyEditingAccount = state.accounts.find((account) => account.id === editingAccountId);
    if (legacyEditingAccount && !accounts.some((account) => account.id === legacyEditingAccount.id)) {
      accounts.push(legacyEditingAccount);
    }
    el.accountInput.innerHTML = accounts.map((account) => `<option value="${account.id}">${account.name}</option>`).join("");
    if (accounts.some((account) => account.id === selected)) el.accountInput.value = selected;
    return;
  }
  const bankOnly = isTopUp(type) || type === "Tarik Tunai" || type === "Setor Tunai" || type === "Transfer Bank";
  const accounts = bankOnly ? state.accounts.filter((account) => account.id !== "cash") : state.accounts;
  el.accountInput.innerHTML = accounts.map((account) => `<option value="${account.id}">${account.name}</option>`).join("");
  if (accounts.some((account) => account.id === selected)) {
    el.accountInput.value = selected;
  }
}

function isTopUp(type) {
  return ["Top Up DANA", "Top Up GoPay", "Top Up OVO", "Paket Data"].includes(type);
}

function isFeeTopUp(type) {
  return type === "Top Up DANA" || type === "Top Up GoPay";
}

function getDefaultTopUpFee(type) {
  return type === "Top Up DANA" ? DANA_ADMIN_FEE : type === "Top Up GoPay" ? GOPAY_ADMIN_FEE : 0;
}

function getProviderFee(transaction) {
  const defaultFee = getDefaultTopUpFee(transaction.type);
  if (!("customerFee" in transaction) &&
      !(Number.isFinite(Number(transaction.fee)) && transaction.fee !== null && transaction.fee !== "") &&
      Number(transaction.providerFee) !== defaultFee) {
    return defaultFee;
  }
  if (Number.isFinite(Number(transaction.providerFee)) && transaction.providerFee !== null && transaction.providerFee !== "") {
    return Number(transaction.providerFee);
  }
  if (transaction.type === "Top Up DANA" && Number(transaction.adminFee) > 0) {
    return Number(transaction.adminFee);
  }
  return getDefaultTopUpFee(transaction.type);
}

function getCustomerTopUpFee(transaction) {
  if (Number.isFinite(Number(transaction.customerFee)) && transaction.customerFee !== null && transaction.customerFee !== "") {
    return Number(transaction.customerFee);
  }
  if (Number.isFinite(Number(transaction.fee)) && transaction.fee !== null && transaction.fee !== "") {
    return Number(transaction.fee);
  }
  const legacyProviderFee = Number(transaction.providerFee);
  return Number.isFinite(legacyProviderFee) && legacyProviderFee !== getDefaultTopUpFee(transaction.type)
    ? legacyProviderFee
    : 0;
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
    el.transactionForm.dataset.fixedType = "true";
    el.typeInput.value = button.dataset.type === "Bank" ? "Transfer Bank" : button.dataset.type;
    el.transactionForm.dataset.pawnMode = "new";
    refreshTransactionAccountOptions();
    updateTransactionFormLabels();
    navigate("transaction");
  }));

  el.bankTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-bank-type]");
    if (!button) return;
    el.typeInput.value = button.dataset.bankType;
    updateTransactionFormLabels();
  });

  el.pawnTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-pawn-mode]");
    if (!button || el.transactionId.value) return;
    el.transactionForm.dataset.pawnMode = button.dataset.pawnMode;
    el.pawnSelectionInput.value = "";
    el.costInput.value = "";
    el.descriptionInput.value = "";
    el.redemptionAmountInput.value = "";
    updateTransactionFormLabels();
  });
  el.pawnSelectionInput.addEventListener("change", updateSelectedPawn);
  el.cancelTransactionConfirm.addEventListener("click", () => el.transactionConfirmDialog.close());
  el.acceptTransactionConfirm.addEventListener("click", () => {
    if (!pendingTransaction) return;
    const transaction = pendingTransaction;
    pendingTransaction = null;
    el.transactionConfirmDialog.close();
    saveTransactionRecord(transaction);
  });
  el.transactionConfirmDialog.addEventListener("close", () => {
    pendingTransaction = null;
  });

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
  [el.costInput, el.sellInput, el.redemptionAmountInput].forEach((input) => {
    input.addEventListener("input", () => {
      el.transactionValidationMessage.hidden = true;
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
  if (type === "Gadai HP") {
    savePawnTransaction();
    return;
  }
  if (isHpServiceType(type)) {
    saveHpTransaction();
    return;
  }

  const cost = parseAmount(el.costInput.value);
  const sellRaw = parseAmount(el.sellInput.value);
  const isTopUpTransaction = isTopUp(type);
  const isDanaTopUp = type === "Top Up DANA";
  const isFeeTopUpTransaction = isFeeTopUp(type);
  const isCashWithdraw = type === "Tarik Tunai";
  const isExpense = type === "Belanja Kebutuhan";
  const isCashDeposit = type === "Setor Tunai";
  const isBankTransfer = type === "Transfer Bank";
  const isPawn = type === "Gadai HP";
  const providerFee = isFeeTopUpTransaction ? getDefaultTopUpFee(type) : 0;
  const customerFee = isFeeTopUpTransaction ? sellRaw : 0;
  const moneyIn = isExpense || isPawn
    ? 0
    : isCashWithdraw
      ? cost + sellRaw
      : isCashDeposit
        ? cost
        : isFeeTopUpTransaction
          ? cost + customerFee
          : sellRaw;
  const selectedAccountId = el.accountInput.value;
  const cashId = state.accounts.find((account) => account.id === "cash")?.id || "cash";
  const sourceAccountId = isCashWithdraw || isCashDeposit ? cashId : selectedAccountId;
  const destinationAccountId = isCashWithdraw
    ? selectedAccountId
    : isCashDeposit || isTopUpTransaction || isBankTransfer
      ? cashId
      : selectedAccountId;
  const movements = isFeeTopUpTransaction
    ? [{ accountId: sourceAccountId, amount: -(cost + providerFee) }, { accountId: destinationAccountId, amount: cost + customerFee }]
    : isTopUpTransaction
      ? [{ accountId: sourceAccountId, amount: -cost }, { accountId: destinationAccountId, amount: sellRaw }]
    : isBankTransfer
      ? [{ accountId: sourceAccountId, amount: -cost }, { accountId: destinationAccountId, amount: sellRaw }]
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
    sell: isBankTransfer ? sellRaw : moneyIn,
    fee: isCashWithdraw ? sellRaw : isFeeTopUpTransaction ? customerFee : null,
    ...(isFeeTopUpTransaction ? {
      providerFee,
      customerFee,
      providerFeeLabel: isDanaTopUp ? "Admin DANA" : "Admin GoPay"
    } : {}),
    expense: isExpense,
    accountId: selectedAccountId,
    sourceAccountId,
    destinationAccountId,
    movements,
    accountMovements: movements,
    createdAt: el.transactionId.value ? getExistingCreatedAt(el.transactionId.value) : new Date().toISOString()
  };

  confirmTransactionBeforeSave(transaction);
}

function savePawnTransaction() {
  const isRedemption = el.transactionForm.dataset.pawnMode === "redeem";
  const selectedAccountId = el.accountInput.value;
  const id = el.transactionId.value || crypto.randomUUID();
  const createdAt = el.transactionId.value ? getExistingCreatedAt(el.transactionId.value) : new Date().toISOString();
  let transaction;

  if (isRedemption) {
    const pawn = state.transactions.find((item) => item.id === el.pawnSelectionInput.value && item.type === "Gadai HP" && item.pawnAction !== "redeem");
    if (!pawn || !getActivePawnTransactions(id).some((item) => item.id === pawn.id)) {
      alert("Pilih data gadai aktif yang valid.");
      return;
    }
    const redemptionAmount = parseAmount(el.redemptionAmountInput.value);
    transaction = {
      id,
      type: "Gadai HP",
      pawnAction: "redeem",
      relatedPawnId: pawn.id,
      date: el.dateInput.value,
      description: `Tebus Gadai: ${pawn.description || pawn.id}`,
      cost: Number(pawn.cost) || 0,
      sell: redemptionAmount,
      fee: null,
      expense: false,
      accountId: selectedAccountId,
      sourceAccountId: null,
      destinationAccountId: selectedAccountId,
      movements: [{ accountId: selectedAccountId, amount: redemptionAmount }],
      accountMovements: [{ accountId: selectedAccountId, amount: redemptionAmount }],
      createdAt
    };
  } else {
    const cost = parseAmount(el.costInput.value);
    transaction = {
      id,
      type: "Gadai HP",
      date: el.dateInput.value,
      description: el.descriptionInput.value.trim(),
      cost,
      sell: 0,
      fee: null,
      expense: false,
      accountId: selectedAccountId,
      sourceAccountId: selectedAccountId,
      destinationAccountId: null,
      movements: [{ accountId: selectedAccountId, amount: -cost }],
      accountMovements: [{ accountId: selectedAccountId, amount: -cost }],
      createdAt
    };
  }
  confirmTransactionBeforeSave(transaction);
}

function saveHpTransaction() {
  const type = el.typeInput.value;
  const cost = parseAmount(el.costInput.value);
  const sell = parseAmount(el.sellInput.value);
  const accountId = el.accountInput.value;
  const transaction = {
    id: el.transactionId.value || crypto.randomUUID(),
    type,
    date: el.dateInput.value,
    description: el.descriptionInput.value.trim(),
    cost,
    sell,
    fee: null,
    expense: false,
    accountId,
    sourceAccountId: accountId,
    destinationAccountId: accountId,
    movements: accountId === "cash"
      ? [{ accountId, amount: sell }]
      : [{ accountId, amount: -cost }, { accountId, amount: sell }],
    accountMovements: accountId === "cash"
      ? [{ accountId, amount: sell }]
      : [{ accountId, amount: -cost }, { accountId, amount: sell }],
    createdAt: el.transactionId.value ? getExistingCreatedAt(el.transactionId.value) : new Date().toISOString()
  };
  confirmTransactionBeforeSave(transaction);
}

function getTransactionMoneyFlow(transaction) {
  const accountId = transaction.accountId;
  const cashId = state.accounts.find((account) => account.id === "cash")?.id || "cash";
  let sourceAccountId = null;
  let destinationAccountId = null;
  let sourceLabel = "Sumber dana";
  let destinationLabel = "Penerimaan dana";

  if (transaction.type === "Belanja Kebutuhan") {
    sourceAccountId = accountId;
  } else if (transaction.type === "Gadai HP") {
    if (transaction.pawnAction === "redeem") {
      destinationAccountId = transaction.destinationAccountId || accountId;
    } else {
      sourceAccountId = transaction.sourceAccountId || accountId;
      sourceLabel = "Sumber dana gadai";
    }
  } else if (transaction.type === "Setor Tunai") {
    sourceAccountId = cashId;
    destinationAccountId = transaction.destinationAccountId || accountId;
  } else if (transaction.type === "Tarik Tunai") {
    sourceAccountId = cashId;
    destinationAccountId = accountId;
  } else if (isTopUp(transaction.type)) {
    sourceAccountId = transaction.sourceAccountId || accountId;
    destinationAccountId = transaction.destinationAccountId || cashId;
  } else if (isHpServiceType(transaction.type)) {
    sourceAccountId = transaction.sourceAccountId || accountId;
    destinationAccountId = transaction.destinationAccountId || accountId;
    sourceLabel = "Sumber dana modal";
    destinationLabel = "Penerimaan dana harga jual";
  } else {
    const movements = getAccountMovements(transaction);
    sourceAccountId = movements.find((movement) => movement.amount < 0)?.accountId || transaction.sourceAccountId || accountId;
    destinationAccountId = movements.find((movement) => movement.amount > 0)?.accountId || transaction.destinationAccountId || accountId;
  }

  return {
    source: sourceAccountId ? `${sourceLabel}: ${getAccountName(sourceAccountId)}` : "",
    destination: destinationAccountId ? `${destinationLabel}: ${getAccountName(destinationAccountId)}` : ""
  };
}

function getTransactionWarning(transaction) {
  const excludedTypes = new Set(["Belanja Kebutuhan", "Gadai HP", "Setor Tunai", "Tarik Tunai", "Top Up DANA", "Top Up GoPay"]);
  if (excludedTypes.has(transaction.type)) return null;

  const profit = (Number(transaction.sell) || 0) - (Number(transaction.cost) || 0);
  if (profit < 0) {
    return {
      type: "negative",
      message: `PERINGATAN: Harga jual lebih kecil dari modal.\nTransaksi ini akan menghasilkan profit minus sebesar ${money(Math.abs(profit))}.\nApakah tetap ingin menyimpan?`
    };
  }
  if (profit === 0) {
    return {
      type: "zero",
      message: "Profit transaksi ini Rp0. Pastikan harga jual sudah benar."
    };
  }
  return null;
}

function validateTransactionInput(transaction) {
  if (isFeeTopUp(transaction.type) &&
      (!Number.isFinite(Number(transaction.providerFee)) || Number(transaction.providerFee) < 0 ||
        !/\d/.test(String(el.sellInput.value || "")))) {
    el.transactionValidationMessage.textContent = "Fee/Admin wajib diisi dengan angka yang valid.";
    el.transactionValidationMessage.hidden = false;
    el.sellInput.focus();
    return false;
  }

  const excludedPriceTypes = new Set(["Belanja Kebutuhan", "Gadai HP", "Setor Tunai", "Tarik Tunai", "Top Up DANA", "Top Up GoPay"]);
  const requiresPrice = !excludedPriceTypes.has(transaction.type);
  const rawPrice = transaction.pawnAction === "redeem" ? el.redemptionAmountInput.value : el.sellInput.value;
  const hasValidPrice = /\d/.test(String(rawPrice || "")) && Number(transaction.sell) > 0;

  if (requiresPrice && !hasValidPrice) {
    el.transactionValidationMessage.textContent = "Harga jual wajib diisi dengan benar.";
    el.transactionValidationMessage.hidden = false;
    (transaction.pawnAction === "redeem" ? el.redemptionAmountInput : el.sellInput).focus();
    return false;
  }

  if (transaction.pawnAction === "redeem" && (!Number.isFinite(Number(transaction.sell)) || Number(transaction.sell) <= 0)) {
    el.transactionValidationMessage.textContent = "Nominal tebus wajib diisi dengan benar.";
    el.transactionValidationMessage.hidden = false;
    el.redemptionAmountInput.focus();
    return false;
  }

  const accountIds = [transaction.accountId, transaction.sourceAccountId, transaction.destinationAccountId]
    .filter(Boolean);
  const missingAccount = accountIds.find((id) => !state.accounts.some((account) => account.id === id));
  if (missingAccount) {
    el.transactionValidationMessage.textContent = "Akun transaksi tidak valid. Pilih akun yang tersedia.";
    el.transactionValidationMessage.hidden = false;
    return false;
  }

  el.transactionValidationMessage.hidden = true;
  return true;
}

function confirmTransactionBeforeSave(transaction) {
  if (!validateTransactionInput(transaction)) return;

  const flow = getTransactionMoneyFlow(transaction);
  const warning = getTransactionWarning(transaction);
  const isExpense = transaction.type === "Belanja Kebutuhan";
  const isPawnNew = transaction.type === "Gadai HP" && transaction.pawnAction !== "redeem";
  const isHpService = isHpServiceType(transaction.type);
  const isCashWithdraw = transaction.type === "Tarik Tunai";
  const isProviderTopUp = isFeeTopUp(transaction.type);
  const movementTotals = getMovementTotals(transaction);
  const nominalOut = isHpService || isPawnNew || isExpense
    ? Number(transaction.cost) || 0
    : movementTotals.out;
  const nominalIn = movementTotals.in;

  el.confirmTransactionType.textContent = transaction.pawnAction === "redeem" ? "Tebus Gadai HP" : transaction.type;
  el.confirmTransactionCost.textContent = `${isPawnNew ? "Nominal gadai" : "Modal / nominal keluar"}: ${money(nominalOut)}`;
  el.confirmTransactionSell.textContent = `Harga jual / uang masuk: ${money(nominalIn)}`;
  el.confirmTransactionProfit.textContent = `Profit: ${money(getProfit(transaction))}`;
  el.confirmTransactionMoneyFlow.replaceChildren();
  [flow.source, flow.destination].filter(Boolean).forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    el.confirmTransactionMoneyFlow.append(item);
  });
  if (isCashWithdraw) {
    const item = document.createElement("li");
    item.textContent = `Cash berkurang: ${money(Number(transaction.cost) || 0)}`;
    el.confirmTransactionMoneyFlow.append(item);
    const bankIn = (Number(transaction.cost) || 0) + (Number(transaction.fee) || 0);
    const bankItem = document.createElement("li");
    bankItem.textContent = `Bank bertambah: ${money(bankIn)}`;
    el.confirmTransactionMoneyFlow.append(bankItem);
  }
  if (isProviderTopUp) {
    const providerFee = getProviderFee(transaction);
    const customerFee = getCustomerTopUpFee(transaction);
    const cashItem = document.createElement("li");
    cashItem.textContent = `Cash masuk: ${money((Number(transaction.cost) || 0) + customerFee)}`;
    el.confirmTransactionMoneyFlow.append(cashItem);
    const customerFeeItem = document.createElement("li");
    customerFeeItem.textContent = `Fee diterima: ${money(customerFee)}`;
    el.confirmTransactionMoneyFlow.append(customerFeeItem);
    const feeItem = document.createElement("li");
    feeItem.textContent = `${transaction.providerFeeLabel || (transaction.type === "Top Up DANA" ? "Admin DANA" : "Admin GoPay")}: ${money(providerFee)}`;
    el.confirmTransactionMoneyFlow.append(feeItem);
    const bankItem = document.createElement("li");
    bankItem.textContent = `Total bank berkurang: ${money((Number(transaction.cost) || 0) + providerFee)}`;
    el.confirmTransactionMoneyFlow.append(bankItem);
  }
  el.confirmTransactionWarning.textContent = warning?.message || "";
  el.confirmTransactionWarning.hidden = !warning;
  el.confirmTransactionWarning.classList.toggle("transaction-warning-negative", warning?.type === "negative");
  el.confirmTransactionWarning.classList.toggle("transaction-warning-zero", warning?.type === "zero");
  el.acceptTransactionConfirm.textContent = warning?.type === "negative" ? "Tetap Simpan" : "Simpan Transaksi";

  pendingTransaction = transaction;
  el.transactionConfirmDialog.showModal();
}

function saveTransactionRecord(transaction) {
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
  el.transactionForm.dataset.fixedType = "false";
  el.transactionId.value = transaction.id;
  el.typeInput.value = transaction.type;
  el.transactionForm.dataset.configuredType = transaction.type;
  el.transactionForm.dataset.pawnMode = transaction.pawnAction === "redeem" ? "redeem" : "new";
  refreshTransactionAccountOptions();
  el.dateInput.value = transaction.date;
  el.descriptionInput.value = transaction.description || "";
  el.costInput.value = formatAmount(transaction.cost);
  el.sellInput.value = formatAmount(getEditableSellValue(transaction));
  el.redemptionAmountInput.value = transaction.pawnAction === "redeem" ? formatAmount(transaction.sell) : "";
  el.accountInput.value = transaction.accountId;
  el.formTitle.textContent = "Edit Transaksi";
  el.saveButton.textContent = "Simpan Perubahan";
  el.cancelEditButton.hidden = false;
  if (transaction.pawnAction === "redeem") {
    renderPawnSelection(transaction.relatedPawnId, transaction.id);
  }
  updateTransactionFormLabels();
  navigate("transaction");
}

function getEditableSellValue(transaction) {
  if (isFeeTopUp(transaction.type)) {
    return getCustomerTopUpFee(transaction);
  }
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
  el.transactionForm.dataset.fixedType = "false";
  el.transactionForm.dataset.configuredType = el.typeInput.value;
  el.transactionForm.dataset.pawnMode = "new";
  el.transactionId.value = "";
  el.redemptionAmountInput.value = "";
  el.transactionValidationMessage.hidden = true;
  el.dateInput.value = todayISO();
  el.formTitle.textContent = "Tambah Transaksi";
  el.saveButton.textContent = "Simpan Transaksi";
  el.cancelEditButton.hidden = true;
  updateTransactionFormLabels();
}

function getActivePawnTransactions(editingRedemptionId = "") {
  const redeemedPawnIds = new Set(state.transactions
    .filter((transaction) => transaction.type === "Gadai HP" &&
      transaction.pawnAction === "redeem" &&
      transaction.id !== editingRedemptionId)
    .map((transaction) => transaction.relatedPawnId));
  return getSortedTransactions().filter((transaction) =>
    transaction.type === "Gadai HP" &&
    transaction.pawnAction !== "redeem" &&
    !redeemedPawnIds.has(transaction.id)
  );
}

function renderPawnSelection(selectedId = "", editingRedemptionId = "") {
  const activePawns = getActivePawnTransactions(editingRedemptionId);
  el.pawnSelectionInput.replaceChildren(new Option("Pilih gadai aktif", ""));
  activePawns.forEach((pawn) => {
    const option = new Option(
      `${pawn.description || "Gadai HP"} · ${formatDate(pawn.date)} · ${money(pawn.cost)}`,
      pawn.id
    );
    el.pawnSelectionInput.add(option);
  });
  el.pawnSelectionInput.value = activePawns.some((pawn) => pawn.id === selectedId) ? selectedId : "";
  el.pawnEmptyNotice.hidden = activePawns.length > 0;
  el.pawnSelectionInput.required = true;
}

function updateSelectedPawn() {
  const pawn = state.transactions.find((transaction) => transaction.id === el.pawnSelectionInput.value);
  el.costInput.value = pawn ? formatAmount(pawn.cost) : "";
  el.descriptionInput.value = pawn ? `Tebus Gadai: ${pawn.description || pawn.id}` : "";
  renderPreview();
}

function configureTopUpFeeForType(type) {
  const previousType = el.transactionForm.dataset.configuredType || "";
  if (type !== previousType) {
    if (isFeeTopUp(previousType) || isFeeTopUp(type)) {
      el.sellInput.value = "";
    }
    el.transactionForm.dataset.configuredType = type;
  }
}

function updateTransactionFormLabels() {
  const type = el.typeInput.value;
  configureTopUpFeeForType(type);
  refreshTransactionAccountOptions();
  const isHpService = isHpServiceType(type);
  const isCashWithdraw = el.typeInput.value === "Tarik Tunai";
  const isTopUpTransaction = isTopUp(type);
  const isFeeTopUpTransaction = isFeeTopUp(type);
  const isExpense = type === "Belanja Kebutuhan";
  const isCashDeposit = type === "Setor Tunai";
  const isBankTransfer = type === "Transfer Bank";
  const isPawn = type === "Gadai HP";
  const isPawnRedemption = isPawn && el.transactionForm.dataset.pawnMode === "redeem";
  const hideSell = isExpense || isCashDeposit || isPawn;
  if (!el.transactionId.value) {
    el.formTitle.textContent = isCashDeposit || isBankTransfer ? "Transaksi Bank" : isHpService ? "Transaksi HP & Service" : "Tambah Transaksi";
  }
  el.typeField.hidden = isBankTransfer || isCashDeposit || el.transactionForm.dataset.fixedType === "true";
  el.bankTabs.hidden = !isBankTransfer && !isCashDeposit;
  el.pawnTabs.hidden = !isPawn;
  el.pawnTabs.querySelectorAll("[data-pawn-mode]").forEach((button) => {
    const selected = button.dataset.pawnMode === el.transactionForm.dataset.pawnMode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.disabled = Boolean(el.transactionId.value);
  });
  el.pawnSelectionField.hidden = !isPawnRedemption;
  el.pawnSelectionInput.required = isPawnRedemption;
  el.redemptionAmountField.hidden = !isPawnRedemption;
  el.redemptionAmountInput.disabled = !isPawnRedemption;
  el.redemptionAmountInput.required = isPawnRedemption;
  if (isPawnRedemption) {
    renderPawnSelection(el.pawnSelectionInput.value, el.transactionId.value);
    const selectedPawn = state.transactions.find((item) => item.id === el.pawnSelectionInput.value);
    el.costInput.value = selectedPawn ? formatAmount(selectedPawn.cost) : "";
    el.descriptionInput.value = selectedPawn ? `Tebus Gadai: ${selectedPawn.description || selectedPawn.id}` : "";
  }
  el.costInput.readOnly = isPawnRedemption;
  el.descriptionInput.closest("label").hidden = isPawnRedemption;
  el.descriptionInput.disabled = isPawnRedemption;
  el.bankTabs.querySelectorAll("[data-bank-type]").forEach((button) => {
    const selected = button.dataset.bankType === type;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  el.costField.textContent = isPawn ? "Nominal Gadai" : isExpense ? "Nominal Belanja" : isCashWithdraw ? "Nominal Tarik Tunai" : isCashDeposit ? "Nominal Setor Tunai" : isFeeTopUpTransaction ? "Nominal Top Up" : isBankTransfer ? "Modal / Nominal Keluar" : isHpService ? "Modal" : isTopUpTransaction ? "Modal (keluar bank)" : "Modal / Nominal Keluar";
  el.sellField.textContent = isPawn ? "Profit Gadai HP (Rp0)" : isExpense ? "Uang Masuk" : isCashWithdraw ? "Fee/Admin" : isFeeTopUpTransaction ? "Fee pelanggan (menambah Cash)" : isCashDeposit ? "Uang Masuk Bank" : isHpService || isBankTransfer ? "Harga Jual / Fee" : isTopUpTransaction ? "Harga Jual (masuk Cash)" : "Harga Jual / Fee";
  el.accountFieldLabel.textContent = isPawnRedemption ? "Akun Penerima Uang" : isHpService ? "Metode Pembayaran" : isFeeTopUpTransaction || isTopUpTransaction || isBankTransfer ? "Sumber Dana Bank" : isCashDeposit ? "Akun Bank Tujuan" : isCashWithdraw ? "Akun Bank Penerima" : isExpense ? "Akun Pembayaran" : isPawn ? "Akun Sumber Dana" : "Akun";
  el.adminFeeNotice.hidden = true;
  el.sellInput.placeholder = isCashWithdraw || isFeeTopUpTransaction ? "Contoh: Rp1.000" : "Rp0";
  const sellLabel = el.sellInput.closest("label");
  sellLabel.hidden = hideSell;
  el.sellInput.disabled = hideSell;
  el.sellInput.required = isCashWithdraw || isFeeTopUpTransaction;
  if (hideSell) el.sellInput.value = "";
  renderPreview();
}

function renderPreview() {
  if (el.typeInput.value === "Gadai HP") {
    renderPawnPreview();
    return;
  }
  if (isHpServiceType(el.typeInput.value)) {
    renderHpPreview();
    return;
  }

  const cost = parseAmount(el.costInput.value);
  const sell = parseAmount(el.sellInput.value);
  const isCashWithdraw = el.typeInput.value === "Tarik Tunai";
  const isExpense = el.typeInput.value === "Belanja Kebutuhan";
  const isCashDeposit = el.typeInput.value === "Setor Tunai";
  const isFeeTopUpTransaction = isFeeTopUp(el.typeInput.value);
  const isPawn = el.typeInput.value === "Gadai HP";
  const outgoing = isFeeTopUpTransaction ? cost + getDefaultTopUpFee(el.typeInput.value) : cost;
  const incoming = isExpense || isPawn ? 0 : isCashWithdraw ? cost + sell : isCashDeposit ? cost : isFeeTopUpTransaction ? cost + sell : sell;
  const profit = isExpense || isCashDeposit || isPawn ? 0 : isCashWithdraw ? sell : isFeeTopUpTransaction ? sell : sell - cost;
  el.previewOut.textContent = money(outgoing);
  el.previewIn.textContent = money(incoming);
  el.previewProfit.textContent = money(profit);
  el.previewProfit.className = profit < 0 ? "profit-negative" : "profit-positive";
}

function renderPawnPreview() {
  const isRedemption = el.transactionForm.dataset.pawnMode === "redeem";
  const cost = parseAmount(el.costInput.value);
  const sell = parseAmount(el.redemptionAmountInput.value);
  const outgoing = isRedemption ? 0 : cost;
  const incoming = isRedemption ? sell : 0;
  const profit = isRedemption ? sell - cost : 0;
  el.previewOut.textContent = money(outgoing);
  el.previewIn.textContent = money(incoming);
  el.previewProfit.textContent = money(profit);
  el.previewProfit.className = profit < 0 ? "profit-negative" : "profit-positive";
}

function renderHpPreview() {
  const cost = parseAmount(el.costInput.value);
  const sell = parseAmount(el.sellInput.value);
  const profit = sell - cost;
  el.previewOut.textContent = money(cost);
  el.previewIn.textContent = money(sell);
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

  const cashHpServiceTransactions = todayTransactions.filter((transaction) =>
    isHpServiceType(transaction.type) && transaction.accountId === "cash"
  );
  const cashHpServiceTotal = cashHpServiceTransactions.reduce((sum, transaction) => sum + getCashHpServiceIncome(transaction), 0);
  el.cashHpServiceTodayTotal.textContent = `Cash HP & Service hari ini: ${money(cashHpServiceTotal)}`;
  el.cashHpServiceNotifications.innerHTML = cashHpServiceTransactions.map((transaction) =>
    `<li>Cash masuk dari HP &amp; Service sebesar ${money(getCashHpServiceIncome(transaction))}</li>`
  ).join("");

  el.quickActions.innerHTML = QUICK_ACTION_TYPES.map((type) => `
    <button type="button" data-type="${type}" aria-label="${getQuickActionLabel(type)}" title="${getQuickActionLabel(type)}">
      <span class="quick-logo ${getQuickActionIcon(type).className}" aria-hidden="true">${getQuickActionIcon(type).label}</span>
      <span>${getQuickActionLabel(type)}</span>
    </button>
  `).join("") + `
    <button type="button" data-type="Bank" aria-label="Bank" title="Bank">
      <span class="quick-logo logo-bank" aria-hidden="true">BANK</span>
      <span>Bank</span>
    </button>
  `;

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
    getAccountMovements(transaction).some((movement) => movement.accountId === "mandiri")
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
    const accountIds = getAccountMovements(transaction).map((movement) => movement.accountId);
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
    const providerFee = items.reduce((sum, item) => sum + (isFeeTopUp(type) ? getProviderFee(item) : 0), 0);
    const customerFee = items.reduce((sum, item) => sum + (isFeeTopUp(type) ? getCustomerTopUpFee(item) : 0), 0);
    const providerFeeLabel = type === "Top Up DANA" ? "Total Admin DANA" : "Total Admin GoPay";
    return breakdownItem(type, items.length, sumProfit(items), sumIn(items), sumOut(items), "Profit", providerFee, providerFeeLabel, customerFee);
  }).join("");

  el.accountBreakdown.innerHTML = getAccountSummaries().map((account) => {
    const items = state.transactions.filter((item) => getAccountMovements(item).some((movement) => movement.accountId === account.id));
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
    const providerFee = isFeeTopUp(transaction.type) ? getProviderFee(transaction) : 0;
    const customerFee = isFeeTopUp(transaction.type) ? getCustomerTopUpFee(transaction) : 0;
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
          ${isFeeTopUp(transaction.type) ? `<div>
            <small>Fee diterima</small>
            <strong>${money(customerFee)}</strong>
          </div>` : ""}
          ${providerFee ? `<div>
            <small>${transaction.providerFeeLabel || (transaction.type === "Top Up DANA" ? "Admin DANA" : "Admin GoPay")}</small>
            <strong>${money(providerFee)}</strong>
          </div>` : ""}
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

function breakdownItem(title, count, metricValue, totalIn, totalOut, metricLabel = "Profit", providerFee = 0, providerFeeLabel = "Biaya Admin", customerFee = 0) {
  return `
    <article class="breakdown-item">
      <div class="breakdown-row">
        <strong>${title}</strong>
        <small>${count} transaksi</small>
      </div>
      <div class="account-line"><span>Masuk</span><span class="money-in">${money(totalIn)}</span></div>
      <div class="account-line"><span>Keluar</span><span class="money-out">${money(totalOut)}</span></div>
      ${customerFee > 0 ? `<div class="account-line"><span>Total Fee diterima</span><span>${money(customerFee)}</span></div>` : ""}
      ${providerFee > 0 ? `<div class="account-line"><span>${providerFeeLabel}</span><span>${money(providerFee)}</span></div>` : ""}
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
    "Transfer Bank": { label: "BANK", className: "logo-bank" },
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
  if (isFeeTopUp(transaction.type)) {
    return getCustomerTopUpFee(transaction);
  }
  if (transaction.type === "Gadai HP") {
    return transaction.pawnAction === "redeem" ? (Number(transaction.sell) || 0) - (Number(transaction.cost) || 0) : 0;
  }
  if (transaction.type === "Setor Tunai") return 0;
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
  const redeemedPawnIds = new Set(transactions
    .filter((transaction) => transaction.type === "Gadai HP" && transaction.pawnAction === "redeem")
    .map((transaction) => transaction.relatedPawnId));
  return transactions
    .filter((transaction) => transaction.type === "Gadai HP" &&
      transaction.pawnAction !== "redeem" &&
      !redeemedPawnIds.has(transaction.id))
    .reduce((sum, transaction) => sum + (Number(transaction.cost) || 0), 0);
}

function sumIn(transactions) {
  return transactions.reduce((sum, item) => sum + getMovementTotals(item).in, 0);
}

function sumOut(transactions) {
  return transactions.reduce((sum, item) => sum + getMovementTotals(item).out, 0);
}

function getAccountMovements(transaction) {
  const storedMovements = Array.isArray(transaction.accountMovements)
    ? transaction.accountMovements
    : Array.isArray(transaction.movements)
      ? transaction.movements
      : [];

  if (transaction.type === "Tarik Tunai") {
    const bankAccountId = transaction.accountId;
    const cashAccountId = "cash";
    const nominal = Number(transaction.cost) || 0;
    const fee = transaction.fee ?? ((Number(transaction.sell) || 0) - nominal);
    const cashReceivedByBank = nominal + (Number(fee) || 0);
    return [
      ...(cashAccountId ? [{ accountId: cashAccountId, amount: -nominal }] : []),
      ...(bankAccountId ? [{ accountId: bankAccountId, amount: cashReceivedByBank }] : [])
    ];
  }

  if (isFeeTopUp(transaction.type)) {
    const sourceAccountId = transaction.sourceAccountId ||
      storedMovements.find((movement) => movement?.amount < 0)?.accountId ||
      transaction.accountId;
    const destinationAccountId = transaction.destinationAccountId ||
      storedMovements.find((movement) => movement?.amount > 0)?.accountId ||
      "cash";
    const nominalTopUp = Number(transaction.cost) || 0;
    const providerFee = getProviderFee(transaction);
    const customerFee = getCustomerTopUpFee(transaction);
    return [
      ...(sourceAccountId ? [{ accountId: sourceAccountId, amount: -(nominalTopUp + providerFee) }] : []),
      ...(destinationAccountId ? [{ accountId: destinationAccountId, amount: nominalTopUp + customerFee }] : [])
    ];
  }

  if (isHpServiceType(transaction.type)) {
    const accountId = transaction.accountId || transaction.movements?.find((movement) => movement?.accountId)?.accountId;
    if (accountId === "cash") {
      return [{ accountId, amount: Number(transaction.sell) || 0 }];
    }
  }

  if (storedMovements.length) {
    return storedMovements
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

function getCashHpServiceIncome(transaction) {
  return getAccountMovements(transaction)
    .filter((movement) => movement.accountId === "cash" && movement.amount > 0)
    .reduce((sum, movement) => sum + movement.amount, 0);
}

function getMovementTotals(transaction) {
  return getAccountMovements(transaction).reduce((totals, movement) => {
    if (movement.amount > 0) totals.in += movement.amount;
    if (movement.amount < 0) totals.out += Math.abs(movement.amount);
    return totals;
  }, { in: 0, out: 0 });
}

function getAccountMovementTotals(accountId, transactions) {
  return transactions.reduce((totals, transaction) => {
    getAccountMovements(transaction).forEach((movement) => {
      if (movement.accountId !== accountId) return;
      if (movement.amount > 0) totals.totalIn += movement.amount;
      if (movement.amount < 0) totals.totalOut += Math.abs(movement.amount);
    });
    return totals;
  }, { totalIn: 0, totalOut: 0 });
}

function getAccountFlowLabel(transaction) {
  const movements = getAccountMovements(transaction);
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
  return digits ? `Rp${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}` : "";
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
