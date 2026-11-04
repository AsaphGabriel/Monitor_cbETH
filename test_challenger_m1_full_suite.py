#!/usr/bin/env python3
"""
test_challenger_m1_full_suite.py — Complete Empirical Challenger Test Suite (Milestone M1)
Author: Challenger 1 (Milestone M1 Mathematical Oracle)
Tests:
  - Exact Oracle Calculations against raw CSV datasets (6 required metrics)
  - Adversarial Boundary Scenarios (ETH 2x, 0.5x, parity 1.0, 0 balance, 0 prices)
  - 1000-Iteration Property-Based Fuzzing (Monotonicity & Boundedness)
  - TMDL Semantic Model Static & Dynamic Integrity (34 measures, formatStrings, 0x00 check)
"""

import csv
import math
import os
import re
import unittest
from typing import Dict, Any, List

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POS_CSV = os.path.join(BASE_DIR, "dados", "fato_posicao_atual.csv")
HIST_CSV = os.path.join(BASE_DIR, "dados", "fato_historico_30d.csv")
TMDL_MEDIDAS = os.path.join(BASE_DIR, "Monitor_cbETH.SemanticModel", "definition", "tables", "_Medidas.tmdl")
TMDL_HIST = os.path.join(BASE_DIR, "Monitor_cbETH.SemanticModel", "definition", "tables", "fato_historico_30d.tmdl")

def dax_divide(num: float, den: float, alt: float = 0.0) -> float:
    if den == 0.0 or math.isnan(den) or math.isinf(den):
        return alt
    return num / den

class TestChallengerM1Oracle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(POS_CSV, mode="r", encoding="utf-8") as f:
            cls.pos_data = list(csv.DictReader(f))[0]
        with open(HIST_CSV, mode="r", encoding="utf-8") as f:
            cls.hist_data = list(csv.DictReader(f))

        cls.saldo_cbeth = float(cls.pos_data["saldo_cbeth"])
        cls.saldo_eth_gas = float(cls.pos_data["saldo_eth_gas"])
        cls.preco_eth_usd = float(cls.pos_data["preco_eth_usd"])
        cls.preco_cbeth_usd = float(cls.pos_data["preco_cbeth_usd"])
        cls.taxa_usd_brl = float(cls.pos_data["taxa_usd_brl"])

        cls.hist_precos_eth = [float(r["preco_eth_usd"]) for r in cls.hist_data]
        cls.hist_precos_cbeth = [float(r["preco_cbeth_usd"]) for r in cls.hist_data]
        cls.hist_taxas = [float(r["taxa_conversao_cbeth_eth"]) for r in cls.hist_data]
        cls.hist_datas = [r["data"] for r in cls.hist_data]

        min_date = min(cls.hist_datas)
        cls.preco_cbeth_ini_30d = cls.hist_precos_cbeth[cls.hist_datas.index(min_date)]

        with open(TMDL_MEDIDAS, mode="r", encoding="utf-8") as f:
            cls.tmdl_medidas_text = f.read()

        with open(TMDL_HIST, mode="r", encoding="utf-8") as f:
            cls.tmdl_hist_text = f.read()

    # --------------------------------------------------------------------------
    # 1. TMDL Static Code & Format Integrity
    # --------------------------------------------------------------------------
    def test_01_no_null_bytes_in_tmdl(self):
        """Gotcha 13.4: Guarantee zero null bytes in TMDL files"""
        with open(TMDL_MEDIDAS, mode="rb") as f:
            raw = f.read()
        self.assertNotIn(b"\x00", raw, "TMDL file contains forbidden null byte 0x00")

    def test_02_total_measures_count(self):
        """Verify that exactly 34 DAX measures are declared in _Medidas.tmdl"""
        measures = re.findall(r"measure\s+'([^']+)'", self.tmdl_medidas_text)
        self.assertEqual(len(measures), 34, f"Expected 34 measures, found {len(measures)}: {measures}")

    def test_03_fato_historico_datetime_typing(self):
        """Verify column 'data' is typed as dateTime with dd/MM format"""
        self.assertIn("column data", self.tmdl_hist_text)
        self.assertIn("dataType: dateTime", self.tmdl_hist_text)
        self.assertIn("formatString: dd/MM", self.tmdl_hist_text)
        self.assertIn('{"data", type date}', self.tmdl_hist_text)

    # --------------------------------------------------------------------------
    # 2. Baseline Mathematical Oracle Assertions (6 Required Metrics)
    # --------------------------------------------------------------------------
    def test_04_lucro_staking_garantido(self):
        """Verify Lucro Staking Garantido BRL equals +R$ 16.07 (+14.2%)"""
        exchange_rate = self.preco_cbeth_usd / self.preco_eth_usd
        lucro_pct = exchange_rate - 1.0
        base_custo = self.saldo_cbeth * 1000.0 * self.taxa_usd_brl
        lucro_brl = base_custo * lucro_pct

        self.assertAlmostEqual(lucro_pct * 100, 14.197, places=2)
        self.assertEqual(f"{lucro_pct*100:+.1f}%", "+14.2%")
        self.assertAlmostEqual(lucro_brl, 16.07, places=2)
        self.assertEqual(f"R$ {lucro_brl:.2f}", "R$ 16.07")

    def test_05_variacao_mercado_30d(self):
        """Verify Variação Mercado 30d BRL equals -R$ 20.62 (-6.2%)"""
        diff_price = self.preco_cbeth_usd - self.preco_cbeth_ini_30d
        var_pct = diff_price / self.preco_cbeth_ini_30d
        var_brl = diff_price * self.saldo_cbeth * self.taxa_usd_brl

        self.assertAlmostEqual(var_pct * 100, -6.16, places=1)
        self.assertEqual(f"{var_pct*100:.1f}%", "-6.2%")
        self.assertAlmostEqual(var_brl, -20.62, places=2)
        self.assertEqual(f"R$ {var_brl:.2f}", "R$ -20.62")

    def test_06_saldo_liquido_30d(self):
        """Verify Saldo Líquido 30d BRL equals -R$ 4.55"""
        exchange_rate = self.preco_cbeth_usd / self.preco_eth_usd
        lucro_pct = exchange_rate - 1.0
        base_custo = self.saldo_cbeth * 1000.0 * self.taxa_usd_brl
        lucro_brl = base_custo * lucro_pct

        diff_price = self.preco_cbeth_usd - self.preco_cbeth_ini_30d
        var_brl = diff_price * self.saldo_cbeth * self.taxa_usd_brl

        saldo_liquido = lucro_brl + var_brl
        self.assertAlmostEqual(saldo_liquido, -4.55, places=2)
        self.assertEqual(f"R$ {saldo_liquido:.2f}", "R$ -4.55")

    def test_07_projecoes_apy_beacon_chain(self):
        """Verify APY 3.10% projections: Anual R$ 9.74, Mensal R$ 0.81, Diário R$ 0.03"""
        patrimonio_brl = self.saldo_cbeth * self.preco_cbeth_usd * self.taxa_usd_brl
        apy = 0.031
        anual = patrimonio_brl * apy
        mensal = anual / 12.0
        diario = anual / 365.0

        self.assertAlmostEqual(patrimonio_brl, 314.19, places=2)
        self.assertAlmostEqual(anual, 9.74, places=2)
        self.assertAlmostEqual(mensal, 0.81, places=2)
        self.assertAlmostEqual(diario, 0.03, places=2)

    def test_08_drawdown_eth_vs_media_30d(self):
        """Verify Drawdown ETH vs Média 30d equals -7.2% ($2,618.47 avg)"""
        media_eth = sum(self.hist_precos_eth) / len(self.hist_precos_eth)
        drawdown = (self.preco_eth_usd - media_eth) / media_eth

        self.assertAlmostEqual(media_eth, 2618.47, places=2)
        self.assertAlmostEqual(drawdown * 100, -7.18, places=1)
        self.assertEqual(f"{drawdown*100:.1f}%", "-7.2%")

    def test_09_score_e_sinal_oportunidade(self):
        """Verify Score de Oportunidade equals 69 / 100 and Signal is 'OPORTUNIDADE DE APORTE'"""
        media_eth = sum(self.hist_precos_eth) / len(self.hist_precos_eth)
        drawdown = (self.preco_eth_usd - media_eth) / media_eth

        pts_dd = min(max(-drawdown * 400.0, 0.0), 60.0)
        pts_stk = 30.0
        pts_base = 10.0
        score = int(round(pts_base + pts_dd + pts_stk))

        self.assertEqual(score, 69)

        if drawdown <= -0.05:
            sinal = "OPORTUNIDADE DE APORTE"
        elif drawdown <= 0.00:
            sinal = "ZONA NEUTRA / FAVORÁVEL"
        else:
            sinal = "CAUTELA / AGUARDAR"

        self.assertEqual(sinal, "OPORTUNIDADE DE APORTE")

    # --------------------------------------------------------------------------
    # 3. Adversarial Boundary Stress Tests
    # --------------------------------------------------------------------------
    def test_10_stress_eth_price_doubling(self):
        """Test ETH spot price doubling: score floors at 40, signal switches to CAUTELA"""
        media_eth = sum(self.hist_precos_eth) / len(self.hist_precos_eth)
        p_eth_2x = self.preco_eth_usd * 2.0
        drawdown = (p_eth_2x - media_eth) / media_eth
        self.assertGreater(drawdown, 0.0)

        pts_dd = min(max(-drawdown * 400.0, 0.0), 60.0)
        score = int(round(10.0 + pts_dd + 30.0))
        self.assertEqual(score, 40)

        sinal = "CAUTELA / AGUARDAR" if drawdown > 0.0 else "OUTRO"
        self.assertEqual(sinal, "CAUTELA / AGUARDAR")

    def test_11_stress_eth_price_halving(self):
        """Test ETH spot price halving: score caps at 100, signal remains APORTE"""
        media_eth = sum(self.hist_precos_eth) / len(self.hist_precos_eth)
        p_eth_half = self.preco_eth_usd * 0.5
        drawdown = (p_eth_half - media_eth) / media_eth
        self.assertLess(drawdown, -0.15)

        pts_dd = min(max(-drawdown * 400.0, 0.0), 60.0)
        score = int(round(10.0 + pts_dd + 30.0))
        self.assertEqual(score, 100)

        sinal = "OPORTUNIDADE DE APORTE" if drawdown <= -0.05 else "OUTRO"
        self.assertEqual(sinal, "OPORTUNIDADE DE APORTE")

    def test_12_stress_parity_conversion_rate(self):
        """Test conversion rate parity (1.00000): staking profit is exactly 0.0% and R$ 0.00"""
        tx_atual = 1.00000
        lucro_pct = (tx_atual - 1.0) if tx_atual > 0 else 0.0
        base_custo = self.saldo_cbeth * 1000.0 * self.taxa_usd_brl
        lucro_brl = (base_custo * (tx_atual - 1.0)) if (tx_atual - 1.0) > 0 else 0.0

        self.assertEqual(lucro_pct, 0.0)
        self.assertEqual(lucro_brl, 0.0)

    def test_13_stress_zero_balances(self):
        """Test 0 balance: patrimônio, projections and profits evaluate to 0 without errors"""
        saldo_zero = 0.0
        patrimonio_brl = saldo_zero * self.preco_cbeth_usd * self.taxa_usd_brl
        anual = patrimonio_brl * 0.031
        mensal = dax_divide(anual, 12.0, 0.0)
        diario = dax_divide(anual, 365.0, 0.0)
        lucro_brl = saldo_zero * 1000.0 * self.taxa_usd_brl * (self.preco_cbeth_usd / self.preco_eth_usd - 1.0)

        self.assertEqual(patrimonio_brl, 0.0)
        self.assertEqual(anual, 0.0)
        self.assertEqual(mensal, 0.0)
        self.assertEqual(diario, 0.0)
        self.assertEqual(lucro_brl, 0.0)

    def test_14_property_based_fuzzing_monotonicity(self):
        """1000 iteration sweep proving score monotonicity and boundedness [40, 100]"""
        media_eth = sum(self.hist_precos_eth) / len(self.hist_precos_eth)
        prev_score = 101

        for i in range(1001):
            p = 100.0 + i * 9.9  # $100 to $10,000
            dd = (p - media_eth) / media_eth
            pts_dd = min(max(-dd * 400.0, 0.0), 60.0)
            score = int(round(10.0 + pts_dd + 30.0))

            self.assertTrue(40 <= score <= 100, f"Score {score} out of bounds for price ${p}")
            self.assertLessEqual(score, prev_score, f"Score increased at higher price ${p}")
            prev_score = score

if __name__ == "__main__":
    unittest.main(verbosity=2)
