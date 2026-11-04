"""
tests/test_static_normative.py — Static & Normative Compliance Suite
Enforces constitutional Yggdrasil rules and integrity invariants:
  - Art. 9º: Zero Unicode Emoji characters across all .html, .js, .css
  - Art. 7º: Zero TODO, FIXME, or incomplete placeholders
  - Art. 2º/4º: PBIR/TMDL artifact preservation, zero null bytes, exactly 34 DAX measures
  - Integrity of canonical CSV datasets
  - Monitored status of legacy challenger tests
"""

import os
import glob
import unittest
try:
    from .helpers import (
        PROJECT_ROOT, TMDL_MEDIDAS, PBIP_FILE, POS_CSV, HIST_CSV,
        EMOJI_REGEX, FORBIDDEN_KEYWORDS
    )
except (ImportError, ValueError):
    try:
        from tests.helpers import (
            PROJECT_ROOT, TMDL_MEDIDAS, PBIP_FILE, POS_CSV, HIST_CSV,
            EMOJI_REGEX, FORBIDDEN_KEYWORDS
        )
    except ImportError:
        from helpers import (
            PROJECT_ROOT, TMDL_MEDIDAS, PBIP_FILE, POS_CSV, HIST_CSV,
            EMOJI_REGEX, FORBIDDEN_KEYWORDS
        )


class TestStaticNormative(unittest.TestCase):
    """Static checks enforcing constitutional governance and artifact preservation."""

    def test_s1_zero_emojis_in_web_artifacts(self):
        """Art. 9º: Ausência absoluta de caracteres emoji Unicode em todos os arquivos .html, .js, .css."""
        target_extensions = [".html", ".js", ".css"]
        violating_files = []

        for root, dirs, files in os.walk(PROJECT_ROOT):
            # Skip hidden directories and tests directory
            if any(p.startswith(".") for p in root.split(os.sep)):
                continue
            if "tests" in root.split(os.sep):
                continue
            if "modelos_visuais" in root.split(os.sep):
                continue

            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in target_extensions:
                    full_path = os.path.join(root, f)
                    try:
                        with open(full_path, "r", encoding="utf-8", errors="ignore") as fp:
                            content = fp.read()
                        matches = EMOJI_REGEX.findall(content)
                        if matches:
                            violating_files.append((os.path.relpath(full_path, PROJECT_ROOT), set(matches)))
                    except Exception as ex:
                        violating_files.append((os.path.relpath(full_path, PROJECT_ROOT), str(ex)))

        self.assertEqual(
            len(violating_files), 0,
            f"Violação do Art. 9º (Zero Emojis Unicode detectados): {violating_files}"
        )

    def test_s2_zero_todos_or_incomplete_placeholders(self):
        """Art. 7º: Ausência de TODO, FIXME ou stubs incompletos em todos os arquivos de código web da SPA."""
        target_extensions = [".html", ".js"]
        violations = []

        for root, dirs, files in os.walk(PROJECT_ROOT):
            if any(p.startswith(".") for p in root.split(os.sep)):
                continue
            if "tests" in root.split(os.sep):
                continue

            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in target_extensions:
                    full_path = os.path.join(root, f)
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as fp:
                        for line_idx, line in enumerate(fp, 1):
                            for pat in FORBIDDEN_KEYWORDS:
                                if pat.search(line):
                                    violations.append(f"{os.path.relpath(full_path, PROJECT_ROOT)}:{line_idx} — '{line.strip()}'")

        self.assertEqual(
            len(violations), 0,
            f"Violação do Art. 7º (TODO/FIXME/Placeholders detectados): {violations}"
        )

    def test_s3_pbir_tmdl_preservation_and_integrity(self):
        """Preservação inegociável do Power BI PBIR v2.0.0 e modelo TMDL com 34 medidas DAX."""
        # 1. PBIP file exists
        self.assertTrue(os.path.exists(PBIP_FILE), f"Arquivo {PBIP_FILE} não encontrado")

        # 2. _Medidas.tmdl exists
        self.assertTrue(os.path.exists(TMDL_MEDIDAS), f"Arquivo {TMDL_MEDIDAS} não encontrado")

        # 3. Check for zero null bytes in all TMDL files
        tmdl_files = glob.glob(os.path.join(PROJECT_ROOT, "**", "*.tmdl"), recursive=True)
        self.assertGreater(len(tmdl_files), 0, "Nenhum arquivo .tmdl encontrado")

        for tf in tmdl_files:
            with open(tf, "rb") as fp:
                raw = fp.read()
            self.assertNotIn(b"\x00", raw, f"Null byte encontrado em {os.path.relpath(tf, PROJECT_ROOT)}")

        # 4. Count DAX measures in _Medidas.tmdl
        with open(TMDL_MEDIDAS, "r", encoding="utf-8") as fp:
            content = fp.read()
        import re
        measures = re.findall(r"^\t?measure\s+'([^']+)'", content, re.MULTILINE)
        measure_count = len(measures)
        self.assertEqual(measure_count, 34, f"Esperadas 34 medidas DAX em _Medidas.tmdl, encontradas {measure_count}")

    def test_s4_canonical_csv_datasets_integrity(self):
        """Preservação e integridade dos CSVs físicos em dados/."""
        self.assertTrue(os.path.exists(POS_CSV), f"{POS_CSV} não encontrado")
        self.assertTrue(os.path.exists(HIST_CSV), f"{HIST_CSV} não encontrado")

        with open(POS_CSV, "r", encoding="utf-8") as f:
            pos_lines = [l.strip() for l in f if l.strip()]
        self.assertGreaterEqual(len(pos_lines), 2, "fato_posicao_atual.csv deve conter cabeçalho e dados")

        with open(HIST_CSV, "r", encoding="utf-8") as f:
            hist_lines = [l.strip() for l in f if l.strip()]
        self.assertGreaterEqual(len(hist_lines), 31, "fato_historico_30d.csv deve conter ao menos 30 dias de dados")

    def test_s5_legacy_challenger_scripts_exist(self):
        """Scripts de testes legados do Milestone M1 existem e estão prontos para execução."""
        f1 = os.path.join(PROJECT_ROOT, "test_challenger_m1_full_suite.py")
        f2 = os.path.join(PROJECT_ROOT, "test_challenger_m1_oracle.py")
        self.assertTrue(os.path.exists(f1), f"{f1} deve existir")
        self.assertTrue(os.path.exists(f2), f"{f2} deve existir")


if __name__ == "__main__":
    unittest.main()
