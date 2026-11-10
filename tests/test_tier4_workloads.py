"""
tests/test_tier4_workloads.py — Tier 4: Real-World Workloads (E2E Opaque Suite)
Tests end-to-end real usage scenarios, local file:// protocol loading, reference data parity,
stress workloads, and responsive layout fidelity (5 tests):
  T4.1: Abertura Local Zero-Build (file://) sem erros de console
  T4.2: Paridade de Dados Reais da Carteira de Referência
  T4.3: Paridade e Integridade Semântica index.html vs dashboard_interativo.html
  T4.4: Workload de Estresse de Navegação (30 Ações Rápidas)
  T4.5: Visualização Responsiva Multi-Resolução (Mobile, Tablet, Desktop)
"""

import os
import unittest
try:
    from .helpers import (
        INDEX_HTML, DASHBOARD_HTML, REFERENCE_WALLET, CANONICAL_TX_HASHES,
        run_playwright_test, eval_in_node, check_file_exists
    )
except (ImportError, ValueError):
    try:
        from tests.helpers import (
            INDEX_HTML, DASHBOARD_HTML, REFERENCE_WALLET, CANONICAL_TX_HASHES,
            run_playwright_test, eval_in_node, check_file_exists
        )
    except ImportError:
        from helpers import (
            INDEX_HTML, DASHBOARD_HTML, REFERENCE_WALLET, CANONICAL_TX_HASHES,
            run_playwright_test, eval_in_node, check_file_exists
        )


class TestTier4Workloads(unittest.TestCase):
    """Tier 4: Real-World Workloads verifying real-life user journeys and production constraints."""

    def test_t4_01_local_file_protocol_zero_console_errors(self):
        """T4.1: Abertura local direta via protocolo file:// carrega sem erros de script (console.error = 0, pageerror = 0)."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def check_load(page, errors, warnings):
            title = page.title()
            return {
                "title": title,
                "error_count": len(errors),
                "errors": errors
            }

        res = run_playwright_test(check_load)
        self.assertEqual(res["error_count"], 0, f"Erros detectados no console: {res['errors']}")
        self.assertTrue(len(res["title"]) > 0, "Título da página deve estar preenchido")

    def test_t4_02_canonical_wallet_data_parity(self):
        """T4.2: Paridade com dados reais da carteira de referência: saldo 0.046924 cbETH, 0.000231 ETH e 7 aportes auditados."""
        res = eval_in_node(
            f"""
            const pos = window.CbEth.FallbackData.getCanonicalPosition();
            const txs = window.CbEth.FallbackData.getCanonicalTransactions();
            return {{
                address: pos.address.toLowerCase(),
                balanceCbEth: pos.balanceCbEth,
                balanceEthGas: pos.balanceEthGas,
                txCount: txs.length,
                txHashes: txs.map(t => t.hash.toLowerCase())
            }};
            """,
            required_js_files=["fallback-data.js"]
        )
        self.assertTrue(res["success"], f"Execution error: {res.get('error')}")
        self.assertEqual(res["result"]["address"], REFERENCE_WALLET.lower())
        self.assertAlmostEqual(res["result"]["balanceCbEth"], 0.046924, places=6)
        self.assertAlmostEqual(res["result"]["balanceEthGas"], 0.000231, places=6)
        self.assertEqual(res["result"]["txCount"], 7)
        for h in CANONICAL_TX_HASHES:
            self.assertIn(h.lower(), res["result"]["txHashes"])

    def test_t4_03_index_and_dashboard_semantic_parity(self):
        """T4.3: Paridade e integridade semântica entre index.html e dashboard_interativo.html."""
        if not os.path.exists(INDEX_HTML) or not os.path.exists(DASHBOARD_HTML):
            self.skipTest("index.html or dashboard_interativo.html missing")

        with open(INDEX_HTML, "r", encoding="utf-8") as f1, open(DASHBOARD_HTML, "r", encoding="utf-8") as f2:
            c1 = f1.read().lower()
            c2 = f2.read().lower()

        core_elements = [
            "monitor cbeth",
            "base l2",
            "carteira",
            "dca",
            "termômetro",
            "staking"
        ]
        for elem in core_elements:
            self.assertIn(elem, c1, f"Termo '{elem}' ausente em index.html")
            self.assertIn(elem, c2, f"Termo '{elem}' ausente em dashboard_interativo.html")

    def test_t4_04_stress_navigation_rapid_clicks(self):
        """T4.4: Workload de estresse de navegação com 30 ações rápidas alternadas sem fugas ou quebras de UI."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        def test_stress(page, errors, warnings):
            # Sequence of 30 rapid clicks
            timeframes = ["24h", "7d", "14d", "30d", "90d", "Tudo"]
            currencies = ["USD", "BRL"]

            for i in range(15):
                tf = timeframes[i % len(timeframes)]
                cur = currencies[i % len(currencies)]

                btn_tf = page.locator(f"button:has-text('{tf}'), [data-timeframe='{tf}']").first
                if btn_tf.count() > 0:
                    btn_tf.click()

                btn_cur = page.locator(f"button:has-text('{cur}'), [data-currency='{cur}']").first
                if btn_cur.count() > 0:
                    btn_cur.click()

                page.wait_for_timeout(30)

            return len(errors) == 0

        self.assertTrue(run_playwright_test(test_stress))

    def test_t4_05_responsive_layout_viewports(self):
        """T4.5: Visualização responsiva em Mobile (375x667), Tablet (768x1024) e Desktop (1920x1080) sem transbordamento."""
        if not os.path.exists(INDEX_HTML):
            self.skipTest("index.html not created yet")

        viewports = [
            {"width": 375, "height": 667, "name": "Mobile"},
            {"width": 768, "height": 1024, "name": "Tablet"},
            {"width": 1920, "height": 1080, "name": "Desktop"}
        ]

        for vp in viewports:
            def check_viewport(page, errors, warnings):
                # Verify body scroll width does not exceed client width by more than 10px (no horizontal overflow)
                scroll_w = page.evaluate("() => document.documentElement.scrollWidth")
                client_w = page.evaluate("() => document.documentElement.clientWidth")
                diff = scroll_w - client_w
                return diff <= 10

            fits = run_playwright_test(check_viewport, viewport={"width": vp["width"], "height": vp["height"]})
            self.assertTrue(fits, f"Transbordamento horizontal detectado em resolução {vp['name']} ({vp['width']}x{vp['height']})")


if __name__ == "__main__":
    unittest.main()
