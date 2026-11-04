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
          datasets: [{
            label: 'Patrimônio',
            data: [],
            borderColor: '#00D2FF',
            borderWidth: 2.5,
            backgroundColor: getGradient(ctxBal, 0, 210, 255, 0.35),
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#00D2FF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 250 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#121826',
              borderColor: '#1E2638',
              borderWidth: 1,
              titleColor: '#94A3B8',
              bodyColor: '#FFFFFF',
              titleFont: { family: 'Plus Jakarta Sans', size: 12 },
              bodyFont: { family: 'JetBrains Mono', size: 12 },
              padding: 10,
              displayColors: false
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(30, 38, 56, 0.4)', drawBorder: false },
              ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 11 }, maxTicksLimit: 7 }
            },
            y: {
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
              tension: 0.35,
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
              grid: { color: 'rgba(30, 38, 56, 0.6)', drawBorder: false },
              ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 11 } }
            }
          }
        }
      });
    }
  }

  function updateBalanceChart(series, currency = 'USD', rateUsdBrl = 5.0980, balanceCbEth = 0.020581) {
    if (!balanceChart || !Array.isArray(series) || series.length === 0) return;

    const labels = series.map(pt => pt.date || pt.timestamp);
    const multiplier = currency === 'BRL' ? rateUsdBrl : 1.0;
    const prefix = currency === 'BRL' ? 'R$ ' : '$ ';
    const bal = typeof balanceCbEth === 'number' ? balanceCbEth : 0.020581;

    const dataValues = series.map(pt => {
      const price = (pt.priceCbEthUsd || 0) * multiplier;
      return +(price * bal).toFixed(2);
    });

    balanceChart.data.labels = labels;
    balanceChart.data.datasets[0].label = `Patrimônio (${currency})`;
    balanceChart.data.datasets[0].data = dataValues;

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
        marketChart.data.datasets[1].label = dcaValue !== null ? `DCA (${prefix}${dcaValue.toFixed(2)})` : 'DCA';
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
          return `${ctx.dataset.label}: ${prefix}${Number(ctx.parsed.y).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
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
          return `Taxa: ${Number(ctx.parsed.y).toFixed(5)} ETH`;
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
