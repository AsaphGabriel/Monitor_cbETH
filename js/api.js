(function (global) {
  'use strict';

  global.CbEth = global.CbEth || {};

  const CONFIG = {
    BASE_RPC_PRIMARY: 'https://mainnet.base.org',
    BASE_RPC_FAILOVER: 'https://base-rpc.publicnode.com',
    CBETH_CONTRACT: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    BALANCE_OF_SELECTOR: '0x70a08231',
    DEFILLAMA_SPOT: 'https://coins.llama.fi/prices/current/coingecko:ethereum,coingecko:coinbase-wrapped-staked-eth',
    AWESOME_API_USD_BRL: 'https://economia.awesomeapi.com.br/last/USD-BRL',
    OPEN_ER_API_USD: 'https://open.er-api.com/v6/latest/USD',
    DEFAULT_USD_BRL: 5.0980,
    CONSERVATIVE_USD_BRL: 5.50,
    REQUEST_TIMEOUT_MS: 3500
  };

  let cachedPrices = null;
  let cachedPricesTimestamp = 0;
  const CACHE_TTL_MS = 60000;

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

  async function callRpc(method, params) {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    });

    const nodes = [CONFIG.BASE_RPC_PRIMARY, CONFIG.BASE_RPC_FAILOVER];

    for (const nodeUrl of nodes) {
      try {
        let signal = undefined;
        let timeoutId = undefined;
        if (typeof AbortController !== 'undefined') {
          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
          signal = controller.signal;
        }

        const response = await fetch(nodeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
          continue;
        }

        const json = await response.json();
        if (json && !json.error && json.result !== undefined) {
          return { success: true, result: json.result, node: nodeUrl };
        }
      } catch (_) {
        // Failover to next node
      }
    }

    return { success: false, error: 'All RPC nodes failed or timed out' };
  }

  async function fetchBalances(address, forceRefresh = false) {
    if (!isValidEvmAddress(address)) {
      throw new Error('Endereço EVM inválido. Formato exigido: 0x seguido de 40 caracteres hexadecimais.');
    }

    const cleanAddr = address.toLowerCase().trim();

    try {
      const calldata = encodeBalanceOf(cleanAddr);
      const [cbEthRes, ethRes] = await Promise.all([
        callRpc('eth_call', [{ to: CONFIG.CBETH_CONTRACT, data: calldata }, 'latest']),
        callRpc('eth_getBalance', [cleanAddr, 'latest'])
      ]);

      if (cbEthRes.success && ethRes.success) {
        const balanceCbEth = decodeWeiToEth(cbEthRes.result);
        const balanceEthGas = decodeWeiToEth(ethRes.result);
        return {
          balanceCbEth,
          balanceEthGas,
          source: 'rpc',
          rawCbEthWei: cbEthRes.result,
          rawEthWei: ethRes.result
        };
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
      } else {
        const synth = fallbackModule.generateSyntheticWallet(cleanAddr);
        return {
          balanceCbEth: synth.position.balanceCbEth,
          balanceEthGas: synth.position.balanceEthGas,
          source: 'fallback'
        };
      }
    }

    return {
      balanceCbEth: 0.020581,
      balanceEthGas: 0.000244,
      source: 'fallback'
    };
  }

  async function fetchUsdBrlRate() {
    // 1. Tenta open.er-api.com primeiro (evita rate limit 429 da AwesomeAPI)
    try {
      let signal = undefined;
      let timeoutId = undefined;
      if (typeof AbortController !== 'undefined') {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 2500);
        signal = controller.signal;
      }
      const res = await fetch(CONFIG.OPEN_ER_API_USD, { signal });
      if (timeoutId) clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const rate = parseFloat(data?.rates?.BRL);
        if (rate > 0 && isFinite(rate)) {
          return { rate, source: 'open.er-api' };
        }
      }
    } catch (_) {}

    // 2. Tenta AwesomeAPI como failover secundário
    try {
      let signal = undefined;
      let timeoutId = undefined;
      if (typeof AbortController !== 'undefined') {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 2000);
        signal = controller.signal;
      }
      const res = await fetch(CONFIG.AWESOME_API_USD_BRL, { signal });
      if (timeoutId) clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const rate = parseFloat(data?.USDBRL?.bid);
        if (rate > 0 && isFinite(rate)) {
          return { rate, source: 'awesomeapi' };
        }
      }
    } catch (_) {}

    return { rate: CONFIG.DEFAULT_USD_BRL, source: 'fallback' };
  }

  async function fetchPrices(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedPrices && (now - cachedPricesTimestamp < CACHE_TTL_MS)) {
      return cachedPrices;
    }

    let ethUsd = null;
    let cbEthUsd = null;

    try {
      let signal = undefined;
      let timeoutId = undefined;
      if (typeof AbortController !== 'undefined') {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
        signal = controller.signal;
      }
      const res = await fetch(CONFIG.DEFILLAMA_SPOT, { signal });
      if (timeoutId) clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const ethPrice = data?.coins?.['coingecko:ethereum']?.price;
        const cbethPrice = data?.coins?.['coingecko:coinbase-wrapped-staked-eth']?.price;
        if (typeof ethPrice === 'number' && typeof cbethPrice === 'number') {
          ethUsd = ethPrice;
          cbEthUsd = cbethPrice;
        }
      }
    } catch (_) {}

    const fx = await fetchUsdBrlRate();
    const usdBrl = fx.rate;

    if (ethUsd !== null && cbEthUsd !== null) {
      const exchangeRate = Number((cbEthUsd / ethUsd).toFixed(5));
      cachedPrices = {
        cbEthUsd,
        ethUsd,
        usdBrl,
        exchangeRate,
        source: 'api'
      };
      cachedPricesTimestamp = now;
      return cachedPrices;
    }

    const fallbackPos = global.CbEth?.FallbackData?.getCanonicalPosition?.() || {
      spotCbEthUsd: 2798.78,
      spotEthUsd: 2450.45,
      exchangeRate: 1.14215,
      rateUsdBrl: CONFIG.DEFAULT_USD_BRL
    };

    cachedPrices = {
      cbEthUsd: fallbackPos.spotCbEthUsd,
      ethUsd: fallbackPos.spotEthUsd,
      usdBrl: usdBrl || fallbackPos.rateUsdBrl,
      exchangeRate: fallbackPos.exchangeRate,
      source: 'fallback'
    };
    cachedPricesTimestamp = now;
    return cachedPrices;
  }

  async function fetchTransactions(address) {
    if (!isValidEvmAddress(address)) {
      return [];
    }

    const cleanAddr = address.toLowerCase().trim();
    const fallbackModule = global.CbEth && global.CbEth.FallbackData;

    if (fallbackModule) {
      if (cleanAddr === fallbackModule.CANONICAL_WALLET.toLowerCase()) {
        return fallbackModule.getCanonicalTransactions();
      }
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

    const [balances, prices, transactions] = await Promise.all([
      fetchBalances(cleanAddr, forceRefresh),
      fetchPrices(forceRefresh),
      fetchTransactions(cleanAddr)
    ]);

    const historicalSeries = fallbackModule
      ? fallbackModule.getHistoricalSeries(sanitizedTf, cleanAddr)
      : [];

    const isCanonical = cleanAddr === (fallbackModule?.CANONICAL_WALLET?.toLowerCase() || '');
    const isFallback = balances.source === 'fallback' || prices.source === 'fallback';

    const spotCbEthUsd = prices.cbEthUsd;
    const spotEthUsd = prices.ethUsd;
    const rateUsdBrl = prices.usdBrl;
    const exchangeRate = prices.exchangeRate;
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
  }

  const Api = {
    CONFIG,
    isValidEvmAddress,
    formatAddress,
    encodeBalanceOf,
    decodeWeiToEth,
    callRpc,
    fetchBalances,
    fetchPrices,
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
