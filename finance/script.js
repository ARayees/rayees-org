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
  { q: 'What is a budget primarily used for?', correct: 'Planning how income will be used.', options: ['Planning how income will be used.', 'Predicting the stock market.', 'Avoiding every purchase.', 'Calculating a credit score.'] },
  { q: 'What is the difference between saving and investing?', correct: 'Saving prioritizes access; investing seeks growth with risk.', options: ['Saving prioritizes access; investing seeks growth with risk.', 'They are exactly the same.', 'Investing is always risk-free.', 'Saving always earns more.'] },
  { q: 'What is an emergency fund?', correct: 'Money set aside for unexpected expenses.', options: ['Money set aside for unexpected expenses.', 'A retirement account.', 'A credit-card limit.', 'A type of insurance.'] },
  { q: 'What does APR describe on a credit card?', correct: 'The annualized cost of borrowing.', options: ['The annualized cost of borrowing.', 'A monthly spending limit.', 'A credit score.', 'A cash-back percentage.'] },
  { q: 'What happens when a card balance rises but its limit stays the same?', correct: 'Credit utilization increases.', options: ['Credit utilization increases.', 'Credit utilization decreases.', 'Nothing changes.', 'The limit doubles.'] },
  { q: 'What usually happens when only the minimum card payment is made?', correct: 'Repayment takes longer and can cost more interest.', options: ['Repayment takes longer and can cost more interest.', 'The balance disappears.', 'The APR becomes zero.', 'The limit falls to zero.'] },
  { q: 'What is compound growth?', correct: 'Growth earned on the original amount and prior growth.', options: ['Growth earned on the original amount and prior growth.', 'A bank fee.', 'A fixed payment schedule.', 'A tax.'] },
  { q: 'What is diversification?', correct: 'Spreading investments across different assets.', options: ['Spreading investments across different assets.', 'Buying one company stock.', 'Eliminating all risk.', 'Keeping everything in cash.'] },
  { q: 'Which is generally more diversified?', correct: 'A broad index fund.', options: ['A broad index fund.', 'One company stock.', 'They are always identical.', 'Neither can diversify.'] },
  { q: 'What is inflation?', correct: 'A general rise in prices that reduces purchasing power.', options: ['A general rise in prices that reduces purchasing power.', 'A drop in all prices.', 'A savings account.', 'A credit-score factor.'] },
  { q: 'What is a Roth IRA?', correct: 'A retirement account generally funded with after-tax contributions.', options: ['A retirement account generally funded with after-tax contributions.', 'A mortgage product.', 'A checking account.', 'A corporate bond.'] },
  { q: 'What is a 401(k)?', correct: 'An employer-sponsored retirement plan.', options: ['An employer-sponsored retirement plan.', 'A credit-score range.', 'An index fund.', 'An emergency loan.'] },
  { q: 'What is a 529 plan generally used for?', correct: 'Qualified education expenses.', options: ['Qualified education expenses.', 'Home repairs only.', 'Credit-card rewards.', 'Car insurance.'] },
  { q: 'Why can a high salary still lead to financial stress?', correct: 'Expenses and debt can rise faster than income.', options: ['Expenses and debt can rise faster than income.', 'High salaries cannot create stress.', 'Taxes disappear.', 'Credit limits always increase.'] },
  { q: 'Which statement about investment risk is most accurate?', correct: 'Risk depends on the investment, goal, time, and diversification.', options: ['Risk depends on the investment, goal, time, and diversification.', 'All investments have the same risk.', 'Risk only matters for retirees.', 'Diversification guarantees profit.'] }
];

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

let quizOrder = shuffle(questions);
let questionIndex = 0;
let score = 0;
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
  document.querySelector('#result-score').textContent = `${score}/15`;
  const results = score <= 4
    ? 'Start with the foundation.'
    : score <= 8
      ? 'You know the essentials.'
      : score <= 12
        ? 'Your foundation is strong.'
        : 'You know your way around the basics.';
  document.querySelector('#result-title').textContent = results;
  document.querySelector('#result-copy').textContent = 'Continue with a topic, tool, or game.';
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
  quizOrder = shuffle(questions);
  questionIndex = 0;
  score = 0;
  document.querySelector('#quiz-panel').classList.remove('hidden');
  document.querySelector('#quiz-result').classList.add('hidden');
  quizDialogBody.scrollTop = 0;
  renderQuestion();
});

renderQuestion();
