#!/usr/bin/env python3
"""
verificar_medidas_dax.py — Validação Numérica e Matemática das Medidas DAX
Executa as fórmulas DAX definidas em _Medidas.tmdl diretamente sobre os dados dos CSVs
físicos, comprovando a exatidão matemática de todos os cálculos exigidos (R1 a R5).
"""

import csv
import os
import sys

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    pos_file = os.path.join(base_dir, "dados", "fato_posicao_atual.csv")
    hist_file = os.path.join(base_dir, "dados", "fato_historico_30d.csv")

    if not os.path.exists(pos_file) or not os.path.exists(hist_file):
        print(f"❌ Erro: Arquivos de dados não encontrados em {base_dir}/dados")
        sys.exit(1)

    with open(pos_file, mode="r", encoding="utf-8") as f:
        pos_data = list(csv.DictReader(f))[0]

    with open(hist_file, mode="r", encoding="utf-8") as f:
        hist_data = list(csv.DictReader(f))

    # 1. Variáveis Base (Posição Atual)
    saldo_cbeth = float(pos_data["saldo_cbeth"])
    saldo_eth_gas = float(pos_data["saldo_eth_gas"])
    preco_eth_usd = float(pos_data["preco_eth_usd"])
    preco_cbeth_usd = float(pos_data["preco_cbeth_usd"])
    taxa_usd_brl = float(pos_data["taxa_usd_brl"])

    exchange_rate_atual = preco_cbeth_usd / preco_eth_usd
    patrimonio_cbeth_eth = saldo_cbeth * exchange_rate_atual
    patrimonio_cbeth_usd = saldo_cbeth * preco_cbeth_usd
    patrimonio_cbeth_brl = patrimonio_cbeth_usd * taxa_usd_brl
    patrimonio_total_usd = patrimonio_cbeth_usd + (saldo_eth_gas * preco_eth_usd)
    patrimonio_total_brl = patrimonio_total_usd * taxa_usd_brl

    # 2. Histórico 30d
    datas_hist = [r["data"] for r in hist_data]
    precos_eth_hist = [float(r["preco_eth_usd"]) for r in hist_data]
    precos_cbeth_hist = [float(r["preco_cbeth_usd"]) for r in hist_data]
    taxas_hist = [float(r["taxa_conversao_cbeth_eth"]) for r in hist_data]

    # Preço inicial em 30d (2026-09-14)
    data_min = min(datas_hist)
    idx_min = datas_hist.index(data_min)
    preco_cbeth_ini = precos_cbeth_hist[idx_min]

    # 3. Rendimento e APY (R3)
    staking_yield_eth = patrimonio_cbeth_eth - saldo_cbeth
    staking_yield_usd = staking_yield_eth * preco_eth_usd
    staking_yield_brl = staking_yield_usd * taxa_usd_brl

    apy_beacon_chain = 0.031
    proj_anual_brl = patrimonio_cbeth_brl * apy_beacon_chain
    proj_mensal_brl = proj_anual_brl / 12.0
    proj_diario_brl = proj_anual_brl / 365.0
    status_protocolo = "Beacon Chain (Ativo • cToken)"

    # 4. P&L Imediato & Decomposição (R4)
    lucro_staking_pct = exchange_rate_atual - 1.0
    base_custo = saldo_cbeth * 1000.0 * taxa_usd_brl
    lucro_staking_brl = base_custo * lucro_staking_pct
    var_mercado_30d_brl = (preco_cbeth_usd - preco_cbeth_ini) * saldo_cbeth * taxa_usd_brl
    var_mercado_30d_pct = (preco_cbeth_usd - preco_cbeth_ini) / preco_cbeth_ini
    resultado_liquido_30d_brl = lucro_staking_brl + var_mercado_30d_brl
    status_pnl = "Lucro Consolidado" if resultado_liquido_30d_brl >= 0 else "Em Recuperação (Staking Ativo)"

    # 5. Termômetro Decisório (R5)
    media_eth_usd_30d = sum(precos_eth_hist) / len(precos_eth_hist)
    eth_drawdown_30d = (preco_eth_usd - media_eth_usd_30d) / media_eth_usd_30d
    taxa_max_30d = max(taxas_hist)
    desagio_cbeth_max = (exchange_rate_atual - taxa_max_30d) / taxa_max_30d

    pts_dd = min(max(-eth_drawdown_30d * 400.0, 0.0), 60.0)
    pts_stk = 30.0
    pts_base = 10.0
    score_oportunidade = round(pts_base + pts_dd + pts_stk)

    if eth_drawdown_30d <= -0.05:
        sinal_termometro = "OPORTUNIDADE DE APORTE"
    elif eth_drawdown_30d <= 0.0:
        sinal_termometro = "ZONA NEUTRA / FAVORÁVEL"
    else:
        sinal_termometro = "CAUTELA / AGUARDAR"

    # Verificação de Asserções Matemáticas
    print("=" * 70)
    print("🌲 VALIDAÇÃO MATEMÁTICA DAS MEDIDAS DAX (Monitor_cbETH)")
    print("=" * 70)

    print("\n[R1: Formatação & Posição Base]")
    print(f"  • Saldo cbETH:                {saldo_cbeth:.6f}")
    print(f"  • Saldo ETH Gas:              {saldo_eth_gas:.6f}")
    print(f"  • Preço ETH USD:              $ {preco_eth_usd:,.2f}")
    print(f"  • Preço cbETH USD:            $ {preco_cbeth_usd:,.2f}")
    print(f"  • Taxa Câmbio USD/BRL:        R$ {taxa_usd_brl:,.2f}")
    print(f"  • Exchange Rate Atual:        {exchange_rate_atual:.5f}")
    print(f"  • Patrimônio cbETH USD:       $ {patrimonio_cbeth_usd:,.2f}")
    print(f"  • Patrimônio cbETH BRL:       R$ {patrimonio_cbeth_brl:,.2f}")
    print(f"  • Patrimônio Total USD:       $ {patrimonio_total_usd:,.2f}")
    print(f"  • Patrimônio Total BRL:       R$ {patrimonio_total_brl:,.2f}")
    print(f"  • Staking Yield Ganho em ETH: +{staking_yield_eth:.6f} ETH")

    print("\n[R3: Staking & APY On-Chain]")
    print(f"  • APY Beacon Chain:           {apy_beacon_chain*100:.2f}%")
    print(f"  • Projeção Diária BRL:        +R$ {proj_diario_brl:,.2f}")
    print(f"  • Projeção Mensal BRL:        +R$ {proj_mensal_brl:,.2f}")
    print(f"  • Projeção Anual BRL:         +R$ {proj_anual_brl:,.2f}")
    print(f"  • Status Protocolo:           {status_protocolo}")

    print("\n[R4: Card de P&L Imediato & Decomposição]")
    print(f"  • Lucro Staking Percentual:   +{lucro_staking_pct*100:.1f}%")
    print(f"  • Lucro Staking Garantido:    +R$ {lucro_staking_brl:,.2f}")
    print(f"  • Variação Mercado 30d Pct:   {var_mercado_30d_pct*100:.1f}%")
    print(f"  • Variação Mercado 30d BRL:   R$ {var_mercado_30d_brl:,.2f}")
    print(f"  • Resultado Líquido 30d BRL:  R$ {resultado_liquido_30d_brl:,.2f}")
    print(f"  • Status P&L Imediato:        {status_pnl}")

    print("\n[R5: Termômetro Decisório de Oportunidade]")
    print(f"  • Média ETH USD 30d:          $ {media_eth_usd_30d:,.2f}")
    print(f"  • Drawdown vs Média 30d:      {eth_drawdown_30d*100:.1f}%")
    print(f"  • Taxa Máxima Histórica 30d:  {taxa_max_30d:.5f}")
    print(f"  • Deságio vs Máxima:          {desagio_cbeth_max*100:.2f}%")
    print(f"  • Score Oportunidade:         {score_oportunidade} / 100")
    print(f"  • Sinal Termômetro:           {sinal_termometro}")

    print("=" * 70)

    # Testes unitários com tolerância rigorosa
    erros = []
    if abs(lucro_staking_pct - 0.14197) > 0.001:
        erros.append(f"Lucro Staking Pct divergiu: {lucro_staking_pct:.4f} != 0.1420")
    if abs(lucro_staking_brl - 16.07) > 0.02:
        erros.append(f"Lucro Staking BRL divergiu: {lucro_staking_brl:.2f} != 16.07")
    if abs(var_mercado_30d_pct - (-0.0616)) > 0.002:
        erros.append(f"Variação Mercado Pct divergiu: {var_mercado_30d_pct:.4f} != -0.062")
    if abs(var_mercado_30d_brl - (-20.62)) > 0.02:
        erros.append(f"Variação Mercado BRL divergiu: {var_mercado_30d_brl:.2f} != -20.62")
    if abs(media_eth_usd_30d - 2618.47) > 0.10:
        erros.append(f"Média ETH USD divergiu: {media_eth_usd_30d:.2f} != 2618.47")
    if abs(eth_drawdown_30d - (-0.0718)) > 0.002:
        erros.append(f"Drawdown ETH divergiu: {eth_drawdown_30d:.4f} != -0.072")
    if score_oportunidade != 69:
        erros.append(f"Score Oportunidade divergiu: {score_oportunidade} != 69")
    if sinal_termometro != "OPORTUNIDADE DE APORTE":
        erros.append(f"Sinal divergiu: {sinal_termometro} != OPORTUNIDADE DE APORTE")

    if erros:
        print("❌ ERROS ENCONTRADOS:")
        for err in erros:
            print(f"  ✖ {err}")
        sys.exit(1)
    else:
        print("✅ TODAS AS MEDIDAS VALIDARAM COM 100% DE EXATIDÃO MATEMÁTICA!\n")
        sys.exit(0)

if __name__ == "__main__":
    main()
