import { DEFAULT_ASSUMPTIONS } from "./profile.js";

export const RECOMMENDATION_VERSION = "0.3.0";

const n = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(Math.max(0, n(value)) * 100) / 100;
const daysBetween = (from, to = new Date()) => {
  const start = new Date(from || to);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
};

export function monthlyEssentials(profile) {
  const breakdown = profile?.expenses?.breakdown || {};
  const values = Object.values(breakdown).map(n);
  const hasBreakdown = values.some((value) => value > 0);
  return round(hasBreakdown ? values.reduce((sum, value) => sum + value, 0) : n(profile?.expenses?.monthlyEssentials));
}

export function emergencyTarget(profile) {
  const essentials = monthlyEssentials(profile);
  if (essentials <= 0) return 0;
  const months = clamp(n(profile?.expenses?.emergencyMonths || DEFAULT_ASSUMPTIONS.emergencyMonths), 3, 6);
  return round(essentials * months);
}

export function totalBalance(profile) {
  return round((profile?.accounts || []).reduce((sum, account) => sum + n(account.amount), 0));
}

export function liquidBalance(profile) {
  return round((profile?.accounts || [])
    .filter((account) => ["checking", "savings"].includes(account.type))
    .reduce((sum, account) => sum + n(account.amount), 0));
}

export function savingsBalance(profile) {
  return round((profile?.accounts || [])
    .filter((account) => account.type === "savings")
    .reduce((sum, account) => sum + n(account.amount), 0));
}

export function debtBalance(profile) {
  return round(n(profile?.debt?.balance));
}

export function accountProjection(account, years = 5) {
  const amount = n(account?.amount);
  const savingsRate = account?.apy === null || account?.apy === undefined || account?.apy === ""
    ? DEFAULT_ASSUMPTIONS.savingsApy
    : n(account.apy);
  const fixedRate = account?.rate === null || account?.rate === undefined || account?.rate === ""
    ? DEFAULT_ASSUMPTIONS.fixedYield
    : n(account.rate);
  const rate = account?.type === "savings"
    ? savingsRate
    : account?.type === "stocks"
      ? (account.subtype === "individual" ? null : DEFAULT_ASSUMPTIONS.broadStockReturn)
      : ["real_assets", "bonds", "other"].includes(account?.type)
        ? fixedRate
        : null;
  if (rate === null || account?.type === "crypto" || account?.type === "checking") {
    return { kind: "scenario", amount, rate: null, value: null, label: "Not projected" };
  }
  return {
    kind: "estimate",
    amount,
    rate,
    value: round(amount * ((1 + rate / 100) ** years)),
    label: "Estimate",
  };
}

function projectedValue(account, elapsedDays) {
  const projection = accountProjection(account, elapsedDays / 365);
  if (projection.kind !== "estimate") return null;
  return projection.value;
}

export function accountSnapshot(profile, asOf = new Date()) {
  const accounts = (profile?.accounts || []).map((account) => {
    const lastCheckedAt = account.lastCheckedAt || profile?.lastCheckedAt || profile?.updatedAt || asOf.toISOString();
    const ageDays = daysBetween(lastCheckedAt, asOf);
    const currentEstimate = projectedValue(account, ageDays);
    return {
      ...account,
      reported: round(account.amount),
      currentEstimate: currentEstimate === null ? null : round(currentEstimate),
      ageDays,
      stale: ageDays >= DEFAULT_ASSUMPTIONS.staleDays,
      asOf: lastCheckedAt,
    };
  });
  const estimatedTotal = round(accounts.reduce((sum, account) => sum + (account.currentEstimate ?? account.reported), 0));
  return {
    accounts,
    reportedTotal: round(accounts.reduce((sum, account) => sum + account.reported, 0)),
    estimatedTotal,
    estimatedDelta: round(estimatedTotal - totalBalance(profile)),
    staleCount: accounts.filter((account) => account.stale).length,
    asOf: asOf.toISOString(),
  };
}

export function profileCompleteness(profile) {
  const missing = [];
  if (monthlyEssentials(profile) <= 0) missing.push({ id: "expenses", label: "essential monthly expenses" });
  return { complete: missing.length === 0, missing };
}

function sourceLabel(source) {
  return {
    parent_support: "family support",
    gift: "a gift",
    scholarship: "a scholarship or refund",
    paycheck: "a paycheck",
    freelance: "freelance or gig work",
    tax_refund: "a tax refund",
    other: "a one-time source",
  }[source] || "this cash event";
}

function destinationLabel(destination) {
  return {
    safety: "safety savings",
    tax: "a tax reserve",
    debt: "debt payoff",
    invest: "long-term investing",
    goal: "your selected goal",
    profile: "profile completion",
  }[destination] || destination;
}

function nextPriority(profile, context) {
  const { essentials, saved, emergency, debt, highCostDebt, goal } = context;
  if (essentials <= 0) return "profile";
  if (highCostDebt && saved < essentials) return "safety";
  if (highCostDebt) return "debt";
  if (saved < emergency) return "safety";
  if (debt > 0 && goal.type === "debt_free") return "debt";
  if (goal.type === "purchase" && n(goal.target) > 0 && n(goal.current) < n(goal.target)) return "goal";
  if (goal.type === "invest") return "invest";
  if (goal.type === "custom" && goal.name) return "goal";
  return "safety";
}

function secondaryPriority(profile, primary, context) {
  const { saved, emergency, debt, highCostDebt, goal } = context;
  const order = [];
  if (saved < emergency) order.push("safety");
  if (highCostDebt && debt > 0) order.push("debt");
  if (goal.type === "purchase" || (goal.type === "custom" && goal.name)) order.push("goal");
  if (goal.type === "invest") order.push("invest");
  return [...new Set(order.filter((item) => item !== primary))][0] || "safety";
}

function addTrace(trace, id, title, detail, result) {
  trace.push({ id, title, detail, result });
}

export function buildRecommendation(profile, cashEvent = null, asOf = new Date()) {
  const essentials = monthlyEssentials(profile);
  const emergency = emergencyTarget(profile);
  const saved = savingsBalance(profile);
  const liquid = liquidBalance(profile);
  const debt = debtBalance(profile);
  const goal = profile?.goal || {};
  const highCostDebt = debt > 0 && n(profile?.debt?.apr) >= 10;
  const eventAmount = round(cashEvent?.amount);
  const isFreelance = cashEvent?.source === "freelance";
  const taxWithheld = profile?.answers?.taxes === "Yes";
  const taxRate = isFreelance && !taxWithheld ? DEFAULT_ASSUMPTIONS.taxReserveRate : 0;
  const taxReserve = round(eventAmount * taxRate);
  const context = { essentials, saved, emergency, liquid, debt, highCostDebt, goal };
  const trace = [];
  const completeness = profileCompleteness(profile);
  const assumptions = {
    emergencyMonths: clamp(n(profile?.expenses?.emergencyMonths || DEFAULT_ASSUMPTIONS.emergencyMonths), 3, 6),
    savingsApy: DEFAULT_ASSUMPTIONS.savingsApy,
    broadStockReturn: DEFAULT_ASSUMPTIONS.broadStockReturn,
    taxReserveRate: taxRate,
    staleDays: DEFAULT_ASSUMPTIONS.staleDays,
  };

  if (!completeness.complete) {
    addTrace(trace, "completeness", "Check the minimum inputs", "The recommendation stays educational until the cost of essentials is known.", "needs input");
    return {
      version: RECOMMENDATION_VERSION,
      destination: "profile",
      title: "Add your monthly essentials before deciding where the next dollar goes.",
      reason: "The safety target is based on essential monthly expenses, so Fundy does not invent that number.",
      detail: "You can use one estimate or expand the breakdown. The rest of your profile can stay approximate.",
      allocation: null,
      allocations: [],
      alternatives: [],
      emergencyTarget: emergency,
      saved,
      liquid,
      debt,
      eventAmount,
      taxReserve,
      confidence: "waiting for one important input",
      trace,
      assumptions,
      missing: completeness.missing,
      generatedAt: asOf.toISOString(),
    };
  }

  const primary = nextPriority(profile, context);
  const secondary = secondaryPriority(profile, primary, context);
  const safetyGap = round(Math.max(0, emergency - saved));
  const oneMonthGap = round(Math.max(0, essentials - saved));

  addTrace(trace, "safety", "Compare savings with the cushion", formatMoney(saved) + " in savings against a " + formatMoney(emergency) + " target.", saved >= emergency ? "covered" : "gap remains");
  if (debt > 0) addTrace(trace, "debt", "Check the cost of debt", formatMoney(debt) + " reported at " + n(profile?.debt?.apr) + "% APR.", highCostDebt ? "high-cost debt is relevant" : "not the first priority");
  addTrace(trace, "goal", "Keep the user's direction in view", goal.name || goal.type || "No custom goal", "used as a tie-breaker after basic stability");
  addTrace(trace, "decision", "Choose the next priority", "Stability comes before volatility when the safety base is incomplete.", destinationLabel(primary));

  let title = "Build your safety cushion first.";
  let reason = "Your savings are below the cushion target, so the next dollar has a stability job.";
  let detail = "This keeps an irregular expense from forcing you to sell investments or rely on expensive debt.";
  if (primary === "debt") {
    title = "Your next dollar should reduce high-cost debt.";
    reason = "Your basic safety floor is in place, and the reported APR makes debt payoff a more certain benefit than taking additional market risk.";
    detail = "The model is not telling you to close an account or make a payment automatically. It is showing the tradeoff.";
  } else if (primary === "invest") {
    title = "Your safety base is ready for long-term investing.";
    reason = "Your reported savings meet the selected cushion target, so long-term money can serve the investing direction you chose.";
    detail = "The estimate uses a broad category assumption, not a promise and not a recommendation for a specific security.";
  } else if (primary === "goal") {
    title = "Make progress on " + (goal.name || "your selected goal") + ".";
    reason = "Your safety base is covered, so this dollar can serve the goal you selected without mixing it with emergency money.";
    detail = "Keeping goal money separate makes the tradeoff visible and easier to revisit.";
  } else if (primary === "safety" && highCostDebt && saved < essentials) {
    title = "Build a one-month floor before tackling high-cost debt.";
    reason = "The reported debt is expensive, but savings are below one month of essentials.";
    detail = "This is a guardrail against paying down debt and immediately needing to borrow again for a basic expense.";
  }

  const allocations = [];
  let remaining = eventAmount;
  if (taxReserve > 0) {
    allocations.push({ destination: "tax", amount: taxReserve, reason: "Estimated reserve because this freelance event has no confirmed withholding." });
    remaining = round(Math.max(0, remaining - taxReserve));
    addTrace(trace, "tax", "Separate a possible tax obligation", formatMoney(taxReserve) + " of this event is held back at an educational " + Math.round(taxRate * 100) + "% assumption.", "tax reserve first");
  }
  const pushAllocation = (destination, amount, reasonText) => {
    const allocationAmount = round(Math.min(remaining, Math.max(0, amount)));
    if (allocationAmount <= 0) return;
    allocations.push({ destination, amount: allocationAmount, reason: reasonText });
    remaining = round(remaining - allocationAmount);
  };
  if (primary === "safety") pushAllocation("safety", Math.min(safetyGap, remaining), safetyGap > 0 ? "Close the remaining cushion gap." : "Keep the next dollar liquid.");
  if (primary === "debt") pushAllocation("debt", remaining, "Reduce the reported high-cost balance.");
  if (primary === "invest") pushAllocation("invest", remaining, "Direct only money that is not needed for the safety base.");
  if (primary === "goal") pushAllocation("goal", remaining, "Keep the selected goal funded separately.");
  if (primary === "profile") pushAllocation("profile", remaining, "Finish the missing input first.");
  if (remaining > 0 && primary === "safety") pushAllocation(secondary, remaining, "After the safety gap, use the next relevant priority.");
  if (remaining > 0 && allocations.length === 0) pushAllocation(primary, remaining, "Use the selected priority for this event.");

  const primaryAllocation = allocations.find((row) => row.destination !== "tax") || allocations[0] || null;
  const alternatives = [
    { destination: primary, label: destinationLabel(primary), selected: true },
    ...[secondary, "safety", "debt", "invest", "goal"]
      .filter((destination, index, list) => destination !== primary && list.indexOf(destination) === index)
      .filter((destination) => destination !== "goal" || goal.name || goal.type === "purchase")
      .map((destination) => ({ destination, label: destinationLabel(destination), selected: false })),
  ];

  return {
    version: RECOMMENDATION_VERSION,
    destination: primary,
    title,
    reason,
    detail,
    allocation: eventAmount > 0 ? { destination: primaryAllocation?.destination || primary, amount: eventAmount } : null,
    allocations,
    alternatives,
    emergencyTarget: emergency,
    saved,
    liquid,
    debt,
    safetyGap,
    oneMonthGap,
    eventAmount,
    taxReserve,
    confidence: highCostDebt || safetyGap > 0 ? "profile-based priority" : "profile-based direction",
    trace,
    assumptions,
    missing: [],
    source: cashEvent?.source ? sourceLabel(cashEvent.source) : null,
    snapshot: accountSnapshot(profile, asOf),
    generatedAt: asOf.toISOString(),
  };
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n(value));
}


