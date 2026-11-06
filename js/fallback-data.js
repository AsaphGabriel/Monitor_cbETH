(function (global) {
  'use strict';

  global.CbEth = global.CbEth || {};

  const CANONICAL_WALLET = '0xc4cfde467bc76d0d6df365584648371b1954b154';
  const CANONICAL_LAST_SYNCED_BLOCK = 53602055;

  const CANONICAL_POSITION = {
    address: CANONICAL_WALLET,
    network: 'Base',
    balanceCbEth: 0.036161,
    balanceEthGas: 0.000236,
    spotCbEthUsd: 2542.42,
    spotEthUsd: 2230.93,
    exchangeRate: 1.13962,
    protocolExchangeRate: 1.14344,
    rateUsdBrl: 5.4687,
    patrimonioCbEthEth: 0.041210,
    patrimonioCbEthUsd: 91.94,
    patrimonioCbEthBrl: 502.79,
    patrimonioTotalUsd: 92.47,
    patrimonioTotalBrl: 505.69
  };

  const CANONICAL_TRANSACTIONS = [
    {
      hash: '0x2fd9b33a75bb78b3fe0b2d3989c9ee09971912957fbb3c70f6120e7d5830eb99',
      blockNumber: 50840112,
      timestamp: '2026-09-01 15:49:19',
      type: 'in',
      amountCbEth: 0.00877126,
      priceUsd: 2788.55,
      totalUsd: 24.46,
      entryExchangeRate: 1.13810
    },
    {
      hash: '0xb5d2d0b5ff8512e9b0d62a342416ee3c2ef3be5045479cb2be4aa1796ca8ef8d',
      blockNumber: 51412540,
      timestamp: '2026-09-14 21:41:01',
      type: 'in',
      amountCbEth: 0.00512007,
      priceUsd: 2900.99,
      totalUsd: 14.85,
      entryExchangeRate: 1.13934
    },
    {
      hash: '0x4a9d7bdfaa373d523624e7561cf05db69fa7f4f6b57ae1ec9b8a07c3fb3c6b25',
      blockNumber: 52050210,
      timestamp: '2026-09-29 15:45:05',
      type: 'in',
      amountCbEth: 0.00668956,
      priceUsd: 3059.08,
      totalUsd: 20.46,
      entryExchangeRate: 1.14003
    },
    {
      hash: '0x89244b9b29dfdd97d00a8f8da97850785e5ca1d8898b2b1d31ec526796faf8f4',
      blockNumber: 53110937,
      timestamp: '2026-10-26 10:40:21',
      type: 'in',
      amountCbEth: 0.00549525,
      priceUsd: 2663.31,
      totalUsd: 14.64,
      entryExchangeRate: 1.14212
    },
    {
      hash: '0x688291461a746fb348a520ec1ccfe59e6c8ea5d6135792320c274f8c3dff0477',
      blockNumber: 53602055,
      timestamp: '2026-11-05 20:33:06',
      type: 'in',
      amountCbEth: 0.01008449,
      priceUsd: 2566.92,
      totalUsd: 25.89,
      entryExchangeRate: 1.14344
    }
  ];

  const CANONICAL_SERIES_30D = [
    { date: '2026-10-07', priceEthUsd: 2573.64, priceCbEthUsd: 2934.22, exchangeRate: 1.14011 },
    { date: '2026-10-08', priceEthUsd: 2477.21, priceCbEthUsd: 2826.74, exchangeRate: 1.14110 },
    { date: '2026-10-09', priceEthUsd: 2487.76, priceCbEthUsd: 2840.23, exchangeRate: 1.14168 },
    { date: '2026-10-10', priceEthUsd: 2504.20, priceCbEthUsd: 2858.54, exchangeRate: 1.14150 },
    { date: '2026-10-11', priceEthUsd: 2532.82, priceCbEthUsd: 2891.79, exchangeRate: 1.14173 },
    { date: '2026-10-12', priceEthUsd: 2463.16, priceCbEthUsd: 2811.39, exchangeRate: 1.14138 },
    { date: '2026-10-13', priceEthUsd: 2497.42, priceCbEthUsd: 2852.49, exchangeRate: 1.14218 },
    { date: '2026-10-14', priceEthUsd: 2418.21, priceCbEthUsd: 2758.70, exchangeRate: 1.14080 },
    { date: '2026-10-15', priceEthUsd: 2437.08, priceCbEthUsd: 2783.87, exchangeRate: 1.14230 },
    { date: '2026-10-16', priceEthUsd: 2421.85, priceCbEthUsd: 2765.94, exchangeRate: 1.14208 },
    { date: '2026-10-17', priceEthUsd: 2391.98, priceCbEthUsd: 2733.10, exchangeRate: 1.14261 },
    { date: '2026-10-18', priceEthUsd: 2398.55, priceCbEthUsd: 2729.64, exchangeRate: 1.13804 },
    { date: '2026-10-19', priceEthUsd: 2405.56, priceCbEthUsd: 2747.35, exchangeRate: 1.14208 },
    { date: '2026-10-20', priceEthUsd: 2445.48, priceCbEthUsd: 2793.99, exchangeRate: 1.14251 },
    { date: '2026-10-21', priceEthUsd: 2477.19, priceCbEthUsd: 2831.17, exchangeRate: 1.14290 },
    { date: '2026-10-22', priceEthUsd: 2382.58, priceCbEthUsd: 2721.60, exchangeRate: 1.14229 },
    { date: '2026-10-23', priceEthUsd: 2376.02, priceCbEthUsd: 2713.04, exchangeRate: 1.14184 },
    { date: '2026-10-24', priceEthUsd: 2341.66, priceCbEthUsd: 2674.41, exchangeRate: 1.14210 },
    { date: '2026-10-25', priceEthUsd: 2334.46, priceCbEthUsd: 2667.17, exchangeRate: 1.14252 },
    { date: '2026-10-26', priceEthUsd: 2310.31, priceCbEthUsd: 2638.65, exchangeRate: 1.14212 },
    { date: '2026-10-27', priceEthUsd: 2344.69, priceCbEthUsd: 2680.50, exchangeRate: 1.14322 },
    { date: '2026-10-28', priceEthUsd: 2359.27, priceCbEthUsd: 2695.96, exchangeRate: 1.14271 },
    { date: '2026-10-29', priceEthUsd: 2266.61, priceCbEthUsd: 2587.42, exchangeRate: 1.14153 },
    { date: '2026-10-30', priceEthUsd: 2240.34, priceCbEthUsd: 2553.61, exchangeRate: 1.13983 },
    { date: '2026-10-31', priceEthUsd: 2254.26, priceCbEthUsd: 2572.58, exchangeRate: 1.14121 },
    { date: '2026-11-01', priceEthUsd: 2265.45, priceCbEthUsd: 2590.28, exchangeRate: 1.14338 },
    { date: '2026-11-02', priceEthUsd: 2249.11, priceCbEthUsd: 2570.12, exchangeRate: 1.14273 },
    { date: '2026-11-03', priceEthUsd: 2288.99, priceCbEthUsd: 2617.24, exchangeRate: 1.14340 },
    { date: '2026-11-04', priceEthUsd: 2423.22, priceCbEthUsd: 2769.69, exchangeRate: 1.14298 },
    { date: '2026-11-05', priceEthUsd: 2230.93, priceCbEthUsd: 2542.42, exchangeRate: 1.13962 }
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

  function generate24hSeries(baseCbEth, baseEth, baseEr, anchorDateStr = '2026-11-05') {
    const hours = 24;
    const series = [];
    const anchorMs = Date.parse(anchorDateStr + 'T23:00:00Z');
    const nowEpoch = Math.floor((isNaN(anchorMs) ? Date.now() : anchorMs) / 1000);
    const startEr = Number((baseEr - 0.00010).toFixed(5));

    for (let h = 0; h < hours; h++) {
      const offsetSeconds = (hours - 1 - h) * 3600;
      const pointEpoch = nowEpoch - offsetSeconds;
      const d = new Date(pointEpoch * 1000);
      const hh = String(d.getUTCHours()).padStart(2, '0') + ':00';
      const progress = h / (hours - 1);
      const wave = h === hours - 1 ? 0 : Math.sin((h / hours) * Math.PI * 2) * 0.0035;
      const er = Number((startEr + progress * (baseEr - startEr)).toFixed(5));
      const priceEth = Number((baseEth * (1 + wave)).toFixed(2));
      const priceCbEth = h === hours - 1
        ? Number(baseCbEth.toFixed(2))
        : Number((priceEth * er).toFixed(2));

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

  function generateExtendedSeries(daysCount, startEr, endEr, prng, anchorStartDateStr = '2026-10-07') {
    const series = [];
    const baseDate = new Date(anchorStartDateStr + 'T12:00:00Z');

    for (let d = daysCount; d > 0; d--) {
      const ptDate = new Date(baseDate.getTime() - d * 86400000);
      const dateStr = ptDate.toISOString().substring(0, 10);
      const progress = (daysCount - d) / daysCount;
      const noise = (prng() - 0.5) * 45;
      const ethBase = 2360 + Math.sin(progress * Math.PI) * 240 + noise;
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

    const firstPoint = base30d[0];
    const lastPoint = base30d[base30d.length - 1];

    if (tf === '24h') {
      return generate24hSeries(lastPoint.priceCbEthUsd, lastPoint.priceEthUsd, lastPoint.exchangeRate, lastPoint.date);
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
      const prior60 = generateExtendedSeries(60, 1.1345, firstPoint.exchangeRate, prng, firstPoint.date);
      return prior60.concat(base30d);
    }
    if (tf === 'all') {
      const prior150 = generateExtendedSeries(150, 1.1255, firstPoint.exchangeRate, prng, firstPoint.date);
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
          spotCbEthUsd: CANONICAL_POSITION.spotCbEthUsd,
          spotEthUsd: CANONICAL_POSITION.spotEthUsd,
          exchangeRate: CANONICAL_POSITION.exchangeRate,
          protocolExchangeRate: CANONICAL_POSITION.protocolExchangeRate,
          rateUsdBrl: CANONICAL_POSITION.rateUsdBrl,
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
    const anchorLastDate = CANONICAL_SERIES_30D[CANONICAL_SERIES_30D.length - 1].date;
    const baseEpoch = Math.floor(Date.parse(anchorLastDate + 'T12:00:00Z') / 1000);

    for (let i = 0; i < txCount; i++) {
      const amount = Number((0.003 + prng() * 0.012).toFixed(6));
      const priceUsd = Number((2520 + prng() * 380).toFixed(2));
      const totalUsd = Number((amount * priceUsd).toFixed(2));
      cumulativeBalance = Number((cumulativeBalance + amount).toFixed(6));

      let txHash = '0x';
      for (let h = 0; h < 8; h++) {
        txHash += Math.floor(prng() * 0xffffffff).toString(16).padStart(8, '0');
      }

      const daysAgo = (txCount - i) * 6 + Math.floor(prng() * 3);
      const txEpoch = baseEpoch - daysAgo * 86400;
      const dateObj = new Date(txEpoch * 1000);
      const dateStr = dateObj.toISOString().replace('T', ' ').substring(0, 19);
      const entryEr = Number((1.1430 - daysAgo * 0.000095).toFixed(5));

      transactions.push({
        hash: txHash.substring(0, 66),
        timestamp: dateStr,
        type: 'in',
        amountCbEth: amount,
        priceUsd: priceUsd,
        totalUsd: totalUsd,
        entryExchangeRate: entryEr
      });
    }

    const spotCbEth = CANONICAL_POSITION.spotCbEthUsd;
    const spotEth = CANONICAL_POSITION.spotEthUsd;
    const exchangeRate = CANONICAL_POSITION.exchangeRate;
    const protocolExchangeRate = CANONICAL_POSITION.protocolExchangeRate;
    const rateUsdBrl = CANONICAL_POSITION.rateUsdBrl;
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
      protocolExchangeRate: protocolExchangeRate,
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
    CANONICAL_LAST_SYNCED_BLOCK,
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
