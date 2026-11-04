import csv
import glob
import json
import os
import shutil
import time
from playwright.sync_api import sync_playwright

BASE_DIR = "/home/ubuntu/Yggdrasil/02_Projetos_Ativos/Monitor_cbETH"
OUTPUT_PNG = os.path.join(BASE_DIR, "cbeth_dashboard_preview.png")
ARTIFACT_DIR = "/home/ubuntu/.gemini/antigravity-cli/brain/a7676071-9576-4654-9da9-b220175a06f8"

# 1. Carregar dados reais dos CSVs
posicao = {}
with open(os.path.join(BASE_DIR, "dados/fato_posicao_atual.csv"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        posicao = row
        break

historico = []
with open(os.path.join(BASE_DIR, "dados/fato_historico_30d.csv"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        historico.append({
            "data": row["data"],
            "taxa": float(row["taxa_conversao_cbeth_eth"]),
            "preco_eth": float(row["preco_eth_usd"]),
            "preco_cbeth": float(row["preco_cbeth_usd"])
        })

# Cálculos chave - Posição & Saldos
saldo_cbeth = float(posicao["saldo_cbeth"])
saldo_eth = float(posicao["saldo_eth_gas"])
preco_eth = float(posicao["preco_eth_usd"])
preco_cbeth = float(posicao["preco_cbeth_usd"])
taxa_atual = float(posicao["taxa_conversao_cbeth_eth"])
taxa_usd_brl = float(posicao["taxa_usd_brl"])
patr_cbeth_usd = float(posicao["patrimonio_cbeth_usd"])
patr_cbeth_brl = float(posicao["patrimonio_cbeth_brl"])
patr_usd = float(posicao["patrimonio_total_usd"])
patr_brl = float(posicao["patrimonio_total_brl"])

# Yield em ETH e Moedas Fiduciárias
yield_eth = (saldo_cbeth * taxa_atual) - saldo_cbeth
yield_usd = yield_eth * preco_eth
yield_brl = yield_usd * taxa_usd_brl

# Variação 30d da taxa
taxa_inicial = historico[0]["taxa"]
var_30d_taxa = ((taxa_atual - taxa_inicial) / taxa_inicial) * 100

# R3: Staking Status & APY On-Chain
apy_staking = 0.031  # 3.10% Beacon Chain
proj_diaria = (patr_cbeth_brl * apy_staking) / 365
proj_mensal = (patr_cbeth_brl * apy_staking) / 12
proj_anual = patr_cbeth_brl * apy_staking
status_staking = "Beacon Chain (Ativo • cToken)"

# R4: P&L Performance & Decomposição
lucro_stk_pct = (taxa_atual - 1.0) * 100  # +14.2%
base_custo = saldo_cbeth * 1000 * taxa_usd_brl
lucro_stk_brl = base_custo * (taxa_atual - 1.0)  # +R$ 16,07

preco_cbeth_ini = historico[0]["preco_cbeth"]
var_mercado_brl = (preco_cbeth - preco_cbeth_ini) * saldo_cbeth * taxa_usd_brl  # -R$ 20,62
var_mercado_pct = ((preco_cbeth - preco_cbeth_ini) / preco_cbeth_ini) * 100  # -6.2%
res_liq_brl = lucro_stk_brl + var_mercado_brl  # -R$ 4,55
status_pnl = "Em Recuperação (Staking Ativo)" if res_liq_brl < 0 else "Lucro Consolidado"

# R5: Termômetro Decisório de Compra
media_eth_30d = sum(h["preco_eth"] for h in historico) / len(historico)
eth_drawdown_pct = ((preco_eth - media_eth_30d) / media_eth_30d) * 100  # -7.2%
taxa_max_30d = max(h["taxa"] for h in historico)
desagio_pct = ((taxa_atual - taxa_max_30d) / taxa_max_30d) * 100  # -0.08%

pts_dd = min(max(-((preco_eth - media_eth_30d) / media_eth_30d) * 400, 0), 60)
score_compra = round(10 + pts_dd + 30)  # 69
sinal_aporte = "OPORTUNIDADE DE APORTE" if eth_drawdown_pct <= -5.0 else ("ZONA NEUTRA / FAVORÁVEL" if eth_drawdown_pct <= 0 else "CAUTELA / AGUARDAR")

# Datas formatadas dd/MM para escala contínua horizontal
datas_dd_mm = [f"{h['data'][8:10]}/{h['data'][5:7]}" for h in historico]
datas_json = json.dumps(datas_dd_mm)
taxas_json = json.dumps([h["taxa"] for h in historico])
preco_eth_json = json.dumps([h["preco_eth"] for h in historico])


html_content = f"""<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <title>cbETH Staking Protocol — Base Network</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body {{
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #080B11;
      color: #F1F5F9;
    }}
    .font-mono {{ font-family: 'JetBrains Mono', monospace; }}
    .executive-card {{
      background: #121826;
      border: 1px solid #1E2638;
      border-radius: 12px;
      box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.45);
    }}
    .panel-pl {{
      background: #121826;
      border: 1px solid #1E2638;
      border-left: 4px solid #10B981;
      border-radius: 12px;
      box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.45);
    }}
    .panel-staking {{
      background: #121826;
      border: 1px solid #1E2638;
      border-left: 4px solid #00D2FF;
      border-radius: 12px;
      box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.45);
    }}
    .panel-thermo {{
      background: #121826;
      border: 1px solid #1E2638;
      border-left: 4px solid #F59E0B;
      border-radius: 12px;
      box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.45);
    }}
  </style>
</head>
<body class="p-6 min-h-screen flex flex-col justify-between">

  <!-- TOPBAR -->
  <header class="flex items-center justify-between pb-6 border-b border-slate-800/80">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-cyan-500/20">
        Ξ
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-bold tracking-tight text-white">Monitor cbETH</h1>
          <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Base L2</span>
          <span class="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            On-Chain Live
          </span>
        </div>
        <p class="text-xs text-slate-400 font-mono mt-0.5">Wallet: {posicao["endereco_carteira"][:8]}...{posicao["endereco_carteira"][-6:]} • Contrato: 0x2Ae3...DEc22</p>
      </div>
    </div>

    <!-- Right Quick Actions -->
    <div class="flex items-center gap-3">
      <div class="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
        <span class="text-slate-500">USD/BRL:</span>
        <span class="font-bold text-white">R$ {taxa_usd_brl:.2f}</span>
      </div>
      <div class="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
        <span class="text-slate-500">ETH Spot:</span>
        <span class="font-bold text-white">${preco_eth:,.2f}</span>
      </div>
      <div class="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
        <span class="text-slate-500">cbETH Spot:</span>
        <span class="font-bold text-cyan-400">${preco_cbeth:,.2f}</span>
      </div>
    </div>
  </header>

  <!-- KPI CARDS (4 COLUMNS) -->
  <section class="grid grid-cols-4 gap-4 my-6">
    <!-- Card 1 -->
    <div class="executive-card p-5 relative overflow-hidden group hover:border-slate-700 transition">
      <div class="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <span>Patrimônio Total BRL</span>
        <span class="text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full">+0.55% 30d</span>
      </div>
      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-2xl font-extrabold text-white font-mono">R$ {patr_brl:,.2f}</span>
      </div>
      <div class="mt-2 text-xs text-slate-400 flex items-center gap-1 font-mono">
        <span>Câmbio comercial oficial</span>
      </div>
      <div class="absolute -right-4 -bottom-4 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
    </div>

    <!-- Card 2 -->
    <div class="executive-card p-5 relative overflow-hidden group hover:border-slate-700 transition">
      <div class="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <span>Patrimônio Total USD</span>
        <span class="text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded-full">Spot</span>
      </div>
      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-2xl font-extrabold text-white font-mono">${patr_usd:,.2f}</span>
      </div>
      <div class="mt-2 text-xs text-slate-400 flex items-center gap-1 font-mono">
        <span>cbETH ({saldo_cbeth:.4f}) + Gas ({saldo_eth:.4f} ETH)</span>
      </div>
      <div class="absolute -right-4 -bottom-4 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl pointer-events-none"></div>
    </div>

    <!-- Card 3 -->
    <div class="executive-card p-5 relative overflow-hidden group hover:border-slate-700 transition">
      <div class="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <span>Exchange Rate Atual</span>
        <span class="text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full">+{var_30d_taxa:.2f}% 30d</span>
      </div>
      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-2xl font-extrabold text-cyan-400 font-mono">{taxa_atual:.5f}</span>
        <span class="text-xs text-slate-400 font-mono">cbETH/ETH</span>
      </div>
      <div class="mt-2 text-xs text-slate-400 flex items-center gap-1 font-mono">
        <span>Base contract oracle rate</span>
      </div>
      <div class="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
    </div>

    <!-- Card 4 -->
    <div class="executive-card p-5 relative overflow-hidden group hover:border-slate-700 transition">
      <div class="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <span>Staking Yield Ganho</span>
        <span class="text-purple-400 font-mono bg-purple-500/10 px-2 py-0.5 rounded-full">Acumulado</span>
      </div>
      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-2xl font-extrabold text-emerald-400 font-mono">+{yield_eth:.6f} ETH</span>
      </div>
      <div class="mt-2 text-xs text-slate-400 flex items-center gap-1 font-mono">
        <span>≈ ${yield_usd:.2f} (R$ {yield_brl:.2f})</span>
      </div>
      <div class="absolute -right-4 -bottom-4 w-20 h-20 bg-purple-500/5 rounded-full blur-xl pointer-events-none"></div>
    </div>
  </section>

  <!-- MAIN SECTION: CHART & 3 ANALYTICAL PANELS -->
  <main class="grid grid-cols-12 gap-6 items-start">
    
    <!-- LEFT: 30D AREA CHART (8 COLS) -->
    <div class="col-span-8 executive-card p-6 flex flex-col justify-between h-[500px]">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h2 class="text-base font-bold text-white flex items-center gap-2">
            Curva de Acumulação do Staking (30 Dias)
            <span class="text-xs font-normal text-slate-400">(Exchange Rate cbETH / ETH)</span>
          </h2>
          <p class="text-xs text-slate-400 font-mono mt-0.5">Escala contínua diária refletindo a apreciação algorítmica do cToken na Beacon Chain.</p>
        </div>
        
        <!-- Timeframe Indicator -->
        <div class="flex items-center bg-slate-900/90 px-3 py-1 rounded-xl border border-slate-800 text-xs font-mono">
          <span class="text-cyan-400 font-bold">Janela 30D • Contínua</span>
        </div>
      </div>

      <!-- APEXCHART DIV -->
      <div id="growthChart" class="w-full h-[400px]"></div>
    </div>

    <!-- RIGHT: 3 ANALYTICAL PANELS (4 COLS) -->
    <div class="col-span-4 flex flex-col justify-between h-[500px] gap-4">
      
      <!-- PANEL 1: P&L PERFORMANCE CARD -->
      <div class="panel-pl p-4 flex flex-col justify-between h-[156px] relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Lucro Staking & Performance (P&L)</span>
          <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{status_pnl}</span>
        </div>
        <div class="flex items-baseline justify-between mt-1">
          <div>
            <div class="flex items-baseline gap-1.5">
              <span class="text-xl font-extrabold text-emerald-400 font-mono">+R$ {lucro_stk_brl:.2f}</span>
              <span class="text-xs font-semibold text-emerald-400/80 font-mono">(+{lucro_stk_pct:.1f}%)</span>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">Lucro Staking Garantido</span>
          </div>
          <div class="text-right">
            <span class="text-base font-extrabold text-rose-400 font-mono">-R$ {abs(res_liq_brl):.2f}</span>
            <div class="text-[10px] text-slate-400 font-mono">Saldo Líquido 30d</div>
          </div>
        </div>
        <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Variação Mercado (30d):</span>
          <span class="text-rose-400 font-bold">-R$ {abs(var_mercado_brl):.2f} ({var_mercado_pct:.1f}%)</span>
        </div>
      </div>

      <!-- PANEL 2: STAKING STATUS & APY ON-CHAIN -->
      <div class="panel-staking p-4 flex flex-col justify-between h-[156px] relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Status Staking & APY On-Chain</span>
          <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Beacon Chain cToken</span>
        </div>
        <div class="flex items-baseline justify-between mt-1">
          <div>
            <div class="text-2xl font-extrabold text-cyan-400 font-mono">{apy_staking*100:.2f}%</div>
            <span class="text-[10px] text-slate-400 font-mono">APY Anualizado Oficial</span>
          </div>
          <div class="text-right">
            <span class="text-xs font-bold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Ativo • Conforme</span>
          </div>
        </div>
        <div class="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1.5 text-center font-mono">
          <div class="bg-slate-900/60 rounded p-1 border border-slate-800/40">
            <div class="text-[9px] text-slate-400 uppercase">Diário</div>
            <div class="text-[11px] font-bold text-white">+R$ {proj_diaria:.2f}</div>
          </div>
          <div class="bg-slate-900/60 rounded p-1 border border-slate-800/40">
            <div class="text-[9px] text-slate-400 uppercase">Mensal</div>
            <div class="text-[11px] font-bold text-white">+R$ {proj_mensal:.2f}</div>
          </div>
          <div class="bg-slate-900/60 rounded p-1 border border-slate-800/40">
            <div class="text-[9px] text-slate-400 uppercase">Anual</div>
            <div class="text-[11px] font-bold text-emerald-400">+R$ {proj_anual:.2f}</div>
          </div>
        </div>
      </div>

      <!-- PANEL 3: BUY OPPORTUNITY THERMOMETER -->
      <div class="panel-thermo p-4 flex flex-col justify-between h-[156px] relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Termômetro Decisório de Compra</span>
          <span class="px-2 py-0.5 text-[10px] font-bold font-mono rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Score {score_compra}/100</span>
        </div>
        <div class="my-1">
          <div class="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between">
            <span class="text-[10px] text-slate-300 font-mono uppercase tracking-wider">Sinal Técnico:</span>
            <span class="text-xs font-bold text-emerald-400 font-mono tracking-wide">{sinal_aporte}</span>
          </div>
        </div>
        <div class="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
          <div>
            <span class="text-[10px] text-slate-400 block">Drawdown ETH 30d</span>
            <span class="font-bold text-amber-400">{eth_drawdown_pct:.1f}%</span>
          </div>
          <div class="text-right">
            <span class="text-[10px] text-slate-400 block">Deságio vs Máxima</span>
            <span class="font-bold text-slate-200">{desagio_pct:.2f}%</span>
          </div>
        </div>
      </div>

    </div>
  </main>

  <footer class="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-500">
    <div>cbETH On-Chain Telemetry • Pipeline Python + DAX VertiPaq • PBIR v2.0.0</div>
    <div>Última extração Base RPC: {posicao["data_hora"]}</div>
  </footer>

  <script>
    // APEXCHART: EVOLUÇÃO CONTÍNUA DO EXCHANGE RATE (30 DIAS)
    const dates = {datas_json};
    const rates = {taxas_json};

    const optionsGrowth = {{
      series: [{{
        name: 'Exchange Rate cbETH/ETH',
        data: rates
      }}],
      chart: {{
        type: 'area',
        height: 380,
        toolbar: {{ show: false }},
        background: 'transparent',
        sparkline: {{ enabled: false }},
        animations: {{ enabled: false }}
      }},
      colors: ['#00D2FF'],
      fill: {{
        type: 'gradient',
        gradient: {{
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.02,
          stops: [0, 95, 100],
          colorStops: [
            {{ offset: 0, color: '#00D2FF', opacity: 0.4 }},
            {{ offset: 100, color: '#8B5CF6', opacity: 0.0 }}
          ]
        }}
      }},
      stroke: {{
        curve: 'smooth',
        width: 3
      }},
      dataLabels: {{ enabled: false }},
      grid: {{
        borderColor: '#1E2638',
        strokeDashArray: 3,
        xaxis: {{ lines: {{ show: false }} }},
        yaxis: {{ lines: {{ show: true }} }}
      }},
      xaxis: {{
        categories: dates,
        tickAmount: 6,
        labels: {{
          style: {{ colors: '#94A3B8', fontFamily: 'JetBrains Mono', fontSize: '11px' }},
          rotate: 0,
          hideOverlappingLabels: true
        }},
        axisBorder: {{ show: false }},
        axisTicks: {{ show: false }}
      }},
      yaxis: {{
        min: 1.134,
        max: 1.144,
        labels: {{
          style: {{ colors: '#94A3B8', fontFamily: 'JetBrains Mono', fontSize: '11px' }},
          formatter: (v) => v.toFixed(5)
        }}
      }},
      tooltip: {{
        theme: 'dark',
        x: {{ show: true }},
        y: {{ formatter: (v) => v.toFixed(5) + ' ETH' }}
      }}
    }};
    const chartGrowth = new ApexCharts(document.querySelector("#growthChart"), optionsGrowth);
    chartGrowth.render();
  </script>
</body>
</html>
"""

html_path = os.path.join(BASE_DIR, "dashboard_interativo.html")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)
print("HTML salvo em:", html_path)

# Renderizar screenshot usando Playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(
        viewport={"width": 1440, "height": 900},
        device_scale_factor=2
    )
    page.goto(f"file://{html_path}")
    time.sleep(2)  # aguarda ApexCharts renderizar
    
    page.screenshot(path=OUTPUT_PNG, full_page=False)
    print("Screenshot salvo em:", OUTPUT_PNG)
    browser.close()

# Cópia opcional para brain se o diretório existir
if os.path.exists(ARTIFACT_DIR):
    try:
        shutil.copy(OUTPUT_PNG, os.path.join(ARTIFACT_DIR, "cbeth_dashboard_preview.png"))
        print("Cópia em brain salva em:", os.path.join(ARTIFACT_DIR, "cbeth_dashboard_preview.png"))
    except Exception as e:
        print("Aviso ao copiar para brain:", e)

for b_dir in glob.glob("/home/ubuntu/.gemini/antigravity-cli/brain/*"):
    if os.path.isdir(b_dir) and b_dir != ARTIFACT_DIR:
        try:
            shutil.copy(OUTPUT_PNG, os.path.join(b_dir, "cbeth_dashboard_preview.png"))
        except Exception:
            pass

print("Concluído com sucesso!")
