const tools = {
  growth: {
    title: 'Compound growth',
    fields: [['start','Starting amount','1000'],['monthly','Monthly contribution','200'],['rate','Annual return (%)','6'],['years','Years','10']],
    calculate(v) { const r = v.rate / 100 / 12; const n = v.years * 12; return r === 0 ? v.start + v.monthly * n : v.start * (1 + r) ** n + v.monthly * (((1 + r) ** n - 1) / r); },
    format(n) { return `$${Math.round(n).toLocaleString()}`; },
    note(v,n) { const contributed = v.start + v.monthly * v.years * 12; return `$${Math.round(contributed).toLocaleString()} contributed · $${Math.round(n-contributed).toLocaleString()} estimated growth`; }
  },
  payoff: {
    title: 'Credit payoff',
    fields: [['balance','Current balance','2500'],['apr','APR (%)','24.99'],['payment','Monthly payment','150']],
    calculate(v) { const r=v.apr/100/12; let b=v.balance,m=0,interest=0; while(b>0&&m<600){interest+=b*r;b=b*(1+r)-v.payment;m++;} return { months:m, interest }; },
    format(n) { return `${n.months} months`; },
    note(v,n) { return `$${Math.round(n.interest).toLocaleString()} estimated interest with no new purchases`; }
  },
  savings: {
    title: 'Savings goal',
    fields: [['goal','Savings goal','5000'],['saved','Current savings','1000'],['monthly','Monthly contribution','250']],
    calculate(v) { return v.monthly <= 0 ? null : Math.max(0,Math.ceil((v.goal-v.saved)/v.monthly)); },
    format(n) { return n === null ? 'Add a contribution' : `${n} months`; },
    note(v,n) { return n === null ? 'Monthly contribution must be greater than zero' : n === 0 ? 'Goal already reached' : `$${v.monthly.toLocaleString()} per month to close the gap`; }
  }
};

function renderChart(key, values, result) {
  const chart = document.querySelector('#mini-chart');
  chart.innerHTML = '';
  const count = 18;
  for (let i=1;i<=count;i++) {
    const bar = document.createElement('i');
    let height;
    if (key === 'growth') height = 12 + 88 * Math.pow(i/count, 1.7);
    else if (key === 'payoff') height = 100 - 88 * (i/count);
    else height = 12 + 88 * (i/count);
    bar.style.height = `${height}%`;
    chart.appendChild(bar);
  }
}

function renderTool(key='growth') {
  const tool = tools[key];
  const workspace = document.querySelector('#tool-workspace');
  workspace.innerHTML = `<h2>${tool.title}</h2><div class="tool-form">${tool.fields.map(([id,label,value])=>`<label>${label}<input type="number" min="0" step="any" data-field="${id}" value="${value}"></label>`).join('')}</div><div class="tool-result"><strong id="tool-value"></strong><p id="tool-note"></p><div class="mini-chart" id="mini-chart" aria-hidden="true"></div></div>`;

  const update = () => {
    const values = {};
    workspace.querySelectorAll('input').forEach(input => { values[input.dataset.field] = Number(input.value); });
    const result = tool.calculate(values);
    document.querySelector('#tool-value').textContent = tool.format(result);
    document.querySelector('#tool-note').textContent = tool.note(values,result);
    renderChart(key,values,result);
  };
  workspace.querySelectorAll('input').forEach(input => input.addEventListener('input',update));
  update();
}

document.querySelectorAll('.tool-tabs button').forEach(button => button.addEventListener('click',()=>{
  document.querySelectorAll('.tool-tabs button').forEach(item=>item.classList.remove('active'));
  button.classList.add('active');
  renderTool(button.dataset.tool);
}));

renderTool();
