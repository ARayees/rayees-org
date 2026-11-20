const events = [
  {
    title: 'The car needs a $900 repair.',
    copy: 'You need it for work. You have $1,800 in savings and a credit card at 24.99% APR.',
    choices: [
      { label: 'Pay from savings', impact: { cash: -30, debt: 0, stability: 8 }, outcome: 'No interest is added, but your emergency cushion is cut in half.' },
      { label: 'Put it on the card', impact: { cash: 0, debt: 28, stability: -8 }, outcome: 'Cash stays available today. The repair now costs more and needs a repayment plan.' },
      { label: 'Pay $450 cash and $450 credit', impact: { cash: -15, debt: 14, stability: 1 }, outcome: 'You preserve part of the cushion while limiting the amount exposed to interest.' }
    ]
  },
  {
    title: 'Your rent increases by $180 a month.',
    copy: 'Your income has not changed. The new lease begins in six weeks.',
    choices: [
      { label: 'Reduce flexible spending by $180', impact: { cash: 3, debt: 0, stability: 8 }, outcome: 'The monthly budget stays balanced, but your discretionary room gets smaller.' },
      { label: 'Use credit for the difference', impact: { cash: 0, debt: 24, stability: -14 }, outcome: 'The gap becomes recurring debt. A monthly mismatch can compound quickly.' },
      { label: 'Search for a lower-cost place', impact: { cash: -5, debt: 0, stability: 4 }, outcome: 'Moving has near-term cost and effort, but may improve the longer-term monthly picture.' }
    ]
  },
  {
    title: 'A $1,200 tax refund arrives.',
    copy: 'You still have card debt and your emergency fund is below one month of expenses.',
    choices: [
      { label: 'Pay down the card', impact: { cash: 0, debt: -26, stability: 8 }, outcome: 'Interest exposure falls. Your cash buffer remains thin.' },
      { label: 'Add it to emergency savings', impact: { cash: 24, debt: 0, stability: 10 }, outcome: 'Your ability to absorb the next shock improves, while existing debt remains.' },
      { label: 'Split it between debt and savings', impact: { cash: 12, debt: -13, stability: 12 }, outcome: 'Both priorities move forward, though neither is solved completely.' }
    ]
  }
];

let index = 0;
let state = { cash: 65, debt: 25, stability: 55 };
const clamp = value => Math.max(0, Math.min(100, value));

function updateStatus() {
  ['cash', 'debt', 'stability'].forEach(key => {
    state[key] = clamp(state[key]);
    document.querySelector(`#${key}-value`).textContent = state[key];
    document.querySelector(`#${key}-meter`).style.width = `${state[key]}%`;
  });
}

function renderEvent() {
  const event = events[index];
  document.querySelector('#round-label').textContent = `Event ${index + 1} of ${events.length}`;
  document.querySelector('#scenario-title').textContent = event.title;
  document.querySelector('#scenario-copy').textContent = event.copy;
  const choices = document.querySelector('#sim-choices');
  choices.innerHTML = '';
  document.querySelector('#sim-outcome').classList.add('hidden');
  document.querySelector('#sim-next').classList.add('hidden');

  event.choices.forEach(choice => {
    const button = document.createElement('button');
    button.className = 'sim-choice';
    button.textContent = choice.label;
    button.addEventListener('click', () => {
      [...choices.children].forEach(item => { item.disabled = true; });
      Object.entries(choice.impact).forEach(([key, value]) => { state[key] += value; });
      updateStatus();
      const outcome = document.querySelector('#sim-outcome');
      outcome.textContent = choice.outcome;
      outcome.classList.remove('hidden');
      const next = document.querySelector('#sim-next');
      next.textContent = index === events.length - 1 ? 'See result' : 'Next event';
      next.classList.remove('hidden');
    });
    choices.appendChild(button);
  });
}

document.querySelector('#sim-next').addEventListener('click', () => {
  index += 1;
  if (index < events.length) {
    renderEvent();
    return;
  }
  const stage = document.querySelector('#sim-stage');
  const summary = state.stability >= 70 && state.debt <= 30
    ? 'You protected flexibility.'
    : state.debt >= 55
      ? 'Debt absorbed too many shocks.'
      : 'You balanced competing priorities.';
  stage.innerHTML = `<span class="round">Result</span><h2>${summary}</h2><p>Cash ${state.cash} · Debt ${state.debt} · Stability ${state.stability}</p><div class="sim-outcome">There is no perfect score. The useful question is which tradeoff you made deliberately.</div><button class="line-button" id="sim-restart">Play again</button>`;
  document.querySelector('#sim-restart').addEventListener('click', () => window.location.reload());
});

renderEvent();
