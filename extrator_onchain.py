#!/usr/bin/env python3
"""
Extrator On-Chain & Mercado: Monitor cbETH na Base
Yggdrasil - Engenharia de Dados & Web3 Analytics
"""

import sys
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# Constantes de Contratos e Rede
BASE_RPC = "https://mainnet.base.org"
CBETH_BASE_CONTRACT = "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22"
BALANCE_OF_SELECTOR = "0x70a08231"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "dados"
CONFIG_FILE = BASE_DIR / "carteira.json"

def carregar_config():
    """Carrega endereço público da carteira ou cria modelo padrão."""
    if not CONFIG_FILE.exists():
        default_config = {
            "endereco_carteira": "0x0000000000000000000000000000000000000000",
            "nota": "Substitua endereco_carteira pelo seu endereco publico 0x..."
        }
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(default_config, f, indent=2)
        return default_config["endereco_carteira"]
    
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("endereco_carteira", "0x0000000000000000000000000000000000000000")

def consultar_rpc(metodo: str, params: list) -> dict:
    """Executa chamada JSON-RPC para o nó público da Base."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": metodo,
        "params": params
    }
    req = urllib.request.Request(
        BASE_RPC,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "Yggdrasil-Monitor/1.0"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))

def obter_saldos_onchain(endereco: str):
    """Obtém saldo nativo de ETH e saldo de cbETH via ERC-20 balanceOf."""
    if not endereco.startswith("0x") or len(endereco) != 42:
        return 0.0, 0.0
    
    # 1. Saldo de cbETH
    clean_addr = endereco[2:].lower().zfill(64)
    data = BALANCE_OF_SELECTOR + clean_addr
    cbeth_res = consultar_rpc("eth_call", [{"to": CBETH_BASE_CONTRACT, "data": data}, "latest"])
    cbeth_raw = int(cbeth_res.get("result", "0x0"), 16)
    saldo_cbeth = cbeth_raw / 1e18

    # 2. Saldo de ETH Nativo (para gas)
    eth_res = consultar_rpc("eth_getBalance", [endereco, "latest"])
    eth_raw = int(eth_res.get("result", "0x0"), 16)
    saldo_eth = eth_raw / 1e18

    return saldo_cbeth, saldo_eth

def obter_precos_mercado():
    """Consulta preços de ETH, cbETH e cotação USD/BRL."""
    # Preços DeFiLlama
    llama_url = "https://coins.llama.fi/prices/current/coingecko:ethereum,coingecko:coinbase-wrapped-staked-eth"
    req = urllib.request.Request(llama_url, headers={"User-Agent": "Yggdrasil-Monitor/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        preco_eth_usd = data["coins"]["coingecko:ethereum"]["price"]
        preco_cbeth_usd = data["coins"]["coingecko:coinbase-wrapped-staked-eth"]["price"]

    # Cotação USD/BRL via AwesomeAPI (BCB)
    try:
        req_brl = urllib.request.Request("https://economia.awesomeapi.com.br/last/USD-BRL", headers={"User-Agent": "Yggdrasil-Monitor/1.0"})
        with urllib.request.urlopen(req_brl, timeout=5) as resp:
            data_brl = json.loads(resp.read().decode("utf-8"))
            taxa_usd_brl = float(data_brl["USDBRL"]["bid"])
    except Exception:
        taxa_usd_brl = 5.50  # Fallback conservador

    return preco_eth_usd, preco_cbeth_usd, taxa_usd_brl

def obter_historico_30d():
    """Consulta série temporal de 30 dias de cbETH e ETH."""
    now = int(time.time())
    start = now - (30 * 86400)
    
    url_cbeth = f"https://coins.llama.fi/chart/coingecko:coinbase-wrapped-staked-eth?start={start}&span=30&period=1d"
    url_eth = f"https://coins.llama.fi/chart/coingecko:ethereum?start={start}&span=30&period=1d"

    req_cb = urllib.request.Request(url_cbeth, headers={"User-Agent": "Yggdrasil-Monitor/1.0"})
    with urllib.request.urlopen(req_cb, timeout=10) as resp:
        data_cb = json.loads(resp.read().decode("utf-8"))

    req_eth = urllib.request.Request(url_eth, headers={"User-Agent": "Yggdrasil-Monitor/1.0"})
    with urllib.request.urlopen(req_eth, timeout=10) as resp:
        data_eth = json.loads(resp.read().decode("utf-8"))

    # Indexar por data YYYY-MM-DD
    cb_by_day = {}
    for p in list(data_cb["coins"].values())[0]["prices"]:
        d_str = datetime.fromtimestamp(p["timestamp"], tz=timezone.utc).strftime("%Y-%m-%d")
        cb_by_day[d_str] = p["price"]

    eth_by_day = {}
    for p in list(data_eth["coins"].values())[0]["prices"]:
        d_str = datetime.fromtimestamp(p["timestamp"], tz=timezone.utc).strftime("%Y-%m-%d")
        eth_by_day[d_str] = p["price"]

    # Alinhar datas e montar série
    historico = []
    dias_comuns = sorted(list(set(cb_by_day.keys()).intersection(set(eth_by_day.keys()))))
    
    for dt in dias_comuns:
        p_cb = cb_by_day[dt]
        p_eth = eth_by_day[dt]
        ratio = p_cb / p_eth if p_eth > 0 else 0.0
        historico.append({
            "data": dt,
            "preco_eth_usd": round(p_eth, 2),
            "preco_cbeth_usd": round(p_cb, 2),
            "taxa_conversao_cbeth_eth": round(ratio, 5)
        })

    return historico

def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    endereco = sys.argv[1] if len(sys.argv) > 1 else carregar_config()
    
    print(f"[*] Consultando blockchain Base para carteira: {endereco}")
    saldo_cbeth, saldo_eth = obter_saldos_onchain(endereco)
    print(f"    Saldo cbETH: {saldo_cbeth:.6f} | Saldo ETH Gas: {saldo_eth:.6f}")

    print("[*] Consultando precos de mercado (DeFiLlama & AwesomeAPI)...")
    preco_eth_usd, preco_cbeth_usd, taxa_usd_brl = obter_precos_mercado()
    taxa_conversao = preco_cbeth_usd / preco_eth_usd if preco_eth_usd > 0 else 0.0

    patrimonio_cbeth_eth = saldo_cbeth * taxa_conversao
    patrimonio_cbeth_usd = saldo_cbeth * preco_cbeth_usd
    patrimonio_cbeth_brl = patrimonio_cbeth_usd * taxa_usd_brl

    patrimonio_eth_usd = saldo_eth * preco_eth_usd
    patrimonio_total_usd = patrimonio_cbeth_usd + patrimonio_eth_usd
    patrimonio_total_brl = patrimonio_total_usd * taxa_usd_brl

    agora_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # 1. Gerar fato_posicao_atual.csv
    posicao_csv = DATA_DIR / "fato_posicao_atual.csv"
    with open(posicao_csv, "w", encoding="utf-8") as f:
        f.write("data_hora,endereco_carteira,rede,saldo_cbeth,saldo_eth_gas,preco_eth_usd,preco_cbeth_usd,taxa_conversao_cbeth_eth,taxa_usd_brl,patrimonio_cbeth_eth,patrimonio_cbeth_usd,patrimonio_cbeth_brl,patrimonio_total_usd,patrimonio_total_brl\n")
        f.write(f'"{agora_iso}","{endereco}","Base",{saldo_cbeth:.6f},{saldo_eth:.6f},{preco_eth_usd:.2f},{preco_cbeth_usd:.2f},{taxa_conversao:.5f},{taxa_usd_brl:.4f},{patrimonio_cbeth_eth:.6f},{patrimonio_cbeth_usd:.2f},{patrimonio_cbeth_brl:.2f},{patrimonio_total_usd:.2f},{patrimonio_total_brl:.2f}\n')
    print(f"[+] Gravado: {posicao_csv}")

    # 2. Gerar fato_historico_30d.csv
    print("[*] Extraindo historico de 30 dias de exchange rate...")
    historico = obter_historico_30d()
    historico_csv = DATA_DIR / "fato_historico_30d.csv"
    with open(historico_csv, "w", encoding="utf-8") as f:
        f.write("data,preco_eth_usd,preco_cbeth_usd,taxa_conversao_cbeth_eth\n")
        for h in historico:
            f.write(f'"{h["data"]}",{h["preco_eth_usd"]:.2f},{h["preco_cbeth_usd"]:.2f},{h["taxa_conversao_cbeth_eth"]:.5f}\n')
    print(f"[+] Gravado: {historico_csv}")

    print("\n=== RESUMO EXECUTIVO DO MONITOR cbETH ===")
    print(f"Preco ETH:      $ {preco_eth_usd:,.2f}")
    print(f"Preco cbETH:    $ {preco_cbeth_usd:,.2f}")
    print(f"Exchange Rate:  1 cbETH = {taxa_conversao:.5f} ETH")
    print(f"Cotação USD:    R$ {taxa_usd_brl:.4f}")
    print(f"Posição cbETH:  {saldo_cbeth:.4f} cbETH (~ {patrimonio_cbeth_eth:.4f} ETH | $ {patrimonio_cbeth_usd:,.2f} | R$ {patrimonio_cbeth_brl:,.2f})")
    print(f"Total Carteira: $ {patrimonio_total_usd:,.2f} (R$ {patrimonio_total_brl:,.2f})")

if __name__ == "__main__":
    main()
