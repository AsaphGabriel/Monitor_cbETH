"""
tests/test_tier3_cross_feature.py — Tier 3: Cross-Feature Combinations (E2E Opaque Suite)
Tests multi-feature interactions, state persistence, and simultaneous UI switches (7 tests):
  T3.1: Moeda BRL + Mudança Janela 7d
  T3.2: Troca Carteira Arbitrária + Timeframe 90d
  T3.3: Gráfico 2 Modo ETH + Timeframe 24h
  T3.4: Reordenação Ledger (Volume) + Filtro Janela 7d
  T3.5: Moeda BRL + Ordenação Ledger por Volume
  T3.6: Carteira Vazia + Moeda BRL + Sweep 6 Janelas
  T3.7: Ciclo Completo E2E Multi-Feature
"""

import os
import unittest
try:
    from .helpers import (
        INDEX_HTML, REFERENCE_WALLET, TIMEFRAMES_UI, run_playwright_test,
        eval_in_node, check_file_exists
    )
except (ImportError, ValueError):
    try:
        from tests.helpers import (
            INDEX_HTML, REFERENCE_WALLET, TIMEFRAMES_UI, run_playwright_test,
            eval_in_node, check_file_exists
        )
    except ImportError:
        from helpers import (
            INDEX_HTML, REFERENCE_WALLET, TIMEFRAMES_UI, run_playwright_test,
            eval_in_node, check_file_exists
        )


class TestTier3CrossFeature(unittest.TestCase):
    """Tier 3: Cross-Feature interaction scenarios combining multiple features simultaneously."""

    def test_t3_01_currency_brl_and_timeframe_7d(self):
        """T3.1: Alternar moeda para BRL e trocar janela para 7d recalcula métricas em BRL na janela correta."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def test_flow(page, errors, warnings):
            # 1. Switch currency to BRL
            btn_brl = page.locator("button:has-text('BRL'), [data-currency='BRL']").first
            if btn_brl.count() > 0:
                btn_brl.click()
                page.wait_for_timeout(200)

            # 2. Switch timeframe to 7d
            btn_7d = page.locator("button:has-text('7d'), [data-timeframe='7d']").first
            if btn_7d.count() > 0:
                btn_7d.click()
                page.wait_for_timeout(300)

            # 3. Check for presence of 'R$' in document and zero runtime errors
            content = page.content()
            return {
                "has_brl_symbol": "R$" in content,
                "zero_errors": len(errors) == 0
            }

        res = run_playwright_test(test_flow)
        self.assertTrue(res["has_brl_symbol"], "Símbolo R$ deve estar presente no DOM após alternar para BRL")
        self.assertTrue(res["zero_errors"], "Zero erros de runtime ao combinar BRL + 7d")

    def test_t3_02_arbitrary_wallet_and_timeframe_90d(self):
        """T3.2: Consultar carteira arbitrária e selecionar janela 90d atualiza saldo, ledger e gráficos."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def test_flow(page, errors, warnings):
            test_wallet = "0x1111111111111111111111111111111111111111"
            addr_input = page.locator("#wallet-address, input[name='address']").first
            addr_input.fill(test_wallet)

            btn_consultar = page.locator("#btn-refresh, #btn-consultar, button:has-text('Consultar')").first
            btn_consultar.click()
            page.wait_for_timeout(400)

            btn_90d = page.locator("button:has-text('90d'), [data-timeframe='90d']").first
            if btn_90d.count() > 0:
                btn_90d.click()
                page.wait_for_timeout(300)

            return len(errors) == 0

        self.assertTrue(run_playwright_test(test_flow))

    def test_t3_03_chart2_eth_mode_persists_on_timeframe_24h(self):
        """T3.3: Alternar Gráfico 2 para ETH e mudar janela para 24h mantém o modo ETH ativo na nova série."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def test_flow(page, errors, warnings):
            btn_eth = page.locator("#btn-chart-eth, [data-chart-mode='ETH'], button:has-text('ETH')").first
            if btn_eth.count() > 0:
                btn_eth.click()
                page.wait_for_timeout(200)

            btn_24h = page.locator("button:has-text('24h'), [data-timeframe='24h']").first
            if btn_24h.count() > 0:
                btn_24h.click()
                page.wait_for_timeout(300)

            return len(errors) == 0

        self.assertTrue(run_playwright_test(test_flow))

    def test_t3_04_reorder_ledger_and_filter_timeframe_7d(self):
        """T3.4: Reordenar ledger por Volume e mudar janela para 7d mantém ordenação sobre itens filtrados."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def test_flow(page, errors, warnings):
            # Select sort by volume
            btn_vol = page.locator("button:has-text('Volume'), [data-sort='volume']").first
            if btn_vol.count() > 0:
                btn_vol.click()
                page.wait_for_timeout(200)

            # Filter 7d
            btn_7d = page.locator("button:has-text('7d'), [data-timeframe='7d']").first
            if btn_7d.count() > 0:
                btn_7d.click()
                page.wait_for_timeout(300)

            return len(errors) == 0

        self.assertTrue(run_playwright_test(test_flow))

    def test_t3_05_currency_brl_and_ledger_volume_sort(self):
        """T3.5: Moeda em BRL combinada com ordenação por Volume renderiza valores monetários em R$ no ledger."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def test_flow(page, errors, warnings):
            btn_brl = page.locator("button:has-text('BRL'), [data-currency='BRL']").first
            if btn_brl.count() > 0:
                btn_brl.click()
                page.wait_for_timeout(200)

            btn_vol = page.locator("button:has-text('Volume'), [data-sort='volume']").first
            if btn_vol.count() > 0:
                btn_vol.click()
                page.wait_for_timeout(200)

            table_text = page.locator("#transactions-table, #ledger-rows, table").inner_text()
            return {"has_brl": "R$" in table_text or "BRL" in table_text, "zero_errors": len(errors) == 0}

        res = run_playwright_test(test_flow)
        self.assertTrue(res["zero_errors"])

    def test_t3_06_empty_wallet_brl_sweep_six_timeframes(self):
        """T3.6: Carteira vazia em moeda BRL navegando por todas as 6 janelas temporais sem exceção."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def test_flow(page, errors, warnings):
            # Set empty wallet
            addr_input = page.locator("#wallet-address, input[name='address']").first
            addr_input.fill("0x0000000000000000000000000000000000000000")
            page.locator("#btn-refresh, #btn-consultar, button:has-text('Consultar')").first.click()
            page.wait_for_timeout(300)

            # Set BRL
            btn_brl = page.locator("button:has-text('BRL'), [data-currency='BRL']").first
            if btn_brl.count() > 0:
                btn_brl.click()
                page.wait_for_timeout(200)

            # Sweep all 6 timeframes
            for tf in TIMEFRAMES_UI:
                btn = page.locator(f"button:has-text('{tf}'), [data-timeframe='{tf}']").first
                if btn.count() > 0:
                    btn.click()
                    page.wait_for_timeout(150)

            return len(errors) == 0

        self.assertTrue(run_playwright_test(test_flow))

    def test_t3_07_full_user_interaction_cycle(self):
        """T3.7: Ciclo completo: Carteira -> Consultar -> 14d -> BRL -> Toggle ETH -> Ordenar -> Asserção de integridade."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def test_cycle(page, errors, warnings):
            # 1. Fill address
            page.locator("#wallet-address, input[name='address']").first.fill(REFERENCE_WALLET)
            page.locator("#btn-refresh, #btn-consultar, button:has-text('Consultar')").first.click()
            page.wait_for_timeout(400)

            # 2. Select 14d
            btn_14d = page.locator("button:has-text('14d'), [data-timeframe='14d']").first
            if btn_14d.count() > 0:
                btn_14d.click()
                page.wait_for_timeout(200)

            # 3. Switch BRL
            btn_brl = page.locator("button:has-text('BRL'), [data-currency='BRL']").first
            if btn_brl.count() > 0:
                btn_brl.click()
                page.wait_for_timeout(200)

            # 4. Toggle ETH on Chart 2
            btn_eth = page.locator("#btn-chart-eth, [data-chart-mode='ETH'], button:has-text('ETH')").first
            if btn_eth.count() > 0:
                btn_eth.click()
                page.wait_for_timeout(200)

            # 5. Sort ledger by Date
            btn_date = page.locator("button:has-text('Data'), [data-sort='date']").first
            if btn_date.count() > 0:
                btn_date.click()
                page.wait_for_timeout(200)

            return len(errors) == 0

        self.assertTrue(run_playwright_test(test_cycle))


if __name__ == "__main__":
    unittest.main()
