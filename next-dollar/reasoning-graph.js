/*
 * Browser implementation of the 0.2.0 Next Dollar reasoning graph.
 *
 * This is intentionally deterministic. It mirrors the local Python graph so a
 * static GitHub Pages deployment can run without a server or paid API. The
 * output contains both the recommendation and the graph/trace used to reach it.
 */

export const REASONING_GRAPH_VERSION = "0.2.0";

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const money = (value) => Math.round(Math.max(0, num(value)) * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, num(value)));
const isoDate = (value) => {
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
};
const dateDaysFrom = (date, days) => {
  const result = new Date(`${isoDate(date)}T12:00:00`);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
};
const daysUntil = (date, asOf) => {
  const target = new Date(`${date}T12:00:00`);
  const start = new Date(`${asOf}T12:00:00`);
  if (Number.isNaN(target.getTime()) || Number.isNaN(start.getTime())) return 9999;
  return Math.ceil((target - start) / 86400000);
};

const labels = {
  paycheck: "paycheck",
  parent_support: "family support",
  gift: "gift",
  scholarship: "scholarship or refund",
  freelance: "freelance income",
  tax_refund: "tax refund",
  other: "other money",
};

function trace(node, action, detail, branch = "shared") {
  return { node, action, detail, branch };
}

function profileAccounts(profile) {
  return (profile?.accounts || []).map((account) => ({
    type: account.type,
    label: account.label || account.type,
    balance: money(account.balance ?? account.amount),
    accessible: account.accessibleForPayments !== false && account.accessible_for_payments !== false,
  }));
}

function profileLiabilities(profile, asOf) {
  const supplied = Array.isArray(profile?.liabilities) ? profile.liabilities : [];
  if (supplied.length) return supplied.map((item, index) => ({
    id: item.id || `liability-${index + 1}`,
    name: item.name || (item.kind === "credit_card" ? "Credit card" : "Debt account"),
    kind: item.kind || "other_debt",
    balance: money(item.balance),
    apr: Math.max(0, num(item.apr)),
    minimumPayment: money(item.minimumPayment ?? item.minimum_payment ?? item.minimum),
    dueDate: item.dueDate || item.due_date || null,
    paymentAccount: item.paymentAccount || item.payment_account || "checking",
    lateFee: money(item.lateFee ?? item.late_fee),
    estimatedDueDate: false,
  }));
  const debt = profile?.debt;
  if (!debt?.hasDebt && money(debt?.balance) <= 0) return [];
  return [{
    id: "legacy-debt",
    name: debt.name || (debt.kind === "credit_card" ? "Credit card" : "Debt account"),
    kind: debt.kind || "loan",
    balance: money(debt.balance),
    apr: Math.max(0, num(debt.apr)),
    minimumPayment: money(debt.minimumPayment ?? debt.minimum),
    dueDate: debt.dueDate || debt.due_date || dateDaysFrom(asOf, 30),
    paymentAccount: debt.paymentAccount || debt.payment_account || "checking",
    lateFee: money(debt.lateFee ?? debt.late_fee),
    estimatedDueDate: !(debt.dueDate || debt.due_date),
  }];
}

function normalize(profile = {}, event = {}, options = {}) {
  const asOf = isoDate(options.today || profile.asOfDate || profile.as_of_date);
  const accounts = profileAccounts(profile);
  const liabilities = profileLiabilities(profile, asOf);
  const explicitObligations = Array.isArray(profile.obligations) ? profile.obligations : [];
  const obligations = explicitObligations.map((item, index) => ({
    id: item.id || `obligation-${index + 1}`,
    name: item.name || "Upcoming payment",
    kind: item.kind || "other",
    amountDue: money(item.amountDue ?? item.amount_due ?? item.amount),
    dueDate: item.dueDate || item.due_date || dateDaysFrom(asOf, 30),
    paymentAccount: item.paymentAccount || item.payment_account || "checking",
    liabilityId: item.liabilityId || item.liability_id || null,
    lateFee: money(item.lateFee ?? item.late_fee),
    estimatedDueDate: false,
  }));
  liabilities.forEach((liability) => {
    const linked = obligations.some((item) => item.liabilityId === liability.id || item.id === `${liability.id}_minimum`);
    if (liability.minimumPayment > 0 && !linked) obligations.push({
      id: `${liability.id}_minimum`,
      name: `${liability.name} minimum`,
      kind: liability.kind === "credit_card" ? "credit_card_minimum" : "loan_payment",
      amountDue: liability.minimumPayment,
      dueDate: liability.dueDate || dateDaysFrom(asOf, 30),
      paymentAccount: liability.paymentAccount,
      liabilityId: liability.id,
      lateFee: liability.lateFee,
      estimatedDueDate: liability.estimatedDueDate,
    });
  });
  const source = event.source || event.sourceType || "other";
  const amount = money(event.amount);
  const taxReserve = source === "freelance" && event.taxesWithheld !== true && event.taxWithheld !== true
    ? money(amount * 0.25)
    : 0;
  return {
    asOf,
    profile: {
      name: profile.name || "there",
      monthlyEssentials: money(profile.monthlyExpenses ?? profile.monthly_essentials ?? profile.expenses?.monthlyEssentials),
      emergencyMonths: clamp(profile.emergencyMonths ?? profile.emergency_months ?? profile.expenses?.emergencyMonths ?? 3, 3, 6),
      primaryDirection: profile.primaryDirection || profile.primary_direction || "",
      primaryGoalName: profile.primaryGoalName || profile.primary_goal_name || "",
      primaryGoalAmount: money(profile.primaryGoalAmount ?? profile.primary_goal_amount),
    },
    accounts,
    liabilities,
    obligations,
    event: {
      amount,
      source,
      sourceLabel: labels[source] || source,
      availableAccount: event.availableAccount || event.available_account || "checking",
      taxesWithheld: event.taxesWithheld ?? event.taxWithheld ?? null,
      taxReserve,
    },
  };
}

function buildGraphNodes(valid, route, activePlan) {
  const future = !valid;
  const names = [
    ["inputs", "Inputs", "input", "Profile, accounts, debts, obligations, and cash event"],
    ["normalize", "Normalize", "shared", "Typed account and obligation records"],
    ["validate", "Validate", "shared", valid ? "Required inputs are present" : "Waiting for required input"],
    ["classify", "Classify event", "shared", "Source, irregularity, and tax-reserve check"],
    ["liquidity", "Liquidity gate", "gate", "Payment-account cash versus near-term obligations"],
    ["obligations", "Obligations branch", "branch", "Due dates, minimums, shortfalls, and consequences"],
    ["debt", "Debt branch", "branch", "Minimum-only versus extra-payoff candidates"],
    ["router", "Priority router", "router", route ? `Selected ${route.replaceAll("_", " ")}` : "Waiting for analysis"],
    ["plan", activePlan ? `Plan: ${activePlan.replaceAll("_", " ")}` : "Allocation plan", "plan", activePlan ? `Built ${activePlan.replaceAll("_", " ")} plan` : "Waiting for route"],
    ["explain", "Why trace", "output", "Plain-language explanation and active path"],
  ];
  return names.map(([id, label, kind, detail]) => ({
    id,
    label,
    kind,
    detail,
    status: future && !["inputs", "normalize", "validate"].includes(id) ? "pending" : id === "validate" && !valid ? "needs-input" : "complete",
  }));
}

function buildEdges(route, valid) {
  const edges = [
    ["inputs", "normalize"], ["normalize", "validate"], ["validate", "classify"], ["classify", "liquidity"],
    ["liquidity", "obligations"], ["liquidity", "debt"], ["obligations", "router"], ["debt", "router"],
    ["router", "plan"], ["plan", "explain"],
  ];
  return edges.map(([from, to]) => ({ from, to, active: valid && !(from === "router" && to === "plan" && !route) }));
}

export function runReasoningGraph(profile = {}, cashEvent = {}, options = {}) {
  const data = normalize(profile, cashEvent, options);
  const traceItems = [trace("normalize", "normalized_inputs", "Converted balances, liabilities, obligations, and the arriving cash event into graph state.")];
  const missing = [];
  if (data.event.amount <= 0) missing.push("cash event amount");
  if (data.profile.monthlyEssentials <= 0) missing.push("monthly essential expenses");
  const valid = missing.length === 0;
  traceItems.push(trace("validate", valid ? "inputs_ready" : "needs_input", valid ? "Inputs are sufficient for branching." : `The graph stopped because ${missing.join(" and ")} is missing.`));
  if (!valid) {
    const nodes = buildGraphNodes(false, null, null);
    return {
      version: REASONING_GRAPH_VERSION,
      status: "needs-input",
      summary: "Add the missing information before Next Dollar allocates this event.",
      missing,
      normalized: data,
      liquidity: null,
      debtAnalysis: null,
      priority: null,
      allocation: { eventAmount: data.event.amount, rows: [], totalAllocated: 0, unassigned: data.event.amount },
      trace: traceItems,
      nodes,
      edges: buildEdges(null, false),
    };
  }

  const earned = ["paycheck", "freelance"].includes(data.event.source);
  const irregular = !["paycheck"].includes(data.event.source);
  traceItems.push(trace("classify", "classified_event", `${data.event.sourceLabel} is ${earned ? "earned" : "not usually earned"} and ${irregular ? "irregular" : "regular"}.`));
  if (data.event.taxReserve > 0) traceItems.push(trace("classify", "reserved_tax_candidate", `${money(data.event.taxReserve)} is held as a visible tax-reserve candidate until withholding is confirmed.`));

  const liquidByAccount = {};
  data.accounts.filter((account) => account.accessible && ["cash", "checking", "savings"].includes(account.type)).forEach((account) => {
    liquidByAccount[account.type] = money((liquidByAccount[account.type] || 0) + account.balance);
  });
  const requiredByAccount = {};
  const horizon = num(profile.planningHorizonDays ?? profile.planning_horizon_days, 45);
  const obligationRows = data.obligations
    .map((obligation) => ({ ...obligation, daysUntilDue: daysUntil(obligation.dueDate, data.asOf) }))
    .filter((obligation) => obligation.daysUntilDue <= horizon)
    .map((obligation) => {
      requiredByAccount[obligation.paymentAccount] = money((requiredByAccount[obligation.paymentAccount] || 0) + obligation.amountDue);
      return obligation;
    });
  const rows = obligationRows.map((obligation) => {
    const balance = money(liquidByAccount[obligation.paymentAccount] || 0);
    const shortfall = money(Math.max(0, (requiredByAccount[obligation.paymentAccount] || 0) - balance));
    return {
      ...obligation,
      accountBalance: balance,
      shortfallBeforeEvent: shortfall,
      status: obligation.daysUntilDue < 0 ? "overdue" : shortfall > 0 ? "shortfall" : "covered",
    };
  });
  const shortfallBeforeEvent = money(Object.entries(requiredByAccount).reduce((total, [account, required]) => total + Math.max(0, required - (liquidByAccount[account] || 0)), 0));
  const paymentReserve = money(Math.min(data.event.amount, shortfallBeforeEvent));
  const availableAfterPayment = money(data.event.amount - paymentReserve);
  const availableSurplus = money(Math.max(0, availableAfterPayment - data.event.taxReserve));
  const savings = money((liquidByAccount.savings || 0));
  const safetyTarget = money(data.profile.monthlyEssentials * data.profile.emergencyMonths);
  const safetyGap = money(Math.max(0, safetyTarget - savings));
  const oneMonthFloor = data.profile.monthlyEssentials;
  const protectedCash = money(Object.values(requiredByAccount).reduce((a, b) => a + b, 0));
  const liquidity = {
    liquidByAccount, requiredByAccount, obligations: rows, protectedCash, shortfallBeforeEvent,
    paymentReserve, taxReserve: data.event.taxReserve, availableSurplus, reportedSavings: savings,
    safetyTarget, safetyGap, oneMonthFloor,
  };
  traceItems.push(trace("liquidity", "built_hard_constraint_view", `Found ${money(shortfallBeforeEvent)} of near-term payment shortfall and ${money(availableSurplus)} surplus after required reserves.`));
  traceItems.push(trace("obligations", "evaluated_hard_branch", `${rows.length} obligation(s) were checked against the payment account(s).`, "obligations"));

  const candidates = data.liabilities.filter((item) => item.balance > 0).map((liability) => {
    const extraAllowed = availableSurplus > 0 && savings >= oneMonthFloor;
    const decision = extraAllowed && liability.apr >= 10 ? "extra_payoff_candidate" : "minimum_only";
    return {
      ...liability,
      decision,
      reason: decision === "extra_payoff_candidate"
        ? "The minimum is protected, the one-month cash floor is present, and surplus can be compared with the APR cost."
        : "Protect the minimum first; extra payoff stays secondary until liquidity and the one-month floor are covered.",
    };
  });
  const highest = candidates.filter((item) => item.decision === "extra_payoff_candidate").sort((a, b) => b.apr - a.apr)[0] || null;
  const debtAnalysis = { candidates, highestAprCandidate: highest?.id || null, extraPayoffAllowed: Boolean(highest), minimumsDueSoon: money(candidates.reduce((sum, item) => sum + item.minimumPayment, 0)) };
  traceItems.push(trace("debt", "evaluated_debt_branch", `Compared ${candidates.length} liability account(s), separating minimum protection from optional extra payoff.`, "debt"));

  let route = "cash_buffer";
  let label = "Keep a flexible cash buffer";
  let reason = "No higher-confidence destination remains after the hard constraints were checked.";
  let branchTaken = "conservative_fallback";
  if (availableSurplus <= 0 && paymentReserve > 0) {
    route = "obligations";
    label = "Protect upcoming payments";
    reason = "This event is needed to cover a near-term cash shortfall before softer goals are funded.";
    branchTaken = "hard_obligation_shortfall";
  } else if (highest) {
    route = "debt_payoff";
    label = `Pay down ${highest.name}`;
    reason = `The minimum is protected, the one-month cash floor is present, and the reported APR is ${highest.apr.toFixed(1)}%.`;
    branchTaken = "surplus_after_minimum_high_apr_debt";
  } else if (safetyGap > 0) {
    route = "safety";
    label = "Build the safety cushion";
    reason = `Savings are ${money(safetyGap)} below the selected ${data.profile.emergencyMonths}-month cushion target.`;
    branchTaken = "safety_gap_after_liquidity_gate";
  } else if (data.profile.primaryDirection === "investing") {
    route = "investing";
    label = "Long-term investing";
    reason = "Near-term obligations and the safety gate are covered, so the selected long-term direction can receive surplus.";
    branchTaken = "surplus_after_hard_constraints";
  } else if (data.profile.primaryGoalName) {
    route = "goal";
    label = data.profile.primaryGoalName;
    reason = "Near-term obligations and safety checks are covered, so the named goal can receive surplus.";
    branchTaken = "named_goal_after_hard_constraints";
  }
  const priority = { route, label, reason, branchTaken, protectedCash, availableSurplus, alternatives: ["obligations", "debt_payoff", "safety", "investing", "goal"].filter((item) => item !== route).slice(0, 3) };
  traceItems.push(trace("router", "selected_branch", `Entered the ${branchTaken} branch instead of comparing percentage offsets directly.`, route));

  const allocationRows = [];
  if (paymentReserve > 0) allocationRows.push({ destination: "payment_reserve", label: "Upcoming payment reserve", amount: paymentReserve, required: true, reason: "Reserve cash for an obligation due inside the planning horizon." });
  if (data.event.taxReserve > 0) allocationRows.push({ destination: "tax_reserve", label: "Tax reserve candidate", amount: data.event.taxReserve, required: true, reason: "Freelance money without confirmed withholding gets a visible reserve." });
  if (availableSurplus > 0) {
    if (route === "debt_payoff" && highest) allocationRows.push({ destination: `debt:${highest.id}`, label: `Extra payoff: ${highest.name}`, amount: money(Math.min(availableSurplus, highest.balance)), required: false, reason: highest.reason });
    else if (route === "safety") allocationRows.push({ destination: "safety_savings", label: "Safety savings", amount: money(Math.min(availableSurplus, safetyGap)), required: false, reason: "Required cash is protected first; the remaining event closes the reported savings gap." });
    else if (route === "investing") allocationRows.push({ destination: "investing", label: "Long-term investing", amount: availableSurplus, required: false, reason: "Only surplus after obligations, tax reserve, and the liquidity gate is eligible for this category." });
    else if (route === "goal") allocationRows.push({ destination: "goal", label: data.profile.primaryGoalName, amount: availableSurplus, required: false, reason: "This named goal is considered only after required cash and the liquidity gate are covered." });
    else allocationRows.push({ destination: "cash_buffer", label: "Flexible cash buffer", amount: availableSurplus, required: false, reason: "The graph is not confident enough to force surplus into a softer target." });
  }
  const totalAllocated = money(allocationRows.reduce((sum, item) => sum + item.amount, 0));
  const allocation = { eventAmount: data.event.amount, rows: allocationRows, totalAllocated, unassigned: money(data.event.amount - totalAllocated) };
  traceItems.push(trace("plan", "built_branch_plan", `Built the ${route.replaceAll("_", " ")} plan with ${money(totalAllocated)} assigned and ${money(allocation.unassigned)} unassigned.`, route));
  const explanation = [
    `Protected cash requirement: ${money(protectedCash)}.`,
    `Near-term payment shortfall before this event: ${money(shortfallBeforeEvent)}.`,
    `Available surplus after required reserves: ${money(availableSurplus)}.`,
    reason,
    ...(allocationRows.some((row) => row.required) ? ["Required payment or tax reserves were placed before savings, debt payoff, or investing."] : []),
    "Percent offsets are supporting evidence, not the decision rule by themselves.",
    "This is an educational plan; it does not move money or contact a lender.",
  ];
  traceItems.push(trace("explain", "published_branch_trace", "Returned the selected branch, allocation, alternatives, and reasoning trace."));
  const nodes = buildGraphNodes(true, route, route);
  return {
    version: REASONING_GRAPH_VERSION,
    status: "complete",
    summary: `Next Dollar: ${label}.`,
    normalized: data,
    classification: { source: data.event.source, earned, irregular, taxReserve: data.event.taxReserve },
    liquidity,
    debtAnalysis,
    priority,
    allocation,
    explanation,
    trace: traceItems,
    nodes,
    edges: buildEdges(route, true),
  };
}

