"""
tests/helpers.py — Test infrastructure helpers for Monitor cbETH E2E suite
Provides Node.js runner, Playwright browser harness, static scanners, and contract constants.
"""

import os
import re
import json
import subprocess
from typing import Dict, Any, List, Optional, Tuple, Callable

# Project Directories & Paths
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INDEX_HTML = os.path.join(PROJECT_ROOT, "index.html")
DASHBOARD_HTML = os.path.join(PROJECT_ROOT, "dashboard_interativo.html")
JS_DIR = os.path.join(PROJECT_ROOT, "js")
DADOS_DIR = os.path.join(PROJECT_ROOT, "dados")
POS_CSV = os.path.join(DADOS_DIR, "fato_posicao_atual.csv")
HIST_CSV = os.path.join(DADOS_DIR, "fato_historico_30d.csv")
TMDL_MEDIDAS = os.path.join(PROJECT_ROOT, "Monitor_cbETH.SemanticModel", "definition", "tables", "_Medidas.tmdl")
PBIP_FILE = os.path.join(PROJECT_ROOT, "Monitor_cbETH.pbip")

# Canonical Web3 & Contract Constants
REFERENCE_WALLET = "0xc4cfde467bc76d0d6df365584648371b1954b154"
CBETH_CONTRACT = "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22"
BASE_RPC_PRIMARY = "https://mainnet.base.org"
BASE_RPC_FAILOVER = "https://base-rpc.publicnode.com"
CANONICAL_TX_HASHES = [
    "0x2fd9b33a75bb78b3fe0b2d3989c9ee09971912957fbb3c70f6120e7d5830eb99",
    "0xb5d2d0b5ff8512e9b0d62a342416ee3c2ef3be5045479cb2be4aa1796ca8ef8d",
    "0x4a9d7bdfaa373d523624e7561cf05db69fa7f4f6b57ae1ec9b8a07c3fb3c6b25"
]
TIMEFRAMES = ["24h", "7d", "14d", "30d", "90d", "all"]
TIMEFRAMES_UI = ["24h", "7d", "14d", "30d", "90d", "Tudo"]

# Art. 9º Regex: Unicode Emoji ranges (prohibited in .html, .js, .css)
EMOJI_REGEX = re.compile(
    r"[\U0001F600-\U0001F64F"  # Emoticons
    r"\U0001F300-\U0001F5FF"  # Misc Symbols and Pictographs
    r"\U0001F680-\U0001F6FF"  # Transport and Map
    r"\U0001F700-\U0001F77F"  # Alchemical Symbols
    r"\U0001F780-\U0001F7FF"  # Geometric Shapes Extended
    r"\U0001F800-\U0001F8FF"  # Supplemental Arrows-C
    r"\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
    r"\U0001FA00-\U0001FA6F"  # Chess Symbols
    r"\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
    r"\U00002600-\U000026FF"  # Misc symbols (like ⚠️, ⚡, ☕, etc.)
    r"\U00002700-\U000027BF]"  # Dingbats
)

# Art. 7º Forbidden tokens
FORBIDDEN_KEYWORDS = [
    re.compile(r"\bTODO\b"),
    re.compile(r"\bFIXME\b"),
    re.compile(r"\bSTUB\b", re.IGNORECASE),
    re.compile(r"\bMOCK_DATA_PLACEHOLDER\b")
]


def check_file_exists(rel_path: str) -> bool:
    """Check if a relative path exists inside PROJECT_ROOT."""
    full = os.path.join(PROJECT_ROOT, rel_path)
    return os.path.exists(full)


def eval_in_node(
    js_code: str,
    required_js_files: Optional[List[str]] = None,
    timeout_sec: int = 5
) -> Dict[str, Any]:
    """
    Evaluates a JavaScript snippet using Node.js, pre-loading any required JS files.
    Injects a minimal browser-like global environment (window, document, console).
    Returns a dict with 'success': True/False, 'result': parsed JSON or raw output, and 'error'.
    """
    scripts_content = []
    if required_js_files:
        for f in required_js_files:
            file_path = os.path.join(JS_DIR, f) if not os.path.isabs(f) else f
            if not os.path.exists(file_path):
                return {
                    "success": False,
                    "error": f"Required JS file missing: {file_path}",
                    "result": None
                }
            with open(file_path, "r", encoding="utf-8") as js_f:
                scripts_content.append(js_f.read())

    # Build the self-contained execution wrapper
    bootstrap = """
// Browser Shim
global.window = global;
global.window.CbEth = global.window.CbEth || {};
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => ({
        setAttribute: () => {},
        classList: { add: () => {}, remove: () => {} },
        appendChild: () => {}
    })
};
global.localStorage = {
    _data: {},
    getItem: (k) => global.localStorage._data[k] || null,
    setItem: (k, v) => { global.localStorage._data[k] = String(v); },
    removeItem: (k) => { delete global.localStorage._data[k]; },
    clear: () => { global.localStorage._data = {}; }
};
"""
    full_script = bootstrap + "\n" + "\n".join(scripts_content) + "\n" + f"""
(async () => {{
    try {{
        const __result = await (async () => {{
            {js_code}
        }})();
        console.log("__RESULT__:" + JSON.stringify(__result !== undefined ? __result : null));
    }} catch (err) {{
        console.error("__ERROR__:" + (err.stack || err.message));
        process.exit(1);
    }}
}})();
"""

    try:
        proc = subprocess.run(
            ["node", "-e", full_script],
            capture_output=True,
            text=True,
            timeout=timeout_sec
        )
        if proc.returncode != 0:
            err_msg = proc.stderr.strip()
            if "__ERROR__:" in err_msg:
                err_msg = err_msg.split("__ERROR__:", 1)[1]
            return {"success": False, "error": err_msg, "result": None}

        stdout = proc.stdout.strip()
        for line in stdout.splitlines():
            if line.startswith("__RESULT__:"):
                json_part = line[len("__RESULT__:"):]
                try:
                    parsed = json.loads(json_part)
                    return {"success": True, "error": None, "result": parsed}
                except Exception as ex:
                    return {"success": True, "error": None, "result": json_part}

        return {"success": True, "error": None, "result": stdout}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Execution timed out", "result": None}
    except Exception as ex:
        return {"success": False, "error": str(ex), "result": None}


def run_playwright_test(
    test_callable: Callable,
    target_file: Optional[str] = None,
    viewport: Optional[Dict[str, int]] = None,
    headless: bool = True
) -> Any:
    """
    Launches Playwright Chromium, navigates to the target HTML file,
    collects console logs and page errors, and invokes test_callable(page, errors, warnings).
    """
    from playwright.sync_api import sync_playwright

    html_file = target_file or INDEX_HTML
    if not os.path.exists(html_file):
        raise FileNotFoundError(f"Target HTML file not found: {html_file}")

    file_url = f"file://{os.path.abspath(html_file)}"
    console_errors: List[str] = []
    console_warnings: List[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"]
        )
        context = browser.new_context(
            viewport=viewport or {"width": 1280, "height": 800}
        )
        page = context.new_page()

        # Listeners
        page.on("pageerror", lambda err: console_errors.append(f"PageError: {err}"))
        page.on("console", lambda msg: (
            console_errors.append(f"ConsoleError: {msg.text}") if msg.type == "error" else
            console_warnings.append(f"ConsoleWarn: {msg.text}") if msg.type == "warning" else None
        ))

        page.goto(file_url, wait_until="load")
        result = test_callable(page, console_errors, console_warnings)
        browser.close()
        return result
