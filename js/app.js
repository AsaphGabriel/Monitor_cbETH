(function (global) {
  'use strict';

  global.CbEth = global.CbEth || {};

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
    return prefix + num.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatCrypto(val, symbol = 'cbETH', decimals = 6) {
    const num = Number(val) || 0.0;
    return num.toFixed(decimals) + ' ' + symbol;
  }

  function filterTransactionsByTimeframe(transactions, timeframe) {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];
    if (timeframe === 'all' || timeframe === '90d') return transactions.slice();

    const nowEpoch = 1792065600; // 15/10/2026 12:00:00 UTC
    let days = 30;
    if (timeframe === '24h') days = 1;
    else if (timeframe === '7d') days = 7;
    else if (timeframe === '14d') days = 14;
    else if (timeframe === '30d') days = 30;

    const cutoffEpoch = nowEpoch - days * 86400;

    return transactions.filter(tx => {
      if (!tx.timestamp) return true;
      const txEpoch = Math.floor(new Date(tx.timestamp.replace(' ', 'T') + 'Z').getTime() / 1000);
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
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
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

    const decomposed = calc.decomposePnl(
      pos.exchangeRate,
      1.0,
      pos.spotCbEthUsd,
      avgPricePeriodUsd,
      pos.balanceCbEth,
      pos.rateUsdBrl
    );

    const projections = calc.calculateStakingProjections(
      pos.balanceCbEth,
      pos.spotCbEthUsd,
      pos.rateUsdBrl
    );

    const ethSeries = series.map(p => ({ price: p.priceEthUsd }));
    const avgEth = calc.calculatePeriodAveragePrice(ethSeries, pos.spotEthUsd);
    const maxEr = series.length > 0
      ? Math.max(...series.map(p => p.exchangeRate || 1.14215), 1.14215)
      : 1.14215;

    const thermometer = calc.calculateThermometer(pos.spotEthUsd, avgEth, pos.exchangeRate, maxEr);

    return {
      dcaUsd,
      avgPricePeriodUsd,
      pnl,
      decomposed,
      projections,
      thermometer
    };
  }

  function renderKpis(data, metrics, currency) {
    if (!data || !metrics) return;
    const pos = data.position;
    const mult = currency === 'BRL' ? pos.rateUsdBrl : 1.0;

    // Card 1: Patrimônio Total
    const elPatTotal = document.getElementById('cardPatrimonioTotal') || document.getElementById('patrimonio-total');
    if (elPatTotal) {
      const val = (pos.patrimonioTotalUsd || (pos.balanceCbEth * pos.spotCbEthUsd)) * mult;
      elPatTotal.textContent = formatCurrency(val, currency, 2);
    }
    const elPatSub = document.getElementById('cardPatrimonioSubtitle');
    if (elPatSub) {
      elPatSub.textContent = `cbETH (${pos.balanceCbEth.toFixed(6)}) + Gas ETH (${pos.balanceEthGas.toFixed(6)})`;
    }

    // Card 2: DCA & Média do Período
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

    // Card 3: Exchange Rate
    const elEr = document.getElementById('cardExchangeRate') || document.getElementById('exchange-rate');
    if (elEr) {
      elEr.textContent = pos.exchangeRate.toFixed(5);
    }

    // Card 4: Staking Yield
    const elYield = document.getElementById('cardStakingYield') || document.getElementById('staking-yield');
    if (elYield) {
      elYield.textContent = `+${metrics.decomposed.stakingYieldEth.toFixed(6)} ETH`;
    }
    const elYieldFiat = document.getElementById('cardStakingYieldFiat');
    if (elYieldFiat) {
      const yieldFiat = (metrics.decomposed.stakingYieldUsd || 0) * mult;
      elYieldFiat.textContent = `≈ ${formatCurrency(yieldFiat, currency, 2)}`;
    }

    // Painel 1: P&L
    const elPnlMonetary = document.getElementById('pnlMonetary') || document.getElementById('pnl-monetary');
    const elPnlPercent = document.getElementById('pnlPercent') || document.getElementById('pnl-percent');
    const elPnlBadge = document.getElementById('pnlBadge') || document.getElementById('pnl-badge');
    const elPnlStaking = document.getElementById('pnlStakingYield');
    const elPnlMarket = document.getElementById('pnlMarketChange');
    const elPanelPnl = document.getElementById('panelPnl');

    if (elPnlMonetary) {
      const pnlMon = metrics.pnl.pnlUsd * mult;
      const sign = pnlMon >= 0 ? '+' : '';
      elPnlMonetary.textContent = sign + formatCurrency(pnlMon, currency, 2);
      elPnlMonetary.className = `text-2xl font-extrabold font-mono ${pnlMon >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
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
      elPnlStaking.textContent = `+${formatCurrency(stVal, currency, 2)}`;
    }
    if (elPnlMarket) {
      const mktVal = (metrics.decomposed.marketChangeUsd || 0) * mult;
      const sign = mktVal >= 0 ? '+' : '';
      elPnlMarket.textContent = sign + formatCurrency(mktVal, currency, 2);
      elPnlMarket.className = `font-bold ${mktVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    // Painel 2: Staking & APY
    const elApy = document.getElementById('stakingApy');
    if (elApy) elApy.textContent = '3.10%';
    const elDaily = document.getElementById('stakingDaily');
    const elMonthly = document.getElementById('stakingMonthly');
    const elAnnual = document.getElementById('stakingAnnual');
    if (elDaily) {
      const val = (currency === 'BRL' ? metrics.projections.dailyBrl : metrics.projections.dailyUsd);
      elDaily.textContent = `+${formatCurrency(val, currency, 2)}`;
    }
    if (elMonthly) {
      const val = (currency === 'BRL' ? metrics.projections.monthlyBrl : metrics.projections.monthlyUsd);
      elMonthly.textContent = `+${formatCurrency(val, currency, 2)}`;
    }
    if (elAnnual) {
      const val = (currency === 'BRL' ? metrics.projections.annualBrl : metrics.projections.annualUsd);
      elAnnual.textContent = `+${formatCurrency(val, currency, 2)}`;
    }

    // Painel 3: Termômetro Decisório
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

    if (sorted.length === 0) {
      const tr = document.createElement('tr');
      tr.id = 'empty-ledger-row';
      tr.innerHTML = `<td colspan="6" class="text-center py-6 text-slate-400 font-mono text-xs">Nenhuma movimentação no período selecionado.</td>`;
      tbody.appendChild(tr);
      return;
    }

    const icons = global.CbEth.Icons;
    const rateUsdBrl = data.position?.rateUsdBrl || 5.0980;
    const mult = currency === 'BRL' ? rateUsdBrl : 1.0;

    for (const tx of sorted) {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/40 transition border-b border-slate-800/40';

      const shortHash = (tx.hash && tx.hash.length >= 10)
        ? tx.hash.substring(0, 6) + '...' + tx.hash.substring(tx.hash.length - 4)
        : tx.hash || '';

      const isEntry = tx.type === 'in' || tx.type === 'entrada' || tx.type === 'compra' || tx.type === 'buy';
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
    const btnUsd = document.getElementById('btnChartModeUsd') || document.querySelector('[data-chart-mode="USD"]');
    const btnEth = document.getElementById('btnChartModeEth') || document.querySelector('[data-chart-mode="ETH"]');

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

    if (btnUpdate) {
      btnUpdate.setAttribute('disabled', 'true');
      const textSpan = btnUpdate.querySelector('span:not(#btnUpdateIcon)') || btnUpdate;
      if (textSpan) textSpan.textContent = 'Buscando...';
    }

    try {
      const data = await api.loadWalletData(state.address, state.timeframe, forceRefresh);
      state.data = data;
      state.metrics = calculateMetrics(data, state.currency);

      renderKpis(state.data, state.metrics, state.currency);
      renderLedger(state.data, state.timeframe, state.sortKey, state.sortAsc, state.currency);

      const charts = global.CbEth.Charts;
      if (charts) {
        charts.updateBalanceChart(
          data.historicalSeries,
          state.currency,
          data.position.rateUsdBrl,
          data.position.balanceCbEth
        );
        charts.updateMarketChart(
          data.historicalSeries,
          state.chartMode,
          state.currency,
          data.position.rateUsdBrl,
          state.metrics?.dcaUsd
        );
      }
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
        state.timeframe = tf;
        updateTimeframeButtons(tf);
        loadData(false);
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
          const charts = global.CbEth.Charts;
          if (charts) {
            charts.updateBalanceChart(
              state.data.historicalSeries,
              'USD',
              state.data.position.rateUsdBrl,
              state.data.position.balanceCbEth
            );
            charts.updateMarketChart(
              state.data.historicalSeries,
              state.chartMode,
              'USD',
              state.data.position.rateUsdBrl,
              state.metrics.dcaUsd
            );
          }
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
          const charts = global.CbEth.Charts;
          if (charts) {
            charts.updateBalanceChart(
              state.data.historicalSeries,
              'BRL',
              state.data.position.rateUsdBrl,
              state.data.position.balanceCbEth
            );
            charts.updateMarketChart(
              state.data.historicalSeries,
              state.chartMode,
              'BRL',
              state.data.position.rateUsdBrl,
              state.metrics.dcaUsd
            );
          }
        }
      });
    }

    // 5. Chart 2 Mode Toggle (USD | ETH)
    const btnChartUsd = document.getElementById('btnChartModeUsd') || document.querySelector('[data-chart-mode="USD"]');
    const btnChartEth = document.getElementById('btnChartModeEth') || document.querySelector('[data-chart-mode="ETH"]');

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
            state.metrics?.dcaUsd
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
            state.metrics?.dcaUsd
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
  }

  function init() {
    initIcons();
    if (global.CbEth.Charts) {
      global.CbEth.Charts.initCharts('chart-balance', 'chart-market');
    }
    setupEvents();
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
    renderKpis,
    renderLedger,
    copyToClipboard,
    formatCurrency,
    formatCrypto
  };

  global.CbEth.App = App;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
  }
})(typeof window !== 'undefined' ? window : globalThis);
