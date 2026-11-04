(function (global) {
  'use strict';

  global.CbEth = global.CbEth || {};

  let balanceChart = null;
  let marketChart = null;
  let currentMarketMode = 'USD';

  function getGradient(ctx, r, g, b, alphaStart = 0.35) {
    if (!ctx || typeof ctx.createLinearGradient !== 'function') return `rgba(${r}, ${g}, ${b}, ${alphaStart})`;
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alphaStart})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
    return gradient;
  }

  function resolveCanvas(id) {
    if (typeof document === 'undefined') return null;
    return document.getElementById(id) ||
      document.getElementById(id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())) ||
      document.querySelector(`canvas[id*="${id.split('-').pop()}"]`);
  }

  function initCharts(canvasBalanceId = 'chart-balance', canvasMarketId = 'chart-market') {
    destroyCharts();

    if (typeof Chart === 'undefined') {
      return;
    }

    const canvasBalance = resolveCanvas(canvasBalanceId);
    const canvasMarket = resolveCanvas(canvasMarketId);

    if (canvasBalance && canvasBalance.getContext) {
      const ctxBal = canvasBalance.getContext('2d');
      balanceChart = new Chart(ctxBal, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Patrimônio',
              data: [],
              borderColor: '#00D2FF',
              borderWidth: 2.5,
              backgroundColor: getGradient(ctxBal, 0, 210, 255, 0.25),
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: '#00D2FF'
            },
            {
              label: 'Custo Investido',
              data: [],
              borderColor: '#F59E0B',
              borderWidth: 1.5,
              borderDash: [5, 5],
              fill: false,
              tension: 0.1,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: '#F59E0B'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 250 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              labels: { color: '#94A3B8', font: { family: 'Plus Jakarta Sans', size: 11 }, boxWidth: 12 }
            },
            tooltip: {
              backgroundColor: '#121826',
              borderColor: '#1E2638',
              borderWidth: 1,
              titleColor: '#94A3B8',
              bodyColor: '#FFFFFF',
              titleFont: { family: 'Plus Jakarta Sans', size: 12 },
              bodyFont: { family: 'JetBrains Mono', size: 12 },
              padding: 10
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(30, 38, 56, 0.4)', drawBorder: false },
              ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 11 }, maxTicksLimit: 7 }
            },
            y: {
              grace: '8%',
              grid: { color: 'rgba(30, 38, 56, 0.6)', drawBorder: false },
              ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 11 } }
            }
          }
        }
      });
    }

    if (canvasMarket && canvasMarket.getContext) {
      const ctxMkt = canvasMarket.getContext('2d');
      marketChart = new Chart(ctxMkt, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Cotação cbETH',
              data: [],
              borderColor: '#10B981',
              borderWidth: 2.5,
              backgroundColor: getGradient(ctxMkt, 16, 185, 129, 0.25),
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: '#10B981'
            },
            {
              label: 'DCA Médio',
              data: [],
              borderColor: '#F59E0B',
              borderWidth: 1.5,
              borderDash: [5, 5],
              fill: false,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 250 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              labels: { color: '#94A3B8', font: { family: 'Plus Jakarta Sans', size: 11 }, boxWidth: 12 }
            },
            tooltip: {
              backgroundColor: '#121826',
              borderColor: '#1E2638',
              borderWidth: 1,
              titleColor: '#94A3B8',
              bodyColor: '#FFFFFF',
              titleFont: { family: 'Plus Jakarta Sans', size: 12 },
              bodyFont: { family: 'JetBrains Mono', size: 12 },
              padding: 10
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(30, 38, 56, 0.4)', drawBorder: false },
              ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 11 }, maxTicksLimit: 7 }
            },
            y: {
              grace: '6%',
              grid: { color: 'rgba(30, 38, 56, 0.6)', drawBorder: false },
              ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 11 } }
            }
          }
        }
      });
    }
  }

  function updateBalanceChart(series, currency = 'USD', rateUsdBrl = 5.0980, balanceCbEth = 0.020581, transactions = []) {
    if (!balanceChart || !Array.isArray(series) || series.length === 0) return;

    const labels = series.map(pt => pt.date || pt.timestamp);
    const multiplier = currency === 'BRL' ? rateUsdBrl : 1.0;
    const prefix = currency === 'BRL' ? 'R$ ' : '$ ';
    const bal = typeof balanceCbEth === 'number' ? balanceCbEth : 0.020581;

    // Calcular posição e custo histórico se houver transações disponíveis
    const hasTxs = Array.isArray(transactions) && transactions.length > 0;
    const totalCostUsd = hasTxs
      ? transactions.reduce((acc, tx) => acc + (tx.totalUsd || ((tx.amountCbEth || 0) * (tx.priceUsd || 0))), 0)
      : (bal * ((series[series.length - 1] && series[series.length - 1].priceCbEthUsd) || 2798.78));

    const dataPatrimonio = [];
    const dataCusto = [];

    series.forEach(pt => {
      const price = (pt.priceCbEthUsd || 0) * multiplier;
      const ptDate = (pt.date || pt.timestamp || '').substring(0, 10);

      if (hasTxs && ptDate && ptDate.length >= 10) {
        let activeBal = 0;
        let activeCostUsd = 0;
        transactions.forEach(tx => {
          const txDate = (tx.timestamp || '').substring(0, 10);
          if (!txDate || txDate <= ptDate) {
            const qty = tx.amountCbEth || 0;
            activeBal += qty;
            activeCostUsd += (tx.totalUsd || (qty * (tx.priceUsd || 0)));
          }
        });
        // Se a série recuar antes do primeiro aporte, preserva a posição conhecida ou usa bal
        const effBal = activeBal > 0 ? activeBal : bal;
        const effCost = activeCostUsd > 0 ? activeCostUsd : totalCostUsd;
        dataPatrimonio.push(+(price * effBal).toFixed(2));
        dataCusto.push(+(effCost * multiplier).toFixed(2));
      } else {
        dataPatrimonio.push(+(price * bal).toFixed(2));
        dataCusto.push(+(totalCostUsd * multiplier).toFixed(2));
      }
    });

    balanceChart.data.labels = labels;
    balanceChart.data.datasets[0].label = `Patrimônio (${currency})`;
    balanceChart.data.datasets[0].data = dataPatrimonio;

    if (balanceChart.data.datasets[1]) {
      balanceChart.data.datasets[1].label = `Custo Investido (${currency})`;
      balanceChart.data.datasets[1].data = dataCusto;
      balanceChart.data.datasets[1].hidden = false;
    }

    if (balanceChart.options?.scales?.y?.ticks) {
      balanceChart.options.scales.y.ticks.callback = function (val) {
        return prefix + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };
    }
    if (balanceChart.options?.plugins?.tooltip?.callbacks) {
      balanceChart.options.plugins.tooltip.callbacks.label = function (ctx) {
        return `${ctx.dataset.label}: ${prefix}${Number(ctx.parsed.y).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      };
    }

    balanceChart.update('none');
  }

  function updateMarketChart(series, mode = 'USD', currency = 'USD', rateUsdBrl = 5.0980, dcaUsd = null) {
    if (!marketChart || !Array.isArray(series) || series.length === 0) return;

    currentMarketMode = mode;
    const labels = series.map(pt => pt.date || pt.timestamp);
    const multiplier = currency === 'BRL' ? rateUsdBrl : 1.0;
    const prefix = currency === 'BRL' ? 'R$ ' : '$ ';

    if (mode === 'USD') {
      const prices = series.map(pt => +((pt.priceCbEthUsd || 0) * multiplier).toFixed(2));
      const dcaValue = (typeof dcaUsd === 'number' && dcaUsd > 0) ? +(dcaUsd * multiplier).toFixed(2) : null;
      const dcaLine = dcaValue !== null ? Array(labels.length).fill(dcaValue) : [];

      marketChart.data.labels = labels;
      marketChart.data.datasets[0].label = `Cotação cbETH (${currency})`;
      marketChart.data.datasets[0].borderColor = '#10B981';
      marketChart.data.datasets[0].data = prices;

      if (marketChart.data.datasets[1]) {
        marketChart.data.datasets[1].label = dcaValue !== null ? `Seu DCA (${prefix}${dcaValue.toFixed(2)})` : 'DCA';
        marketChart.data.datasets[1].data = dcaLine;
        marketChart.data.datasets[1].hidden = dcaValue === null;
      }

      if (marketChart.options?.scales?.y?.ticks) {
        marketChart.options.scales.y.ticks.callback = function (val) {
          return prefix + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0 });
        };
      }
      if (marketChart.options?.plugins?.tooltip?.callbacks) {
        marketChart.options.plugins.tooltip.callbacks.label = function (ctx) {
          const valStr = `${ctx.dataset.label}: ${prefix}${Number(ctx.parsed.y).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
          if (ctx.datasetIndex === 0 && dcaValue !== null && dcaValue > 0) {
            const diffPct = ((ctx.parsed.y - dcaValue) / dcaValue) * 100;
            const diffStr = diffPct >= 0 ? `+${diffPct.toFixed(2)}% vs DCA` : `${diffPct.toFixed(2)}% vs DCA`;
            return `${valStr} (${diffStr})`;
          }
          return valStr;
        };
      }
    } else {
      const rates = series.map(pt => +(pt.exchangeRate || 1.14215).toFixed(5));

      marketChart.data.labels = labels;
      marketChart.data.datasets[0].label = 'Exchange Rate (cbETH / ETH)';
      marketChart.data.datasets[0].borderColor = '#8B5CF6';
      marketChart.data.datasets[0].data = rates;

      if (marketChart.data.datasets[1]) {
        marketChart.data.datasets[1].data = [];
        marketChart.data.datasets[1].hidden = true;
      }

      if (marketChart.options?.scales?.y?.ticks) {
        marketChart.options.scales.y.ticks.callback = function (val) {
          return Number(val).toFixed(5);
        };
      }
      if (marketChart.options?.plugins?.tooltip?.callbacks) {
        marketChart.options.plugins.tooltip.callbacks.label = function (ctx) {
          return `Taxa: ${Number(ctx.parsed.y).toFixed(5)} ETH por cbETH`;
        };
      }
    }

    marketChart.update('none');
  }

  function destroyCharts() {
    if (balanceChart) {
      balanceChart.destroy();
      balanceChart = null;
    }
    if (marketChart) {
      marketChart.destroy();
      marketChart = null;
    }
  }

  const Charts = {
    initCharts,
    updateBalanceChart,
    updateMarketChart,
    destroyCharts,
    getMarketMode: () => currentMarketMode,
    setMarketMode: (m) => { currentMarketMode = m; }
  };

  global.CbEth.Charts = Charts;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Charts;
  }
})(typeof window !== 'undefined' ? window : globalThis);
