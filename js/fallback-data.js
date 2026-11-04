(function (global) {
  'use strict';

  global.CbEth = global.CbEth || {};

  const CANONICAL_WALLET = '0xc4cfde467bc76d0d6df365584648371b1954b154';

  const CANONICAL_POSITION = {
    address: CANONICAL_WALLET,
    network: 'Base',
    balanceCbEth: 0.020581,
    balanceEthGas: 0.000244,
    spotCbEthUsd: 2798.78,
    spotEthUsd: 2450.45,
    exchangeRate: 1.14215,
    rateUsdBrl: 5.0980,
    patrimonioCbEthEth: 0.023506,
    patrimonioCbEthUsd: 57.60,
    patrimonioCbEthBrl: 293.65,
    patrimonioTotalUsd: 58.20,
    patrimonioTotalBrl: 296.70
  };

  const CANONICAL_TRANSACTIONS = [
    {
      hash: '0x2fd9b33a75bb78b3fe0b2d3989c9ee09971912957fbb3c70f6120e7d5830eb99',
      timestamp: '2026-09-01 15:49:19',
      type: 'in',
      amountCbEth: 0.00877126,
      priceUsd: 2788.55,
      totalUsd: 24.46
    },
    {
      hash: '0xb5d2d0b5ff8512e9b0d62a342416ee3c2ef3be5045479cb2be4aa1796ca8ef8d',
      timestamp: '2026-09-14 21:41:01',
      type: 'in',
      amountCbEth: 0.00512007,
      priceUsd: 2900.99,
      totalUsd: 14.85
    },
    {
      hash: '0x4a9d7bdfaa373d523624e7561cf05db69fa7f4f6b57ae1ec9b8a07c3fb3c6b25',
      timestamp: '2026-09-29 15:45:05',
      type: 'in',
      amountCbEth: 0.00668956,
      priceUsd: 3059.08,
      totalUsd: 20.46
    }
  ];

  const CANONICAL_SERIES_30D = [
    { date: '2026-09-16', priceEthUsd: 2400.39, priceCbEthUsd: 2735.31, exchangeRate: 1.13953 },
    { date: '2026-09-17', priceEthUsd: 2432.20, priceCbEthUsd: 2770.48, exchangeRate: 1.13908 },
    { date: '2026-09-18', priceEthUsd: 2514.30, priceCbEthUsd: 2866.27, exchangeRate: 1.13999 },
    { date: '2026-09-19', priceEthUsd: 2643.27, priceCbEthUsd: 3011.54, exchangeRate: 1.13932 },
    { date: '2026-09-20', priceEthUsd: 2573.89, priceCbEthUsd: 2933.66, exchangeRate: 1.13978 },
    { date: '2026-09-21', priceEthUsd: 2716.31, priceCbEthUsd: 3093.03, exchangeRate: 1.13869 },
    { date: '2026-09-22', priceEthUsd: 2738.83, priceCbEthUsd: 3121.64, exchangeRate: 1.13977 },
    { date: '2026-09-23', priceEthUsd: 2731.17, priceCbEthUsd: 3112.86, exchangeRate: 1.13975 },
    { date: '2026-09-24', priceEthUsd: 2636.07, priceCbEthUsd: 3003.17, exchangeRate: 1.13926 },
    { date: '2026-09-25', priceEthUsd: 2711.45, priceCbEthUsd: 3093.60, exchangeRate: 1.14094 },
    { date: '2026-09-26', priceEthUsd: 2687.47, priceCbEthUsd: 3063.65, exchangeRate: 1.13997 },
    { date: '2026-09-27', priceEthUsd: 2712.25, priceCbEthUsd: 3094.58, exchangeRate: 1.14096 },
    { date: '2026-09-28', priceEthUsd: 2648.13, priceCbEthUsd: 3018.89, exchangeRate: 1.14001 },
    { date: '2026-09-29', priceEthUsd: 2713.22, priceCbEthUsd: 3093.16, exchangeRate: 1.14003 },
    { date: '2026-09-30', priceEthUsd: 2692.04, priceCbEthUsd: 3071.00, exchangeRate: 1.14077 },
    { date: '2026-10-01', priceEthUsd: 2687.06, priceCbEthUsd: 3068.36, exchangeRate: 1.14190 },
    { date: '2026-10-02', priceEthUsd: 2743.27, priceCbEthUsd: 3129.42, exchangeRate: 1.14076 },
    { date: '2026-10-03', priceEthUsd: 2682.48, priceCbEthUsd: 3059.21, exchangeRate: 1.14044 },
    { date: '2026-10-04', priceEthUsd: 2705.38, priceCbEthUsd: 3086.90, exchangeRate: 1.14102 },
    { date: '2026-10-05', priceEthUsd: 2719.10, priceCbEthUsd: 3100.67, exchangeRate: 1.14033 },
    { date: '2026-10-06', priceEthUsd: 2714.31, priceCbEthUsd: 3095.39, exchangeRate: 1.14040 },
    { date: '2026-10-07', priceEthUsd: 2587.56, priceCbEthUsd: 2955.22, exchangeRate: 1.14209 },
    { date: '2026-10-08', priceEthUsd: 2555.60, priceCbEthUsd: 2915.47, exchangeRate: 1.14082 },
    { date: '2026-10-09', priceEthUsd: 2498.85, priceCbEthUsd: 2852.33, exchangeRate: 1.14146 },
    { date: '2026-10-10', priceEthUsd: 2492.13, priceCbEthUsd: 2845.79, exchangeRate: 1.14191 },
    { date: '2026-10-11', priceEthUsd: 2499.39, priceCbEthUsd: 2852.79, exchangeRate: 1.14140 },
    { date: '2026-10-12', priceEthUsd: 2554.13, priceCbEthUsd: 2916.21, exchangeRate: 1.14176 },
    { date: '2026-10-13', priceEthUsd: 2504.08, priceCbEthUsd: 2861.72, exchangeRate: 1.14282 },
    { date: '2026-10-14', priceEthUsd: 2498.51, priceCbEthUsd: 2854.24, exchangeRate: 1.14237 },
    { date: '2026-10-15', priceEthUsd: 2361.27, priceCbEthUsd: 2696.00, exchangeRate: 1.14176 }
  ];

  function hashAddress(address) {
    const str = String(address || '').toLowerCase().trim();
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createMulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      let t = (s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getCanonicalTransactions() {
    return CANONICAL_TRANSACTIONS.map(tx => Object.assign({}, tx));
  }

  function getCanonicalPosition() {
    return Object.assign({}, CANONICAL_POSITION);
  }

  function generate24hSeries(baseCbEth, baseEth, baseEr) {
    const hours = 24;
    const series = [];
    const nowEpoch = 1792065600; // 15/10/2026 12:00:00 UTC
    for (let h = 0; h < hours; h++) {
      const offsetSeconds = (hours - 1 - h) * 3600;
      const pointEpoch = nowEpoch - offsetSeconds;
      const d = new Date(pointEpoch * 1000);
      const hh = String(d.getUTCHours()).padStart(2, '0') + ':00';
      const wave = Math.sin((h / hours) * Math.PI * 2) * 0.004;
      const priceCbEth = Number((baseCbEth * (1 + wave)).toFixed(2));
      const priceEth = Number((baseEth * (1 + wave * 0.95)).toFixed(2));
      const er = Number((priceCbEth / priceEth).toFixed(5));
      series.push({
        date: hh,
        timestamp: d.toISOString(),
        priceCbEthUsd: priceCbEth,
        priceEthUsd: priceEth,
        exchangeRate: er
      });
    }
    return series;
  }

  function generateExtendedSeries(daysCount, startEr, endEr, prng) {
    const series = [];
    const baseDate = new Date('2026-09-16T12:00:00Z');
    const erStep = (endEr - startEr) / daysCount;

    for (let d = daysCount; d > 0; d--) {
      const ptDate = new Date(baseDate.getTime() - d * 86400000);
      const dateStr = ptDate.toISOString().substring(0, 10);
      const progress = (daysCount - d) / daysCount;
      const noise = (prng() - 0.5) * 40;
      const ethBase = 2200 + progress * 200 + noise;
      const er = Number((startEr + progress * (endEr - startEr)).toFixed(5));
      const cbEthPrice = Number((ethBase * er).toFixed(2));
      series.push({
        date: dateStr,
        priceEthUsd: Number(ethBase.toFixed(2)),
        priceCbEthUsd: cbEthPrice,
        exchangeRate: er
      });
    }
    return series;
  }

  function getHistoricalSeries(timeframe = '30d', address = CANONICAL_WALLET) {
    const tf = (timeframe || '30d').toLowerCase();
    const isCanonical = String(address || '').toLowerCase().trim() === CANONICAL_WALLET.toLowerCase();
    const seed = hashAddress(address);
    const prng = createMulberry32(seed);

    let base30d = CANONICAL_SERIES_30D.map(p => Object.assign({}, p));

    if (!isCanonical) {
      const factor = 0.9 + (seed % 200) / 1000;
      base30d = CANONICAL_SERIES_30D.map(p => ({
        date: p.date,
        priceEthUsd: Number((p.priceEthUsd * factor).toFixed(2)),
        priceCbEthUsd: Number((p.priceCbEthUsd * factor).toFixed(2)),
        exchangeRate: p.exchangeRate
      }));
    }

    const lastPoint = base30d[base30d.length - 1];

    if (tf === '24h') {
      return generate24hSeries(lastPoint.priceCbEthUsd, lastPoint.priceEthUsd, lastPoint.exchangeRate);
    }
    if (tf === '7d') {
      return base30d.slice(-7);
    }
    if (tf === '14d') {
      return base30d.slice(-14);
    }
    if (tf === '30d') {
      return base30d.slice();
    }
    if (tf === '90d') {
      const prior60 = generateExtendedSeries(60, 1.1340, 1.1395, prng);
      return prior60.concat(base30d);
    }
    if (tf === 'all') {
      const prior150 = generateExtendedSeries(150, 1.1240, 1.1395, prng);
      return prior150.concat(base30d);
    }

    return base30d.slice();
  }

  function generateSyntheticWallet(address) {
    const cleanAddr = String(address || '').toLowerCase().trim();

    if (cleanAddr === '0x0000000000000000000000000000000000000000') {
      return {
        position: {
          address: cleanAddr,
          network: 'Base',
          balanceCbEth: 0.0,
          balanceEthGas: 0.0,
          spotCbEthUsd: 2798.78,
          spotEthUsd: 2450.45,
          exchangeRate: 1.14215,
          rateUsdBrl: 5.0980,
          patrimonioCbEthEth: 0.0,
          patrimonioCbEthUsd: 0.0,
          patrimonioCbEthBrl: 0.0,
          patrimonioTotalUsd: 0.0,
          patrimonioTotalBrl: 0.0
        },
        transactions: [],
        series: {
          '24h': getHistoricalSeries('24h', cleanAddr),
          '7d': getHistoricalSeries('7d', cleanAddr),
          '14d': getHistoricalSeries('14d', cleanAddr),
          '30d': getHistoricalSeries('30d', cleanAddr),
          '90d': getHistoricalSeries('90d', cleanAddr),
          'all': getHistoricalSeries('all', cleanAddr)
        }
      };
    }

    const seed = hashAddress(cleanAddr);
    const prng = createMulberry32(seed);

    const txCount = 3 + Math.floor(prng() * 3);
    const transactions = [];
    let cumulativeBalance = 0;
    const baseEpoch = 1792065600;

    for (let i = 0; i < txCount; i++) {
      const amount = Number((0.003 + prng() * 0.012).toFixed(6));
      const priceUsd = Number((2650 + prng() * 380).toFixed(2));
      const totalUsd = Number((amount * priceUsd).toFixed(2));
      cumulativeBalance = Number((cumulativeBalance + amount).toFixed(6));

      let txHash = '0x';
      for (let h = 0; h < 8; h++) {
        txHash += Math.floor(prng() * 0xffffffff).toString(16).padStart(8, '0');
      }

      const daysAgo = (txCount - i) * 8 + Math.floor(prng() * 4);
      const txEpoch = baseEpoch - daysAgo * 86400;
      const dateObj = new Date(txEpoch * 1000);
      const dateStr = dateObj.toISOString().replace('T', ' ').substring(0, 19);

      transactions.push({
        hash: txHash.substring(0, 66),
        timestamp: dateStr,
        type: 'in',
        amountCbEth: amount,
        priceUsd: priceUsd,
        totalUsd: totalUsd
      });
    }

    const spotCbEth = 2798.78;
    const spotEth = 2450.45;
    const exchangeRate = 1.14215;
    const rateUsdBrl = 5.0980;
    const gasEth = Number((0.00015 + prng() * 0.0005).toFixed(6));
    const patEth = Number((cumulativeBalance * exchangeRate).toFixed(6));
    const patUsd = Number((cumulativeBalance * spotCbEth).toFixed(2));
    const patBrl = Number((patUsd * rateUsdBrl).toFixed(2));
    const totalUsd = Number((patUsd + gasEth * spotEth).toFixed(2));
    const totalBrl = Number((totalUsd * rateUsdBrl).toFixed(2));

    const position = {
      address: cleanAddr,
      network: 'Base',
      balanceCbEth: cumulativeBalance,
      balanceEthGas: gasEth,
      spotCbEthUsd: spotCbEth,
      spotEthUsd: spotEth,
      exchangeRate: exchangeRate,
      rateUsdBrl: rateUsdBrl,
      patrimonioCbEthEth: patEth,
      patrimonioCbEthUsd: patUsd,
      patrimonioCbEthBrl: patBrl,
      patrimonioTotalUsd: totalUsd,
      patrimonioTotalBrl: totalBrl
    };

    return {
      position,
      transactions,
      series: {
        '24h': getHistoricalSeries('24h', cleanAddr),
        '7d': getHistoricalSeries('7d', cleanAddr),
        '14d': getHistoricalSeries('14d', cleanAddr),
        '30d': getHistoricalSeries('30d', cleanAddr),
        '90d': getHistoricalSeries('90d', cleanAddr),
        'all': getHistoricalSeries('all', cleanAddr)
      }
    };
  }

  const FallbackData = {
    CANONICAL_WALLET,
    CANONICAL_POSITION,
    CANONICAL_TRANSACTIONS,
    CANONICAL_SERIES_30D,
    hashAddress,
    createMulberry32,
    getCanonicalTransactions,
    getCanonicalPosition,
    getHistoricalSeries,
    generateSyntheticWallet
  };

  global.CbEth.FallbackData = FallbackData;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FallbackData;
  }
})(typeof window !== 'undefined' ? window : globalThis);
