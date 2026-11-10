(function (global) {
  'use strict';

  global.CbEth = global.CbEth || {};

  const CONFIG = {
    BASE_RPC_PRIMARY: 'https://mainnet.base.org',
    BASE_RPC_FAILOVER: 'https://base-rpc.publicnode.com',
    ETHEREUM_RPC: 'https://ethereum-rpc.publicnode.com',
    CBETH_CONTRACT: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    CBETH_L1_CONTRACT: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704',
    USDC_BASE_CONTRACT: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    USDBC_BASE_CONTRACT: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
    DAI_BASE_CONTRACT: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
    WETH_BASE_CONTRACT: '0x4200000000000000000000000000000000000006',
    BALANCE_OF_SELECTOR: '0x70a08231',
    EXCHANGE_RATE_SELECTOR: '0x3ba0b9a9',
    TRANSFER_TOPIC: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    DEFILLAMA_SPOT: 'https://coins.llama.fi/prices/current/coingecko:ethereum,coingecko:coinbase-wrapped-staked-eth',
    DEFILLAMA_CHART_BASE: 'https://coins.llama.fi/chart/coingecko:ethereum,coingecko:coinbase-wrapped-staked-eth',
    AWESOME_API_USD_BRL: 'https://economia.awesomeapi.com.br/last/USD-BRL',
    OPEN_ER_API_USD: 'https://open.er-api.com/v6/latest/USD',
    DEFAULT_USD_BRL: 5.4687,
    CONSERVATIVE_USD_BRL: 5.50,
    REQUEST_TIMEOUT_MS: 3500,
    MAX_LOG_BLOCK_SPAN: 45000
  };

  const STABLECOIN_DECIMALS = {
    [CONFIG.USDC_BASE_CONTRACT]: 6,
    [CONFIG.USDBC_BASE_CONTRACT]: 6,
    [CONFIG.DAI_BASE_CONTRACT]: 18
  };

  const CACHE_TTL_MS = 60000;
  let cachedPrices = null;
  let cachedPricesTimestamp = 0;
  let inflightPricesPromise = null;
  let cachedSeries180d = null;
  let cachedSeries180dTimestamp = 0;
  let inflightSeries180dPromise = null;
  let cachedSeries24h = null;
  let cachedSeries24hTimestamp = 0;
  let inflightSeries24hPromise = null;
  const cachedBalancesByAddr = {};
  const inflightBalancesByAddr = {};
  const cachedTxsByAddr = {};

  function isValidEvmAddress(address) {
    if (typeof address !== 'string') return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  function formatAddress(address, prefixChars = 6, suffixChars = 4) {
    if (!address || typeof address !== 'string') return '';
    const clean = address.trim();
    if (clean.length <= prefixChars + suffixChars) return clean;
    return clean.substring(0, prefixChars) + '...' + clean.substring(clean.length - suffixChars);
  }

  function encodeBalanceOf(address) {
    const clean = String(address || '').toLowerCase().replace(/^0x/, '').padStart(64, '0');
    return CONFIG.BALANCE_OF_SELECTOR + clean;
  }

  function padTopicAddress(address) {
    return '0x' + String(address || '').toLowerCase().replace(/^0x/, '').padStart(64, '0');
  }

  function decodeWeiToEth(hexResult) {
    if (!hexResult || hexResult === '0x' || hexResult === '0x0') {
      return 0.0;
    }
    try {
      const rawBig = BigInt(hexResult);
      return Number(rawBig) / 1e18;
    } catch (_) {
      return 0.0;
    }
  }

  function decodeUnits(hexData, decimals) {
    if (!hexData || hexData === '0x' || hexData === '0x0') return 0.0;
    try {
      const raw = BigInt(hexData);
      if (decimals <= 9) {
        return Number(raw) / Math.pow(10, decimals);
      }
      const scale = BigInt(Math.pow(10, decimals - 8));
      return Number(raw / scale) / 1e8;
    } catch (_) {
      return 0.0;
    }
  }

  async function fetchJsonWithTimeout(url, options = {}, timeoutMs = CONFIG.REQUEST_TIMEOUT_MS) {
    let signal = undefined;
    let timeoutId = undefined;
    if (typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      signal = controller.signal;
    }
    try {
      const response = await fetch(url, Object.assign({}, options, { signal }));
      if (timeoutId) clearTimeout(timeoutId);
      if (!response.ok) {
        return { ok: false, status: response.status, data: null };
      }
      const data = await response.json();
      return { ok: true, status: response.status, data };
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      return { ok: false, status: 0, data: null, error: err };
    }
  }

  async function callRpcOnNodes(method, params, nodesOrder, timeoutMs = CONFIG.REQUEST_TIMEOUT_MS) {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    });

    for (const nodeUrl of nodesOrder) {
      const res = await fetchJsonWithTimeout(
        nodeUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        },
        timeoutMs
      );
      if (res.ok && res.data && !res.data.error && res.data.result !== undefined && res.data.result !== null) {
        return { success: true, result: res.data.result, node: nodeUrl };
      }
    }

    return { success: false, error: 'All RPC nodes failed or timed out' };
  }

  async function callRpc(method, params) {
    const logFirstMethods = ['eth_getLogs', 'eth_getTransactionReceipt', 'eth_blockNumber', 'eth_getBlockByNumber'];
    const nodes = logFirstMethods.includes(method)
      ? [CONFIG.BASE_RPC_FAILOVER, CONFIG.BASE_RPC_PRIMARY]
      : [CONFIG.BASE_RPC_PRIMARY, CONFIG.BASE_RPC_FAILOVER];
    return callRpcOnNodes(method, params, nodes, CONFIG.REQUEST_TIMEOUT_MS);
  }

  function decodeSwapReceiptUsd(receipt, walletAddress, amountCbEth, fallbackCbEthUsd = 0.0, fallbackEthUsd = 0.0) {
    const qty = Math.max(0, Number(amountCbEth) || 0.0);
    const fbPrice = Number(fallbackCbEthUsd) || 0.0;
    const fbEth = Number(fallbackEthUsd) || 0.0;

    if (!receipt || !Array.isArray(receipt.logs) || receipt.logs.length === 0) {
      return qty * fbPrice;
    }

    const walletClean = String(walletAddress || '').toLowerCase().trim();
    const cbEthAddr = CONFIG.CBETH_CONTRACT.toLowerCase();
    const wethAddr = CONFIG.WETH_BASE_CONTRACT.toLowerCase();
    const transferTopic = CONFIG.TRANSFER_TOPIC.toLowerCase();

    const parsedTransfers = [];
    const cbEthEmitters = new Set();
    const cbEthReceivers = new Set();
    let isBuy = false;
    let isSell = false;

    for (const log of receipt.logs) {
      if (!log || !Array.isArray(log.topics) || log.topics.length < 3) continue;
      if (String(log.topics[0] || '').toLowerCase() !== transferTopic) continue;

      const token = String(log.address || '').toLowerCase();
      const from = '0x' + String(log.topics[1] || '').slice(-40).toLowerCase();
      const to = '0x' + String(log.topics[2] || '').slice(-40).toLowerCase();
      const dataHex = log.data || '0x0';

      parsedTransfers.push({ token, from, to, dataHex });

      if (token === cbEthAddr) {
        if (to === walletClean) isBuy = true;
        if (from === walletClean) isSell = true;
        if (from !== walletClean) cbEthEmitters.add(from);
        if (to !== walletClean) cbEthReceivers.add(to);
      }
    }

    // 1. Direct stablecoin flow from/to the wallet itself, or directional pool leg (handles Uniswap V4 Singleton PoolManager)
    let walletStableOut = 0.0;
    let walletStableIn = 0.0;
    const senderStableTotals = {};
    let poolBuyStableIn = 0.0;
    let poolSellStableOut = 0.0;

    for (const tr of parsedTransfers) {
      const dec = STABLECOIN_DECIMALS[tr.token];
      if (dec === undefined) continue;
      const val = decodeUnits(tr.dataHex, dec);
      if (val <= 0) continue;

      if (tr.from === walletClean) walletStableOut += val;
      if (tr.to === walletClean) walletStableIn += val;

      senderStableTotals[tr.from] = (senderStableTotals[tr.from] || 0.0) + val;

      if (cbEthEmitters.has(tr.to) && !cbEthEmitters.has(tr.from)) {
        poolBuyStableIn += val;
      }
      if (cbEthReceivers.has(tr.from) && !cbEthReceivers.has(tr.to)) {
        poolSellStableOut += val;
      }
    }

    if (walletStableOut > 0) return walletStableOut;
    if (walletStableIn > 0) return walletStableIn;
    if (isBuy && poolBuyStableIn > 0) return poolBuyStableIn;
    if (isSell && poolSellStableOut > 0) return poolSellStableOut;
    if (poolBuyStableIn > 0) return poolBuyStableIn;
    if (poolSellStableOut > 0) return poolSellStableOut;

    const maxSenderStable = Object.values(senderStableTotals).reduce((mx, v) => (v > mx ? v : mx), 0.0);
    if (maxSenderStable > 0) return maxSenderStable;

    // 2. WETH leg valuation when swap routed via ETH/WETH without stablecoin hops
    if (fbEth > 0) {
      let walletWethFlow = 0.0;
      let poolWethFlow = 0.0;
      for (const tr of parsedTransfers) {
        if (tr.token !== wethAddr) continue;
        const wethVal = decodeUnits(tr.dataHex, 18);
        if (wethVal <= 0) continue;
        if (tr.from === walletClean || tr.to === walletClean) {
          walletWethFlow += wethVal;
        } else if (isBuy && cbEthEmitters.has(tr.to) && !cbEthEmitters.has(tr.from)) {
          poolWethFlow += wethVal;
        } else if (isSell && cbEthReceivers.has(tr.from) && !cbEthReceivers.has(tr.to)) {
          poolWethFlow += wethVal;
        }
      }
      if (walletWethFlow > 0) return walletWethFlow * fbEth;
      if (poolWethFlow > 0) return poolWethFlow * fbEth;
    }

    return qty * fbPrice;
  }

  async function fetchProtocolExchangeRate() {
    const fallbackEr = global.CbEth?.FallbackData?.CANONICAL_POSITION?.protocolExchangeRate || 1.14344;
    const res = await callRpcOnNodes(
      'eth_call',
      [{ to: CONFIG.CBETH_L1_CONTRACT, data: CONFIG.EXCHANGE_RATE_SELECTOR }, 'latest'],
      [CONFIG.ETHEREUM_RPC],
      2500
    );
    if (res.success && res.result) {
      const rate = decodeWeiToEth(res.result);
      if (rate > 1.0 && rate < 2.0 && isFinite(rate)) {
        return { rate: Number(rate.toFixed(6)), source: 'l1-rpc' };
      }
    }
    return { rate: fallbackEr, source: 'fallback' };
  }

  async function fetchBalances(address, forceRefresh = false) {
    if (!isValidEvmAddress(address)) {
      throw new Error('Endereço EVM inválido. Formato exigido: 0x seguido de 40 caracteres hexadecimais.');
    }

    const cleanAddr = address.toLowerCase().trim();
    const now = Date.now();
    const cached = cachedBalancesByAddr[cleanAddr];
    if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.value;
    }
    if (!forceRefresh && inflightBalancesByAddr[cleanAddr]) {
      return inflightBalancesByAddr[cleanAddr];
    }

    const promise = (async () => {
      try {
        const calldata = encodeBalanceOf(cleanAddr);
        const [cbEthRes, ethRes] = await Promise.all([
          callRpc('eth_call', [{ to: CONFIG.CBETH_CONTRACT, data: calldata }, 'latest']),
          callRpc('eth_getBalance', [cleanAddr, 'latest'])
        ]);

        if (cbEthRes.success && ethRes.success) {
          const balanceCbEth = decodeWeiToEth(cbEthRes.result);
          const balanceEthGas = decodeWeiToEth(ethRes.result);
          const value = {
            balanceCbEth,
            balanceEthGas,
            source: 'rpc',
            rawCbEthWei: cbEthRes.result,
            rawEthWei: ethRes.result
          };
          cachedBalancesByAddr[cleanAddr] = { timestamp: Date.now(), value };
          return value;
        }
      } catch (_) {
        // Fallback
      }

      const fallbackModule = global.CbEth && global.CbEth.FallbackData;
      if (fallbackModule) {
        if (cleanAddr === fallbackModule.CANONICAL_WALLET.toLowerCase()) {
          const pos = fallbackModule.getCanonicalPosition();
          return {
            balanceCbEth: pos.balanceCbEth,
            balanceEthGas: pos.balanceEthGas,
            source: 'fallback'
          };
        }
        const synth = fallbackModule.generateSyntheticWallet(cleanAddr);
        return {
          balanceCbEth: synth.position.balanceCbEth,
          balanceEthGas: synth.position.balanceEthGas,
          source: 'fallback'
        };
      }

      return {
        balanceCbEth: 0.046924,
        balanceEthGas: 0.000231,
        source: 'fallback'
      };
    })();

    inflightBalancesByAddr[cleanAddr] = promise;
    try {
      return await promise;
    } finally {
      delete inflightBalancesByAddr[cleanAddr];
    }
  }

  async function fetchUsdBrlRate() {
    const primary = await fetchJsonWithTimeout(CONFIG.OPEN_ER_API_USD, {}, 2500);
    if (primary.ok && primary.data) {
      const rate = parseFloat(primary.data?.rates?.BRL);
      if (rate > 0 && isFinite(rate)) {
        return { rate, source: 'open.er-api' };
      }
    }

    const secondary = await fetchJsonWithTimeout(CONFIG.AWESOME_API_USD_BRL, {}, 2000);
    if (secondary.ok && secondary.data) {
      const rate = parseFloat(secondary.data?.USDBRL?.bid);
      if (rate > 0 && isFinite(rate)) {
        return { rate, source: 'awesomeapi' };
      }
    }

    return { rate: CONFIG.DEFAULT_USD_BRL, source: 'fallback' };
  }

  async function fetchPrices(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedPrices && (now - cachedPricesTimestamp < CACHE_TTL_MS)) {
      return cachedPrices;
    }
    if (!forceRefresh && inflightPricesPromise) {
      return inflightPricesPromise;
    }

    inflightPricesPromise = (async () => {
      const [spotRes, fx, protoErRes] = await Promise.all([
        fetchJsonWithTimeout(CONFIG.DEFILLAMA_SPOT, {}, CONFIG.REQUEST_TIMEOUT_MS),
        fetchUsdBrlRate(),
        fetchProtocolExchangeRate()
      ]);

      let ethUsd = null;
      let cbEthUsd = null;

      if (spotRes.ok && spotRes.data) {
        const ethPrice = spotRes.data?.coins?.['coingecko:ethereum']?.price;
        const cbethPrice = spotRes.data?.coins?.['coingecko:coinbase-wrapped-staked-eth']?.price;
        if (typeof ethPrice === 'number' && typeof cbethPrice === 'number' && ethPrice > 0 && cbethPrice > 0) {
          ethUsd = ethPrice;
          cbEthUsd = cbethPrice;
        }
      }

      const usdBrl = fx.rate;
      const protocolExchangeRate = protoErRes.rate;
      const doneAt = Date.now();

      if (ethUsd !== null && cbEthUsd !== null) {
        const exchangeRate = Number((cbEthUsd / ethUsd).toFixed(5));
        cachedPrices = {
          cbEthUsd,
          ethUsd,
          usdBrl,
          exchangeRate,
          protocolExchangeRate,
          source: 'api'
        };
        cachedPricesTimestamp = doneAt;
        return cachedPrices;
      }

      const fallbackPos = global.CbEth?.FallbackData?.getCanonicalPosition?.() || {
        spotCbEthUsd: 2344.36,
        spotEthUsd: 2052.45,
        exchangeRate: 1.14222,
        protocolExchangeRate: 1.14374,
        rateUsdBrl: CONFIG.DEFAULT_USD_BRL
      };

      cachedPrices = {
        cbEthUsd: fallbackPos.spotCbEthUsd,
        ethUsd: fallbackPos.spotEthUsd,
        usdBrl: usdBrl || fallbackPos.rateUsdBrl,
        exchangeRate: fallbackPos.exchangeRate,
        protocolExchangeRate: protocolExchangeRate || fallbackPos.protocolExchangeRate || 1.14344,
        source: 'fallback'
      };
      cachedPricesTimestamp = doneAt;
      return cachedPrices;
    })();

    try {
      return await inflightPricesPromise;
    } finally {
      inflightPricesPromise = null;
    }
  }

  function parseAlignedLlamaDailySeries(data) {
    const ethPts = data?.coins?.['coingecko:ethereum']?.prices;
    const cbPts = data?.coins?.['coingecko:coinbase-wrapped-staked-eth']?.prices;
    if (!Array.isArray(ethPts) || !Array.isArray(cbPts) || ethPts.length === 0 || cbPts.length === 0) {
      return [];
    }

    const ethByDay = new Map();
    for (const pt of ethPts) {
      if (!pt || typeof pt.timestamp !== 'number' || typeof pt.price !== 'number' || pt.price <= 0) continue;
      const day = new Date(pt.timestamp * 1000).toISOString().substring(0, 10);
      ethByDay.set(day, pt);
    }

    const aligned = [];
    for (const cb of cbPts) {
      if (!cb || typeof cb.timestamp !== 'number' || typeof cb.price !== 'number' || cb.price <= 0) continue;
      const day = new Date(cb.timestamp * 1000).toISOString().substring(0, 10);
      const eth = ethByDay.get(day);
      if (!eth) continue;
      // Guard against midnight-crossing timestamp skew (> 4h difference between observations)
      if (Math.abs(cb.timestamp - eth.timestamp) > 14400) continue;
      const ratio = cb.price / eth.price;
      if (ratio < 1.0 || ratio > 1.35) continue;
      aligned.push({
        date: day,
        priceEthUsd: Number(eth.price.toFixed(2)),
        priceCbEthUsd: Number(cb.price.toFixed(2)),
        exchangeRate: Number(ratio.toFixed(5))
      });
    }

    aligned.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return aligned;
  }

  function parseAlignedLlamaHourlySeries(data) {
    const ethPts = data?.coins?.['coingecko:ethereum']?.prices;
    const cbPts = data?.coins?.['coingecko:coinbase-wrapped-staked-eth']?.prices;
    if (!Array.isArray(ethPts) || !Array.isArray(cbPts) || ethPts.length === 0 || cbPts.length === 0) {
      return [];
    }

    const aligned = [];
    for (const cb of cbPts) {
      if (!cb || typeof cb.timestamp !== 'number' || typeof cb.price !== 'number' || cb.price <= 0) continue;
      let bestEth = null;
      let bestDiff = Infinity;
      for (const eth of ethPts) {
        if (!eth || typeof eth.timestamp !== 'number' || typeof eth.price !== 'number' || eth.price <= 0) continue;
        const diff = Math.abs(cb.timestamp - eth.timestamp);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestEth = eth;
        }
      }
      if (!bestEth || bestDiff > 2700) continue;
      const ratio = cb.price / bestEth.price;
      if (ratio < 1.0 || ratio > 1.35) continue;
      const dt = new Date(cb.timestamp * 1000);
      const hh = String(dt.getUTCHours()).padStart(2, '0') + ':00';
      aligned.push({
        date: hh,
        timestamp: dt.toISOString(),
        priceEthUsd: Number(bestEth.price.toFixed(2)),
        priceCbEthUsd: Number(cb.price.toFixed(2)),
        exchangeRate: Number(ratio.toFixed(5))
      });
    }
    return aligned;
  }

  async function fetchHistoricalSeries(timeframe = '30d', address = '', spotPrices = null, forceRefresh = false) {
    const sanitizedTf = sanitizeTimeframe(timeframe);
    const now = Date.now();
    const nowSec = Math.floor(now / 1000);
    const fallbackModule = global.CbEth && global.CbEth.FallbackData;

    if (sanitizedTf === '24h') {
      if (forceRefresh || !cachedSeries24h || (now - cachedSeries24hTimestamp >= CACHE_TTL_MS)) {
        if (!forceRefresh && inflightSeries24hPromise) {
          await inflightSeries24hPromise;
        } else {
          inflightSeries24hPromise = (async () => {
            const start24h = nowSec - 86400;
            const url = `${CONFIG.DEFILLAMA_CHART_BASE}?start=${start24h}&span=24&period=1h`;
            const res = await fetchJsonWithTimeout(url, {}, CONFIG.REQUEST_TIMEOUT_MS);
            if (res.ok && res.data) {
              const parsed = parseAlignedLlamaHourlySeries(res.data);
              if (parsed.length >= 6) {
                cachedSeries24h = parsed;
                cachedSeries24hTimestamp = Date.now();
              }
            }
          })();
          try {
            await inflightSeries24hPromise;
          } finally {
            inflightSeries24hPromise = null;
          }
        }
      }

      if (cachedSeries24h && cachedSeries24h.length > 0) {
        const copy = cachedSeries24h.map(p => Object.assign({}, p));
        const effSpot = spotPrices || cachedPrices;
        if (effSpot && effSpot.source === 'api') {
          const last = copy[copy.length - 1];
          last.priceCbEthUsd = Number(effSpot.cbEthUsd.toFixed(2));
          last.priceEthUsd = Number(effSpot.ethUsd.toFixed(2));
          last.exchangeRate = effSpot.exchangeRate;
        }
        return copy;
      }

      return fallbackModule ? fallbackModule.getHistoricalSeries('24h', address) : [];
    }

    if (forceRefresh || !cachedSeries180d || (now - cachedSeries180dTimestamp >= CACHE_TTL_MS)) {
      if (!forceRefresh && inflightSeries180dPromise) {
        await inflightSeries180dPromise;
      } else {
        inflightSeries180dPromise = (async () => {
          const start180d = nowSec - 180 * 86400;
          const url = `${CONFIG.DEFILLAMA_CHART_BASE}?start=${start180d}&span=180&period=1d`;
          const res = await fetchJsonWithTimeout(url, {}, CONFIG.REQUEST_TIMEOUT_MS);
          if (res.ok && res.data) {
            const parsed = parseAlignedLlamaDailySeries(res.data);
            if (parsed.length >= 25) {
              cachedSeries180d = parsed;
              cachedSeries180dTimestamp = Date.now();
            }
          }
        })();
        try {
          await inflightSeries180dPromise;
        } finally {
          inflightSeries180dPromise = null;
        }
      }
    }

    if (cachedSeries180d && cachedSeries180d.length > 0) {
      const full = cachedSeries180d.map(p => Object.assign({}, p));
      const effSpot = spotPrices || cachedPrices;
      if (effSpot && effSpot.source === 'api') {
        const todayStr = new Date().toISOString().substring(0, 10);
        const livePt = {
          date: todayStr,
          priceEthUsd: Number(effSpot.ethUsd.toFixed(2)),
          priceCbEthUsd: Number(effSpot.cbEthUsd.toFixed(2)),
          exchangeRate: effSpot.exchangeRate
        };
        if (full[full.length - 1].date === todayStr) {
          full[full.length - 1] = livePt;
        } else if (full[full.length - 1].date < todayStr) {
          full.push(livePt);
        }
      }

      if (sanitizedTf === '7d') return full.slice(-7);
      if (sanitizedTf === '14d') return full.slice(-14);
      if (sanitizedTf === '30d') return full.slice(-30);
      if (sanitizedTf === '90d') return full.slice(-90);
      return full;
    }

    return fallbackModule ? fallbackModule.getHistoricalSeries(sanitizedTf, address) : [];
  }

  async function fetchBalanceAtBlock(cleanAddr, blockNum) {
    const calldata = encodeBalanceOf(cleanAddr);
    const hexBlock = '0x' + Number(blockNum).toString(16);
    const res = await callRpcOnNodes(
      'eth_call',
      [{ to: CONFIG.CBETH_CONTRACT, data: calldata }, hexBlock],
      [CONFIG.BASE_RPC_FAILOVER, CONFIG.BASE_RPC_PRIMARY],
      3000
    );
    if (!res.success) return null;
    return decodeWeiToEth(res.result);
  }

  function buildPriceLookupMap(spotPrices) {
    const map = new Map();
    const fbSeries = global.CbEth?.FallbackData?.CANONICAL_SERIES_30D || [];
    for (const pt of fbSeries) {
      if (pt && pt.date) map.set(pt.date, pt);
    }
    if (Array.isArray(cachedSeries180d)) {
      for (const pt of cachedSeries180d) {
        if (pt && pt.date) map.set(pt.date, pt);
      }
    }
    if (spotPrices && spotPrices.cbEthUsd > 0) {
      const today = new Date().toISOString().substring(0, 10);
      map.set(today, {
        date: today,
        priceCbEthUsd: spotPrices.cbEthUsd,
        priceEthUsd: spotPrices.ethUsd,
        exchangeRate: spotPrices.exchangeRate
      });
    }
    return map;
  }

  async function scanBlockWindowLogs(cleanAddr, fromBlock, toBlock, priceMap, spotPrices) {
    if (toBlock < fromBlock) return [];
    const fromHex = '0x' + Math.max(0, Math.floor(fromBlock)).toString(16);
    const toHex = '0x' + Math.max(0, Math.floor(toBlock)).toString(16);
    const paddedAddr = padTopicAddress(cleanAddr);

    const [inRes, outRes] = await Promise.all([
      callRpcOnNodes(
        'eth_getLogs',
        [{
          address: CONFIG.CBETH_CONTRACT,
          fromBlock: fromHex,
          toBlock: toHex,
          topics: [CONFIG.TRANSFER_TOPIC, null, paddedAddr]
        }],
        [CONFIG.BASE_RPC_FAILOVER, CONFIG.BASE_RPC_PRIMARY],
        3000
      ),
      callRpcOnNodes(
        'eth_getLogs',
        [{
          address: CONFIG.CBETH_CONTRACT,
          fromBlock: fromHex,
          toBlock: toHex,
          topics: [CONFIG.TRANSFER_TOPIC, paddedAddr, null]
        }],
        [CONFIG.BASE_RPC_FAILOVER, CONFIG.BASE_RPC_PRIMARY],
        3000
      )
    ]);

    if (!inRes.success && !outRes.success) {
      return null;
    }

    const rawLogs = [];
    const seen = new Set();
    const collect = (arr, dir) => {
      if (!Array.isArray(arr)) return;
      for (const lg of arr) {
        if (!lg || !lg.transactionHash) continue;
        const key = `${lg.transactionHash.toLowerCase()}:${lg.logIndex || '0x0'}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rawLogs.push({ log: lg, type: dir });
      }
    };
    collect(inRes.result, 'in');
    collect(outRes.result, 'out');

    if (rawLogs.length === 0) return [];

    // Sort newest first and cap receipt decoding at 12 per window
    rawLogs.sort((a, b) => parseInt(b.log.blockNumber || '0x0', 16) - parseInt(a.log.blockNumber || '0x0', 16));
    const sliceLogs = rawLogs.slice(0, 12);

    const decodedTxs = await Promise.all(
      sliceLogs.map(async ({ log, type }) => {
        const amountCbEth = decodeWeiToEth(log.data);
        if (amountCbEth <= 0) return null;

        const blockNumber = parseInt(log.blockNumber || '0x0', 16);
        let epochSec = log.blockTimestamp ? parseInt(log.blockTimestamp, 16) : NaN;

        if (!epochSec || isNaN(epochSec)) {
          const blkRes = await callRpc('eth_getBlockByNumber', [log.blockNumber, false]);
          if (blkRes.success && blkRes.result?.timestamp) {
            epochSec = parseInt(blkRes.result.timestamp, 16);
          }
        }

        const dt = (!isNaN(epochSec) && epochSec > 0) ? new Date(epochSec * 1000) : new Date();
        const timestamp = dt.toISOString().replace('T', ' ').substring(0, 19);
        const dayStr = timestamp.substring(0, 10);

        const dayRef = priceMap.get(dayStr);
        const fbCbEth = dayRef?.priceCbEthUsd || spotPrices?.cbEthUsd || 2344.36;
        const fbEth = dayRef?.priceEthUsd || spotPrices?.ethUsd || 2052.45;
        const entryEr = dayRef?.exchangeRate || spotPrices?.protocolExchangeRate || spotPrices?.exchangeRate || 1.14374;

        const receiptRes = await callRpc('eth_getTransactionReceipt', [log.transactionHash]);
        const rawTotalUsd = receiptRes.success && receiptRes.result
          ? decodeSwapReceiptUsd(receiptRes.result, cleanAddr, amountCbEth, fbCbEth, fbEth)
          : amountCbEth * fbCbEth;

        const totalUsd = Number(rawTotalUsd.toFixed(2));
        const priceUsd = amountCbEth > 0 ? Number((rawTotalUsd / amountCbEth).toFixed(2)) : Number(fbCbEth.toFixed(2));

        return {
          hash: log.transactionHash.toLowerCase(),
          blockNumber,
          timestamp,
          type,
          amountCbEth: Number(amountCbEth.toFixed(8)),
          priceUsd,
          totalUsd,
          entryExchangeRate: Number(entryEr.toFixed(5))
        };
      })
    );

    return decodedTxs.filter(Boolean);
  }

  async function discoverSwapsViaBisection(cleanAddr, startBlock, endBlock, startBal, endBal, priceMap, spotPrices, budget) {
    if (startBlock > endBlock || budget.callsLeft <= 0) return [];
    if (Math.abs(endBal - startBal) <= 1e-7) return [];

    if (endBlock - startBlock <= CONFIG.MAX_LOG_BLOCK_SPAN) {
      budget.callsLeft -= 1;
      const found = await scanBlockWindowLogs(cleanAddr, startBlock, endBlock, priceMap, spotPrices);
      return Array.isArray(found) ? found : [];
    }

    const mid = Math.floor((startBlock + endBlock) / 2);
    budget.callsLeft -= 1;
    const midBal = await fetchBalanceAtBlock(cleanAddr, mid);
    if (midBal === null) return [];

    const hasLeftDelta = Math.abs(midBal - startBal) > 1e-7;
    const hasRightDelta = Math.abs(endBal - midBal) > 1e-7;

    if (hasLeftDelta && hasRightDelta && budget.callsLeft >= 2) {
      const [left, right] = await Promise.all([
        discoverSwapsViaBisection(cleanAddr, startBlock, mid, startBal, midBal, priceMap, spotPrices, budget),
        discoverSwapsViaBisection(cleanAddr, mid + 1, endBlock, midBal, endBal, priceMap, spotPrices, budget)
      ]);
      return [...left, ...right];
    }

    const results = [];
    if (hasLeftDelta && budget.callsLeft > 0) {
      const left = await discoverSwapsViaBisection(cleanAddr, startBlock, mid, startBal, midBal, priceMap, spotPrices, budget);
      results.push(...left);
    }
    if (hasRightDelta && budget.callsLeft > 0) {
      const right = await discoverSwapsViaBisection(cleanAddr, mid + 1, endBlock, midBal, endBal, priceMap, spotPrices, budget);
      results.push(...right);
    }
    return results;
  }

  function sumNetTransactionsCbEth(transactions) {
    if (!Array.isArray(transactions)) return 0.0;
    return transactions.reduce((acc, tx) => {
      if (!tx) return acc;
      const qty = Number(tx.amountCbEth) || 0.0;
      const tType = String(tx.type || 'in').toLowerCase();
      const isEntry = !tType || tType === 'in' || tType === 'entrada' || tType === 'compra' || tType === 'buy';
      return isEntry ? acc + qty : acc - qty;
    }, 0.0);
  }

  function mergeAndDeduplicateTransactions(baseList, extraList) {
    const byHash = new Map();
    for (const tx of (baseList || [])) {
      if (tx && tx.hash) byHash.set(tx.hash.toLowerCase(), Object.assign({}, tx));
    }
    for (const tx of (extraList || [])) {
      if (tx && tx.hash && !byHash.has(tx.hash.toLowerCase())) {
        byHash.set(tx.hash.toLowerCase(), Object.assign({}, tx));
      }
    }
    return Array.from(byHash.values()).sort((a, b) => {
      const tA = Date.parse(String(a.timestamp || '').replace(' ', 'T') + 'Z') || 0;
      const tB = Date.parse(String(b.timestamp || '').replace(' ', 'T') + 'Z') || 0;
      return tA - tB;
    });
  }

  async function fetchTransactions(address, options = {}) {
    if (!isValidEvmAddress(address)) {
      return [];
    }

    const cleanAddr = address.toLowerCase().trim();
    if (cleanAddr === '0x0000000000000000000000000000000000000000') {
      return [];
    }

    const forceRefresh = Boolean(options.forceRefresh);
    const now = Date.now();
    const cached = cachedTxsByAddr[cleanAddr];
    if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.value.map(tx => Object.assign({}, tx));
    }

    const fallbackModule = global.CbEth && global.CbEth.FallbackData;
    const isCanonical = fallbackModule && cleanAddr === fallbackModule.CANONICAL_WALLET.toLowerCase();
    const balances = options.balances || null;
    const spotPrices = options.prices || cachedPrices || null;

    if (isCanonical) {
      const baseTxs = fallbackModule.getCanonicalTransactions();
      const knownNet = sumNetTransactionsCbEth(baseTxs);
      const liveBal = balances && balances.source === 'rpc' ? balances.balanceCbEth : knownNet;
      const hasBalanceDelta = balances && balances.source === 'rpc' && Math.abs(liveBal - knownNet) > 1e-6;

      if (!hasBalanceDelta) {
        cachedTxsByAddr[cleanAddr] = { timestamp: now, value: baseTxs };
        return baseTxs;
      }

      if (balances && balances.source === 'rpc') {
        try {
          const blkRes = await callRpc('eth_blockNumber', []);
          if (blkRes.success && blkRes.result) {
            const latestBlock = parseInt(blkRes.result, 16);
            const syncedBlock = fallbackModule.CANONICAL_LAST_SYNCED_BLOCK || 55721053;
            if (latestBlock > syncedBlock) {
              const priceMap = buildPriceLookupMap(spotPrices);
              let discovered = [];
              const recentFrom = Math.max(syncedBlock + 1, latestBlock - CONFIG.MAX_LOG_BLOCK_SPAN);
              const recentLogs = await scanBlockWindowLogs(cleanAddr, recentFrom, latestBlock, priceMap, spotPrices);
              if (Array.isArray(recentLogs)) {
                discovered.push(...recentLogs);
              }
              const mergedRecent = mergeAndDeduplicateTransactions(baseTxs, discovered);
              const netAfterRecent = sumNetTransactionsCbEth(mergedRecent);

              if (Math.abs(liveBal - netAfterRecent) > 1e-6 && recentFrom > syncedBlock + 1) {
                const budget = { callsLeft: 32 };
                const olderLogs = await discoverSwapsViaBisection(
                  cleanAddr,
                  syncedBlock + 1,
                  recentFrom - 1,
                  knownNet,
                  liveBal - (netAfterRecent - knownNet),
                  priceMap,
                  spotPrices,
                  budget
                );
                discovered.push(...olderLogs);
              }

              const finalCanonical = mergeAndDeduplicateTransactions(baseTxs, discovered);
              cachedTxsByAddr[cleanAddr] = { timestamp: now, value: finalCanonical };
              return finalCanonical;
            }
          }
        } catch (_) {
          // Return audited canonical set if log RPC is unreachable
        }
      }

      cachedTxsByAddr[cleanAddr] = { timestamp: now, value: baseTxs };
      return baseTxs;
    }

    // Non-canonical arbitrary EVM wallet
    if (balances && balances.source === 'rpc') {
      try {
        const blkRes = await callRpc('eth_blockNumber', []);
        if (blkRes.success && blkRes.result) {
          const latestBlock = parseInt(blkRes.result, 16);
          const priceMap = buildPriceLookupMap(spotPrices);
          const recentFrom = Math.max(0, latestBlock - CONFIG.MAX_LOG_BLOCK_SPAN);
          const recentLogs = await scanBlockWindowLogs(cleanAddr, recentFrom, latestBlock, priceMap, spotPrices);

          if (balances.balanceCbEth <= 1e-8) {
            const resZero = Array.isArray(recentLogs) ? recentLogs : [];
            cachedTxsByAddr[cleanAddr] = { timestamp: now, value: resZero };
            return resZero;
          }

          let found = Array.isArray(recentLogs) ? recentLogs : [];
          const foundNet = sumNetTransactionsCbEth(found);
          if (Math.abs(balances.balanceCbEth - foundNet) > 1e-6) {
            const lookbackStart = Math.max(0, latestBlock - 7776000); // ~180 days on Base (2s blocks)
            const startBal = (await fetchBalanceAtBlock(cleanAddr, lookbackStart)) ?? 0.0;
            const budget = { callsLeft: 32 };
            const older = await discoverSwapsViaBisection(
              cleanAddr,
              lookbackStart,
              Math.max(lookbackStart, recentFrom - 1),
              startBal,
              Math.max(0, balances.balanceCbEth - foundNet),
              priceMap,
              spotPrices,
              budget
            );
            found = mergeAndDeduplicateTransactions(older, found);
          }

          if (found.length > 0) {
            cachedTxsByAddr[cleanAddr] = { timestamp: now, value: found };
            return found;
          }
        }
      } catch (_) {
        // Fallback below
      }
    }

    if (fallbackModule) {
      const synth = fallbackModule.generateSyntheticWallet(cleanAddr);
      return synth.transactions;
    }

    return [];
  }

  function sanitizeTimeframe(timeframe) {
    const valid = ['24h', '7d', '14d', '30d', '90d', 'all'];
    const tf = String(timeframe || '').toLowerCase().trim();
    return valid.includes(tf) ? tf : '30d';
  }

  async function loadWalletData(address, timeframe = '30d', forceRefresh = false) {
    if (!isValidEvmAddress(address)) {
      throw new Error('Endereço EVM inválido. Formato exigido: 0x seguido de 40 caracteres hexadecimais.');
    }

    const cleanAddr = address.toLowerCase().trim();
    const sanitizedTf = sanitizeTimeframe(timeframe);
    const fallbackModule = global.CbEth && global.CbEth.FallbackData;

    const [balances, prices] = await Promise.all([
      fetchBalances(cleanAddr, forceRefresh),
      fetchPrices(forceRefresh),
      fetchHistoricalSeries(sanitizedTf, cleanAddr, null, forceRefresh)
    ]);

    const [historicalSeries, transactions] = await Promise.all([
      fetchHistoricalSeries(sanitizedTf, cleanAddr, prices, false),
      fetchTransactions(cleanAddr, { balances, prices, forceRefresh })
    ]);

    const isCanonical = cleanAddr === (fallbackModule?.CANONICAL_WALLET?.toLowerCase() || '');
    const isFallback = balances.source === 'fallback' || prices.source === 'fallback';

    const spotCbEthUsd = prices.cbEthUsd;
    const spotEthUsd = prices.ethUsd;
    const rateUsdBrl = prices.usdBrl;
    const exchangeRate = prices.exchangeRate;
    const protocolExchangeRate = prices.protocolExchangeRate || exchangeRate;
    const balanceCbEth = balances.balanceCbEth;
    const balanceEthGas = balances.balanceEthGas;

    const patrimonioCbEthEth = Number((balanceCbEth * exchangeRate).toFixed(6));
    const patrimonioCbEthUsd = Number((balanceCbEth * spotCbEthUsd).toFixed(2));
    const patrimonioCbEthBrl = Number((patrimonioCbEthUsd * rateUsdBrl).toFixed(2));
    const patrimonioTotalUsd = Number((patrimonioCbEthUsd + balanceEthGas * spotEthUsd).toFixed(2));
    const patrimonioTotalBrl = Number((patrimonioTotalUsd * rateUsdBrl).toFixed(2));

    const position = {
      address: cleanAddr,
      network: 'Base',
      balanceCbEth,
      balanceEthGas,
      spotCbEthUsd,
      spotEthUsd,
      exchangeRate,
      protocolExchangeRate,
      rateUsdBrl,
      patrimonioCbEthEth,
      patrimonioCbEthUsd,
      patrimonioCbEthBrl,
      patrimonioTotalUsd,
      patrimonioTotalBrl
    };

    return {
      position,
      transactions,
      historicalSeries,
      isFallback,
      isCanonical
    };
  }

  function clearCache() {
    cachedPrices = null;
    cachedPricesTimestamp = 0;
    cachedSeries180d = null;
    cachedSeries180dTimestamp = 0;
    cachedSeries24h = null;
    cachedSeries24hTimestamp = 0;
    Object.keys(cachedBalancesByAddr).forEach(k => { delete cachedBalancesByAddr[k]; });
    Object.keys(cachedTxsByAddr).forEach(k => { delete cachedTxsByAddr[k]; });
  }

  const Api = {
    CONFIG,
    isValidEvmAddress,
    formatAddress,
    encodeBalanceOf,
    decodeWeiToEth,
    decodeSwapReceiptUsd,
    fetchProtocolExchangeRate,
    callRpc,
    fetchBalances,
    fetchPrices,
    fetchHistoricalSeries,
    fetchTransactions,
    sanitizeTimeframe,
    loadWalletData,
    clearCache
  };

  global.CbEth.Api = Api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
