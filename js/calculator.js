(function (global) {
  'use strict';

  global.CbEth = global.CbEth || {};

  function safeDivide(numerator, denominator, fallback = 0.0) {
    if (!denominator || isNaN(denominator) || !isFinite(denominator) || denominator === 0) {
      return fallback;
    }
    const res = numerator / denominator;
    return isFinite(res) && !isNaN(res) ? res : fallback;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function isEntryTransaction(tx) {
    if (!tx) return false;
    const tType = String(tx.type || '').toLowerCase().trim();
    return !tType || tType === 'in' || tType === 'entrada' || tType === 'compra' || tType === 'buy';
  }

  function calculateDca(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return 0.0;
    }

    let totalQty = 0.0;
    let totalSpend = 0.0;

    for (const tx of transactions) {
      if (!tx) continue;
      if (isEntryTransaction(tx) && typeof tx.amountCbEth === 'number' && tx.amountCbEth > 0) {
        const qty = tx.amountCbEth;
        let spend = 0.0;
        if (typeof tx.totalUsd === 'number' && tx.totalUsd > 0) {
          spend = tx.totalUsd;
        } else if (typeof tx.priceUsd === 'number' && tx.priceUsd > 0) {
          spend = qty * tx.priceUsd;
        }
        totalQty += qty;
        totalSpend += spend;
      }
    }

    if (totalQty <= 0) {
      return 0.0;
    }

    return safeDivide(totalSpend, totalQty, 0.0);
  }

  function calculateEntryExchangeRate(transactions, fallbackEr = 1.14019) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return fallbackEr;
    }

    let totalQty = 0.0;
    let weightedErSum = 0.0;
    const nowMs = Date.now();
    const dailyRateAccrual = 0.0310 / 365;

    for (const tx of transactions) {
      if (!tx || !isEntryTransaction(tx)) continue;
      const qty = Number(tx.amountCbEth) || 0.0;
      if (qty <= 0) continue;

      let txEr = Number(tx.entryExchangeRate) || 0.0;
      if (txEr <= 0) {
        const tsStr = String(tx.timestamp || '').trim();
        const txMs = tsStr ? Date.parse(tsStr.replace(' ', 'T') + (tsStr.includes('Z') ? '' : 'Z')) : NaN;
        if (!isNaN(txMs) && txMs < nowMs) {
          const daysHeld = (nowMs - txMs) / 86400000;
          txEr = Math.max(1.0, fallbackEr * (1 - daysHeld * dailyRateAccrual));
        } else {
          txEr = fallbackEr;
        }
      }

      totalQty += qty;
      weightedErSum += qty * txEr;
    }

    if (totalQty <= 0) {
      return fallbackEr;
    }

    return safeDivide(weightedErSum, totalQty, fallbackEr);
  }

  function calculatePeriodAveragePrice(series, spotFallback = 0.0) {
    if (!Array.isArray(series) || series.length === 0) {
      return spotFallback;
    }

    let sum = 0.0;
    let count = 0;

    for (const pt of series) {
      if (!pt) continue;
      const price = pt.priceCbEthUsd ?? pt.price ?? pt.close ?? pt.val;
      if (typeof price === 'number' && isFinite(price) && price > 0) {
        sum += price;
        count++;
      }
    }

    if (count === 0) {
      return spotFallback;
    }

    return sum / count;
  }

  function calculatePnl(spotPrice, dca, balance) {
    const s = Number(spotPrice) || 0.0;
    const d = Number(dca) || 0.0;
    const b = Number(balance) || 0.0;

    if (b <= 0 || s <= 0) {
      return { pnlUsd: 0.0, pnlPercent: 0.0 };
    }

    const pnlUsd = (s - d) * b;
    const pnlPercent = d > 0 ? ((s - d) / d) * 100 : 0.0;

    return {
      pnlUsd: isFinite(pnlUsd) ? pnlUsd : 0.0,
      pnlPercent: isFinite(pnlPercent) ? pnlPercent : 0.0
    };
  }

  function decomposePnl(spotEr, initEr, spotPrice, initPrice, balance, exchangeRateUsdBrl, spotEthOverride = null) {
    const sEr = Number(spotEr) > 0 ? Number(spotEr) : 1.14344;
    const iEr = Number(initEr) > 0 ? Number(initEr) : sEr;
    const sPrice = Number(spotPrice) || 0.0;
    const iPrice = Number(initPrice) > 0 ? Number(initPrice) : sPrice;
    const bal = Number(balance) || 0.0;
    const fx = Number(exchangeRateUsdBrl) > 0 ? Number(exchangeRateUsdBrl) : 5.4687;

    if (bal <= 0 || sPrice <= 0) {
      return {
        stakingYieldEth: 0.0,
        stakingYieldUsd: 0.0,
        stakingYieldBrl: 0.0,
        lucroStakingGarantidoBrl: 0.0,
        marketChangeUsd: 0.0,
        marketChangeBrl: 0.0,
        netResultUsd: 0.0,
        netResultBrl: 0.0,
        status: 'Lucro Consolidado'
      };
    }

    const totalPnlUsd = (sPrice - iPrice) * bal;
    const totalPnlBrl = totalPnlUsd * fx;

    const rendAcum = Math.max(0, sEr - iEr);
    const stakingYieldEth = bal * rendAcum;
    const ethSpotUsd = (typeof spotEthOverride === 'number' && spotEthOverride > 0)
      ? spotEthOverride
      : (sEr > 0 ? sPrice / sEr : 0.0);

    const stakingYieldUsd = stakingYieldEth * ethSpotUsd;
    const stakingYieldBrl = stakingYieldUsd * fx;
    const lucroStakingGarantidoBrl = stakingYieldBrl;

    const marketChangeUsd = totalPnlUsd - stakingYieldUsd;
    const marketChangeBrl = marketChangeUsd * fx;

    const netResultUsd = totalPnlUsd;
    const netResultBrl = totalPnlBrl;
    const status = netResultUsd >= 0 ? 'Lucro Consolidado' : 'Em Recuperação (Staking Ativo)';

    return {
      stakingYieldEth: isFinite(stakingYieldEth) ? stakingYieldEth : 0.0,
      stakingYieldUsd: isFinite(stakingYieldUsd) ? stakingYieldUsd : 0.0,
      stakingYieldBrl: isFinite(stakingYieldBrl) ? stakingYieldBrl : 0.0,
      lucroStakingGarantidoBrl: isFinite(lucroStakingGarantidoBrl) ? lucroStakingGarantidoBrl : 0.0,
      marketChangeUsd: isFinite(marketChangeUsd) ? marketChangeUsd : 0.0,
      marketChangeBrl: isFinite(marketChangeBrl) ? marketChangeBrl : 0.0,
      netResultUsd: isFinite(netResultUsd) ? netResultUsd : 0.0,
      netResultBrl: isFinite(netResultBrl) ? netResultBrl : 0.0,
      status
    };
  }

  function calculateStakingProjections(balance, spotPriceUsd, rateUsdBrl) {
    const b = Number(balance) || 0.0;
    const p = Number(spotPriceUsd) || 0.0;
    const r = Number(rateUsdBrl) || 5.4687;
    const apy = 0.0310;

    const patUsd = b * p;
    const patBrl = patUsd * r;

    const annualUsd = patUsd * apy;
    const annualBrl = patBrl * apy;

    const monthlyUsd = annualUsd / 12;
    const monthlyBrl = annualBrl / 12;

    const dailyUsd = annualUsd / 365;
    const dailyBrl = annualBrl / 365;

    return {
      annualUsd: isFinite(annualUsd) ? annualUsd : 0.0,
      annualBrl: isFinite(annualBrl) ? annualBrl : 0.0,
      monthlyUsd: isFinite(monthlyUsd) ? monthlyUsd : 0.0,
      monthlyBrl: isFinite(monthlyBrl) ? monthlyBrl : 0.0,
      dailyUsd: isFinite(dailyUsd) ? dailyUsd : 0.0,
      dailyBrl: isFinite(dailyBrl) ? dailyBrl : 0.0
    };
  }

  function calculateThermometer(spotEth, avgEthPeriod, spotEr, maxErPeriod) {
    const sEth = Number(spotEth) || 0.0;
    const aEth = Number(avgEthPeriod) || 0.0;
    const sEr = Number(spotEr) || 0.0;
    const mEr = Number(maxErPeriod) || 0.0;

    const drawdownEth = aEth > 0 ? (sEth - aEth) / aEth : 0.0;
    const desagioCbEth = mEr > 0 ? (sEr - mEr) / mEr : 0.0;

    const ptsDD = Math.min(Math.max(-drawdownEth * 400, 0), 60);
    const ptsStk = 30;
    const ptsBase = 10;
    const rawScore = Math.round(ptsBase + ptsDD + ptsStk);
    const score = clamp(rawScore, 40, 100);

    let signal = 'ZONA NEUTRA / FAVORÁVEL';
    if (drawdownEth <= -0.05) {
      signal = 'OPORTUNIDADE DE APORTE';
    } else if (drawdownEth >= 0.05) {
      signal = 'CAUTELA / AGUARDAR';
    } else if (drawdownEth <= 0.00) {
      signal = 'ZONA NEUTRA / FAVORÁVEL';
    } else {
      signal = 'CAUTELA / AGUARDAR';
    }

    return {
      drawdownEth: isFinite(drawdownEth) ? drawdownEth : 0.0,
      desagioCbEth: isFinite(desagioCbEth) ? desagioCbEth : 0.0,
      score,
      signal
    };
  }

  const Calculator = {
    safeDivide,
    clamp,
    isEntryTransaction,
    calculateDca,
    calculateEntryExchangeRate,
    calculatePeriodAveragePrice,
    calculatePnl,
    decomposePnl,
    calculateStakingProjections,
    calculateThermometer
  };

  global.CbEth.Calculator = Calculator;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Calculator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
