document.documentElement.classList.add('motion-ready');

const hero = document.querySelector('.hero-home');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reducedMotion) {
  let scrollFrame = 0;
  const updateHeroMotion = () => {
    const progress = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * .72)));
    const reveal = Math.min(1, Math.max(0, (progress - .08) / .22));
    hero.style.setProperty('--quiz-shift', `${(1 - reveal) * 28}px`);
    hero.style.setProperty('--quiz-opacity', reveal.toFixed(3));
    hero.style.setProperty('--title-shift', `${progress * -34}px`);
    scrollFrame = 0;
  };
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateHeroMotion);
  }, { passive: true });
  window.addEventListener('resize', updateHeroMotion, { passive: true });
  updateHeroMotion();
}

const quizModal = document.querySelector('#quiz-modal');
const quizDialog = document.querySelector('.quiz-dialog');
const quizDialogBody = document.querySelector('.quiz-dialog-body');
const quizCloseButton = document.querySelector('.quiz-close');
let quizReturnFocus = null;

function openQuiz() {
  quizReturnFocus = document.activeElement;
  quizModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => quizCloseButton.focus());
}

function closeQuiz() {
  quizModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  clearConfetti();
  quizReturnFocus?.focus();
}

document.querySelectorAll('[data-open-quiz]').forEach(button => button.addEventListener('click', openQuiz));
document.querySelectorAll('[data-close-quiz]').forEach(button => button.addEventListener('click', closeQuiz));

document.addEventListener('keydown', event => {
  if (quizModal.getAttribute('aria-hidden') === 'true') return;
  if (event.key === 'Escape') {
    closeQuiz();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...quizDialog.querySelectorAll('a[href], button:not([disabled])')]
    .filter(element => element.offsetParent !== null);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

const topics = [
  { label: 'compound growth', href: 'learn/#compound-growth' },
  { label: 'credit utilization', href: 'learn/#credit-utilization' },
  { label: 'diversification', href: 'learn/#diversification' },
  { label: 'inflation', href: 'learn/#inflation' },
  { label: 'emergency funds', href: 'learn/#emergency-fund' },
  { label: 'Roth IRAs', href: 'learn/#roth-ira' },
  { label: '401(k)s', href: 'learn/#401k' },
  { label: '529 plans', href: 'learn/#529-plan' },
  { label: 'net worth', href: 'learn/#net-worth' }
];
const learningTopic = document.querySelector('#learning-topic');
let topicIndex = 0;

function setTopic() {
  learningTopic.textContent = topics[topicIndex].label;
  learningTopic.href = topics[topicIndex].href;
}

if (!reducedMotion) {
  setInterval(async () => {
    const out = learningTopic.animate(
      [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-32%)', opacity: 0 }],
      { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
    );
    await out.finished.catch(() => {});
    out.cancel();
    topicIndex = (topicIndex + 1) % topics.length;
    setTopic();
    const incoming = learningTopic.animate(
      [{ transform: 'translateY(32%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
    );
    await incoming.finished.catch(() => {});
    incoming.cancel();
  }, 3200);
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .16 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const questions = [
  ['emergency-fund','What is an emergency fund?','Money set aside for unexpected expenses.',['Money set aside for unexpected expenses.','A retirement account.','A credit-card limit.','A type of insurance.']],
  ['emergency-fund','Which expense belongs in an emergency-fund target?','Essential monthly expenses.',['Essential monthly expenses.','A luxury vacation.','Expected investment returns.','Credit limits.']],
  ['apr','What does APR describe on a credit card?','The annualized cost of borrowing.',['The annualized cost of borrowing.','A spending limit.','A credit score.','A reward rate.']],
  ['apr','Why can minimum payments be expensive?','They can extend repayment and increase total interest.',['They can extend repayment and increase total interest.','They erase interest.','They close the account.','They reduce the APR to zero.']],
  ['credit-utilization','A balance rises while the limit stays fixed. What changes?','Credit utilization increases.',['Credit utilization increases.','Utilization decreases.','The limit doubles.','Nothing changes.']],
  ['credit-utilization','A $500 balance on a $2,000 limit equals what utilization?','25%.',['25%.','10%.','40%.','75%.']],
  ['compound-growth','What is compound growth?','Growth on the original amount and prior growth.',['Growth on the original amount and prior growth.','A bank fee.','A fixed payment.','A tax.']],
  ['compound-growth','Which input most directly gives compounding more time?','Starting earlier.',['Starting earlier.','Checking daily.','Using one stock.','Ignoring fees.']],
  ['diversification','What is diversification?','Spreading exposure across different assets.',['Spreading exposure across different assets.','Owning one stock.','Eliminating all risk.','Keeping everything in cash.']],
  ['diversification','What risk does diversification address most directly?','Dependence on one investment outcome.',['Dependence on one investment outcome.','All market losses.','Inflation entirely.','Every possible fee.']],
  ['index-fund','Which is generally more diversified?','A broad index fund.',['A broad index fund.','One company stock.','They are identical.','A single bond.']],
  ['index-fund','What should you check before buying an index fund?','Its index, holdings, and fees.',['Its index, holdings, and fees.','Only its name.','Yesterday’s price only.','The logo color.']],
  ['inflation','What does inflation reduce over time?','Purchasing power.',['Purchasing power.','The number of dollars in every account.','All debt balances.','Every interest rate.']],
  ['inflation','Why use today’s dollars in a long plan?','To compare future money with current purchasing power.',['To compare future money with current purchasing power.','To guarantee a return.','To remove taxes.','To raise a credit limit.']],
  ['roth-ira','How is a Roth IRA generally funded?','With after-tax contributions.',['With after-tax contributions.','Only employer money.','With a mortgage.','With pre-tax payroll tax.']],
  ['roth-ira','What still must be selected inside an IRA?','Investments.',['Investments.','A credit limit.','A rent payment.','An insurance deductible.']],
  ['401k','What is a 401(k)?','An employer-sponsored retirement plan.',['An employer-sponsored retirement plan.','A credit score.','An emergency loan.','A bank fee.']],
  ['401k','Why does an employer match matter?','It can add employer contributions when requirements are met.',['It can add employer contributions when requirements are met.','It guarantees profits.','It removes every fee.','It replaces a salary.']],
  ['529-plan','What is a 529 plan generally used for?','Qualified education expenses.',['Qualified education expenses.','Home repairs only.','Card rewards.','Auto insurance.']],
  ['529-plan','What varies among 529 plans?','Fees, investments, and potential state incentives.',['Fees, investments, and potential state incentives.','The definition of money.','Federal currency.','Credit-card APR.']],
  ['net-worth','How is net worth calculated?','Assets minus debts.',['Assets minus debts.','Income minus taxes.','Credit limit minus balance.','Savings plus salary.']],
  ['net-worth','What is net worth best understood as?','A financial snapshot, not personal worth.',['A financial snapshot, not personal worth.','A permanent score.','Annual income.','A credit report.']],
  ['budget','What is a budget primarily used for?','Planning how income will be used.',['Planning how income will be used.','Predicting markets.','Avoiding every purchase.','Calculating a credit score.']],
  ['budget','Why can a high salary still feel tight?','Expenses and debt can rise faster than income.',['Expenses and debt can rise faster than income.','Taxes disappear.','Limits always rise.','High salaries prevent stress.']],
  ['saving','What distinguishes saving from investing?','Saving prioritizes access; investing accepts risk for potential growth.',['Saving prioritizes access; investing accepts risk for potential growth.','They are identical.','Investing is risk-free.','Saving always earns more.']],
  ['saving','Which goal often fits cash savings better than volatile investments?','A near-term emergency reserve.',['A near-term emergency reserve.','A 40-year retirement goal only.','Speculation.','A credit limit increase.']],
  ['diversification','Which statement about risk is accurate?','Risk depends on the investment, goal, time, and diversification.',['Risk depends on the investment, goal, time, and diversification.','All investments share one risk.','Risk only matters in retirement.','Diversification guarantees profit.']],
  ['apr','What makes recurring new card charges dangerous during payoff?','They can offset payments and extend the debt.',['They can offset payments and extend the debt.','They reduce APR.','They increase savings.','They erase prior interest.']]
].map(([concept,q,correct,options])=>({concept,q,correct,options}));

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuizOrder() {
  const counts = {};
  return shuffle(questions).filter(item => {
    counts[item.concept] = counts[item.concept] || 0;
    if (counts[item.concept] >= 2) return false;
    counts[item.concept] += 1;
    return true;
  }).slice(0, 15);
}

let quizOrder = buildQuizOrder();
let questionIndex = 0;
let score = 0;
let missedConcepts = {};
const questionEl = document.querySelector('#quiz-question');
const answersEl = document.querySelector('#quiz-answers');
const feedbackEl = document.querySelector('#quiz-feedback');
const nextButton = document.querySelector('#quiz-next');

function renderQuestion() {
  const item = quizOrder[questionIndex];
  document.querySelector('#quiz-count').textContent = `${questionIndex + 1} / ${quizOrder.length}`;
  document.querySelector('#quiz-score').textContent = `${score} correct`;
  document.querySelector('#quiz-progress').style.width = `${((questionIndex + 1) / quizOrder.length) * 100}%`;
  questionEl.textContent = item.q;
  answersEl.innerHTML = '';
  feedbackEl.textContent = '';
  nextButton.classList.add('hidden');

  shuffle(item.options).forEach(option => {
    const button = document.createElement('button');
    button.className = 'answer';
    button.textContent = option;
    button.addEventListener('click', () => {
      [...answersEl.children].forEach(answer => { answer.disabled = true; });
      const isCorrect = option === item.correct;
      if (isCorrect) {
        score += 1;
        button.classList.add('correct');
        feedbackEl.textContent = 'Correct.';
      } else {
        missedConcepts[item.concept] = (missedConcepts[item.concept] || 0) + 1;
        button.classList.add('incorrect');
        [...answersEl.children].find(answer => answer.textContent === item.correct)?.classList.add('correct');
        feedbackEl.textContent = item.correct;
      }
      document.querySelector('#quiz-score').textContent = `${score} correct`;
      nextButton.classList.remove('hidden');
    });
    answersEl.appendChild(button);
  });
}

function showResult() {
  document.querySelector('#quiz-panel').classList.add('hidden');
  const resultPanel = document.querySelector('#quiz-result');
  resultPanel.classList.remove('hidden');
  document.querySelector('#result-score').textContent = `${score}/${quizOrder.length}`;
  const results = score <= 4
    ? 'Start with the foundation.'
    : score <= 8
      ? 'You know the essentials.'
      : score <= 12
        ? 'Your foundation is strong.'
        : 'You know your way around the basics.';
  document.querySelector('#result-title').textContent = results;
  document.querySelector('#result-copy').textContent = 'Continue with a topic, tool, or game.';
  const recommendations = Object.entries(missedConcepts).sort((a,b) => b[1]-a[1]).slice(0,3);
  const learning = document.querySelector('#result-learning');
  const recommendationEl = document.querySelector('#result-recommendations');
  if (recommendations.length) {
    const labels = {'emergency-fund':'Emergency fund','credit-utilization':'Credit utilization','apr':'APR','compound-growth':'Compound growth','diversification':'Diversification','index-fund':'Index funds','inflation':'Inflation','roth-ira':'Roth IRA','401k':'401(k)','529-plan':'529 plans','net-worth':'Net worth','budget':'Cash flow','saving':'Saving vs. investing'};
    recommendationEl.innerHTML = recommendations.map(([concept,count]) => `<a href="learn/#${concept}"><span>${count} missed</span><strong>Learn about ${labels[concept]}</strong></a>`).join('');
    learning.classList.remove('hidden');
  } else learning.classList.add('hidden');
  quizDialogBody.scrollTop = 0;
  launchConfetti();
}

const confettiLayer = document.querySelector('#confetti');
let confettiFrame = 0;

function clearConfetti() {
  if (confettiFrame) cancelAnimationFrame(confettiFrame);
  confettiFrame = 0;
  confettiLayer.replaceChildren();
}

function launchConfetti() {
  if (reducedMotion) return;
  clearConfetti();
  const colors = ['#B89558', '#32658A', '#66806A', '#A87578', '#EEE4D2'];
  const originX = window.innerWidth / 2;
  const originY = Math.min(window.innerHeight * .28, 230);
  const particles = Array.from({ length: 84 }, (_, index) => {
    const piece = document.createElement('i');
    const size = 6 + Math.random() * 8;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * (.38 + Math.random() * .36)}px`;
    piece.style.background = colors[index % colors.length];
    piece.style.borderRadius = Math.random() > .76 ? '50%' : '1px';
    confettiLayer.appendChild(piece);
    return {
      piece,
      x: originX,
      y: originY,
      vx: (Math.random() - .5) * 760,
      vy: -(590 + Math.random() * 430),
      gravity: 980 + Math.random() * 520,
      drag: .08 + Math.random() * .12,
      rotation: Math.random() * 360,
      spin: (Math.random() - .5) * 780,
      phase: Math.random() * Math.PI * 2,
      flutter: 7 + Math.random() * 7,
      age: 0,
      life: 2.9 + Math.random() * 1.1
    };
  });

  let previousTime = performance.now();
  const animateConfetti = currentTime => {
    const elapsed = Math.min((currentTime - previousTime) / 1000, .034);
    previousTime = currentTime;
    let activeParticles = 0;

    particles.forEach(particle => {
      if (particle.age >= particle.life || particle.y > window.innerHeight + 70) {
        particle.piece.style.opacity = '0';
        return;
      }
      activeParticles += 1;
      particle.age += elapsed;
      particle.vy += particle.gravity * elapsed;
      particle.vx *= Math.exp(-particle.drag * elapsed);
      particle.x += particle.vx * elapsed;
      particle.y += particle.vy * elapsed;
      particle.rotation += particle.spin * elapsed;
      particle.phase += particle.flutter * elapsed;
      const sway = Math.sin(particle.phase) * 5;
      const fadeStart = particle.life - .55;
      particle.piece.style.opacity = particle.age > fadeStart
        ? String(Math.max(0, (particle.life - particle.age) / .55))
        : '1';
      particle.piece.style.transform = `translate3d(${particle.x + sway}px, ${particle.y}px, 0) rotate(${particle.rotation}deg)`;
    });

    if (activeParticles) confettiFrame = requestAnimationFrame(animateConfetti);
    else clearConfetti();
  };

  confettiFrame = requestAnimationFrame(animateConfetti);
}

nextButton.addEventListener('click', () => {
  questionIndex += 1;
  if (questionIndex < quizOrder.length) renderQuestion();
  else showResult();
});

document.querySelector('#quiz-restart').addEventListener('click', () => {
  clearConfetti();
  quizOrder = buildQuizOrder();
  questionIndex = 0;
  score = 0;
  missedConcepts = {};
  document.querySelector('#quiz-panel').classList.remove('hidden');
  document.querySelector('#quiz-result').classList.add('hidden');
  quizDialogBody.scrollTop = 0;
  renderQuestion();
});

renderQuestion();
