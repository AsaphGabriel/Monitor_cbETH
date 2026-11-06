#!/usr/bin/env python3
"""
Extrator On-Chain & Mercado: Monitor cbETH na Base
Yggdrasil - Engenharia de Dados & Web3 Analytics
"""

import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_RPC = "https://mainnet.base.org"
CBETH_BASE_CONTRACT = "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22"
BALANCE_OF_SELECTOR = "0x70a08231"
DEFAULT_WALLET = "0xc4cfde467bc76d0d6df365584648371b1954b154"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "dados"
CONFIG_FILE = BASE_DIR / "carteira.json"


def gravar_atomico(destino: Path, conteudo: str) -> None:
    """Escrita atomica em disco via tempfile + os.replace (Art. 26)."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=str(destino.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fp:
            fp.write(conteudo)
        os.replace(tmp_path, str(destino))
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


def carregar_config() -> str:
    """Carrega endereco publico da carteira ou usa carteira canonica."""
    if not CONFIG_FILE.exists():
        return DEFAULT_WALLET

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        addr = data.get("endereco_carteira", DEFAULT_WALLET)
        if addr == "0x0000000000000000000000000000000000000000":
            return DEFAULT_WALLET
        return addr


def consultar_rpc(metodo: str, params: list) -> dict:
    """Executa chamada JSON-RPC para o no publico da Base."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": metodo,
        "params": params,
    }
    req = urllib.request.Request(
        BASE_RPC,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "Yggdrasil-Monitor/1.1"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def obter_saldos_onchain(endereco: str):
    """Obtem saldo de cbETH via ERC-20 balanceOf e saldo nativo de ETH."""
    if not endereco.startswith("0x") or len(endereco) != 42:
        return 0.0, 0.0

    clean_addr = endereco[2:].lower().zfill(64)
    data = BALANCE_OF_SELECTOR + clean_addr
    cbeth_res = consultar_rpc("eth_call", [{"to": CBETH_BASE_CONTRACT, "data": data}, "latest"])
    cbeth_raw = int(cbeth_res.get("result", "0x0"), 16)
    saldo_cbeth = cbeth_raw / 1e18

    eth_res = consultar_rpc("eth_getBalance", [endereco, "latest"])
    eth_raw = int(eth_res.get("result", "0x0"), 16)
    saldo_eth = eth_raw / 1e18

    return saldo_cbeth, saldo_eth


def obter_precos_mercado():
    """Consulta precos de ETH, cbETH e cotacao USD/BRL com failover."""
    llama_url = "https://coins.llama.fi/prices/current/coingecko:ethereum,coingecko:coinbase-wrapped-staked-eth"
    req = urllib.request.Request(llama_url, headers={"User-Agent": "Yggdrasil-Monitor/1.1"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        preco_eth_usd = float(data["coins"]["coingecko:ethereum"]["price"])
        preco_cbeth_usd = float(data["coins"]["coingecko:coinbase-wrapped-staked-eth"]["price"])

    taxa_usd_brl = None
    try:
        req_er = urllib.request.Request("https://open.er-api.com/v6/latest/USD", headers={"User-Agent": "Yggdrasil-Monitor/1.1"})
        with urllib.request.urlopen(req_er, timeout=6) as resp:
            data_er = json.loads(resp.read().decode("utf-8"))
            taxa_usd_brl = float(data_er["rates"]["BRL"])
    except Exception as err_er:
        print(f"[!] open.er-api indisponivel ({err_er}), tentando AwesomeAPI...")

    if not taxa_usd_brl or taxa_usd_brl <= 0:
        try:
            req_brl = urllib.request.Request("https://economia.awesomeapi.com.br/last/USD-BRL", headers={"User-Agent": "Yggdrasil-Monitor/1.1"})
            with urllib.request.urlopen(req_brl, timeout=6) as resp:
                data_brl = json.loads(resp.read().decode("utf-8"))
                taxa_usd_brl = float(data_brl["USDBRL"]["bid"])
        except Exception as err_aw:
            print(f"[!] AwesomeAPI indisponivel ({err_aw}), aplicando fallback 5.4687")
            taxa_usd_brl = 5.4687

    return preco_eth_usd, preco_cbeth_usd, taxa_usd_brl


def obter_historico_30d():
    """Consulta serie temporal de 31 dias em chamada unica sincronizada no DeFiLlama."""
    now = int(time.time())
    start = now - (31 * 86400)
    url = (
        "https://coins.llama.fi/chart/"
        f"coingecko:ethereum,coingecko:coinbase-wrapped-staked-eth?start={start}&span=32&period=1d"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Yggdrasil-Monitor/1.1"})
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    eth_pts = data["coins"]["coingecko:ethereum"]["prices"]
    cb_pts = data["coins"]["coingecko:coinbase-wrapped-staked-eth"]["prices"]

    eth_by_day = {}
    for p in eth_pts:
        d_str = datetime.fromtimestamp(p["timestamp"], tz=timezone.utc).strftime("%Y-%m-%d")
        eth_by_day[d_str] = p

    historico = []
    for cb in cb_pts:
        d_str = datetime.fromtimestamp(cb["timestamp"], tz=timezone.utc).strftime("%Y-%m-%d")
        eth = eth_by_day.get(d_str)
        if not eth:
            continue
        if abs(cb["timestamp"] - eth["timestamp"]) > 14400:
            continue
        p_cb = float(cb["price"])
        p_eth = float(eth["price"])
        ratio = p_cb / p_eth if p_eth > 0 else 0.0
        if ratio < 1.0 or ratio > 1.35:
            continue
        historico.append(
            {
                "data": d_str,
                "preco_eth_usd": round(p_eth, 2),
                "preco_cbeth_usd": round(p_cb, 2),
                "taxa_conversao_cbeth_eth": round(ratio, 5),
            }
        )

    historico.sort(key=lambda item: item["data"])
    return historico[-31:] if len(historico) > 31 else historico


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    endereco = sys.argv[1] if len(sys.argv) > 1 else carregar_config()

    print(f"[*] Consultando blockchain Base para carteira: {endereco}")
    saldo_cbeth, saldo_eth = obter_saldos_onchain(endereco)
    print(f"    Saldo cbETH: {saldo_cbeth:.6f} | Saldo ETH Gas: {saldo_eth:.6f}")

    print("[*] Consultando precos de mercado (DeFiLlama & FX)...")
    preco_eth_usd, preco_cbeth_usd, taxa_usd_brl = obter_precos_mercado()
    taxa_conversao = preco_cbeth_usd / preco_eth_usd if preco_eth_usd > 0 else 0.0

    patrimonio_cbeth_eth = saldo_cbeth * taxa_conversao
    patrimonio_cbeth_usd = saldo_cbeth * preco_cbeth_usd
    patrimonio_cbeth_brl = patrimonio_cbeth_usd * taxa_usd_brl

    patrimonio_eth_usd = saldo_eth * preco_eth_usd
    patrimonio_total_usd = patrimonio_cbeth_usd + patrimonio_eth_usd
    patrimonio_total_brl = patrimonio_total_usd * taxa_usd_brl

    agora_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    posicao_csv = DATA_DIR / "fato_posicao_atual.csv"
    linhas_pos = (
        "data_hora,endereco_carteira,rede,saldo_cbeth,saldo_eth_gas,preco_eth_usd,preco_cbeth_usd,"
        "taxa_conversao_cbeth_eth,taxa_usd_brl,patrimonio_cbeth_eth,patrimonio_cbeth_usd,"
        "patrimonio_cbeth_brl,patrimonio_total_usd,patrimonio_total_brl\n"
        f'"{agora_iso}","{endereco}","Base",{saldo_cbeth:.6f},{saldo_eth:.6f},{preco_eth_usd:.2f},'
        f"{preco_cbeth_usd:.2f},{taxa_conversao:.5f},{taxa_usd_brl:.4f},{patrimonio_cbeth_eth:.6f},"
        f"{patrimonio_cbeth_usd:.2f},{patrimonio_cbeth_brl:.2f},{patrimonio_total_usd:.2f},{patrimonio_total_brl:.2f}\n"
    )
    gravar_atomico(posicao_csv, linhas_pos)
    print(f"[+] Gravado atomicamente: {posicao_csv}")

    print("[*] Extraindo historico de 30 dias sincronizado...")
    historico = obter_historico_30d()
    historico_csv = DATA_DIR / "fato_historico_30d.csv"
    linhas_hist = ["data,preco_eth_usd,preco_cbeth_usd,taxa_conversao_cbeth_eth\n"]
    for h in historico:
        linhas_hist.append(
            f'"{h["data"]}",{h["preco_eth_usd"]:.2f},{h["preco_cbeth_usd"]:.2f},{h["taxa_conversao_cbeth_eth"]:.5f}\n'
        )
    gravar_atomico(historico_csv, "".join(linhas_hist))
    print(f"[+] Gravado atomicamente: {historico_csv} ({len(historico)} dias)")


if __name__ == "__main__":
    main()
