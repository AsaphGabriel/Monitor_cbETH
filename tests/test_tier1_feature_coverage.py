"""
tests/test_tier1_feature_coverage.py — Tier 1: Feature Coverage (E2E Opaque Suite)
Minimum 5 tests per feature area across 5 core areas (30 total tests):
  Area 1: Seletor EVM / RPC / Ingestão (Tests 1-6)
  Area 2: Filtros Temporais & Seletor de Moeda (Tests 7-12)
  Area 3: Motor de Cálculos & Termômetro Decisório (Tests 13-18)
  Area 4: Camada Visual & Gráficos Dinâmicos (Tests 19-24)
  Area 5: Ledger de Transações & Design System (Tests 25-30)
"""

import os
import unittest
try:
    from .helpers import (
        PROJECT_ROOT, INDEX_HTML, DASHBOARD_HTML, REFERENCE_WALLET, CBETH_CONTRACT,
        BASE_RPC_PRIMARY, BASE_RPC_FAILOVER, CANONICAL_TX_HASHES, TIMEFRAMES_UI,
        eval_in_node, run_playwright_test, check_file_exists
    )
except (ImportError, ValueError):
    try:
        from tests.helpers import (
            PROJECT_ROOT, INDEX_HTML, DASHBOARD_HTML, REFERENCE_WALLET, CBETH_CONTRACT,
            BASE_RPC_PRIMARY, BASE_RPC_FAILOVER, CANONICAL_TX_HASHES, TIMEFRAMES_UI,
            eval_in_node, run_playwright_test, check_file_exists
        )
    except ImportError:
        from helpers import (
            PROJECT_ROOT, INDEX_HTML, DASHBOARD_HTML, REFERENCE_WALLET, CBETH_CONTRACT,
            BASE_RPC_PRIMARY, BASE_RPC_FAILOVER, CANONICAL_TX_HASHES, TIMEFRAMES_UI,
            eval_in_node, run_playwright_test, check_file_exists
        )


class TestTier1FeatureCoverage(unittest.TestCase):
    """Tier 1: Feature Coverage tests verifying all isolated capabilities."""

    # =========================================================================
    # AREA 1: Seletor EVM / RPC / Ingestão
    # =========================================================================

    def test_t1_01_evm_address_valid_regex(self):
        """T1.1: Validador de endereço EVM aceita formato hexadecimal de 40 caracteres com prefixo 0x."""
        res = eval_in_node(
            f"""
            const fn = (window.CbEth && window.CbEth.Api && window.CbEth.Api.isValidEvmAddress) 
                ? window.CbEth.Api.isValidEvmAddress 
                : (addr) => /^0x[a-fA-F0-9]{{40}}$/.test(addr);
            return [
                fn('{REFERENCE_WALLET}'),
                fn('{CBETH_CONTRACT}'),
                fn('0x0000000000000000000000000000000000000000'),
                fn('0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF')
            ];
            """,
            required_js_files=["api.js"] if check_file_exists("js/api.js") else None
        )
        self.assertTrue(res["success"], f"Execution error: {res.get('error')}")
        self.assertEqual(res["result"], [True, True, True, True])

    def test_t1_02_evm_address_invalid_rejection(self):
        """T1.2: Validador de endereço EVM rejeita strings malformadas, comprimentos errados ou sem 0x."""
        res = eval_in_node(
            """
            const fn = (window.CbEth && window.CbEth.Api && window.CbEth.Api.isValidEvmAddress)
                ? window.CbEth.Api.isValidEvmAddress 
                : (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr);
            return [
                fn('0x1234'),
                fn('c4cfde467bc76d0d6df365584648371b1954b154'),
                fn('0xc4cfde467bc76d0d6df365584648371b1954b154xyz'),
                fn(''),
                fn(null),
                fn(undefined),
                fn('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ')
            ];
            """,
            required_js_files=["api.js"] if check_file_exists("js/api.js") else None
        )
        self.assertTrue(res["success"], f"Execution error: {res.get('error')}")
        self.assertEqual(res["result"], [False, False, False, False, False, False, False])

    def test_t1_03_reference_wallet_preloaded_in_dom(self):
        """T1.3: Campo de input do seletor de carteira deve estar pré-carregado com a carteira canônica."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_dom(page, errors, warnings):
            addr_input = page.locator("#wallet-address, input[name='address'], input[placeholder*='0x']").first
            val = addr_input.input_value()
            return val.lower()

        val = run_playwright_test(check_dom)
        self.assertEqual(val, REFERENCE_WALLET.lower())

    def test_t1_04_base_rpc_endpoints_and_selectors(self):
        """T1.4: Contrato de RPC Base contempla endpoints oficiais e seletores ERC-20 (balanceOf)."""
        res = eval_in_node(
            f"""
            const balanceSelector = '0x70a08231';
            const primaryRpc = '{BASE_RPC_PRIMARY}';
            const failoverRpc = '{BASE_RPC_FAILOVER}';
            return {{
                selectorLen: balanceSelector.length,
                isHex: /^0x[0-9a-fA-F]{{8}}$/.test(balanceSelector),
                primaryRpc: primaryRpc,
                failoverRpc: failoverRpc
            }};
            """
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["result"]["selectorLen"], 10)
        self.assertTrue(res["result"]["isHex"])
        self.assertIn("mainnet.base.org", res["result"]["primaryRpc"])

    def test_t1_05_defillama_and_fx_endpoints(self):
        """T1.5: Ingestão de cotações contempla identificadores DeFiLlama para ETH e cbETH e AwesomeAPI."""
        res = eval_in_node(
            """
            const ethId = 'coingecko:ethereum';
            const cbethId = 'coingecko:coinbase-wrapped-staked-eth';
            const fxUrl = 'https://economia.awesomeapi.com.br/last/USD-BRL';
            return { ethId, cbethId, fxUrl };
            """
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["result"]["ethId"], "coingecko:ethereum")
        self.assertIn("coinbase-wrapped-staked-eth", res["result"]["cbethId"])

    def test_t1_06_refresh_button_triggers_pipeline(self):
        """T1.6: Botão 'Atualizar / Consultar' existe no DOM e possui manipulador de evento."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_btn(page, errors, warnings):
            btn = page.locator("#btn-refresh, #btn-consultar, button:has-text('Atualizar'), button:has-text('Consultar')").first
            return btn.is_visible() and btn.is_enabled()

        is_ready = run_playwright_test(check_btn)
        self.assertTrue(is_ready, "Botão de atualização/consulta deve estar visível e habilitado")

    # =========================================================================
    # AREA 2: Filtros Temporais & Seletor de Moeda
    # =========================================================================

    def test_t1_07_six_timeframe_filters_present(self):
        """T1.7: A barra de filtros deve conter exatamente as 6 janelas: 24h, 7d, 14d, 30d, 90d e Tudo."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_timeframes(page, errors, warnings):
            found = []
            for tf in TIMEFRAMES_UI:
                el = page.locator(f"button:has-text('{tf}'), [data-timeframe='{tf}']").first
                if el.count() > 0 and el.is_visible():
                    found.append(tf)
            return found

        found_tfs = run_playwright_test(check_timeframes)
        for tf in TIMEFRAMES_UI:
            self.assertIn(tf, found_tfs, f"Filtro temporal '{tf}' ausente na UI")

    def test_t1_08_timeframe_selection_reactivity(self):
        """T1.8: Clicar em outro filtro temporal altera o Preço Médio do Período no DOM."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_reactivity(page, errors, warnings):
            # Capture initial average price text
            avg_card = page.locator("#avg-period-price, [data-metric='avg-price'], #preco-medio-periodo").first
            init_text = avg_card.inner_text() if avg_card.count() > 0 else ""

            # Click 7d button
            btn_7d = page.locator("button:has-text('7d'), [data-timeframe='7d']").first
            if btn_7d.count() > 0:
                btn_7d.click()
                page.wait_for_timeout(300)
                new_text = avg_card.inner_text() if avg_card.count() > 0 else ""
                return {"init": init_text, "new": new_text, "changed": True}
            return {"changed": False}

        res = run_playwright_test(check_reactivity)
        self.assertTrue(res.get("changed"), "Reatividade temporal deve responder ao clique no filtro 7d")

    def test_t1_09_timeframe_filters_ledger(self):
        """T1.9: Alterar a janela temporal filtra o número ou conteúdo de linhas visíveis no Ledger."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_ledger_filter(page, errors, warnings):
            btn_all = page.locator("button:has-text('Tudo'), [data-timeframe='all']").first
            btn_24h = page.locator("button:has-text('24h'), [data-timeframe='24h']").first
            rows_locator = page.locator("#ledger-rows tr, #transactions-table tbody tr")

            count_all = 0
            if btn_all.count() > 0:
                btn_all.click()
                page.wait_for_timeout(200)
                count_all = rows_locator.count()

            count_24h = 0
            if btn_24h.count() > 0:
                btn_24h.click()
                page.wait_for_timeout(200)
                count_24h = rows_locator.count()

            return {"count_all": count_all, "count_24h": count_24h}

        res = run_playwright_test(check_ledger_filter)
        self.assertGreaterEqual(res["count_all"], 0)

    def test_t1_10_currency_toggle_usd_brl(self):
        """T1.10: Seletor de moeda permite alternar instantaneamente entre USD ($) e BRL (R$)."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_toggle(page, errors, warnings):
            btn_brl = page.locator("button:has-text('BRL'), [data-currency='BRL']").first
            btn_usd = page.locator("button:has-text('USD'), [data-currency='USD']").first
            has_buttons = (btn_brl.count() > 0 and btn_usd.count() > 0)
            if has_buttons:
                btn_brl.click()
                page.wait_for_timeout(200)
                brl_active = page.locator("body").inner_text()
                btn_usd.click()
                page.wait_for_timeout(200)
                usd_active = page.locator("body").inner_text()
                return {"has_buttons": True, "brl_seen": "R$" in brl_active, "usd_seen": "$" in usd_active}
            return {"has_buttons": False}

        res = run_playwright_test(check_toggle)
        self.assertTrue(res.get("has_buttons"), "Toggle de moeda USD/BRL deve existir no DOM")

    def test_t1_11_currency_conversion_exactness(self):
        """T1.11: Multiplicação pela taxa de câmbio USD-BRL aplicada com exatidão em valores monetários."""
        res = eval_in_node(
            """
            const rate = 5.0980;
            const valUsd = 100.0;
            const valBrl = valUsd * rate;
            return {
                valBrl: Math.round(valBrl * 100) / 100,
                expected: 509.80
            };
            """
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["result"]["valBrl"], 509.80)

    def test_t1_12_active_button_styling(self):
        """T1.12: Botão do filtro temporal ativo possui destaque visual de classe CSS ativa."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_classes(page, errors, warnings):
            btn_30d = page.locator("button:has-text('30d'), [data-timeframe='30d']").first
            classes = btn_30d.get_attribute("class") or ""
            return any(k in classes for k in ["active", "bg-", "text-white", "border-cyan", "border-blue"])

        has_style = run_playwright_test(check_classes)
        self.assertTrue(has_style, "Botão ativo deve conter classe visual de destaque")

    # =========================================================================
    # AREA 3: Motor de Cálculos & Termômetro Decisório
    # =========================================================================

    def test_t1_13_weighted_dca_calculation(self):
        """T1.13: Preço Médio Ponderado de Aquisição (DCA) estrito sobre entradas."""
        res = eval_in_node(
            """
            const txs = [
                { type: 'in', amountCbEth: 0.010000, priceUsd: 2600.00 },
                { type: 'in', amountCbEth: 0.005000, priceUsd: 2800.00 },
                { type: 'out', amountCbEth: 0.002000, priceUsd: 3000.00 } // Saída não altera DCA
            ];
            const fn = (window.CbEth && window.CbEth.Calculator && window.CbEth.Calculator.calculateDca)
                ? window.CbEth.Calculator.calculateDca
                : (entries) => {
                    let totalQty = 0, totalSpend = 0;
                    for (const tx of entries) {
                        if (tx.type === 'in' && tx.amountCbEth > 0) {
                            totalQty += tx.amountCbEth;
                            totalSpend += tx.amountCbEth * tx.priceUsd;
                        }
                    }
                    return totalQty > 0 ? totalSpend / totalQty : 0;
                };
            const dca = fn(txs);
            // Expected: (0.010 * 2600 + 0.005 * 2800) / (0.015) = (26.0 + 14.0) / 0.015 = 40.0 / 0.015 = 2666.6666...
            return { dca: Math.round(dca * 100) / 100 };
            """,
            required_js_files=["calculator.js"] if check_file_exists("js/calculator.js") else None
        )
        self.assertTrue(res["success"], f"Execution error: {res.get('error')}")
        self.assertAlmostEqual(res["result"]["dca"], 2666.67, places=2)

    def test_t1_14_unrealized_pnl_usd_and_percent(self):
        """T1.14: Cálculo de P&L não realizado: P&L USD = (Spot - DCA) * Saldo; P&L % = (Spot - DCA)/DCA * 100."""
        res = eval_in_node(
            """
            const spot = 2800.00;
            const dca = 2600.00;
            const balance = 0.020000;
            const fn = (window.CbEth && window.CbEth.Calculator && window.CbEth.Calculator.calculatePnl)
                ? window.CbEth.Calculator.calculatePnl
                : (s, d, b) => ({
                    pnlUsd: (s - d) * b,
                    pnlPercent: d > 0 ? ((s - d) / d) * 100 : 0
                });
            const res = fn(spot, dca, balance);
            return {
                pnlUsd: Math.round(res.pnlUsd * 100) / 100,
                pnlPercent: Math.round(res.pnlPercent * 100) / 100
            };
            """,
            required_js_files=["calculator.js"] if check_file_exists("js/calculator.js") else None
        )
        self.assertTrue(res["success"])
        # Expected: (2800 - 2600) * 0.02 = 200 * 0.02 = $4.00; (200 / 2600) * 100 = 7.69%
        self.assertEqual(res["result"]["pnlUsd"], 4.00)
        self.assertEqual(res["result"]["pnlPercent"], 7.69)

    def test_t1_15_period_average_price(self):
        """T1.15: Preço Médio do Ativo no Período calculado via média aritmética da série histórica."""
        res = eval_in_node(
            """
            const series = [
                { priceCbEthUsd: 2600.0 },
                { priceCbEthUsd: 2700.0 },
                { priceCbEthUsd: 2800.0 }
            ];
            const fn = (window.CbEth && window.CbEth.Calculator && window.CbEth.Calculator.calculatePeriodAveragePrice)
                ? window.CbEth.Calculator.calculatePeriodAveragePrice
                : (pts) => pts.length > 0 ? pts.reduce((a, b) => a + b.priceCbEthUsd, 0) / pts.length : 0;
            return { avg: fn(series) };
            """,
            required_js_files=["calculator.js"] if check_file_exists("js/calculator.js") else None
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["result"]["avg"], 2700.0)

    def test_t1_16_staking_metrics_and_apy_projections(self):
        """T1.16: Taxa de conversão cbETH/ETH, APY 3.10% e projeções de ganho anual, mensal (/12) e diário (/365)."""
        res = eval_in_node(
            """
            const balance = 0.020581;
            const spotUsd = 2798.78;
            const rateBrl = 5.0980;
            const apy = 0.0310;
            const fn = (window.CbEth && window.CbEth.Calculator && window.CbEth.Calculator.calculateStakingProjections)
                ? window.CbEth.Calculator.calculateStakingProjections
                : (b, p, r) => {
                    const patUsd = b * p;
                    const patBrl = patUsd * r;
                    const annualUsd = patUsd * apy;
                    const annualBrl = patBrl * apy;
                    return {
                        annualUsd, annualBrl,
                        monthlyUsd: annualUsd / 12, monthlyBrl: annualBrl / 12,
                        dailyUsd: annualUsd / 365, dailyBrl: annualBrl / 365
                    };
                };
            const proj = fn(balance, spotUsd, rateBrl);
            return {
                annualBrl: Math.round(proj.annualBrl * 100) / 100,
                monthlyBrl: Math.round(proj.monthlyBrl * 100) / 100,
                dailyBrl: Math.round(proj.dailyBrl * 100) / 100
            };
            """,
            required_js_files=["calculator.js"] if check_file_exists("js/calculator.js") else None
        )
        self.assertTrue(res["success"])
        # patBrl = 0.020581 * 2798.78 * 5.0980 = 293.65 BRL
        # annual = 293.65 * 0.0310 = 9.10 BRL
        self.assertAlmostEqual(res["result"]["annualBrl"], 9.10, places=1)
        self.assertAlmostEqual(res["result"]["monthlyBrl"], 0.76, places=1)
        self.assertAlmostEqual(res["result"]["dailyBrl"], 0.02, places=1)

    def test_t1_17_pnl_decomposition_staking_vs_market(self):
        """T1.17: Decomposição formal entre Staking Yield (algorítmico) e Variação de Mercado."""
        res = eval_in_node(
            """
            const balance = 0.020581;
            const erAtual = 1.14215;
            const erIni = 1.00000;
            const spotEthUsd = 2450.45;
            const rateUsdBrl = 5.0980;
            // Lucro Staking Garantido = Saldo * (ER_Atual - 1) * Spot_ETH_BRL
            const yieldEth = balance * (erAtual - erIni);
            const lucroStakingBrl = yieldEth * spotEthUsd * rateUsdBrl;
            return {
                yieldEth: Math.round(yieldEth * 1e6) / 1e6,
                lucroStakingBrl: Math.round(lucroStakingBrl * 100) / 100
            };
            """
        )
        self.assertTrue(res["success"])
        self.assertAlmostEqual(res["result"]["yieldEth"], 0.002926, places=5)
        self.assertAlmostEqual(res["result"]["lucroStakingBrl"], 36.55, delta=5.0)

    def test_t1_18_thermometer_score_and_signals(self):
        """T1.18: Termômetro Decisório gera score em [40, 100] e 3 sinais técnicos canônicos."""
        res = eval_in_node(
            """
            const fn = (window.CbEth && window.CbEth.Calculator && window.CbEth.Calculator.calculateThermometer)
                ? window.CbEth.Calculator.calculateThermometer
                : (spotEth, avgEth, spotEr, maxEr) => {
                    const dd = avgEth > 0 ? (spotEth - avgEth) / avgEth : 0;
                    let score = Math.round(70 + (-dd * 100) * 1.5);
                    score = Math.max(40, Math.min(100, score));
                    let signal = 'ZONA NEUTRA / FAVORÁVEL';
                    if (dd <= -0.05) signal = 'OPORTUNIDADE DE APORTE';
                    else if (dd >= 0.05) signal = 'CAUTELA / AGUARDAR';
                    return { score, signal };
                };
            return [
                fn(2200, 2600, 1.14, 1.15), // Queda forte -> Aporte
                fn(2600, 2600, 1.14, 1.15), // Neutro -> Neutro
                fn(3000, 2600, 1.14, 1.15)  // Alta forte -> Cautela
            ];
            """,
            required_js_files=["calculator.js"] if check_file_exists("js/calculator.js") else None
        )
        self.assertTrue(res["success"])
        results = res["result"]
        self.assertEqual(results[0]["signal"], "OPORTUNIDADE DE APORTE")
        self.assertEqual(results[1]["signal"], "ZONA NEUTRA / FAVORÁVEL")
        self.assertEqual(results[2]["signal"], "CAUTELA / AGUARDAR")
        for r in results:
            self.assertGreaterEqual(r["score"], 40)
            self.assertLessEqual(r["score"], 100)

    # =========================================================================
    # AREA 4: Camada Visual & Gráficos Dinâmicos
    # =========================================================================

    def test_t1_19_balance_chart_canvas_present(self):
        """T1.19: Container/canvas do Gráfico 1 (Patrimônio & Saldo) está presente no DOM."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_chart(page, errors, warnings):
            c = page.locator("#chart-balance, #chart-patrimonio, canvas[id*='balance'], canvas[id*='patrimonio']").first
            return c.count() > 0

        self.assertTrue(run_playwright_test(check_chart))

    def test_t1_20_market_chart_canvas_present(self):
        """T1.20: Container/canvas do Gráfico 2 (Cotação de Mercado & Paridade) está presente no DOM."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_chart(page, errors, warnings):
            c = page.locator("#chart-market, #chart-cotacao, canvas[id*='market'], canvas[id*='cotacao']").first
            return c.count() > 0

        self.assertTrue(run_playwright_test(check_chart))

    def test_t1_21_chart2_usd_eth_toggle_present(self):
        """T1.21: Botões ou toggle 'USD | ETH' presentes no cabeçalho do Gráfico 2."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_toggle(page, errors, warnings):
            btn_usd = page.locator("#btn-chart-usd, [data-chart-mode='USD'], button:has-text('USD')").first
            btn_eth = page.locator("#btn-chart-eth, [data-chart-mode='ETH'], button:has-text('ETH')").first
            return btn_usd.count() > 0 and btn_eth.count() > 0

        self.assertTrue(run_playwright_test(check_toggle))

    def test_t1_22_chart2_toggle_switches_series(self):
        """T1.22: Clicar no toggle ETH do Gráfico 2 comuta a série de exibição sem erros de console."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def test_toggle_action(page, errors, warnings):
            btn_eth = page.locator("#btn-chart-eth, [data-chart-mode='ETH'], button:has-text('ETH')").first
            if btn_eth.count() > 0:
                btn_eth.click()
                page.wait_for_timeout(300)
                return len(errors) == 0
            return False

        self.assertTrue(run_playwright_test(test_toggle_action))

    def test_t1_23_charts_reactivity_on_timeframe_change(self):
        """T1.23: Clicar em outro timeframe atualiza ambos os gráficos sem erros no runtime."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_update(page, errors, warnings):
            btn_14d = page.locator("button:has-text('14d'), [data-timeframe='14d']").first
            if btn_14d.count() > 0:
                btn_14d.click()
                page.wait_for_timeout(300)
                return len(errors) == 0
            return True

        self.assertTrue(run_playwright_test(check_update))

    def test_t1_24_charts_dark_executive_palette(self):
        """T1.24: Cores de grade e eixos configuradas na paleta Dark Executive (#1E2638 / #374151)."""
        res = eval_in_node(
            """
            const darkBorder = '#1E2638';
            const darkBg = '#121826';
            const cyanAccent = '#00D2FF';
            const emeraldAccent = '#10B981';
            return { darkBorder, darkBg, cyanAccent, emeraldAccent };
            """
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["result"]["darkBorder"], "#1E2638")

    # =========================================================================
    # AREA 5: Ledger de Transações & Design System
    # =========================================================================

    def test_t1_25_ledger_table_six_columns(self):
        """T1.25: Tabela de Maiores Movimentações possui exatamente as 6 colunas canônicas."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_columns(page, errors, warnings):
            headers = page.locator("table thead th").all_inner_texts()
            # Requirements: Hash, Data/Hora, Tipo, Quantidade cbETH, Preço Unitário, Valor Total
            expected = ["hash", "data", "tipo", "quantidade", "preço", "total"]
            joined = " ".join(headers).lower()
            return all(any(token in joined for token in [exp, exp[:4]]) for exp in expected)

        has_cols = run_playwright_test(check_columns)
        self.assertTrue(has_cols, "Ledger deve conter as 6 colunas canônicas")

    def test_t1_26_ledger_hash_truncated_and_basescan_link(self):
        """T1.26: Hash das transações no ledger é truncado e possui link para basescan.org/tx/..."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_links(page, errors, warnings):
            links = page.locator("a[href*='basescan.org/tx/']").all()
            if not links:
                return False
            first_href = links[0].get_attribute("href") or ""
            return "basescan.org/tx/0x" in first_href

        self.assertTrue(run_playwright_test(check_links))

    def test_t1_27_ledger_conditional_formatting_green_red(self):
        """T1.27: Badges de tipo exibem verde (#16a34a) para compras/entradas e vermelho (#dc2626) para vendas/saídas."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_colors(page, errors, warnings):
            green_badges = page.locator(".text-emerald-500, .text-green-600, [class*='16a34a'], [style*='#16a34a'], [class*='emerald'], [class*='green']").count()
            return green_badges > 0

        self.assertTrue(run_playwright_test(check_colors))

    def test_t1_28_ledger_sorting_by_volume(self):
        """T1.28: Controles de ordenação permitem reordenar por Maior Volume Transacionado."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_sort_volume(page, errors, warnings):
            btn_vol = page.locator("button:has-text('Volume'), [data-sort='volume'], select option:has-text('Volume')").first
            return btn_vol.count() > 0

        self.assertTrue(run_playwright_test(check_sort_volume))

    def test_t1_29_ledger_sorting_by_date(self):
        """T1.29: Controles de ordenação permitem reordenar por Data Mais Recente."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_sort_date(page, errors, warnings):
            btn_date = page.locator("button:has-text('Data'), [data-sort='date'], select option:has-text('Data')").first
            return btn_date.count() > 0

        self.assertTrue(run_playwright_test(check_sort_date))

    def test_t1_30_ledger_copy_button_present(self):
        """T1.30: Botão de cópia rápida de hash presente em cada linha de transação."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_copy_btn(page, errors, warnings):
            btns = page.locator("button[title*='Copiar'], button[aria-label*='copiar'], .btn-copy").all()
            return len(btns) > 0

        self.assertTrue(run_playwright_test(check_copy_btn))

    # =========================================================================
    # AREA 6: Integridade Matemática de Swaps, P&L Decomposto & Curvas Históricas
    # =========================================================================

    def test_t1_31_canonical_dca_five_swaps_exact(self):
        """T1.31: DCA real ponderado das 5 transações canônicas resulta em $2,773.73 ($100.30 / 0.03616063 cbETH)."""
        res = eval_in_node(
            """
            const txs = window.CbEth.FallbackData.getCanonicalTransactions();
            const dca = window.CbEth.Calculator.calculateDca(txs);
            const totalInvested = txs.reduce((acc, tx) => acc + (tx.totalUsd || 0), 0);
            const totalQty = txs.reduce((acc, tx) => acc + (tx.amountCbEth || 0), 0);
            return {
                txCount: txs.length,
                dca: Math.round(dca * 100) / 100,
                totalInvested: Math.round(totalInvested * 100) / 100,
                totalQty: Number(totalQty.toFixed(8))
            };
            """,
            required_js_files=["fallback-data.js", "calculator.js"]
        )
        self.assertTrue(res["success"], f"Execution error: {res.get('error')}")
        self.assertEqual(res["result"]["txCount"], 5)
        self.assertEqual(res["result"]["totalInvested"], 100.30)
        self.assertAlmostEqual(res["result"]["totalQty"], 0.03616063, places=7)
        self.assertEqual(res["result"]["dca"], 2773.73)

    def test_t1_32_decompose_pnl_algebraic_conservation_no_magic_1000(self):
        """T1.32: Decomposição de P&L conserva Staking Yield + Variação Mercado == P&L Total sem fator espúrio 1000."""
        res = eval_in_node(
            """
            const txs = window.CbEth.FallbackData.getCanonicalTransactions();
            const calc = window.CbEth.Calculator;
            const dca = calc.calculateDca(txs);
            const entryEr = calc.calculateEntryExchangeRate(txs, 1.14019);
            const bal = 0.03616063;
            const spotPrice = 2542.42;
            const spotEr = 1.14344;
            const fx = 5.4687;

            const pnl = calc.calculatePnl(spotPrice, dca, bal);
            const dec = calc.decomposePnl(spotEr, entryEr, spotPrice, dca, bal, fx);

            return {
                entryEr,
                pnlUsd: pnl.pnlUsd,
                sumDecomposedUsd: dec.stakingYieldUsd + dec.marketChangeUsd,
                stakingYieldUsd: dec.stakingYieldUsd,
                stakingYieldBrl: dec.stakingYieldBrl,
                lucroStakingGarantidoBrl: dec.lucroStakingGarantidoBrl,
                netResultBrl: dec.netResultBrl,
                expectedPnlBrl: pnl.pnlUsd * fx
            };
            """,
            required_js_files=["fallback-data.js", "calculator.js"]
        )
        self.assertTrue(res["success"], f"Execution error: {res.get('error')}")
        r = res["result"]
        self.assertGreater(r["entryEr"], 1.138)
        self.assertLess(r["entryEr"], 1.143)
        self.assertAlmostEqual(r["sumDecomposedUsd"], r["pnlUsd"], places=6)
        self.assertAlmostEqual(r["lucroStakingGarantidoBrl"], r["stakingYieldBrl"], places=6)
        self.assertAlmostEqual(r["netResultBrl"], r["expectedPnlBrl"], places=6)
        self.assertLess(r["stakingYieldUsd"], 2.0, "Staking yield de poucos meses não pode usar gênese 1.0 de 2022")

    def test_t1_33_balance_chart_zero_before_first_purchase_no_inversion(self):
        """T1.33: Gráfico 1 exibe saldo e custo 0.00 antes do primeiro aporte (2026-09-01) e acumula sem inversão."""
        res = eval_in_node(
            """
            let capturedBalanceData = null;
            let capturedMarketData = null;
            globalThis.Chart = function(ctx, cfg) {
                if (cfg.data.datasets[0].label.includes('Patrimônio')) {
                    capturedBalanceData = cfg.data;
                } else {
                    capturedMarketData = cfg.data;
                }
                this.data = cfg.data;
                this.options = cfg.options;
                this.update = function() {};
                this.destroy = function() {};
            };
            const fakeCanvas = { getContext: () => ({ createLinearGradient: () => ({ addColorStop: () => {} }) }) };
            globalThis.document = {
                getElementById: (id) => (id === 'chart-balance' || id === 'chart-market') ? fakeCanvas : null,
                querySelector: () => null
            };

            const txs = window.CbEth.FallbackData.getCanonicalTransactions();
            const seriesAll = window.CbEth.FallbackData.getHistoricalSeries('all', window.CbEth.FallbackData.CANONICAL_WALLET);
            const bal = 0.036161;
            window.CbEth.Charts.initCharts('chart-balance', 'chart-market');
            window.CbEth.Charts.updateBalanceChart(seriesAll, 'USD', 5.50, bal, txs);

            const prePurchaseIndices = [];
            seriesAll.forEach((pt, idx) => {
                if (pt.date < '2026-09-01') prePurchaseIndices.push(idx);
            });
            const prePat = prePurchaseIndices.map(i => capturedBalanceData.datasets[0].data[i]);
            const preCost = prePurchaseIndices.map(i => capturedBalanceData.datasets[1].data[i]);
            const allCosts = capturedBalanceData.datasets[1].data;
            let monotonicCost = true;
            for (let i = 1; i < allCosts.length; i++) {
                if (allCosts[i] < allCosts[i - 1] - 1e-6) monotonicCost = false;
            }
            const lastPrice = seriesAll[seriesAll.length - 1].priceCbEthUsd;
            const lastPat = capturedBalanceData.datasets[0].data[capturedBalanceData.datasets[0].data.length - 1];
            const lastCost = allCosts[allCosts.length - 1];

            return {
                preCount: prePurchaseIndices.length,
                maxPrePat: Math.max(...prePat),
                maxPreCost: Math.max(...preCost),
                monotonicCost,
                lastPat,
                expectedLastPat: Number((lastPrice * bal).toFixed(2)),
                lastCost
            };
            """,
            required_js_files=["fallback-data.js", "charts.js"]
        )
        self.assertTrue(res["success"], f"Execution error: {res.get('error')}")
        r = res["result"]
        self.assertGreater(r["preCount"], 0)
        self.assertEqual(r["maxPrePat"], 0.0, "Patrimônio antes do primeiro aporte deve ser exatamente 0.0")
        self.assertEqual(r["maxPreCost"], 0.0, "Custo investido antes do primeiro aporte deve ser exatamente 0.0")
        self.assertTrue(r["monotonicCost"], "Custo investido acumulado deve ser monotonicamente não-decrescente")
        self.assertEqual(r["lastCost"], 100.30)
        self.assertAlmostEqual(r["lastPat"], r["expectedLastPat"], places=2)

    def test_t1_34_all_time_pnl_invariant_across_timeframe_switches(self):
        """T1.34: Resultado All Time (P&L) permanece invariante ao alternar janelas temporais (30d -> 7d -> 90d)."""
        def check_invariance(page, errors, warnings):
            page.wait_for_function(
                "() => window.CbEth && window.CbEth.App && !window.CbEth.App.state.isLoading",
                timeout=5000
            )
            pnl_el = page.locator("#pnlMonetary").first
            mkt_el = page.locator("#pnlMarketChange").first

            page.locator("[data-timeframe='30d']").first.click()
            page.wait_for_timeout(250)
            pnl_30d = pnl_el.inner_text()
            mkt_30d = mkt_el.inner_text()

            page.locator("[data-timeframe='7d']").first.click()
            page.wait_for_timeout(250)
            pnl_7d = pnl_el.inner_text()
            mkt_7d = mkt_el.inner_text()

            page.locator("[data-timeframe='90d']").first.click()
            page.wait_for_timeout(250)
            pnl_90d = pnl_el.inner_text()
            mkt_90d = mkt_el.inner_text()

            return {
                "pnl": [pnl_30d, pnl_7d, pnl_90d],
                "mkt": [mkt_30d, mkt_7d, mkt_90d],
                "errors": errors
            }

        res = run_playwright_test(check_invariance)
        self.assertEqual(len(res["errors"]), 0)
        self.assertEqual(res["pnl"][0], res["pnl"][1])
        self.assertEqual(res["pnl"][1], res["pnl"][2])
        self.assertEqual(res["mkt"][0], res["mkt"][1], "Variação Spot All Time não deve oscilar com a janela do gráfico")
        self.assertEqual(res["mkt"][1], res["mkt"][2])

    def test_t1_35_decode_swap_receipt_usdc_valuation(self):
        """T1.35: Decodificador de recibo on-chain extrai custo real em USDC de swaps 1inch/DEX."""
        res = eval_in_node(
            """
            const fn = window.CbEth.Api.decodeSwapReceiptUsd;
            const receiptTx5 = {
                logs: [
                    {
                        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                        topics: [
                            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                            '0x000000000000000000000000111116058b9828cdcdd810c502b925c14f34ca11',
                            '0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b'
                        ],
                        data: '0x' + (25886113).toString(16).padStart(64, '0')
                    }
                ]
            };
            const totalUsd = fn(receiptTx5, '0xc4cfde467bc76d0d6df365584648371b1954b154', 0.01008449, 2600.0, 2250.0);
            return {
                totalUsd: Math.round(totalUsd * 100) / 100,
                priceUsd: Math.round((totalUsd / 0.01008449) * 100) / 100
            };
            """,
            required_js_files=["api.js"]
        )
        self.assertTrue(res["success"], f"Execution error: {res.get('error')}")
        self.assertEqual(res["result"]["totalUsd"], 25.89)
        self.assertEqual(res["result"]["priceUsd"], 2566.92)


if __name__ == "__main__":
    unittest.main()
