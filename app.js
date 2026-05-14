// ─────────────────────────────────────────────
//  Repayment Demolition Time — app.js
//  All data is local to this session.
//  Nothing is transmitted or stored externally.
// ─────────────────────────────────────────────

let historyBalances = [];
let chart = null;
let viewMode = 'imminent';

// ── Formatting ────────────────────────────────
function fmt(n) {
  return '$' + Math.abs(n).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ── Toggle view mode ──────────────────────────
function setToggle(mode) {
  viewMode = mode;
  document.getElementById('tImminent').classList.toggle('active', mode === 'imminent');
  document.getElementById('tFull').classList.toggle('active', mode === 'full');
  document.getElementById('m4card').style.display = mode === 'full' ? '' : 'none';
  document.getElementById('m5card').style.display = mode === 'full' ? '' : 'none';
  updateProjection();
}

// ── Parse raw pasted/typed input ──────────────
function parseBalances(raw) {
  return raw.split(/[\n,\t;]+/)
    .map(s => s.replace(/[^0-9.]/g, '').trim())
    .filter(s => s.length > 0)
    .map(s => parseFloat(s))
    .filter(n => !isNaN(n) && n > 0);
}

// ── Plot data from textarea ───────────────────
// order: 'oldest' = first entry is oldest (manual input)
// order: 'newest' = first entry is newest (bank CSV paste)
function plotData(order) {
  const raw = document.getElementById('pasteArea').value.trim();
  if (!raw) {
    document.getElementById('statusText').textContent =
      'Nothing to plot — paste or type some balances first.';
    return;
  }
  let vals = parseBalances(raw);
  if (vals.length === 0) {
    document.getElementById('statusText').textContent =
      'No valid numbers found — check your input.';
    return;
  }
  if (order === 'newest') vals = vals.reverse();
  historyBalances = historyBalances.concat(vals);
  document.getElementById('pasteArea').value = '';
  document.getElementById('statusText').textContent =
    vals.length + ' point' + (vals.length > 1 ? 's' : '') + ' added — ' +
    historyBalances.length + ' total. Paste your next update whenever you\'re ready.';
  updateMomentum();
  updateProjection();
}

// ── Reset everything ──────────────────────────
function resetAll() {
  historyBalances = [];
  document.getElementById('pasteArea').value = '';
  document.getElementById('statusText').textContent = 'Chart reset.';
  document.getElementById('momentumText').textContent = '';
  ['m1','m2','m3','m4','m5'].forEach(id => {
    document.getElementById(id).textContent = '—';
  });
  if (chart) { chart.destroy(); chart = null; }
}

// ── Momentum summary sentence ─────────────────
function updateMomentum() {
  const el = document.getElementById('momentumText');
  if (historyBalances.length < 2) { el.textContent = ''; return; }
  const n = Math.min(6, historyBalances.length);
  const recent = historyBalances.slice(-n);
  const avg = (recent[recent.length - 1] - recent[0]) / (n - 1);
  if (avg > 1) {
    el.textContent =
      'Over the last ' + (n-1) + ' month' + (n>2?'s':'') +
      ', your balance has grown by an average of ' + fmt(avg) + ' per month.';
  } else if (avg < -1) {
    el.textContent =
      'Over the last ' + (n-1) + ' month' + (n>2?'s':'') +
      ', you\'ve been reducing your balance by an average of ' +
      fmt(Math.abs(avg)) + ' per month.';
  } else {
    el.textContent = 'Your balance has been roughly stable over recent months.';
  }
}

// ── Update projection and metrics ────────────
function updateProjection() {
  if (historyBalances.length === 0) return;
  const repay = parseFloat(document.getElementById('repayInput').value);
  const annualRate = parseFloat(document.getElementById('rateInput').value) || 20.99;
  const monthlyRate = annualRate / 100 / 12;
  const currentBalance = historyBalances[historyBalances.length - 1];
  const interestThisMonth = currentBalance * monthlyRate;
  const minPayment = Math.max(25, currentBalance * 0.02);
  const histLabels = historyBalances.map((_, i) => 'M' + (i + 1));

  if (isNaN(repay) || repay <= 0) {
    ['m1','m2','m3'].forEach(id => document.getElementById(id).textContent = '—');
    renderChart(histLabels, historyBalances, [], historyBalances.length - 1);
    return;
  }

  document.getElementById('m2').textContent = fmt(interestThisMonth);
  document.getElementById('m3').textContent =
    repay > minPayment ? fmt((repay - minPayment) * monthlyRate * 12) : '$0.00';

  let projLabels = [], projData = [];

  if (viewMode === 'imminent') {
    const ic = currentBalance * monthlyRate;
    const paid = Math.min(repay, currentBalance + ic);
    const balAfter = Math.max(0, currentBalance - (paid - ic));
    document.getElementById('m1').textContent = fmt(balAfter);
    projLabels = ['Now', 'Next'];
    projData = [currentBalance, parseFloat(balAfter.toFixed(2))];
    document.getElementById('m4card').style.display = 'none';
    document.getElementById('m5card').style.display = 'none';
  } else {
    let bal = currentBalance, months = 0, totalInt = 0;
    const MAX = 600;
    const pLabels = ['Now'], pData = [currentBalance];
    while (bal > 0.5 && months < MAX) {
      const ic = bal * monthlyRate;
      if (repay <= ic) break;
      totalInt += ic;
      const paid = Math.min(repay, bal + ic);
      bal = Math.max(0, bal - (paid - ic));
      months++;
      if (months <= 6 || months % 3 === 0 || bal <= 0.5) {
        pLabels.push('M+' + months);
        pData.push(parseFloat(bal.toFixed(2)));
      }
    }
    projLabels = pLabels;
    projData = pData;
    document.getElementById('m1').textContent =
      fmt(pData.length > 1 ? pData[1] : currentBalance);

    // Min payment comparison
    let minBal = currentBalance, minInt = 0, minMonths = 0;
    while (minBal > 0.5 && minMonths < MAX) {
      const ic = minBal * monthlyRate;
      const mp = Math.max(25, minBal * 0.02);
      if (mp <= ic) break;
      minInt += ic;
      minBal = Math.max(0, minBal - (mp - ic));
      minMonths++;
    }

    const yrs = Math.floor(months / 12), mths = months % 12;
    document.getElementById('m4').textContent =
      months >= MAX || repay <= interestThisMonth
        ? 'Increase repayment'
        : (yrs > 0 ? yrs + 'y ' + mths + 'm' : mths + ' months');
    document.getElementById('m5').textContent =
      fmt(Math.max(0, minInt - totalInt));
    document.getElementById('m4card').style.display = '';
    document.getElementById('m5card').style.display = '';
  }

  const combinedLabels = [...histLabels, ...projLabels.slice(1)];
  const histFull = [...historyBalances, ...new Array(projLabels.length - 1).fill(null)];
  const projFull = [...new Array(historyBalances.length - 1).fill(null), ...projData];
  renderChart(combinedLabels, histFull, projFull, historyBalances.length - 1);
}

// ── Render chart ──────────────────────────────
function renderChart(labels, histData, projData, todayIdx) {
  if (chart) { chart.destroy(); }

  const datasets = [{
    label: 'Balance history',
    data: histData,
    borderColor: '#4a9eff',
    backgroundColor: 'rgba(74,158,255,0.06)',
    borderWidth: 2,
    pointRadius: 3,
    pointBackgroundColor: '#4a9eff',
    fill: true,
    tension: 0.3,
    spanGaps: false
  }];

  if (projData.length > 0) {
    datasets.push({
      label: 'Projected path',
      data: projData,
      borderColor: '#3ecf8e',
      backgroundColor: 'rgba(62,207,142,0.04)',
      borderWidth: 2,
      borderDash: [6, 3],
      pointRadius: 4,
      pointBackgroundColor: '#3ecf8e',
      fill: true,
      tension: 0.3,
      spanGaps: false
    });
  }

  chart = new Chart(document.getElementById('mainChart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e2026',
          borderColor: '#2a2d35',
          borderWidth: 1,
          titleColor: '#6b7280',
          bodyColor: '#e8e9ec',
          titleFont: { family: 'DM Mono', size: 11 },
          bodyFont: { family: 'DM Mono', size: 12 },
          callbacks: {
            label: ctx => ctx.parsed.y !== null
              ? ctx.dataset.label + ': $' +
                Math.abs(ctx.parsed.y).toLocaleString('en-AU', {
                  minimumFractionDigits: 2, maximumFractionDigits: 2
                })
              : null
          },
          filter: item => item.parsed.y !== null
        }
      },
      scales: {
        x: {
          ticks: { color: '#6b7280', maxTicksLimit: 12, font: { family: 'DM Mono', size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { color: '#2a2d35' }
        },
        y: {
          min: 0,
          ticks: {
            color: '#6b7280',
            callback: v => '$' + v.toLocaleString(),
            font: { family: 'DM Mono', size: 10 }
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { color: '#2a2d35' }
        }
      }
    },
    plugins: [{
      id: 'todayLine',
      afterDraw(chartInst) {
        const ctx = chartInst.ctx;
        const x = chartInst.scales.x.getPixelForValue(todayIdx);
        const top = chartInst.chartArea.top;
        const bottom = chartInst.chartArea.bottom;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px DM Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('today', x, top - 6);
        ctx.restore();
      }
    }]
  });
}
