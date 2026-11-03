import { runReasoningGraph } from "./reasoning-graph.js";

const STORAGE_KEY = "fundy.mechanics.0.2.0";
const $ = (id) => document.getElementById(id);
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value) => Math.round(Math.max(0, num(value)) * 100) / 100;
const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
const formatCurrency = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num(value));
const today = () => new Date().toISOString().slice(0, 10);
const daysFromToday = (days) => { const date = new Date(`${today()}T12:00:00`); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };

const ACCOUNT_TYPES = [
  ["checking", "Checking", "day-to-day liquidity"],
  ["savings", "Savings", "cash reserve"],
  ["stocks", "Broad investments", "tracked, not liquid"],
  ["crypto", "Crypto", "volatile asset"],
  ["real_assets", "Real assets", "REITs or property"],
];

const freshState = () => ({
  event: { amount: 100, source: "gift" },
  accounts: ACCOUNT_TYPES.map(([type]) => ({ type, amount: type === "checking" ? 465 : type === "savings" ? 400 : type === "stocks" ? 800 : 0 })),
  monthlyEssentials: 500,
  emergencyMonths: 3,
  primaryDirection: "investing",
  goalName: "",
  debt: { kind: "credit_card", balance: 0, apr: 24, minimumPayment: 0, dueDate: "", paymentAccount: "checking" },
  obligations: [],
});

const state = {
  model: loadState(),
  result: null,
  selectedNode: "router",
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved) return { ...freshState(), ...saved, event: { ...freshState().event, ...(saved.event || {}) }, debt: { ...freshState().debt, ...(saved.debt || {}) } };
  } catch {}
  return freshState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.model));
}

function profileForGraph() {
  const debt = state.model.debt;
  const liabilities = money(debt.balance) > 0 ? [{
    id: "primary-debt",
    name: debt.kind === "credit_card" ? "Credit card" : debt.kind === "student_loan" ? "Student loan" : "Debt account",
    kind: debt.kind,
    balance: money(debt.balance),
    apr: num(debt.apr),
    minimumPayment: money(debt.minimumPayment),
    dueDate: debt.dueDate || null,
    paymentAccount: debt.paymentAccount || "checking",
  }] : [];
  return {
    asOfDate: today(),
    monthlyExpenses: money(state.model.monthlyEssentials),
    emergencyMonths: num(state.model.emergencyMonths),
    primaryDirection: state.model.primaryDirection === "goal" ? "" : state.model.primaryDirection,
    primaryGoalName: state.model.primaryDirection === "goal" ? state.model.goalName : "",
    accounts: state.model.accounts,
    liabilities,
    obligations: state.model.obligations,
  };
}

function runModel() {
  state.result = runReasoningGraph(profileForGraph(), { ...state.model.event, availableAccount: "checking" }, { today: today() });
  saveState();
  renderAnalysis();
}

function renderAccounts() {
  $("account-inputs").innerHTML = state.model.accounts.map((account) => {
    const meta = ACCOUNT_TYPES.find(([type]) => type === account.type) || [account.type, account.type, ""];
    return '<label class="account-row"><span class="account-mark">' + esc(meta[1].slice(0, 1)) + '</span><span class="account-name"><strong>' + esc(meta[1]) + '</strong><small>' + esc(meta[2]) + '</small></span><span class="account-value"><b>$</b><input data-account-type="' + esc(account.type) + '" type="number" min="0" step="1" value="' + (account.amount || "") + '" aria-label="' + esc(meta[1]) + ' balance"></span></label>';
  }).join("");
}

function renderObligations() {
  const mount = $("obligation-inputs");
  if (!state.model.obligations.length) {
    mount.innerHTML = '<p class="empty-line">No additional obligations entered.</p>';
    return;
  }
  mount.innerHTML = state.model.obligations.map((item, index) => '<div class="obligation-row"><div class="obligation-row-top"><span class="row-index">0' + (index + 1) + '</span><input data-obligation-field="name" data-obligation-index="' + index + '" type="text" value="' + esc(item.name) + '" placeholder="Rent, utility, tuition" aria-label="Obligation name"><button type="button" class="remove-button" data-remove-obligation="' + index + '" aria-label="Remove obligation">×</button></div><div class="field-grid"><label class="field"><span>AMOUNT DUE</span><div class="currency-field"><b>$</b><input data-obligation-field="amountDue" data-obligation-index="' + index + '" type="number" min="0" step="1" value="' + (item.amountDue || "") + '" aria-label="Obligation amount"></div></label><label class="field"><span>DUE DATE</span><input data-obligation-field="dueDate" data-obligation-index="' + index + '" type="date" value="' + esc(item.dueDate || "") + '" aria-label="Obligation due date"></label></div><label class="field"><span>PAY FROM</span><select data-obligation-field="paymentAccount" data-obligation-index="' + index + '" aria-label="Obligation payment account"><option value="checking" ' + (item.paymentAccount === "checking" ? "selected" : "") + '>Checking</option><option value="savings" ' + (item.paymentAccount === "savings" ? "selected" : "") + '>Savings</option></select></label></div>').join("");
}

function graphPositions() {
  return { inputs: [18, 28], normalize: [198, 28], validate: [378, 28], classify: [558, 28], liquidity: [378, 148], obligations: [106, 275], debt: [378, 275], router: [558, 378], plan: [378, 485], explain: [558, 485] };
}

function renderGraph(result) {
  const positions = graphPositions();
  const width = 136;
  const height = 62;
  const edges = (result?.edges || []).map((edge) => {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (!from || !to) return "";
    return '<line class="graph-edge ' + (edge.active ? "active" : "") + '" x1="' + (from[0] + width / 2) + '" y1="' + (from[1] + height) + '" x2="' + (to[0] + width / 2) + '" y2="' + to[1] + '" marker-end="url(#arrow)"></line>';
  }).join("");
  const nodes = (result?.nodes || []).map((node) => {
    const position = positions[node.id] || [0, 0];
    const selected = state.selectedNode === node.id;
    return '<g class="graph-node ' + esc(node.kind) + ' ' + esc(node.status) + ' ' + (selected ? "selected" : "") + '" data-graph-node="' + esc(node.id) + '" transform="translate(' + position[0] + ' ' + position[1] + ')"><rect width="' + width + '" height="' + height + '" rx="9"></rect><text class="node-label" x="68" y="26">' + esc(node.label) + '</text><text class="node-status" x="68" y="45">' + esc(node.status.replaceAll("-", " ")) + '</text></g>';
  }).join("");
  const svg = '<svg class="reasoning-svg" viewBox="0 0 712 570" role="img" aria-label="Branching Next Dollar reasoning graph"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z"></path></marker></defs><text class="svg-caption" x="18" y="15">STATE FLOW / ACTIVE BRANCHES</text>' + edges + nodes + '</svg>';
  const selected = result?.nodes?.find((node) => node.id === state.selectedNode) || result?.nodes?.find((node) => node.id === "router");
  const trace = result?.trace?.filter((item) => item.node === selected?.id) || [];
  const detail = trace.map((item) => '<p><strong>' + esc(item.action.replaceAll("_", " ")) + '</strong> ' + esc(item.detail) + '</p>').join("") || '<p>' + esc(selected?.detail || "Select a node to inspect its mechanics.") + '</p>';
  $("graph-mount").innerHTML = svg + '<div class="graph-inspector"><span>SELECTED NODE</span><strong>' + esc(selected?.label || "Waiting") + '</strong><small>' + detail + '</small></div>';
}

function renderAnalysis() {
  const result = state.result;
  renderGraph(result);
  const complete = result?.status === "complete";
  $("run-status").textContent = complete ? "LIVE CALCULATION" : "INPUT REQUIRED";
  $("priority-title").textContent = complete ? result.priority.label : "Waiting for inputs";
  $("priority-reason").textContent = complete ? result.priority.reason : `Add ${result?.missing?.join(" and ") || "the required values"} to continue.`;
  $("surplus-value").textContent = formatCurrency(result?.liquidity?.availableSurplus || 0);
  const liquidity = result?.liquidity;
  const debt = result?.debtAnalysis;
  $("metric-row").innerHTML = '<div class="metric"><span>NEAR-TERM SHORTFALL</span><strong>' + formatCurrency(liquidity?.shortfallBeforeEvent || 0) + '</strong><small>before this event</small></div><div class="metric"><span>PAYMENT RESERVE</span><strong>' + formatCurrency(liquidity?.paymentReserve || 0) + '</strong><small>hard constraint</small></div><div class="metric"><span>SAFETY GAP</span><strong>' + formatCurrency(liquidity?.safetyGap || 0) + '</strong><small>reported savings</small></div><div class="metric"><span>DEBT CANDIDATES</span><strong>' + (debt?.candidates?.length || 0) + '</strong><small>' + (debt?.extraPayoffAllowed ? "extra payoff eligible" : "minimum protection") + '</small></div>';
  const trace = result?.trace || [];
  $("trace-count").textContent = trace.length + " steps";
  $("trace-list").innerHTML = trace.length ? trace.map((item, index) => '<div class="trace-row"><span>0' + (index + 1) + '</span><div><strong>' + esc(item.node.replaceAll("_", " ")) + '</strong><p>' + esc(item.detail) + '</p></div></div>').join("") : '<p class="empty-line">The graph is waiting for required inputs.</p>';
  const allocations = result?.allocation?.rows || [];
  $("allocation-list").innerHTML = allocations.length ? allocations.map((row) => '<div class="allocation-row"><span><i class="allocation-dot ' + (row.required ? "required" : "") + '"></i>' + esc(row.label) + '</span><strong>' + formatCurrency(row.amount) + '</strong></div>').join("") : '<p class="empty-line">No allocation has been published.</p>';
  $("allocation-total").textContent = formatCurrency(result?.allocation?.eventAmount || 0);
}

function updateFromTarget(target) {
  if (target.dataset.accountType) {
    const account = state.model.accounts.find((item) => item.type === target.dataset.accountType);
    if (account) account.amount = money(target.value);
  }
  if (target.id === "event-amount") state.model.event.amount = money(target.value);
  if (target.id === "event-source") state.model.event.source = target.value;
  if (target.id === "monthly-essentials") state.model.monthlyEssentials = money(target.value);
  if (target.id === "emergency-months") state.model.emergencyMonths = num(target.value);
  if (target.id === "primary-direction") state.model.primaryDirection = target.value;
  if (target.id === "goal-name") state.model.goalName = target.value;
  if (target.id === "debt-kind") state.model.debt.kind = target.value;
  if (target.id === "debt-apr") state.model.debt.apr = num(target.value);
  if (target.id === "debt-balance") state.model.debt.balance = money(target.value);
  if (target.id === "debt-minimum") state.model.debt.minimumPayment = money(target.value);
  if (target.id === "debt-due-date") state.model.debt.dueDate = target.value;
  if (target.id === "debt-account") state.model.debt.paymentAccount = target.value;
  if (target.dataset.obligationField) {
    const item = state.model.obligations[num(target.dataset.obligationIndex)];
    if (item) item[target.dataset.obligationField] = target.dataset.obligationField === "amountDue" ? money(target.value) : target.value;
  }
}

function addObligation() {
  state.model.obligations.push({ id: `obligation-${Date.now()}`, name: "", amountDue: 0, dueDate: daysFromToday(14), paymentAccount: "checking", kind: "other" });
  renderObligations();
  runModel();
  const last = $("obligation-inputs").querySelector("input[type=text]:last-of-type");
  last?.focus();
}

function handleClick(event) {
  const target = event.target.closest("button,[data-graph-node]");
  if (!target) return;
  if (target.id === "reset-model") {
    if (window.confirm("Reset the mechanics model to the example state?")) {
      state.model = freshState();
      state.selectedNode = "router";
      renderAccounts(); renderObligations(); syncControls(); runModel();
    }
    return;
  }
  if (target.id === "add-obligation") return addObligation();
  if (target.dataset.removeObligation) {
    state.model.obligations.splice(num(target.dataset.removeObligation), 1);
    renderObligations();
    runModel();
    return;
  }
  if (target.dataset.graphNode) {
    state.selectedNode = target.dataset.graphNode;
    renderGraph(state.result);
  }
}

function syncControls() {
  $("event-amount").value = state.model.event.amount;
  $("event-source").value = state.model.event.source;
  $("monthly-essentials").value = state.model.monthlyEssentials;
  $("emergency-months").value = state.model.emergencyMonths;
  $("primary-direction").value = state.model.primaryDirection;
  $("goal-name").value = state.model.goalName;
  $("goal-name-field").classList.toggle("hidden-field", state.model.primaryDirection !== "goal");
  $("debt-kind").value = state.model.debt.kind;
  $("debt-apr").value = state.model.debt.apr;
  $("debt-balance").value = state.model.debt.balance;
  $("debt-minimum").value = state.model.debt.minimumPayment;
  $("debt-due-date").value = state.model.debt.dueDate;
  $("debt-account").value = state.model.debt.paymentAccount;
}

document.addEventListener("input", (event) => { updateFromTarget(event.target); if (event.target.id === "primary-direction") syncControls(); runModel(); });
document.addEventListener("change", (event) => { updateFromTarget(event.target); if (event.target.id === "primary-direction") syncControls(); runModel(); });
document.addEventListener("click", handleClick);

renderAccounts();
renderObligations();
syncControls();
runModel();
