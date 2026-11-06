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

  function parseSeriesPointEpochMs(pt) {
    if (!pt) return NaN;
    if (pt.timestamp) {
      const tsMs = Date.parse(String(pt.timestamp));
      if (!isNaN(tsMs)) return tsMs;
    }
    const dStr = String(pt.date || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
      return Date.parse(dStr + 'T23:59:59Z');
    }
    return NaN;
  }

  function parseTxEpochMs(tx) {
    if (!tx || !tx.timestamp) return NaN;
    const raw = String(tx.timestamp).trim().replace(' ', 'T');
    const hasTz = raw.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(raw);
    return Date.parse(hasTz ? raw : raw + 'Z');
  }

  function isEntryTx(tx) {
    if (!tx) return false;
    const tType = String(tx.type || '').toLowerCase().trim();
    return !tType || tType === 'in' || tType === 'entrada' || tType === 'compra' || tType === 'buy';
  }

  function formatSignedPrefixValue(val, prefix, decimals = 2) {
    const num = Number(val) || 0;
    const sign = num >= 0 ? '+' : '-';
    const formatted = Math.abs(num).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return `${sign}${prefix}${formatted}`;
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
              tension: 0.25,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: '#00D2FF'
            },
            {
              label: 'Custo Investido',
              data: [],
              borderColor: '#F59E0B',
              borderWidth: 1.75,
              borderDash: [5, 5],
              fill: false,
              stepped: 'before',
              tension: 0,
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
              footerColor: '#CBD5E1',
              titleFont: { family: 'Plus Jakarta Sans', size: 12 },
              bodyFont: { family: 'JetBrains Mono', size: 12 },
              footerFont: { family: 'JetBrains Mono', size: 11 },
              padding: 10,
              callbacks: {}
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
              tension: 0.25,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: '#10B981'
            },
            {
              label: 'DCA Médio',
              data: [],
              borderColor: '#F59E0B',
              borderWidth: 1.75,
              borderDash: [5, 5],
              fill: false,
              spanGaps: false,
              stepped: 'before',
              tension: 0,
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
              padding: 10,
              callbacks: {}
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

  function updateBalanceChart(series, currency = 'USD', rateUsdBrl = 5.4687, balanceCbEth = 0.036161, transactions = []) {
    if (!balanceChart || !Array.isArray(series) || series.length === 0) return;

    const labels = series.map(pt => pt.date || pt.timestamp);
    const multiplier = currency === 'BRL' ? rateUsdBrl : 1.0;
    const prefix = currency === 'BRL' ? 'R$ ' : '$';
    const bal = typeof balanceCbEth === 'number' && isFinite(balanceCbEth) ? Math.max(0, balanceCbEth) : 0.0;

    const hasTxs = Array.isArray(transactions) && transactions.length > 0;
    const sortedTxs = hasTxs
      ? transactions
          .map(tx => ({ tx, epochMs: parseTxEpochMs(tx) }))
          .sort((a, b) => (isNaN(a.epochMs) ? 0 : a.epochMs) - (isNaN(b.epochMs) ? 0 : b.epochMs))
      : [];

    const maxTxMs = sortedTxs.reduce((mx, item) => (!isNaN(item.epochMs) && item.epochMs > mx ? item.epochMs : mx), -Infinity);

    const fallbackCostUsd = bal > 0
      ? bal * ((series[series.length - 1] && series[series.length - 1].priceCbEthUsd) || 2542.42)
      : 0.0;

    const dataPatrimonio = [];
    const dataCusto = [];

    series.forEach((pt, idx) => {
      const price = (pt.priceCbEthUsd || 0) * multiplier;
      const ptEpochMs = parseSeriesPointEpochMs(pt);

      if (hasTxs && !isNaN(ptEpochMs)) {
        let activeBal = 0.0;
        let activeCostUsd = 0.0;

        for (const item of sortedTxs) {
          if (isNaN(item.epochMs) || item.epochMs <= ptEpochMs) {
            const tx = item.tx;
            const qty = Math.max(0, Number(tx.amountCbEth) || 0);
            const txUsd = (typeof tx.totalUsd === 'number' && tx.totalUsd > 0)
              ? tx.totalUsd
              : qty * (Number(tx.priceUsd) || 0);

            if (isEntryTx(tx)) {
              activeBal += qty;
              activeCostUsd += txUsd;
            } else if (activeBal > 0 && qty > 0) {
              const ratio = Math.min(1, qty / activeBal);
              activeBal = Math.max(0, activeBal - qty);
              activeCostUsd = Math.max(0, activeCostUsd * (1 - ratio));
            }
          }
        }

        const isLastPoint = idx === series.length - 1;
        const effBal = (isLastPoint && activeBal > 0 && ptEpochMs >= maxTxMs)
          ? bal
          : activeBal;

        dataPatrimonio.push(+(price * effBal).toFixed(2));
        dataCusto.push(+(activeCostUsd * multiplier).toFixed(2));
      } else {
        dataPatrimonio.push(+(price * bal).toFixed(2));
        dataCusto.push(+(fallbackCostUsd * multiplier).toFixed(2));
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
        return `${ctx.dataset.label}: ${prefix}${Number(ctx.parsed.y).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };
      balanceChart.options.plugins.tooltip.callbacks.footer = function (items) {
        if (!Array.isArray(items) || items.length === 0) return '';
        const idx = items[0].dataIndex;
        const pat = dataPatrimonio[idx] || 0;
        const cost = dataCusto[idx] || 0;
        if (cost <= 0) return '';
        const diff = pat - cost;
        const pct = (diff / cost) * 100;
        const pctSign = pct >= 0 ? '+' : '';
        return `P&L no ponto: ${formatSignedPrefixValue(diff, prefix, 2)} (${pctSign}${pct.toFixed(2)}%)`;
      };
    }

    balanceChart.update('none');
  }

  function updateMarketChart(series, mode = 'USD', currency = 'USD', rateUsdBrl = 5.4687, dcaUsd = null, transactions = null, entryEr = null) {
    if (!marketChart || !Array.isArray(series) || series.length === 0) return;

    currentMarketMode = mode;
    const labels = series.map(pt => pt.date || pt.timestamp);
    const multiplier = currency === 'BRL' ? rateUsdBrl : 1.0;
    const prefix = currency === 'BRL' ? 'R$ ' : '$';
    const canvasMarket = resolveCanvas('chart-market');
    const ctxMkt = canvasMarket && canvasMarket.getContext ? canvasMarket.getContext('2d') : null;

    if (mode === 'USD') {
      const prices = series.map(pt => +((pt.priceCbEthUsd || 0) * multiplier).toFixed(2));
      const dcaValue = (typeof dcaUsd === 'number' && dcaUsd > 0) ? +(dcaUsd * multiplier).toFixed(2) : null;

      let dcaLine = [];
      if (dcaValue !== null) {
        if (Array.isArray(transactions) && transactions.length > 0) {
          const sortedEntries = transactions
            .filter(tx => isEntryTx(tx) && Number(tx.amountCbEth) > 0)
            .map(tx => ({ tx, epochMs: parseTxEpochMs(tx) }))
            .sort((a, b) => (isNaN(a.epochMs) ? 0 : a.epochMs) - (isNaN(b.epochMs) ? 0 : b.epochMs));

          dcaLine = series.map(pt => {
            const ptEpochMs = parseSeriesPointEpochMs(pt);
            if (isNaN(ptEpochMs) || sortedEntries.length === 0) return dcaValue;
            let qtySum = 0.0;
            let spendSum = 0.0;
            for (const item of sortedEntries) {
              if (isNaN(item.epochMs) || item.epochMs <= ptEpochMs) {
                const q = Number(item.tx.amountCbEth) || 0;
                const s = (typeof item.tx.totalUsd === 'number' && item.tx.totalUsd > 0)
                  ? item.tx.totalUsd
                  : q * (Number(item.tx.priceUsd) || 0);
                qtySum += q;
                spendSum += s;
              }
            }
            if (qtySum <= 0) return null;
            return +((spendSum / qtySum) * multiplier).toFixed(2);
          });
        } else {
          dcaLine = Array(labels.length).fill(dcaValue);
        }
      }

      marketChart.data.labels = labels;
      marketChart.data.datasets[0].label = `Cotação cbETH (${currency})`;
      marketChart.data.datasets[0].borderColor = '#10B981';
      marketChart.data.datasets[0].backgroundColor = getGradient(ctxMkt, 16, 185, 129, 0.25);
      marketChart.data.datasets[0].pointHoverBackgroundColor = '#10B981';
      marketChart.data.datasets[0].data = prices;

      if (marketChart.data.datasets[1]) {
        const dcaFmt = dcaValue !== null
          ? dcaValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '';
        marketChart.data.datasets[1].label = dcaValue !== null ? `Seu DCA (${prefix}${dcaFmt})` : 'DCA';
        marketChart.data.datasets[1].borderColor = '#F59E0B';
        marketChart.data.datasets[1].data = dcaLine;
        marketChart.data.datasets[1].hidden = dcaValue === null;
      }

      if (marketChart.options?.scales?.y?.ticks) {
        marketChart.options.scales.y.ticks.callback = function (val) {
          return prefix + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        };
      }
      if (marketChart.options?.plugins?.tooltip?.callbacks) {
        marketChart.options.plugins.tooltip.callbacks.footer = undefined;
        marketChart.options.plugins.tooltip.callbacks.label = function (ctx) {
          if (ctx.parsed.y === null || ctx.parsed.y === undefined) return '';
          const valStr = `${ctx.dataset.label}: ${prefix}${Number(ctx.parsed.y).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const pointDca = (dcaLine[ctx.dataIndex] !== null && dcaLine[ctx.dataIndex] !== undefined)
            ? dcaLine[ctx.dataIndex]
            : dcaValue;
          if (ctx.datasetIndex === 0 && pointDca !== null && pointDca > 0) {
            const diffPct = ((ctx.parsed.y - pointDca) / pointDca) * 100;
            const diffStr = diffPct >= 0 ? `+${diffPct.toFixed(2)}% vs DCA` : `${diffPct.toFixed(2)}% vs DCA`;
            return `${valStr} (${diffStr})`;
          }
          return valStr;
        };
      }
    } else {
      const rates = series.map(pt => +(pt.exchangeRate || 1.14215).toFixed(5));
      const validEntryEr = (typeof entryEr === 'number' && isFinite(entryEr) && entryEr > 1.0)
        ? +entryEr.toFixed(5)
        : null;

      marketChart.data.labels = labels;
      marketChart.data.datasets[0].label = 'Paridade de Mercado (cbETH / ETH)';
      marketChart.data.datasets[0].borderColor = '#8B5CF6';
      marketChart.data.datasets[0].backgroundColor = getGradient(ctxMkt, 139, 92, 246, 0.22);
      marketChart.data.datasets[0].pointHoverBackgroundColor = '#8B5CF6';
      marketChart.data.datasets[0].data = rates;

      if (marketChart.data.datasets[1]) {
        if (validEntryEr !== null) {
          marketChart.data.datasets[1].label = `Paridade Média Entrada (${validEntryEr.toFixed(5)})`;
          marketChart.data.datasets[1].borderColor = '#F59E0B';
          marketChart.data.datasets[1].data = Array(labels.length).fill(validEntryEr);
          marketChart.data.datasets[1].hidden = false;
        } else {
          marketChart.data.datasets[1].data = [];
          marketChart.data.datasets[1].hidden = true;
        }
      }

      if (marketChart.options?.scales?.y?.ticks) {
        marketChart.options.scales.y.ticks.callback = function (val) {
          return Number(val).toFixed(5);
        };
      }
      if (marketChart.options?.plugins?.tooltip?.callbacks) {
        marketChart.options.plugins.tooltip.callbacks.footer = undefined;
        marketChart.options.plugins.tooltip.callbacks.label = function (ctx) {
          if (ctx.parsed.y === null || ctx.parsed.y === undefined) return '';
          return `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(5)} ETH`;
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
