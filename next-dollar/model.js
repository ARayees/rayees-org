export const FUNDY_VERSION = "0.5.0";

export const ACCOUNT_TYPES = [
  { id: "checking", label: "Checking", icon: "◌", description: "day-to-day cash" },
  { id: "savings", label: "Savings", icon: "▤", description: "cash set aside" },
  { id: "stocks", label: "Investments", icon: "↗", description: "stocks or funds" },
  { id: "crypto", label: "Crypto", icon: "◇", description: "digital assets" },
  { id: "real_assets", label: "Real estate", icon: "⌂", description: "property or REITs" },
  { id: "other", label: "Other", icon: "＋", description: "anything else" },
];

export const ROLE_OPTIONS = [
  { id: "student", label: "Full-time student", short: "Student", color: "#818cf8" },
  { id: "student_worker", label: "Student with work", short: "Student + work", color: "#a78bfa" },
  { id: "hourly", label: "Working part-time", short: "Part-time", color: "#fbbf24" },
  { id: "salary", label: "Full-time employee", short: "Employee", color: "#34d399" },
  { id: "freelance", label: "Freelance / self-employed", short: "Freelance", color: "#fb7185" },
  { id: "supported", label: "Between jobs / supported", short: "Supported", color: "#2dd4bf" },
];

export const GOAL_OPTIONS = [
  { id: "emergency", label: "Emergency fund", icon: "♥", category: "emergency", essential: true },
  { id: "debt", label: "Pay off debt", icon: "−", category: "debt", essential: true },
  { id: "investing", label: "Invest long term", icon: "↗", category: "investing" },
  { id: "travel", label: "Travel", icon: "✈", category: "savings" },
  { id: "purchase", label: "Something I want", icon: "□", category: "savings" },
  { id: "custom", label: "Something else", icon: "＋", category: "other" },
];

export const FUND_SOURCES = [
  { id: "paycheck", label: "Paycheck", icon: "▦", earned: true },
  { id: "parent_support", label: "Parent or family support", icon: "♥", earned: false },
  { id: "gift", label: "Gift", icon: "✦", earned: false },
  { id: "scholarship", label: "Scholarship or refund", icon: "✎", earned: false },
  { id: "freelance", label: "Freelance or gig work", icon: "↗", earned: true },
  { id: "tax_refund", label: "Tax refund", icon: "↺", earned: false },
  { id: "other", label: "Something else", icon: "＋", earned: false },
];

export const DEFAULTS = {
  emergencyMonths: 3,
  defaultSavingsApy: 4.25,
  broadStockScenario: 7,
  fixedYieldScenario: 5,
  highAprThreshold: 10,
  taxReserveRate: 0.25,
};

const n = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const round = (value) => Math.round(Math.max(0, n(value)) * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n(value));
}

export function formatCompactCurrency(value) {
  const amount = n(value);
  if (Math.abs(amount) >= 1000000) return "$" + (amount / 1000000).toFixed(1) + "M";
  if (Math.abs(amount) >= 1000) return "$" + (amount / 1000).toFixed(amount >= 10000 ? 0 : 1) + "k";
  return formatCurrency(amount);
}

export function calculateProgress(current, target) {
  if (n(target) <= 0) return 0;
  return clamp(n(current) / n(target) * 100, 0, 100);
}

export function getTimeRemaining(targetDate, today = new Date()) {
  if (!targetDate) return "";
  const target = new Date(targetDate + "T12:00:00");
  if (Number.isNaN(target.getTime())) return "";
  const days = Math.ceil((target.getTime() - new Date(today).getTime()) / 86400000);
  if (days < 0) return "Past target date";
  if (days === 0) return "Today";
  if (days < 30) return days + " day" + (days === 1 ? "" : "s") + " left";
  const months = Math.floor(days / 30);
  const remainder = days % 30;
  return remainder ? months + "mo " + remainder + "d left" : months + " month" + (months === 1 ? "" : "s") + " left";
}

export function parseMoneyText(text) {
  const value = String(text || "").toLowerCase().replace(/,/g, "");
  const k = value.match(/(\d+(?:\.\d+)?)\s*k/);
  if (k) return Number(k[1]) * 1000;
  const match = value.match(/\$?\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

export function parseGoalText(text) {
  const raw = String(text || "").trim();
  const amount = parseMoneyText(raw);
  const dateMatch = raw.match(/\b(?:by|before)\s+([a-z]+(?:\s+\d{1,2})?(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2})/i);
  let date = "";
  if (dateMatch) {
    const label = dateMatch[1].replace(/,/g, "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(label)) date = label;
    else {
      const hasDay = /\d/.test(label);
      const now = new Date();
      const parsed = new Date(label + (/,?\s*\d{4}$/.test(dateMatch[1]) ? "" : ", " + now.getFullYear()));
      if (!Number.isNaN(parsed.getTime())) {
        let year = parsed.getFullYear();
        const month = parsed.getMonth();
        if (!hasDay && month < now.getMonth()) year += 1;
        const day = hasDay ? parsed.getDate() : new Date(year, month + 1, 0).getDate();
        date = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      }
    }
  }
  const nameMatch = raw.match(/(?:save|saving|fund|for)\s+(?:up\s+)?(?:for\s+)?(?:a|an|the)?\s*([a-z][a-z\s-]+?)(?:\s+(?:by|before)|\s+\$?\d|$)/i);
  const name = nameMatch ? nameMatch[1].trim().replace(/\s+/g, " ") : raw.replace(/\$?\s*\d[\d,.]*\s*k?/i, "").trim();
  return { name: name || "My goal", targetAmount: amount || 0, targetDate: date || "" };
}

function makeId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return prefix + "_" + globalThis.crypto.randomUUID();
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function emptyAccounts() {
  return ACCOUNT_TYPES.map((type) => ({
    id: makeId("account"),
    type: type.id,
    label: "",
    amount: 0,
    apy: null,
    rate: null,
    subtype: "broad",
    breakdown: {},
    updatedAt: null,
  }));
}

export function normalizeProfile(raw = {}) {
  const accounts = emptyAccounts().map((blank) => {
    const existing = (raw.accounts || []).find((account) => account.type === blank.type);
    return existing ? { ...blank, ...existing, amount: round(existing.amount) } : blank;
  });
  const profile = {
    version: FUNDY_VERSION,
    name: String(raw.name || raw.displayName || ""),
    age: raw.age === null || raw.age === undefined ? null : n(raw.age),
    role: raw.role || raw.archetype || "",
    incomeSources: Array.isArray(raw.incomeSources) ? raw.incomeSources : [],
    answers: { ...(raw.answers || {}) },
    primaryDirection: raw.primaryDirection || "",
    primaryGoalType: raw.primaryGoalType || "",
    primaryGoalName: raw.primaryGoalName || "",
    primaryGoalAmount: round(raw.primaryGoalAmount),
    monthlyExpenses: round(raw.monthlyExpenses ?? raw.expenses?.monthlyEssentials),
    expenseBreakdown: { ...(raw.expenseBreakdown || raw.expenses?.breakdown || {}) },
    emergencyMonths: clamp(n(raw.emergencyMonths ?? raw.expenses?.emergencyMonths, DEFAULTS.emergencyMonths), 3, 6),
    emergencyFundAmount: round(raw.emergencyFundAmount ?? 0),
    debt: {
      hasDebt: Boolean(raw.debt?.hasDebt || raw.hasStudentLoans),
      id: raw.debt?.id || "legacy-debt",
      name: String(raw.debt?.name || "Debt account"),
      kind: raw.debt?.kind || "loan",
      balance: round(raw.debt?.balance ?? raw.studentLoanTotal),
      apr: n(raw.debt?.apr),
      minimum: round(raw.debt?.minimum ?? raw.studentLoanMinPayment),
      minimumPayment: round(raw.debt?.minimumPayment ?? raw.debt?.minimum ?? raw.studentLoanMinPayment),
      dueDate: raw.debt?.dueDate || raw.debt?.due_date || "",
      paymentAccount: raw.debt?.paymentAccount || raw.debt?.payment_account || "checking",
      lateFee: round(raw.debt?.lateFee ?? raw.debt?.late_fee),
    },
    liabilities: Array.isArray(raw.liabilities) ? raw.liabilities : [],
    obligations: Array.isArray(raw.obligations) ? raw.obligations : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    accounts,
    hasCompletedOnboarding: Boolean(raw.hasCompletedOnboarding),
    lastCheckedAt: raw.lastCheckedAt || null,
    updatedAt: raw.updatedAt || null,
  };
  return profile;
}

export function monthlyEssentials(profile) {
  const breakdownValues = Object.values(profile?.expenseBreakdown || {}).map(n);
  if (breakdownValues.some((value) => value > 0)) return round(breakdownValues.reduce((sum, value) => sum + value, 0));
  return round(profile?.monthlyExpenses);
}

export function emergencyTarget(profile) {
  return round(monthlyEssentials(profile) * clamp(n(profile?.emergencyMonths, DEFAULTS.emergencyMonths), 3, 6));
}

export function accountTotal(profile) {
  return round((profile?.accounts || []).reduce((sum, account) => sum + n(account.amount), 0));
}

export function savingsTotal(profile) {
  return round((profile?.accounts || []).filter((account) => account.type === "savings").reduce((sum, account) => sum + n(account.amount), 0));
}

export function accountProjection(account, years = 5) {
  const amount = n(account?.amount);
  const rate = account?.type === "savings"
    ? account.apy === null || account.apy === undefined ? DEFAULTS.defaultSavingsApy : n(account.apy)
    : account?.type === "stocks" && account.subtype !== "individual"
      ? DEFAULTS.broadStockScenario
      : ["real_assets", "other"].includes(account?.type)
        ? account.rate === null || account.rate === undefined ? DEFAULTS.fixedYieldScenario : n(account.rate)
        : ["checking", "crypto"].includes(account?.type) ? null : null;
  return rate === null ? { kind: "none", value: null, rate: null } : { kind: "estimate", value: round(amount * ((1 + rate / 100) ** years)), rate };
}

export function goalProgress(goal) {
  return calculateProgress(goal?.currentAmount, goal?.targetAmount);
}

export function makeGoal({ name, targetAmount, currentAmount = 0, targetDate = "", category = "savings", icon = "＋", priority = 3, essential = false } = {}) {
  return {
    id: makeId("goal"),
    name: String(name || "New goal"),
    targetAmount: round(targetAmount),
    currentAmount: round(currentAmount),
    targetDate: targetDate || "",
    createdAt: Date.now(),
    icon,
    category,
    priority,
    isEssential: Boolean(essential),
  };
}

export function initialGoals(profile) {
  const goals = [];
  const target = emergencyTarget(profile);
  const startingSafety = Math.min(target, Math.max(n(profile.emergencyFundAmount), savingsTotal(profile)));
  if (target > 0 && startingSafety < target) {
    goals.push(makeGoal({
      name: "Emergency Fund",
      targetAmount: target,
      currentAmount: startingSafety,
      icon: "♥",
      category: "emergency",
      priority: 1,
      essential: true,
    }));
  }
  if (profile.debt?.hasDebt && profile.debt.balance > 0) {
    goals.push(makeGoal({
      name: "Pay Off Debt",
      targetAmount: profile.debt.balance,
      currentAmount: 0,
      icon: "−",
      category: "debt",
      priority: 1,
      essential: true,
    }));
  }
  return goals;
}

export function smartSuggestions(profile, goals = []) {
  const existingNames = new Set(goals.map((goal) => goal.name.toLowerCase()));
  const existingCategories = new Set(goals.map((goal) => goal.category));
  const suggestions = [];
  const age = n(profile.age, 21);
  const hasIncome = profile.incomeSources.some((source) => ["paycheck", "w2", "other_job", "freelance"].includes(source));
  if (!existingCategories.has("emergency") && emergencyTarget(profile) > 0) {
    suggestions.push({
      id: "suggest_emergency",
      title: "Build your safety cushion",
      description: "Start with enough cash to handle a surprise without selling investments.",
      reasoning: "Your monthly essentials are the foundation of the next-dollar decision.",
      suggestedAmount: emergencyTarget(profile),
      icon: "♥",
      category: "emergency",
      priority: 1,
    });
  }
  if (profile.debt?.hasDebt && !existingCategories.has("debt")) {
    suggestions.push({
      id: "suggest_debt",
      title: "Make a debt plan",
      description: "Track the balance and make the interest cost visible.",
      reasoning: "A high APR can change where the next dollar creates the most value.",
      suggestedAmount: profile.debt.balance,
      icon: "−",
      category: "debt",
      priority: 1,
    });
  }
  if (hasIncome && !existingNames.has("roth ira") && !existingNames.has("retirement")) {
    suggestions.push({
      id: "suggest_retirement",
      title: "Long-term investing",
      description: age < 25 ? "Time is your biggest advantage, once your safety base is ready." : "Give long-term money a separate job.",
      reasoning: "This stays a category-level idea, not a security recommendation.",
      suggestedAmount: 1000,
      icon: "↗",
      category: "investing",
      priority: 3,
    });
  }
  if (!existingNames.has("travel") && age < 35) {
    suggestions.push({
      id: "suggest_travel",
      title: "A future trip",
      description: "Turn a future experience into a goal instead of a surprise expense.",
      reasoning: "A named goal gives irregular money somewhere meaningful to go.",
      suggestedAmount: 1500,
      icon: "✈",
      category: "savings",
      priority: 3,
    });
  }
  if (!existingNames.has("learning") && !existingNames.has("learn better money habits")) {
    suggestions.push({
      id: "suggest_habits",
      title: "Build better money habits",
      description: "Use small check-ins to make your financial picture easier to understand.",
      reasoning: "Consistency matters more than a perfect first number.",
      suggestedAmount: 0,
      icon: "✦",
      category: "other",
      priority: 4,
    });
  }
  return suggestions.sort((a, b) => a.priority - b.priority);
}

function destinationName(destination, goals) {
  if (destination === "safety") return "Emergency Fund";
  if (destination === "debt") return "Debt payoff";
  if (destination === "investing") return "Long-term investing";
  const goal = goals.find((item) => item.id === destination);
  return goal?.name || "Your selected goal";
}

export function nextDollarPlan(profile, goals = [], cashEvent = null) {
  const amount = round(cashEvent?.amount);
  const savings = savingsTotal(profile);
  const target = emergencyTarget(profile);
  const essentials = monthlyEssentials(profile);
  const emergencyGoal = goals.find((goal) => goal.category === "emergency");
  const debtGoal = goals.find((goal) => goal.category === "debt");
  const highCostDebt = profile.debt?.hasDebt && n(profile.debt.apr) >= DEFAULTS.highAprThreshold;
  const safetyGap = round(Math.max(0, target - savings));
  const oneMonthFloor = essentials;
  const taxReserve = cashEvent?.source === "freelance" && profile.answers?.taxes !== "Yes"
    ? round(amount * DEFAULTS.taxReserveRate)
    : 0;
  let destination = "safety";
  if (highCostDebt && savings >= oneMonthFloor) destination = "debt";
  else if (safetyGap <= 0 && profile.primaryDirection === "investing") destination = "investing";
  else if (safetyGap <= 0) destination = goals.find((goal) => !goal.isEssential && goal.currentAmount < goal.targetAmount)?.id || "safety";
  if (highCostDebt && savings < oneMonthFloor) destination = "safety";

  const remaining = Math.max(0, amount - taxReserve);
  const allocations = [];
  if (taxReserve > 0) allocations.push({ destination: "tax", amount: taxReserve, label: "Tax reserve", reason: "Freelance income without confirmed withholding." });
  if (remaining > 0) {
    const primaryNeed = destination === "safety" ? safetyGap : destination === "debt" ? n(profile.debt.balance) : destination === "investing" ? remaining : Math.max(0, n(goals.find((goal) => goal.id === destination)?.targetAmount) - n(goals.find((goal) => goal.id === destination)?.currentAmount));
    const primaryAmount = destination === "safety" ? Math.min(remaining, primaryNeed) : Math.min(remaining, primaryNeed || remaining);
    allocations.push({ destination, amount: round(primaryAmount), label: destinationName(destination, goals), reason: destination === "safety" ? "Close the remaining safety gap." : destination === "debt" ? "Reduce the reported debt balance." : destination === "investing" ? "Use only money that can stay invested." : "Keep progress on the goal you chose." });
    const leftover = round(remaining - primaryAmount);
    if (leftover > 0) allocations.push({ destination: destination === "safety" ? (highCostDebt ? "debt" : "investing") : "safety", amount: leftover, label: destination === "safety" && highCostDebt ? "Debt payoff" : destination === "safety" ? "Long-term investing" : "Safety savings", reason: "The primary gap is covered; this is the next comparison point." });
  }
  const reasons = [
    "We started with your reported savings, not a growth estimate.",
    target > 0 ? formatCurrency(savings) + " saved against a " + formatCurrency(target) + " cushion target." : "A cushion target needs monthly essentials.",
  ];
  if (highCostDebt) reasons.push("Your debt APR is high enough to affect the order.");
  if (profile.primaryDirection) reasons.push("Your chosen direction is used after stability checks.");
  return {
    destination,
    destinationLabel: destinationName(destination, goals),
    title: destination === "safety" ? "Build your safety cushion first." : destination === "debt" ? "Put this dollar toward high-cost debt." : destination === "investing" ? "Your safety base is ready for long-term investing." : "Put this dollar toward " + destinationName(destination, goals) + ".",
    reason: destination === "safety"
      ? (highCostDebt && savings < essentials ? "Keep a one-month floor before tackling high-cost debt." : "Your reported savings are below the cushion target.")
      : destination === "debt"
        ? "Your basic safety base is covered, and the reported debt cost changes the order."
        : "Your safety base is covered, so this dollar can serve the direction you chose.",
    detail: "This is a suggested plan for education. It does not move money or choose a specific investment.",
    amount,
    taxReserve,
    allocations,
    reasons,
    assumptions: { ...DEFAULTS },
    alternatives: ["safety", "debt", "investing", ...goals.map((goal) => goal.id)].filter((item, index, list) => list.indexOf(item) === index && item !== destination).slice(0, 3),
    generatedAt: new Date().toISOString(),
  };
}

export function calculateSmartAllocation(totalAmount, goals, plan = null) {
  const total = round(totalAmount);
  const allocations = {};
  goals.forEach((goal) => { allocations[goal.id] = 0; });
  if (total <= 0 || !goals.length) return allocations;
  let remaining = total;
  const ordered = [...goals].sort((a, b) => (a.priority || 3) - (b.priority || 3));
  if (plan?.destination === "safety") {
    const emergency = ordered.find((goal) => goal.category === "emergency");
    if (emergency) {
      const amount = Math.min(remaining, Math.max(0, emergency.targetAmount - emergency.currentAmount));
      allocations[emergency.id] += round(amount);
      remaining = round(remaining - amount);
    }
  }
  if (plan?.destination === "debt") {
    const debtGoal = ordered.find((goal) => goal.category === "debt");
    if (debtGoal) {
      const amount = Math.min(remaining, Math.max(0, debtGoal.targetAmount - debtGoal.currentAmount));
      allocations[debtGoal.id] += round(amount);
      remaining = round(remaining - amount);
    }
  }
  if (plan?.destination && !["safety", "debt", "investing"].includes(plan.destination)) {
    const selected = ordered.find((goal) => goal.id === plan.destination);
    if (selected) {
      const amount = Math.min(remaining, Math.max(0, selected.targetAmount - selected.currentAmount - allocations[selected.id]));
      allocations[selected.id] = round(allocations[selected.id] + amount);
      remaining = round(remaining - amount);
    }
  }
  if (plan?.destination === "investing") {
    const investingGoal = ordered.find((goal) => goal.category === "investing");
    if (investingGoal) {
      const amount = Math.min(remaining, Math.max(0, investingGoal.targetAmount - investingGoal.currentAmount - allocations[investingGoal.id]));
      allocations[investingGoal.id] = round(allocations[investingGoal.id] + amount);
      remaining = round(remaining - amount);
    }
  }
  const hungry = ordered.filter((goal) => goal.targetAmount > goal.currentAmount + allocations[goal.id]);
  if (remaining > 0 && hungry.length) {
    const weights = hungry.map((goal) => 6 - clamp(n(goal.priority, 3), 1, 5));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    hungry.forEach((goal, index) => {
      const share = index === hungry.length - 1 ? remaining : round(remaining * weights[index] / totalWeight);
      const space = Math.max(0, goal.targetAmount - goal.currentAmount - allocations[goal.id]);
      const amount = Math.min(share, space);
      allocations[goal.id] = round(allocations[goal.id] + amount);
      remaining = round(remaining - amount);
    });
  }
  return allocations;
}

