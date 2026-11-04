#!/usr/bin/env python3
"""
tests/test_e2e_runner.py — Unified E2E Test Suite Runner for Monitor cbETH
Executes Tiers 1-4 plus Static & Normative checks, outputting structured reports.

Usage:
  python3 tests/test_e2e_runner.py
  python3 tests/test_e2e_runner.py --tier 1
  python3 tests/test_e2e_runner.py --tier 2
  python3 tests/test_e2e_runner.py --tier 3
  python3 tests/test_e2e_runner.py --tier 4
  python3 tests/test_e2e_runner.py --tier static
  python3 tests/test_e2e_runner.py --verbose
"""

import os
import sys
import time
import argparse
import unittest
from typing import Dict, Any, List

# Ensure parent directory is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Import test cases
from tests.test_tier1_feature_coverage import TestTier1FeatureCoverage
from tests.test_tier2_boundary_corner import TestTier2BoundaryCorner
from tests.test_tier3_cross_feature import TestTier3CrossFeature
from tests.test_tier4_workloads import TestTier4Workloads
from tests.test_static_normative import TestStaticNormative


TIER_REGISTRY = {
    "1": ("Tier 1: Feature Coverage", TestTier1FeatureCoverage),
    "2": ("Tier 2: Boundary & Corner Cases", TestTier2BoundaryCorner),
    "3": ("Tier 3: Cross-Feature Combinations", TestTier3CrossFeature),
    "4": ("Tier 4: Real-World Workloads", TestTier4Workloads),
    "static": ("Static & Normative Compliance", TestStaticNormative)
}


class DetailedTestResult(unittest.TestResult):
    """Custom TestResult collecting detailed execution statistics and diagnostic errors."""

    def __init__(self):
        super().__init__()
        self.successes: List[unittest.TestCase] = []

    def addSuccess(self, test: unittest.TestCase):
        super().addSuccess(test)
        self.successes.append(test)


def run_suite_for_tier(tier_key: str, verbose: bool = False) -> Dict[str, Any]:
    """Runs tests for a specific Tier and returns a metrics dictionary."""
    tier_name, test_class = TIER_REGISTRY[tier_key]
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(test_class)

    result = DetailedTestResult()
    start_time = time.time()
    suite.run(result)
    elapsed = time.time() - start_time

    return {
        "tier_key": tier_key,
        "tier_name": tier_name,
        "total": suite.countTestCases(),
        "passed": len(result.successes),
        "failed": len(result.failures),
        "errors": len(result.errors),
        "skipped": len(result.skipped),
        "elapsed": elapsed,
        "failures_list": result.failures,
        "errors_list": result.errors,
        "skipped_list": result.skipped
    }


def print_banner():
    print("=" * 80)
    print("🌲 MONITOR cbETH (BASE L2) — END-TO-END (E2E) TEST SUITE RUNNER")
    print(f"Target: {PROJECT_ROOT}")
    print(f"Python: {sys.version.split()[0]} | Node: available | Playwright: available")
    print("=" * 80)


def print_summary_table(tier_results: List[Dict[str, Any]]):
    print("\n" + "-" * 80)
    print(f"{'Tier / Suite':<40} | {'Total':>5} | {'Pass':>5} | {'Fail':>5} | {'Skip':>5} | {'Time':>7}")
    print("-" * 80)

    total_tests = 0
    total_passed = 0
    total_failed = 0
    total_skipped = 0
    total_time = 0.0

    for r in tier_results:
        total_tests += r["total"]
        total_passed += r["passed"]
        total_failed += (r["failed"] + r["errors"])
        total_skipped += r["skipped"]
        total_time += r["elapsed"]

        status_str = f"{r['tier_name']:<40} | {r['total']:>5} | {r['passed']:>5} | {r['failed'] + r['errors']:>5} | {r['skipped']:>5} | {r['elapsed']:>6.2f}s"
        print(status_str)

    print("-" * 80)
    print(f"{'TOTAL COMPREHENSIVE SUITE':<40} | {total_tests:>5} | {total_passed:>5} | {total_failed:>5} | {total_skipped:>5} | {total_time:>6.2f}s")
    print("-" * 80)


def print_diagnostics(tier_results: List[Dict[str, Any]]):
    has_issues = any(r["failed"] > 0 or r["errors"] > 0 for r in tier_results)
    if not has_issues:
        print("\n✔ All active tests passed successfully.")
        return

    print("\n" + "!" * 80)
    print("DIAGNOSTIC FAILURE DETAILS")
    print("!" * 80)

    for r in tier_results:
        for test, trace in r["failures_list"]:
            print(f"\n[FAIL] {r['tier_name']} :: {test.id()}")
            print(trace)
        for test, trace in r["errors_list"]:
            print(f"\n[ERROR] {r['tier_name']} :: {test.id()}")
            print(trace)


def main():
    parser = argparse.ArgumentParser(description="Monitor cbETH E2E Unified Runner")
    parser.add_argument(
        "--tier",
        choices=["1", "2", "3", "4", "static", "all"],
        default="all",
        help="Specify which Tier to run (default: all)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Verbose test execution"
    )
    args = parser.parse_args()

    print_banner()

    tiers_to_run = (
        ["1", "2", "3", "4", "static"]
        if args.tier == "all"
        else [args.tier]
    )

    tier_results = []
    for t_key in tiers_to_run:
        res = run_suite_for_tier(t_key, verbose=args.verbose)
        tier_results.append(res)

    print_summary_table(tier_results)
    print_diagnostics(tier_results)

    total_failures = sum(r["failed"] + r["errors"] for r in tier_results)
    if total_failures > 0:
        print(f"\n❌ SUITE VERDICT: FAIL ({total_failures} failure(s) detected)")
        sys.exit(1)
    else:
        print("\n✅ SUITE VERDICT: PASS (0 failures)")
        sys.exit(0)


if __name__ == "__main__":
    main()
