/*
 * Next Dollar's deterministic MVP engine.
 *
 * The engine deliberately allocates to categories, not securities. It treats a
 * cash event as the trigger, keeps cash received separate from earned income,
 * and emits an auditable marginal allocation curve.
 */

export const ENGINE_VERSION = "0.1.0";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const roundMoney = (value) => Math.round((Math.max(0, value) + Number.EPSILON) * 100) / 100;
const daysUntil = (date, today = new Date()) => {
  if (!date) return 365;
  const target = new Date(`${date}T12:00:00`);
  if (Number.isNaN(target.getTime())) return 365;
  return Math.ceil((target - today) / 86400000);
};

export const DEFAULT_STATE = {
  person: {
    age: 21,
    student: true,
    employmentStatus: "part_time",
    housingSupport: "mixed",
    incomeStability: "variable",
  },
  accounts: {
    checking: 300,
    savings: 1800,
    reserveTarget: 1000,
  },
  cashEvent: {
    amount: 380,
    sourceType: "paycheck",
    recurrence: "biweekly",
    earnedIncome: true,
    taxWithheld: true,
    taxReservePct: 0.25,
  },
  cashFlow: {
    nextIncomeDays: 14,
    nextIncomeAmount: 380,
    monthlyEssentials: 450,
    incomeFloorMonthly: 300,
  },
  essentials: [
    { id: "food", label: "Food and groceries", amount: 160, dueInDays: 14, required: true },
    { id: "transport", label: "Transportation", amount: 70, dueInDays: 14, required: true },
  ],
  commitments: [],
  debt: {
    balance: 0,
    apr: 0,
    minimumDue: 0,
    promoApr: null,
    promoEndDate: null,
  },
  employerMatch: {
    remainingContribution: 0,
    matchRatio: 1,
    deadlineDays: 30,
    eligible: false,
  },
  goals: [
    {
      id: "travel",
      name: "Christmas travel",
      target: 450,
      current: 0,
      deadline: "2026-12-18",
      priority: 4,
      required: false,
      flexibility: 2,
      priceVolatility: 5,
      substitutability: 2,
      delayCost: 4,
    },
    {
      id: "car",
      name: "Car fund",
      target: 5000,
      current: 1200,
      deadline: "2027-06-01",
      priority: 3,
      required: false,
      flexibility: 4,
      priceVolatility: 2,
      substitutability: 3,
      delayCost: 2,
    },
  ],
};

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function mergeState(base, override = {}) {
  const state = clone(base);
  const merge = (target, source) => {
    Object.entries(source || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        target[key] = merge(target[key] || {}, value);
      } else if (value !== undefined) {
        target[key] = value;
      }
    });
    return target;
  };
  return merge(state, override);
}

function normalizeList(items = []) {
  return items
    .filter(Boolean)
    .map((item, index) => ({
      id: item.id || `item-${index + 1}`,
      label: item.label || item.name || `Item ${index + 1}`,
      name: item.name || item.label || `Item ${index + 1}`,
      amount: roundMoney(num(item.amount || item.target)),
      current: roundMoney(num(item.current)),
      target: roundMoney(num(item.target || item.amount)),
      dueInDays: Math.max(0, num(item.dueInDays, 30)),
      deadline: item.deadline || null,
      required: Boolean(item.required),
      priority: clamp(num(item.priority, 3), 1, 5),
      flexibility: clamp(num(item.flexibility, 3), 1, 5),
      priceVolatility: clamp(num(item.priceVolatility, 2), 1, 5),
      substitutability: clamp(num(item.substitutability, 3), 1, 5),
      delayCost: clamp(num(item.delayCost, 2), 1, 5),
    }));
}

function classifyEvent(state) {
  const event = state.cashEvent || {};
  const type = String(event.sourceType || "other").toLowerCase();
  const selfEmployment = ["freelance", "1099", "gig", "commission", "tips"].includes(type);
  const nonEarned = ["parent_support", "gift", "scholarship", "refund", "reimbursement", "sale"].includes(type);
  const taxReservePct = clamp(num(event.taxReservePct, 0.25), 0, 0.6);
  const taxReserve = selfEmployment && !event.taxWithheld ? roundMoney(num(event.amount) * taxReservePct) : 0;
  return {
    amount: roundMoney(num(event.amount)),
    sourceType: type,
    recurrence: event.recurrence || "one_time",
    earnedIncome: Boolean(event.earnedIncome) && !nonEarned,
    taxWithheld: Boolean(event.taxWithheld),
    selfEmployment,
    nonEarned,
    taxReserve,
    taxReservePct,
  };
}

function normalizeState(input = {}) {
  const state = mergeState(DEFAULT_STATE, input);
  state.essentials = normalizeList(state.essentials);
  state.commitments = normalizeList(state.commitments);
  state.goals = normalizeList(state.goals);
  state.accounts.checking = roundMoney(num(state.accounts.checking));
  state.accounts.savings = roundMoney(num(state.accounts.savings));
  state.accounts.reserveTarget = roundMoney(num(state.accounts.reserveTarget, 500));
  state.cashFlow.nextIncomeDays = Math.max(0, num(state.cashFlow.nextIncomeDays, 14));
  state.cashFlow.nextIncomeAmount = roundMoney(num(state.cashFlow.nextIncomeAmount));
  state.cashFlow.monthlyEssentials = roundMoney(num(state.cashFlow.monthlyEssentials));
  state.debt.balance = roundMoney(num(state.debt.balance));
  state.debt.apr = Math.max(0, num(state.debt.apr));
  state.debt.minimumDue = roundMoney(num(state.debt.minimumDue));
  state.employerMatch.remainingContribution = roundMoney(num(state.employerMatch.remainingContribution));
  state.employerMatch.matchRatio = Math.max(0, num(state.employerMatch.matchRatio, 1));
  state.event = classifyEvent(state);
  return state;
}

function computeCashPosition(state) {
  const event = state.event;
  const liquidBefore = state.accounts.checking + state.accounts.savings;
  const liquidAfter = liquidBefore + event.amount;
  const essentialsDue = state.essentials
    .filter((item) => item.dueInDays <= state.cashFlow.nextIncomeDays || item.required)
    .reduce((sum, item) => sum + item.amount, 0);
  const commitmentHorizon = Math.max(state.cashFlow.nextIncomeDays, 120);
  const commitmentsDue = state.commitments
    .filter((item) => item.dueInDays <= commitmentHorizon || item.required)
    .reduce((sum, item) => sum + item.amount, 0);
  const debtMinimum = state.debt.balance > 0 ? state.debt.minimumDue : 0;
  const knownNeeds = roundMoney(essentialsDue + commitmentsDue + debtMinimum);
  const reserveTarget = roundMoney(Math.max(state.accounts.reserveTarget, state.cashFlow.monthlyEssentials * 0.5));
  const cashAboveReserveBefore = Math.max(0, liquidBefore - reserveTarget);
  const unfundedNeedsBefore = Math.max(0, knownNeeds - cashAboveReserveBefore);
  const eventToNeeds = Math.min(event.amount, unfundedNeedsBefore);
  const cashAfterNeeds = Math.max(0, liquidAfter - knownNeeds - reserveTarget);
  const allocatable = roundMoney(Math.max(0, event.amount - eventToNeeds));
  const reserveGap = roundMoney(Math.max(0, reserveTarget - Math.max(0, liquidBefore - knownNeeds)));
  return {
    received: event.amount,
    liquidBefore: roundMoney(liquidBefore),
    availableCash: roundMoney(liquidAfter),
    essentialsDue: roundMoney(essentialsDue),
    commitmentsDue: roundMoney(commitmentsDue),
    minimumDebtDue: roundMoney(debtMinimum),
    taxReserve: event.taxReserve,
    knownNeeds,
    reserveTarget,
    reserveGap,
    eventToNeeds: roundMoney(eventToNeeds),
    allocatableBeforeTax: allocatable,
    allocatable: roundMoney(Math.max(0, allocatable - event.taxReserve)),
    cashAfterNeeds: roundMoney(cashAfterNeeds),
  };
}

function debtScore(state) {
  const debt = state.debt;
  if (debt.balance <= 0) return 0;
  if (debt.promoApr !== null && debt.promoEndDate) {
    const promoDays = daysUntil(debt.promoEndDate);
    if (promoDays <= 180) return 9.5;
  }
  if (debt.apr >= 20) return 12;
  if (debt.apr >= 10) return 8;
  if (debt.apr > 0) return 4;
  return 1.5;
}

function goalScore(goal, today = new Date()) {
  const need = Math.max(0, goal.target - goal.current);
  if (need <= 0) return 0;
  const days = goal.deadline ? Math.max(1, daysUntil(goal.deadline, today)) : 365;
  const urgency = clamp(180 / days, 0, 6);
  const requiredBoost = goal.required ? 4 : 0;
  const volatilityBoost = goal.priceVolatility * 0.45;
  const delayBoost = goal.delayCost * 0.65;
  const flexibilityPenalty = (goal.flexibility - 1) * 0.55;
  const substitutabilityPenalty = (goal.substitutability - 1) * 0.35;
  const underfundedBoost = clamp((need / Math.max(goal.target, 1)) * 2, 0, 2);
  return 2 + goal.priority * 1.1 + urgency + requiredBoost + volatilityBoost + delayBoost + underfundedBoost - flexibilityPenalty - substitutabilityPenalty;
}

function candidateDestinations(state, position, today = new Date()) {
  const cash = position;
  const candidates = [];
  const add = (candidate) => {
    if (candidate.max > 0 && candidate.score > 0) candidates.push(candidate);
  };

  add({
    id: "liquidity",
    label: "Cash reserve",
    layer: "stabilize",
    max: cash.reserveGap,
    score: cash.reserveGap > 0 ? 10 : 0,
    reason: "Protects the runway before the next reliable inflow.",
  });

  if (state.event.taxReserve > 0) {
    add({
      id: "tax_reserve",
      label: "Tax reserve",
      layer: "survive",
      max: state.event.taxReserve,
      score: 13,
      reason: "This inflow may create a tax obligation because withholding was not confirmed.",
    });
  }

  add({
    id: "high_interest_debt",
    label: "Debt payoff",
    layer: "stabilize",
    max: state.debt.balance,
    score: debtScore(state),
    reason: state.debt.promoEndDate && daysUntil(state.debt.promoEndDate, today) <= 180
      ? "The promotional rate has a known end date; waiting could create a sudden interest cost."
      : state.debt.apr >= 20
        ? "High APR debt creates a large, near-certain drag on each dollar left unpaid."
        : "Reducing debt improves future flexibility, but its priority depends on the APR and other needs.",
  });

  if (state.employerMatch.eligible && state.event.earnedIncome) {
    add({
      id: "employer_match",
      label: "Employer match",
      layer: "grow",
      max: state.employerMatch.remainingContribution,
      score: state.employerMatch.remainingContribution > 0 ? 9.5 : 0,
      reason: "The remaining contribution can unlock an employer benefit, subject to the plan rules.",
    });
  }

  state.goals.forEach((goal) => {
    const max = Math.max(0, goal.target - goal.current);
    add({
      id: `goal:${goal.id}`,
      label: goal.name,
      layer: goal.required ? "survive" : "achieve",
      max,
      score: goalScore(goal, today),
      reason: `${goal.deadline ? `Deadline ${goal.deadline}; ` : ""}${goal.required ? "required goal" : "stated goal"} with ${goal.priceVolatility}/5 price uncertainty and ${goal.delayCost}/5 delay cost.`,
    });
  });

  const canUseTaxAdvantaged = state.event.earnedIncome && state.cashFlow.incomeFloorMonthly > 0;
  if (canUseTaxAdvantaged) {
    add({
      id: "retirement_category",
      label: "Long-term retirement category",
      layer: "grow",
      max: Number.POSITIVE_INFINITY,
      score: 3.5,
      reason: "Long-term growth is considered only after near-term obligations, liquidity, debt, and goals are addressed.",
    });
  }

  add({
    id: "flexible_spending",
    label: "Flexible spending",
    layer: "achieve",
    max: Number.POSITIVE_INFINITY,
    score: 1.5,
    reason: "A small flexible category can be reasonable after higher-consequence uses are covered.",
  });
  return candidates;
}

function allocateMarginally(state, position, today = new Date()) {
  let remaining = position.allocatable;
  const allocations = new Map();
  const curve = [];
  const increment = remaining >= 100 ? 25 : 10;
  let cumulative = 0;
  let guard = 0;

  while (remaining > 0.009 && guard < 5000) {
    guard += 1;
    const candidates = candidateDestinations(state, position, today)
      .map((candidate) => ({ ...candidate, allocated: allocations.get(candidate.id) || 0 }))
      .filter((candidate) => candidate.allocated + 0.01 < candidate.max)
      .sort((a, b) => b.score - a.score);
    if (!candidates.length) break;
    const winner = candidates[0];
    const amount = roundMoney(Math.min(increment, remaining, winner.max - winner.allocated));
    if (amount <= 0) break;
    const nextAmount = roundMoney((allocations.get(winner.id) || 0) + amount);
    allocations.set(winner.id, nextAmount);
    const start = cumulative;
    cumulative = roundMoney(cumulative + amount);
    const last = curve[curve.length - 1];
    if (last && last.bucketId === winner.id && last.reason === winner.reason) {
      last.end = cumulative;
    } else {
      curve.push({ start, end: cumulative, bucketId: winner.id, label: winner.label, reason: winner.reason, layer: winner.layer });
    }
    remaining = roundMoney(remaining - amount);
  }

  if (remaining > 0.009) {
    const previous = allocations.get("flexible_spending") || 0;
    allocations.set("flexible_spending", roundMoney(previous + remaining));
    curve.push({ start: cumulative, end: roundMoney(cumulative + remaining), bucketId: "flexible_spending", label: "Flexible spending", reason: "Residual dollars remained after modeled destinations reached their caps.", layer: "achieve" });
    remaining = 0;
  }

  const allocationRows = [...allocations.entries()]
    .map(([id, amount]) => {
      const candidate = candidateDestinations(state, position, today).find((item) => item.id === id);
      return { id, label: candidate?.label || id, amount: roundMoney(amount), layer: candidate?.layer || "achieve", reason: candidate?.reason || "" };
    })
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { allocationRows, curve, residual: roundMoney(remaining) };
}

function requiredQuestions(state, position) {
  const questions = [];
  if (state.debt.balance <= 0 && state.debt.apr <= 0) {
    questions.push({ id: "debt", question: "Do you carry any revolving or promotional debt?", why: "A high APR or expiring promotion can change the next-dollar priority completely.", value: "high" });
  }
  if (state.event.selfEmployment && !state.event.taxWithheld) {
    questions.push({ id: "tax", question: "Have you already set aside money for taxes on this inflow?", why: "The app is reserving a placeholder percentage until the tax situation is confirmed.", value: "high" });
  }
  if (state.cashFlow.nextIncomeAmount <= 0 || state.cashFlow.nextIncomeDays > 45) {
    questions.push({ id: "income", question: "When is the next reliable inflow, and what is its conservative amount?", why: "Runway depends more on the income floor than on an optimistic average.", value: "high" });
  }
  if (state.goals.length > 0 && state.goals.some((goal) => goal.priority >= 4)) {
    questions.push({ id: "goal", question: "Which goal has the highest personal consequence if delayed?", why: "The engine uses your preference to distinguish a meaningful life goal from a merely optional purchase.", value: "medium" });
  }
  if (!state.event.earnedIncome) {
    questions.push({ id: "earned_income", question: "Do you have any taxable compensation this year, separate from this cash transfer?", why: "Cash received and earned income are different; account eligibility may depend on compensation.", value: "high" });
  }
  return questions.slice(0, 4);
}

function critique(state, position, allocations) {
  const total = roundMoney(allocations.reduce((sum, item) => sum + item.amount, 0));
  const checks = [
    { id: "conservation", label: "Allocations do not exceed modeled allocatable cash", pass: total <= position.allocatable + 0.01, severity: "critical" },
    { id: "tax", label: "Potential tax reserve is protected before growth", pass: position.taxReserve === 0 || position.allocatableBeforeTax - position.allocatable >= position.taxReserve - 0.01, severity: "critical" },
    { id: "earned_income", label: "No earned-income assumption is made for transfers or gifts", pass: !(!state.event.earnedIncome && allocations.some((item) => item.id === "retirement_category")), severity: "critical" },
    { id: "debt", label: "Debt APR and promotion timing are part of the comparison", pass: state.debt.balance <= 0 || allocations.some((item) => item.id === "high_interest_debt") || debtScore(state) < 4, severity: "warning" },
    { id: "explainability", label: "Every recommendation has an explanation", pass: allocations.every((item) => Boolean(item.reason)), severity: "warning" },
  ];
  return { total, pass: checks.every((check) => check.pass), checks };
}

function buildSummary(state, position, allocations, critiqueResult) {
  if (position.allocatable <= 0.01) {
    return "There is no true surplus to invest or send toward optional goals yet. The cash event is being absorbed by known needs, taxes, or the minimum liquidity runway.";
  }
  const top = allocations[0];
  const second = allocations[1];
  const parts = [`Your modeled allocatable amount is ${formatCurrency(position.allocatable)}.`];
  if (top) parts.push(`The highest marginal value starts with ${top.label.toLowerCase()} (${formatCurrency(top.amount)}).`);
  if (second) parts.push(`After that, the next meaningful destination is ${second.label.toLowerCase()}.`);
  if (!critiqueResult.pass) parts.push("This result contains unresolved checks and should be treated as a draft until those inputs are confirmed.");
  return parts.join(" ");
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num(value));
}

export function analyze(input = {}, options = {}) {
  const state = normalizeState(input);
  const position = computeCashPosition(state);
  const allocations = allocateMarginally(state, position, options.today ? new Date(options.today) : new Date());
  const critiqueResult = critique(state, position, allocations.allocationRows);
  const questions = requiredQuestions(state, position);
  const layerTotals = allocations.allocationRows.reduce((totals, row) => {
    totals[row.layer] = roundMoney((totals[row.layer] || 0) + row.amount);
    return totals;
  }, {});
  return {
    engineVersion: ENGINE_VERSION,
    state,
    position,
    allocations: allocations.allocationRows,
    layerTotals,
    curve: allocations.curve,
    questions,
    critique: critiqueResult,
    summary: buildSummary(state, position, allocations.allocationRows, critiqueResult),
    disclaimer: "Educational prototype: category-level planning only. Confirm tax, benefits, debt, and investment rules with the relevant plan documents or a qualified professional.",
  };
}

export function evaluateScenario(scenario, options = {}) {
  const result = analyze(scenario.input, options);
  const expected = scenario.expected || {};
  const forbidden = scenario.forbidden || [];
  const actualIds = new Set(result.allocations.map((item) => item.id));
  const forbiddenHits = forbidden.filter((id) => actualIds.has(id) && result.allocations.find((item) => item.id === id)?.amount > 0);
  const requiredChecks = expected.requiredChecks || [];
  const satisfiedChecks = requiredChecks.filter((check) => result.critique.checks.some((item) => item.id === check && item.pass));
  const dominant = result.allocations[0]?.id || "none";
  const dominantAcceptable = expected.noSurplus
    ? dominant === "none" || !expected.dominant || expected.dominant.includes(dominant)
    : (!expected.dominant || expected.dominant.includes(dominant));
  const noSurplusCorrect = expected.noSurplus ? result.position.allocatable <= 0.01 : true;
  const pass = forbiddenHits.length === 0 && dominantAcceptable && noSurplusCorrect && satisfiedChecks.length === requiredChecks.length;
  return {
    id: scenario.id,
    title: scenario.title,
    pass,
    dominant,
    forbiddenHits,
    requiredChecks,
    satisfiedChecks,
    allocatable: result.position.allocatable,
    allocations: result.allocations,
    result,
  };
}

export function runBenchmark(scenarios, options = {}) {
  const results = scenarios.map((scenario) => evaluateScenario(scenario, options));
  const passed = results.filter((result) => result.pass).length;
  const criticalErrors = results.filter((result) => result.forbiddenHits.length > 0).length;
  return {
    total: results.length,
    passed,
    passRate: results.length ? passed / results.length : 0,
    criticalErrors,
    results,
  };
}

