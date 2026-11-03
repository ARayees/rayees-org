export const PROFILE_VERSION = "0.3.0";

export const ACCOUNT_TYPES = [
  { id: "checking", label: "Checking", icon: "◌", description: "Money you use day to day", rateType: "none" },
  { id: "savings", label: "Savings", icon: "▤", description: "Cash set aside for flexibility", rateType: "apy" },
  { id: "stocks", label: "Stocks", icon: "↗", description: "Broad funds or individual companies", rateType: "market" },
  { id: "crypto", label: "Crypto", icon: "◇", description: "Highly volatile digital assets", rateType: "none" },
  { id: "real_assets", label: "Real estate / REITs", icon: "⌂", description: "Property or real-estate funds", rateType: "fixed" },
  { id: "bonds", label: "Bonds / fixed income", icon: "—", description: "A stated yield or coupon", rateType: "fixed" },
  { id: "other", label: "Other", icon: "＋", description: "Anything else you want tracked", rateType: "fixed" },
];

export const GOAL_TYPES = [
  { id: "safety", label: "Build a safety cushion", icon: "◒" },
  { id: "debt_free", label: "Become debt-free", icon: "−" },
  { id: "invest", label: "Invest for the long term", icon: "↗" },
  { id: "purchase", label: "Save for a purchase", icon: "□" },
  { id: "learn", label: "Learn better money habits", icon: "✦" },
  { id: "custom", label: "Something else", icon: "＋" },
];

export const DEFAULT_ASSUMPTIONS = {
  savingsApy: 4.25,
  broadStockReturn: 7,
  emergencyMonths: 3,
  fixedYield: 5,
  taxReserveRate: 0.25,
  staleDays: 45,
};

export const ARCHETYPES = [
  { id: "student", label: "Full-time student", icon: "⌂", description: "School is your main focus; money may come from family, aid, savings, or occasional work." },
  { id: "student_worker", label: "Student with work", icon: "↗", description: "You are in school and earn money through part-time, campus, or seasonal work." },
  { id: "hourly", label: "Working part-time", icon: "◷", description: "Your hours or pay vary, and your next deposit may not look like the last one." },
  { id: "salary", label: "Full-time employee", icon: "▦", description: "You receive regular pay and may have workplace benefits to evaluate." },
  { id: "freelance", label: "Freelance or self-employed", icon: "✦", description: "Your income is project-based, uneven, or may arrive without withholding." },
  { id: "supported", label: "Between jobs or supported", icon: "○", description: "Your next money may come from family, aid, benefits, or a one-time source." },
];

export function getArchetype(id) {
  return ARCHETYPES.find((item) => item.id === id) || ARCHETYPES[0];
}

export function getProfileQuestions(archetypeId, answers = {}) {
  const base = [
    { id: "housing", question: "Who currently covers most of your housing?", options: ["I cover it", "Family or partner covers it", "Shared / varies"], type: "single" },
    { id: "debt", question: "Do you currently carry debt?", options: ["No debt", "Credit card or high APR", "Student, auto, or personal loan", "Not sure"], type: "single" },
  ];
  if (archetypeId === "student") {
    return [
      { id: "support", question: "What do family, aid, or savings currently cover?", options: ["Most essentials", "Some essentials", "Almost nothing"], type: "single" },
      ...base,
      { id: "earnedIncome", question: "Do you currently have taxable earned income?", options: ["No", "Yes, occasionally", "Yes, regularly"], type: "single" },
    ];
  }
  if (archetypeId === "student_worker") {
    return [
      { id: "workPattern", question: "How predictable is your student-job income?", options: ["Very predictable", "Changes week to week", "Seasonal / pauses during school"], type: "single" },
      { id: "support", question: "Do family, aid, or savings cover any major essentials?", options: ["Yes, most of them", "Some of them", "No"], type: "single" },
      ...base,
    ];
  }
  if (archetypeId === "hourly") {
    return [
      { id: "workPattern", question: "How predictable is your income?", options: ["Very predictable", "Changes week to week", "Seasonal / pauses"], type: "single" },
      { id: "benefits", question: "Do you have workplace benefits worth checking?", options: ["I have them", "I do not think so", "I am not sure"], type: "single" },
      ...base,
    ];
  }
  if (archetypeId === "salary") {
    return [
      { id: "benefits", question: "Do you have a workplace retirement match or HSA?", options: ["Yes", "No", "I am not sure"], type: "single" },
      { id: "incomeStability", question: "How stable is your take-home pay?", options: ["Stable", "Bonus or commission varies", "Job situation is uncertain"], type: "single" },
      ...base,
    ];
  }
  if (archetypeId === "freelance") {
    return [
      { id: "taxes", question: "Is tax withholding already handled on most payments?", options: ["Yes", "No", "It varies"], type: "single" },
      { id: "workPattern", question: "How predictable is your next payment?", options: ["Predictable", "Somewhat predictable", "Highly variable"], type: "single" },
      ...base,
    ];
  }
  return [
    { id: "incomeSource", question: "Where does money usually come from right now?", options: ["Family or partner", "Aid or benefits", "Occasional work", "Savings / one-time money"], type: "single" },
    ...base,
  ];
}

export function deriveVisibility(archetypeId, answers = {}) {
  const isWorker = ["student_worker", "hourly", "salary", "freelance"].includes(archetypeId);
  const taxSensitive = archetypeId === "freelance" || answers.taxes === "It varies" || answers.taxes === "No" || answers.incomeSource === "Occasional work";
  const benefitsRelevant = archetypeId === "salary" || archetypeId === "hourly" || archetypeId === "student_worker" || answers.benefits === "I am not sure" || answers.benefits === "I have them";
  const debtRelevant = answers.debt !== "No debt";
  return {
    showBenefits: isWorker && benefitsRelevant,
    showTaxQuestions: taxSensitive,
    showDebtQuestion: debtRelevant,
    showEarnedIncomeQuestion: !isWorker || archetypeId === "freelance",
    defaultEarnedIncome: isWorker,
    mode: archetypeId,
  };
}

export function createProfile(archetypeId, answers = {}) {
  const visibility = deriveVisibility(archetypeId, answers);
  return {
    version: PROFILE_VERSION,
    archetype: archetypeId,
    answers,
    visibility,
    completedAt: new Date().toISOString(),
  };
}


