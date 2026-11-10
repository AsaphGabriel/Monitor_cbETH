(function (global) {
  'use strict';

  global.CbEth = global.CbEth || {};

  let requestCounter = 0;

  const state = {
    address: '0xc4cfde467bc76d0d6df365584648371b1954b154',
    timeframe: '30d',
    currency: 'USD',
    chartMode: 'USD',
    sortKey: 'date',
    sortAsc: false,
    isLoading: false,
    data: null,
    metrics: null
  };

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      textArea.remove();
      return Promise.resolve();
    } catch (err) {
      textArea.remove();
      return Promise.reject(err);
    }
  }

  function formatCurrency(val, currency = 'USD', decimals = 2) {
    const num = Number(val) || 0.0;
    const prefix = currency === 'BRL' ? 'R$ ' : '$';
    const sign = num < 0 ? '-' : '';
    return sign + prefix + Math.abs(num).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatSignedCurrency(val, currency = 'USD', decimals = 2) {
    const num = Number(val) || 0.0;
    const prefix = currency === 'BRL' ? 'R$ ' : '$';
    const sign = num >= 0 ? '+' : '-';
    return sign + prefix + Math.abs(num).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatCrypto(val, symbol = 'cbETH', decimals = 6) {
    const num = Number(val) || 0.0;
    return num.toFixed(decimals) + ' ' + symbol;
  }

  function parseTxEpochSeconds(tx) {
    if (!tx || !tx.timestamp) return NaN;
    const raw = String(tx.timestamp).trim().replace(' ', 'T');
    const hasTz = raw.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(raw);
    const ms = Date.parse(hasTz ? raw : raw + 'Z');
    return isNaN(ms) ? NaN : Math.floor(ms / 1000);
  }

  function filterTransactionsByTimeframe(transactions, timeframe) {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];
    if (timeframe === 'all') return transactions.slice();

    let maxTxEpoch = 0;
    for (const tx of transactions) {
      const ep = parseTxEpochSeconds(tx);
      if (!isNaN(ep) && ep > maxTxEpoch) maxTxEpoch = ep;
    }

    const nowEpoch = Math.max(Math.floor(Date.now() / 1000), maxTxEpoch);
    let days = 30;
    if (timeframe === '24h') days = 1;
    else if (timeframe === '7d') days = 7;
    else if (timeframe === '14d') days = 14;
    else if (timeframe === '30d') days = 30;
    else if (timeframe === '90d') days = 90;

    const cutoffEpoch = nowEpoch - days * 86400;

    return transactions.filter(tx => {
      const txEpoch = parseTxEpochSeconds(tx);
      if (isNaN(txEpoch)) return true;
      return txEpoch >= cutoffEpoch;
    });
  }

  function sortTransactions(transactions, sortKey, sortAsc) {
    const copy = transactions.slice();
    copy.sort((a, b) => {
      if (sortKey === 'volume') {
        const volA = a.totalUsd || (a.amountCbEth * (a.priceUsd || 0));
        const volB = b.totalUsd || (b.amountCbEth * (b.priceUsd || 0));
        return sortAsc ? volA - volB : volB - volA;
      } else {
        const timeA = parseTxEpochSeconds(a) || 0;
        const timeB = parseTxEpochSeconds(b) || 0;
        return sortAsc ? timeA - timeB : timeB - timeA;
      }
    });
    return copy;
  }

  function calculateMetrics(data, currentCurrency) {
    const calc = global.CbEth.Calculator;
    if (!calc || !data || !data.position) return null;

    const pos = data.position;
    const series = data.historicalSeries || [];
    const transactions = data.transactions || [];

    const dcaUsd = calc.calculateDca(transactions);
    const avgPricePeriodUsd = calc.calculatePeriodAveragePrice(series, pos.spotCbEthUsd);
    const pnl = calc.calculatePnl(pos.spotCbEthUsd, dcaUsd, pos.balanceCbEth);
    const entryEr = calc.calculateEntryExchangeRate
      ? calc.calculateEntryExchangeRate(transactions, 1.14062)
      : 1.14062;

    const totalInvestedUsd = transactions.reduce((acc, tx) => {
      const tType = String(tx.type || '').toLowerCase();
      const isEntry = !tType || tType === 'in' || tType === 'entrada' || tType === 'compra' || tType === 'buy';
      if (isEntry) {
        return acc + (tx.totalUsd || ((tx.amountCbEth || 0) * (tx.priceUsd || 0)));
      }
      return acc;
    }, 0) || (pos.balanceCbEth * (dcaUsd > 0 ? dcaUsd : pos.spotCbEthUsd));

    const effectiveProtocolEr = pos.protocolExchangeRate || pos.exchangeRate;
    const decomposed = calc.decomposePnl(
      effectiveProtocolEr,
      entryEr,
      pos.spotCbEthUsd,
      dcaUsd,
      pos.balanceCbEth,
      pos.rateUsdBrl,
      pos.spotEthUsd
    );

    const projections = calc.calculateStakingProjections(
      pos.balanceCbEth,
      pos.spotCbEthUsd,
      pos.rateUsdBrl
    );

    const ethSeries = series.map(p => ({ price: p.priceEthUsd }));
    const avgEth = calc.calculatePeriodAveragePrice(ethSeries, pos.spotEthUsd);
    const maxEr = Math.max(
      effectiveProtocolEr || 1.14344,
      ...(series.length > 0 ? series.map(p => p.exchangeRate || 0) : [1.14344])
    );

    const thermometer = calc.calculateThermometer(pos.spotEthUsd, avgEth, pos.exchangeRate, maxEr);

    return {
      dcaUsd,
      entryEr,
      avgPricePeriodUsd,
      totalInvestedUsd,
      pnl,
      decomposed,
      projections,
      thermometer
    };
  }

  function renderStatusFooter(data) {
    const elFooterTs = document.getElementById('footerTimestamp');
    if (elFooterTs) {
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const modeLabel = data?.isFallback ? 'Snapshot Auditado' : 'Tempo Real RPC + DeFiLlama';
      elFooterTs.textContent = `Última Atualização: ${nowIso} UTC (${modeLabel})`;
    }

    const elBadge = document.getElementById('networkBadge');
    if (elBadge) {
      if (data?.isFallback) {
        elBadge.className = 'flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20';
        elBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Cache Auditado';
      } else {
        elBadge.className = 'flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        elBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>On-Chain';
      }
    }
  }

  function renderKpis(data, metrics, currency) {
    if (!data || !metrics) return;
    const pos = data.position;
    const mult = currency === 'BRL' ? pos.rateUsdBrl : 1.0;

    // Card 1: Patrimônio Total
    const elPatTotal = document.getElementById('cardPatrimonioTotal') || document.getElementById('patrimonio-total');
    if (elPatTotal) {
      const val = (pos.patrimonioTotalUsd ?? (pos.balanceCbEth * pos.spotCbEthUsd)) * mult;
      elPatTotal.textContent = formatCurrency(val, currency, 2);
    }
    const elPatSub = document.getElementById('cardPatrimonioSubtitle');
    if (elPatSub) {
      elPatSub.textContent = `cbETH (${pos.balanceCbEth.toFixed(6)}) + Gas ETH (${pos.balanceEthGas.toFixed(6)})`;
    }
    const elPatBadge = document.getElementById('kpiPatrimonioBadge');
    if (elPatBadge) {
      const pnlPct = metrics.pnl.pnlPercent;
      const sign = pnlPct >= 0 ? '+' : '';
      elPatBadge.textContent = `${sign}${pnlPct.toFixed(2)}% All Time`;
      elPatBadge.className = `font-mono px-2 py-0.5 rounded-full text-xs font-semibold ${pnlPct >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`;
    }
    const elTotalInv = document.getElementById('cardTotalInvested');
    if (elTotalInv) {
      const totalInv = (metrics.totalInvestedUsd || 0) * mult;
      elTotalInv.textContent = formatCurrency(totalInv, currency, 2);
    }
    const elSpotPrice = document.getElementById('cardSpotPrice');
    if (elSpotPrice) {
      elSpotPrice.textContent = formatCurrency(pos.spotCbEthUsd * mult, currency, 2);
    }

    // Card 2 / 3: DCA & Média do Período
    const elDca = document.getElementById('cardDca') || document.getElementById('dca-price');
    if (elDca) {
      const val = metrics.dcaUsd * mult;
      elDca.textContent = metrics.dcaUsd > 0 ? formatCurrency(val, currency, 2) : 'N/A';
    }
    const elAvgPeriod = document.getElementById('cardPeriodAveragePrice') ||
      document.getElementById('avg-period-price') ||
      document.getElementById('preco-medio-periodo') ||
      document.querySelector('[data-metric="avg-price"]');
    if (elAvgPeriod) {
      const val = metrics.avgPricePeriodUsd * mult;
      elAvgPeriod.textContent = formatCurrency(val, currency, 2);
    }

    // Card 4: Exchange Rate (Protocol Beacon Chain Rate, with market parity fallback)
    const elEr = document.getElementById('cardExchangeRate') || document.getElementById('exchange-rate');
    if (elEr) {
      const displayEr = pos.protocolExchangeRate || pos.exchangeRate;
      elEr.textContent = displayEr.toFixed(5);
    }

    // Staking Yield Real desde entrada
    const elYield = document.getElementById('cardStakingYield') || document.getElementById('staking-yield');
    if (elYield) {
      elYield.textContent = `+${metrics.decomposed.stakingYieldEth.toFixed(6)} ETH`;
    }
    const elYieldFiat = document.getElementById('cardStakingYieldFiat');
    if (elYieldFiat) {
      const yieldFiat = (metrics.decomposed.stakingYieldUsd || 0) * mult;
      elYieldFiat.textContent = `~ ${formatCurrency(yieldFiat, currency, 2)}`;
    }

    // Painel P&L All Time
    const elPnlMonetary = document.getElementById('pnlMonetary') || document.getElementById('pnl-monetary');
    const elPnlPercent = document.getElementById('pnlPercent') || document.getElementById('pnl-percent');
    const elPnlBadge = document.getElementById('pnlBadge') || document.getElementById('pnl-badge');
    const elPnlStaking = document.getElementById('pnlStakingYield');
    const elPnlMarket = document.getElementById('pnlMarketChange');
    const elPanelPnl = document.getElementById('panelPnl');

    if (elPnlMonetary) {
      const pnlMon = metrics.pnl.pnlUsd * mult;
      elPnlMonetary.textContent = formatSignedCurrency(pnlMon, currency, 2);
      elPnlMonetary.className = `text-3xl font-extrabold font-mono ${pnlMon >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }
    if (elPnlPercent) {
      const sign = metrics.pnl.pnlPercent >= 0 ? '+' : '';
      elPnlPercent.textContent = `(${sign}${metrics.pnl.pnlPercent.toFixed(2)}%)`;
      elPnlPercent.className = `text-sm font-bold font-mono ${metrics.pnl.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }
    if (elPnlBadge) {
      elPnlBadge.textContent = metrics.decomposed.status;
      if (metrics.decomposed.status === 'Lucro Consolidado') {
        elPnlBadge.className = 'px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        if (elPanelPnl) elPanelPnl.className = 'card-executive p-5 flex flex-col justify-between border-l-4 border-l-emerald-500';
      } else {
        elPnlBadge.className = 'px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20';
        if (elPanelPnl) elPanelPnl.className = 'card-executive p-5 flex flex-col justify-between border-l-4 border-l-amber-500';
      }
    }
    if (elPnlStaking) {
      const stVal = (metrics.decomposed.stakingYieldUsd || 0) * mult;
      elPnlStaking.textContent = formatSignedCurrency(stVal, currency, 2);
    }
    if (elPnlMarket) {
      const mktVal = (metrics.decomposed.marketChangeUsd || 0) * mult;
      elPnlMarket.textContent = formatSignedCurrency(mktVal, currency, 2);
      elPnlMarket.className = `font-bold ${mktVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    // Painel Staking & APY
    const elApy = document.getElementById('stakingApy');
    if (elApy) elApy.textContent = '3.10% APY';
    const elDaily = document.getElementById('stakingDaily');
    const elMonthly = document.getElementById('stakingMonthly');
    const elAnnual = document.getElementById('stakingAnnual');
    if (elDaily) {
      const val = (currency === 'BRL' ? metrics.projections.dailyBrl : metrics.projections.dailyUsd);
      elDaily.textContent = formatSignedCurrency(val, currency, 2);
    }
    if (elMonthly) {
      const val = (currency === 'BRL' ? metrics.projections.monthlyBrl : metrics.projections.monthlyUsd);
      elMonthly.textContent = formatSignedCurrency(val, currency, 2);
    }
    if (elAnnual) {
      const val = (currency === 'BRL' ? metrics.projections.annualBrl : metrics.projections.annualUsd);
      elAnnual.textContent = formatSignedCurrency(val, currency, 2);
    }

    // Painel Termômetro Decisório
    const elScore = document.getElementById('thermoScore');
    const elSignal = document.getElementById('thermoSignal');
    const elSignalContainer = document.getElementById('thermoSignalContainer');
    const elDd = document.getElementById('thermoDrawdown');
    const elDesagio = document.getElementById('thermoDesagio');
    const elPanelThermo = document.getElementById('panelThermometer');

    if (elScore) {
      elScore.textContent = `Score ${metrics.thermometer.score}/100`;
    }
    if (elSignal) {
      elSignal.textContent = metrics.thermometer.signal;
    }
    if (elSignalContainer) {
      if (metrics.thermometer.signal === 'OPORTUNIDADE DE APORTE') {
        elSignalContainer.className = 'px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between';
        if (elSignal) elSignal.className = 'text-xs font-bold text-emerald-400 font-mono';
        if (elPanelThermo) elPanelThermo.className = 'card-executive p-5 flex flex-col justify-between border-l-4 border-l-emerald-500';
      } else if (metrics.thermometer.signal === 'ZONA NEUTRA / FAVORÁVEL') {
        elSignalContainer.className = 'px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-between';
        if (elSignal) elSignal.className = 'text-xs font-bold text-cyan-400 font-mono';
        if (elPanelThermo) elPanelThermo.className = 'card-executive p-5 flex flex-col justify-between border-l-4 border-l-cyan-500';
      } else {
        elSignalContainer.className = 'px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-between';
        if (elSignal) elSignal.className = 'text-xs font-bold text-amber-400 font-mono';
        if (elPanelThermo) elPanelThermo.className = 'card-executive p-5 flex flex-col justify-between border-l-4 border-l-amber-500';
      }
    }
    if (elDd) {
      const ddPct = (metrics.thermometer.drawdownEth * 100).toFixed(2);
      elDd.textContent = `${ddPct}%`;
    }
    if (elDesagio) {
      const desPct = (metrics.thermometer.desagioCbEth * 100).toFixed(2);
      elDesagio.textContent = `${desPct}%`;
    }

    // Topbar stats
    const elStatUsdBrl = document.getElementById('statUsdBrl');
    if (elStatUsdBrl) {
      elStatUsdBrl.textContent = `R$ ${pos.rateUsdBrl.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
    }

    renderStatusFooter(data);
  }

  function renderLedger(data, timeframe, sortKey, sortAsc, currency) {
    const tbody = document.getElementById('ledger-table-body') ||
      document.querySelector('#transactions-table tbody') ||
      document.getElementById('ledgerTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const txs = data?.transactions || [];
    const filtered = filterTransactionsByTimeframe(txs, timeframe);
    const sorted = sortTransactions(filtered, sortKey, sortAsc);

    const elCountBadge = document.getElementById('ledgerCountBadge');
    if (elCountBadge) {
      elCountBadge.textContent = timeframe === 'all'
        ? `${txs.length} transações`
        : `${filtered.length} no período / ${txs.length} total`;
    }

    if (sorted.length === 0) {
      const tr = document.createElement('tr');
      tr.id = 'empty-ledger-row';
      const hint = txs.length > 0
        ? `Nenhuma movimentação na janela ${timeframe}. Selecione 90d ou Tudo para ver as ${txs.length} transações históricas.`
        : 'Nenhuma movimentação encontrada para esta carteira.';
      tr.innerHTML = `<td colspan="6" class="text-center py-6 text-slate-400 font-mono text-xs">${hint}</td>`;
      tbody.appendChild(tr);
      return;
    }

    const icons = global.CbEth.Icons;
    const rateUsdBrl = data.position?.rateUsdBrl || 5.4687;
    const mult = currency === 'BRL' ? rateUsdBrl : 1.0;

    for (const tx of sorted) {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/40 transition border-b border-slate-800/40';

      const shortHash = (tx.hash && tx.hash.length >= 10)
        ? tx.hash.substring(0, 6) + '...' + tx.hash.substring(tx.hash.length - 4)
        : tx.hash || '';

      const tType = String(tx.type || 'in').toLowerCase();
      const isEntry = !tType || tType === 'in' || tType === 'entrada' || tType === 'compra' || tType === 'buy';
      const badgeCls = isEntry
        ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
        : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20';
      const badgeStyle = isEntry ? 'color: #16a34a;' : 'color: #dc2626;';
      const badgeIcon = isEntry ? (icons?.arrowUpRight?.('w-3 h-3') || '') : (icons?.arrowDownLeft?.('w-3 h-3') || '');
      const badgeLabel = isEntry ? 'Entrada / Compra' : 'Saída / Venda';

      const copyIcon = icons?.copy?.('w-3.5 h-3.5') || '';
      const extIcon = icons?.externalLink?.('w-3.5 h-3.5') || '';

      const priceUnit = (tx.priceUsd || 0) * mult;
      const totalVal = (tx.totalUsd || (tx.amountCbEth * (tx.priceUsd || 0))) * mult;

      tr.innerHTML = `
        <td class="py-3 px-3">
          <div class="flex items-center gap-2">
            <span class="font-mono text-slate-200">${shortHash}</span>
            <button class="btn-copy text-slate-400 hover:text-white transition p-1 rounded hover:bg-slate-700/50" title="Copiar Hash" aria-label="copiar hash" data-hash="${tx.hash}">
              ${copyIcon}
            </button>
            <a href="https://basescan.org/tx/${tx.hash}" target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-cyan-400 transition p-1 rounded hover:bg-slate-700/50" title="Ver no BaseScan">
              ${extIcon}
            </a>
          </div>
        </td>
        <td class="py-3 px-3 text-slate-400 whitespace-nowrap">${tx.timestamp || '-'}</td>
        <td class="py-3 px-3">
          <span class="${badgeCls}" style="${badgeStyle}">
            ${badgeIcon}
            <span>${badgeLabel}</span>
          </span>
        </td>
        <td class="py-3 px-3 text-right font-mono font-semibold text-slate-200">
          ${isEntry ? '+' : '-'}${Number(tx.amountCbEth || 0).toFixed(6)} cbETH
        </td>
        <td class="py-3 px-3 text-right font-mono text-slate-300">
          ${formatCurrency(priceUnit, currency, 2)}
        </td>
        <td class="py-3 px-3 text-right font-mono font-bold text-white">
          ${formatCurrency(totalVal, currency, 2)}
        </td>
      `;

      const copyBtn = tr.querySelector('.btn-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try {
            await copyToClipboard(tx.hash);
            const originalHtml = copyBtn.innerHTML;
            copyBtn.innerHTML = icons?.check?.('w-3.5 h-3.5 text-emerald-400') || '';
            setTimeout(() => {
              copyBtn.innerHTML = originalHtml;
            }, 1500);
          } catch (_) {}
        });
      }

      tbody.appendChild(tr);
    }
  }

  function renderCharts(data, metrics) {
    const charts = global.CbEth.Charts;
    if (!charts || !data || !data.position) return;

    charts.updateBalanceChart(
      data.historicalSeries,
      state.currency,
      data.position.rateUsdBrl,
      data.position.balanceCbEth,
      data.transactions
    );
    charts.updateMarketChart(
      data.historicalSeries,
      state.chartMode,
      state.currency,
      data.position.rateUsdBrl,
      metrics?.dcaUsd,
      data.transactions,
      metrics?.entryEr
    );
  }

  function updateTimeframeButtons(activeTimeframe) {
    const buttons = document.querySelectorAll('#timeframeFilter button, [data-timeframe]');
    buttons.forEach(btn => {
      const tf = btn.getAttribute('data-timeframe') || btn.textContent.trim().toLowerCase();
      const isActive = tf === activeTimeframe || (tf === 'all' && activeTimeframe === 'all') || (btn.textContent.trim() === 'Tudo' && activeTimeframe === 'all');
      if (isActive) {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold font-mono bg-blue-600 text-white shadow transition active border border-blue-500';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold font-mono text-slate-400 hover:text-white transition';
      }
    });
  }

  function updateCurrencyButtons(activeCurrency) {
    const btnUsd = document.getElementById('btnCurrencyUsd') || document.querySelector('[data-currency="USD"]');
    const btnBrl = document.getElementById('btnCurrencyBrl') || document.querySelector('[data-currency="BRL"]');

    if (btnUsd && btnBrl) {
      if (activeCurrency === 'USD') {
        btnUsd.className = 'px-3 py-1 rounded-lg text-xs font-bold font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition active';
        btnBrl.className = 'px-3 py-1 rounded-lg text-xs font-bold font-mono text-slate-400 hover:text-white transition';
      } else {
        btnBrl.className = 'px-3 py-1 rounded-lg text-xs font-bold font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition active';
        btnUsd.className = 'px-3 py-1 rounded-lg text-xs font-bold font-mono text-slate-400 hover:text-white transition';
      }
    }
  }

  function updateChartModeButtons(activeMode) {
    const btnUsd = document.getElementById('btnChartModeUsd') || document.getElementById('btn-chart-usd') || document.querySelector('[data-chart-mode="USD"]');
    const btnEth = document.getElementById('btnChartModeEth') || document.getElementById('btn-chart-eth') || document.querySelector('[data-chart-mode="ETH"]');

    if (btnUsd && btnEth) {
      if (activeMode === 'USD') {
        btnUsd.className = 'px-2.5 py-1 text-xs font-bold font-mono bg-blue-600 text-white rounded transition active';
        btnEth.className = 'px-2.5 py-1 text-xs font-bold font-mono text-slate-400 hover:text-white rounded transition';
      } else {
        btnEth.className = 'px-2.5 py-1 text-xs font-bold font-mono bg-purple-600 text-white rounded transition active';
        btnUsd.className = 'px-2.5 py-1 text-xs font-bold font-mono text-slate-400 hover:text-white rounded transition';
      }
    }
  }

  function hydrateInitialSnapshot() {
    const fb = global.CbEth.FallbackData;
    if (!fb) return;
    const pos = fb.getCanonicalPosition();
    const txs = fb.getCanonicalTransactions();
    const series = fb.getHistoricalSeries(state.timeframe, pos.address);
    const snapshot = {
      position: pos,
      transactions: txs,
      historicalSeries: series,
      isFallback: true,
      isCanonical: true
    };
    state.data = snapshot;
    state.metrics = calculateMetrics(snapshot, state.currency);
    renderKpis(state.data, state.metrics, state.currency);
    renderLedger(state.data, state.timeframe, state.sortKey, state.sortAsc, state.currency);
    renderCharts(state.data, state.metrics);
  }

  async function switchTimeframe(tf) {
    const api = global.CbEth.Api;
    if (!api) return;

    const sanitized = api.sanitizeTimeframe(tf);
    state.timeframe = sanitized;
    updateTimeframeButtons(sanitized);

    if (!state.data || state.isLoading) {
      return loadData(false);
    }

    const reqId = ++requestCounter;
    try {
      const spotObj = {
        cbEthUsd: state.data.position.spotCbEthUsd,
        ethUsd: state.data.position.spotEthUsd,
        exchangeRate: state.data.position.exchangeRate,
        protocolExchangeRate: state.data.position.protocolExchangeRate,
        source: state.data.isFallback ? 'fallback' : 'api'
      };
      const nextSeries = await api.fetchHistoricalSeries(sanitized, state.address, spotObj, false);
      if (reqId !== requestCounter) return;

      state.data = Object.assign({}, state.data, { historicalSeries: nextSeries });
      state.metrics = calculateMetrics(state.data, state.currency);
      renderKpis(state.data, state.metrics, state.currency);
      renderLedger(state.data, state.timeframe, state.sortKey, state.sortAsc, state.currency);
      renderCharts(state.data, state.metrics);
    } catch (err) {
      console.warn('Erro ao alternar janela temporal:', err.message);
    }
  }

  async function loadData(forceRefresh = false) {
    const api = global.CbEth.Api;
    if (!api) return;

    const input = document.getElementById('wallet-address') || document.getElementById('walletInput') || document.querySelector('input[name="address"]');
    const errorEl = document.getElementById('walletError');
    const btnUpdate = document.getElementById('btn-refresh') || document.getElementById('btn-consultar') || document.getElementById('btnUpdate');

    const address = input ? input.value.trim() : state.address;

    if (!api.isValidEvmAddress(address)) {
      if (errorEl) {
        errorEl.textContent = 'Endereço EVM inválido. Formato exigido: 0x seguido de 40 caracteres hexadecimais.';
        errorEl.classList.remove('hidden');
      }
      if (input) {
        input.classList.add('border-rose-500', 'bg-rose-500/10');
      }
      return;
    }

    if (errorEl) {
      errorEl.classList.add('hidden');
      errorEl.textContent = '';
    }
    if (input) {
      input.classList.remove('border-rose-500', 'bg-rose-500/10');
    }

    state.address = address;
    state.isLoading = true;
    const reqId = ++requestCounter;
    const requestedTimeframe = state.timeframe;

    if (btnUpdate && forceRefresh) {
      btnUpdate.setAttribute('disabled', 'true');
      const textSpan = btnUpdate.querySelector('span:not(#btnUpdateIcon)') || btnUpdate;
      if (textSpan) textSpan.textContent = 'Buscando...';
    }

    try {
      const data = await api.loadWalletData(state.address, requestedTimeframe, forceRefresh);
      if (reqId !== requestCounter) {
        // If timeframe changed while wallet load was in flight, align series to current state.timeframe
        if (state.address.toLowerCase() === address.toLowerCase()) {
          const spotObj = {
            cbEthUsd: data.position.spotCbEthUsd,
            ethUsd: data.position.spotEthUsd,
            exchangeRate: data.position.exchangeRate,
            protocolExchangeRate: data.position.protocolExchangeRate,
            source: data.isFallback ? 'fallback' : 'api'
          };
          const alignedSeries = await api.fetchHistoricalSeries(state.timeframe, state.address, spotObj, false);
          data.historicalSeries = alignedSeries;
        } else {
          return;
        }
      }

      state.data = data;
      state.metrics = calculateMetrics(data, state.currency);

      renderKpis(state.data, state.metrics, state.currency);
      renderLedger(state.data, state.timeframe, state.sortKey, state.sortAsc, state.currency);
      renderCharts(state.data, state.metrics);
    } catch (err) {
      console.warn('Erro ao carregar dados on-chain:', err.message);
    } finally {
      state.isLoading = false;
      if (btnUpdate) {
        btnUpdate.removeAttribute('disabled');
        const textSpan = btnUpdate.querySelector('span:not(#btnUpdateIcon)') || btnUpdate;
        if (textSpan) textSpan.textContent = 'Atualizar / Consultar';
      }
    }
  }

  function setupEvents() {
    // 1. Refresh / Consultar button
    const btnUpdate = document.getElementById('btn-refresh') ||
      document.getElementById('btn-consultar') ||
      document.getElementById('btnUpdate') ||
      document.querySelector('button[type="submit"]');

    if (btnUpdate) {
      btnUpdate.addEventListener('click', (e) => {
        e.preventDefault();
        loadData(true);
      });
    }

    // 2. Input Enter key
    const input = document.getElementById('wallet-address') ||
      document.getElementById('walletInput') ||
      document.querySelector('input[name="address"]');

    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          loadData(true);
        }
      });
      input.addEventListener('input', () => {
        const errorEl = document.getElementById('walletError');
        if (errorEl && !errorEl.classList.contains('hidden')) {
          errorEl.classList.add('hidden');
          input.classList.remove('border-rose-500', 'bg-rose-500/10');
        }
      });
    }

    // 3. Timeframe Buttons
    const timeframeButtons = document.querySelectorAll('#timeframeFilter button, [data-timeframe]');
    timeframeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        let tf = btn.getAttribute('data-timeframe') || btn.textContent.trim().toLowerCase();
        if (tf === 'tudo') tf = 'all';
        switchTimeframe(tf);
      });
    });

    // 4. Currency Buttons
    const btnUsd = document.getElementById('btnCurrencyUsd') || document.querySelector('[data-currency="USD"]');
    const btnBrl = document.getElementById('btnCurrencyBrl') || document.querySelector('[data-currency="BRL"]');

    if (btnUsd) {
      btnUsd.addEventListener('click', () => {
        if (state.currency === 'USD') return;
        state.currency = 'USD';
        updateCurrencyButtons('USD');
        if (state.data && state.metrics) {
          renderKpis(state.data, state.metrics, 'USD');
          renderLedger(state.data, state.timeframe, state.sortKey, state.sortAsc, 'USD');
          renderCharts(state.data, state.metrics);
        }
      });
    }

    if (btnBrl) {
      btnBrl.addEventListener('click', () => {
        if (state.currency === 'BRL') return;
        state.currency = 'BRL';
        updateCurrencyButtons('BRL');
        if (state.data && state.metrics) {
          renderKpis(state.data, state.metrics, 'BRL');
          renderLedger(state.data, state.timeframe, state.sortKey, state.sortAsc, 'BRL');
          renderCharts(state.data, state.metrics);
        }
      });
    }

    // 5. Chart 2 Mode Toggle (USD | ETH)
    const btnChartUsd = document.getElementById('btnChartModeUsd') || document.getElementById('btn-chart-usd') || document.querySelector('[data-chart-mode="USD"]');
    const btnChartEth = document.getElementById('btnChartModeEth') || document.getElementById('btn-chart-eth') || document.querySelector('[data-chart-mode="ETH"]');

    if (btnChartUsd) {
      btnChartUsd.addEventListener('click', () => {
        state.chartMode = 'USD';
        updateChartModeButtons('USD');
        if (state.data) {
          global.CbEth.Charts?.updateMarketChart(
            state.data.historicalSeries,
            'USD',
            state.currency,
            state.data.position.rateUsdBrl,
            state.metrics?.dcaUsd,
            state.data.transactions,
            state.metrics?.entryEr
          );
        }
      });
    }

    if (btnChartEth) {
      btnChartEth.addEventListener('click', () => {
        state.chartMode = 'ETH';
        updateChartModeButtons('ETH');
        if (state.data) {
          global.CbEth.Charts?.updateMarketChart(
            state.data.historicalSeries,
            'ETH',
            state.currency,
            state.data.position.rateUsdBrl,
            state.metrics?.dcaUsd,
            state.data.transactions,
            state.metrics?.entryEr
          );
        }
      });
    }

    // 6. Ledger Sorting
    const btnSortDate = document.getElementById('btnSortDate') || document.querySelector('[data-sort="date"]');
    const btnSortVolume = document.getElementById('btnSortVolume') || document.querySelector('[data-sort="volume"]');

    if (btnSortDate) {
      btnSortDate.addEventListener('click', () => {
        if (state.sortKey === 'date') {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortKey = 'date';
          state.sortAsc = false;
        }
        btnSortDate.className = 'px-2.5 py-1 text-xs font-semibold font-mono bg-blue-600 text-white rounded transition active';
        if (btnSortVolume) {
          btnSortVolume.className = 'px-2.5 py-1 text-xs font-semibold font-mono text-slate-400 hover:text-white rounded transition';
        }
        renderLedger(state.data, state.timeframe, state.sortKey, state.sortAsc, state.currency);
      });
    }

    if (btnSortVolume) {
      btnSortVolume.addEventListener('click', () => {
        if (state.sortKey === 'volume') {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortKey = 'volume';
          state.sortAsc = false;
        }
        btnSortVolume.className = 'px-2.5 py-1 text-xs font-semibold font-mono bg-blue-600 text-white rounded transition active';
        if (btnSortDate) {
          btnSortDate.className = 'px-2.5 py-1 text-xs font-semibold font-mono text-slate-400 hover:text-white rounded transition';
        }
        renderLedger(state.data, state.timeframe, state.sortKey, state.sortAsc, state.currency);
      });
    }
  }

  function initIcons() {
    const icons = global.CbEth.Icons;
    if (!icons) return;

    const logoIcon = document.getElementById('logoIcon');
    if (logoIcon) logoIcon.innerHTML = icons.ethereum('w-5 h-5 text-white');

    const btnUpdateIcon = document.getElementById('btnUpdateIcon');
    if (btnUpdateIcon) btnUpdateIcon.innerHTML = icons.refresh('w-3.5 h-3.5');

    const btnFullscreenIcon = document.getElementById('btnFullscreenIcon');
    if (btnFullscreenIcon && typeof icons.maximize === 'function') {
      btnFullscreenIcon.innerHTML = icons.maximize('w-3.5 h-3.5');
    }

    const btnInstallIcon = document.getElementById('btnInstallIcon');
    if (btnInstallIcon && typeof icons.download === 'function') {
      btnInstallIcon.innerHTML = icons.download('w-3.5 h-3.5');
    }
  }

  let deferredInstallPrompt = null;

  function isFullscreenActive() {
    if (typeof document === 'undefined') return false;
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
  }

  function toggleFullscreen() {
    if (typeof document === 'undefined') return;
    const docEl = document.documentElement;

    if (!isFullscreenActive()) {
      const requestFs = docEl.requestFullscreen ||
                        docEl.webkitRequestFullscreen ||
                        docEl.mozRequestFullScreen ||
                        docEl.msRequestFullscreen;
      if (requestFs) {
        requestFs.call(docEl).catch((err) => {
          console.warn('Falha ao entrar em tela cheia:', err);
        });
      }
    } else {
      const exitFs = document.exitFullscreen ||
                     document.webkitExitFullscreen ||
                     document.mozCancelFullScreen ||
                     document.msExitFullscreen;
      if (exitFs) {
        exitFs.call(document).catch((err) => {
          console.warn('Falha ao sair de tela cheia:', err);
        });
      }
    }
  }

  function updateFullscreenUI() {
    if (typeof document === 'undefined') return;
    const icons = global.CbEth.Icons;
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const iconContainer = document.getElementById('btnFullscreenIcon');
    const labelContainer = document.getElementById('btnFullscreenText');

    if (!btnFullscreen || !iconContainer || !icons) return;

    const inFullscreen = isFullscreenActive();
    if (inFullscreen) {
      if (typeof icons.minimize === 'function') {
        iconContainer.innerHTML = icons.minimize('w-3.5 h-3.5');
      }
      if (labelContainer) labelContainer.textContent = 'Janela';
      btnFullscreen.setAttribute('title', 'Sair da Tela Cheia');
      btnFullscreen.setAttribute('aria-label', 'Sair da Tela Cheia');
      btnFullscreen.classList.add('bg-cyan-950/60', 'border-cyan-500/50', 'text-cyan-300');
      btnFullscreen.classList.remove('bg-slate-800');
    } else {
      if (typeof icons.maximize === 'function') {
        iconContainer.innerHTML = icons.maximize('w-3.5 h-3.5');
      }
      if (labelContainer) labelContainer.textContent = 'Tela Cheia';
      btnFullscreen.setAttribute('title', 'Entrar em Tela Cheia');
      btnFullscreen.setAttribute('aria-label', 'Entrar em Tela Cheia');
      btnFullscreen.classList.remove('bg-cyan-950/60', 'border-cyan-500/50', 'text-cyan-300');
      btnFullscreen.classList.add('bg-slate-800');
    }
  }

  function setupPwaAndFullscreen() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        toggleFullscreen();
      });
    }

    const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    fsEvents.forEach((evt) => {
      document.addEventListener(evt, updateFullscreenUI);
    });

    const btnInstall = document.getElementById('btn-install');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (btnInstall) {
        btnInstall.classList.remove('hidden');
        const iconContainer = document.getElementById('btnInstallIcon');
        if (iconContainer && global.CbEth.Icons && typeof global.CbEth.Icons.download === 'function') {
          iconContainer.innerHTML = global.CbEth.Icons.download('w-3.5 h-3.5');
        }
      }
    });

    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          btnInstall.classList.add('hidden');
        }
        deferredInstallPrompt = null;
      });
    }

    window.addEventListener('appinstalled', () => {
      if (btnInstall) btnInstall.classList.add('hidden');
      deferredInstallPrompt = null;
    });

    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Falha no registro do Service Worker:', err);
      });
    }

    updateFullscreenUI();
  }

  function init() {
    initIcons();
    if (global.CbEth.Charts) {
      global.CbEth.Charts.initCharts('chart-balance', 'chart-market');
    }
    hydrateInitialSnapshot();
    setupEvents();
    setupPwaAndFullscreen();
    loadData(false);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  const App = {
    state,
    init,
    loadData,
    switchTimeframe,
    calculateMetrics,
    filterTransactionsByTimeframe,
    renderKpis,
    renderLedger,
    copyToClipboard,
    formatCurrency,
    formatSignedCurrency,
    formatCrypto,
    toggleFullscreen,
    isFullscreenActive,
    setupPwaAndFullscreen
  };

  global.CbEth.App = App;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
  }
})(typeof window !== 'undefined' ? window : globalThis);
