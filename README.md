# Monitor On-Chain & Dashboard cbETH (Base L2)

Dashboard analítico e aplicação web reativa para acompanhamento patrimonial, rendimento de staking e taxa de conversão (*exchange rate*) de cbETH na rede Base (Chain ID 8453).

A solução é construída sob uma **arquitetura híbrida de engenharia de dados e visualização**:
1. **Relatório Analítico Power BI PBIP/PBIR v2.0.0:** Modelagem semântica em código puro (TMDL), 34 medidas DAX canônicas, visual containers atômicos e tema executivo escuro (*CryptoExecutiveDark*).
2. **Single-Page Application (SPA) Web Zero-Build & PWA Fullscreen:** Interface moderna, reativa e modular em HTML5, Tailwind CSS e JavaScript ES6 (`window.CbEth`), operando como Progressive Web App (PWA) instalável com modo Tela Cheia nativo (HTML5 Fullscreen API) para todos os navegadores incluindo o Brave, operando sem etapas de compilação/build (`npm run build`), pronta para visualização local (`file://`), servidor estático ou deploy em nuvem (GitHub Pages / Vercel).
3. **Camada de Ingestão On-Chain Resiliente:** Comunicação direta com nós RPC da Base L2, oráculos de preços da DeFiLlama, cotação cambial da AwesomeAPI e motor de fallback determinístico multi-janela com 100% de disponibilidade.

---

## Arquitetura da Solução

```text
                                 FONTES DE DADOS ON-CHAIN & MERCADO
                      Base L2 RPC (JSON-RPC) | DeFiLlama API | AwesomeAPI USD/BRL
                                              |
                   ┌──────────────────────────┴──────────────────────────┐
                   ▼                                                     ▼
      [PIPELINE LOCAL EM PYTHON]                            [WEB APP SPA ZERO-BUILD]
         extrator_onchain.py                                   js/api.js (fetch / RPC)
                   │                                                     │
                   ▼ (gravação física)                                   ▼ (resiliência)
              dados/*.csv                                       js/fallback-data.js
        (fato_posicao_atual.csv)                          (Dados Canônicos & PRNG Mulberry32)
        (fato_historico_30d.csv)                                         │
                   │                                                     ▼
                   ▼ (carga semântica)                          js/calculator.js
         [POWER BI PBIP / PBIR v2.0.0]                     (DCA, P&L, Staking, Termômetro)
           Monitor_cbETH.SemanticModel                                   │
              (_Medidas.tmdl: 34 DAX)                                    ▼
                   │                                               js/charts.js
                   ▼ (renderização)                           (Chart.js v4 UMD Dark)
           Monitor_cbETH.Report                                          │
       (Tema CryptoExecutiveDark)                                        ▼
                                                             index.html / dashboard_interativo.html
                                                             (Tailwind CSS CDN + js/app.js)
```

---

## Pilares da Solução

### 1. Single-Page Application (SPA) Zero-Build

A SPA foi projetada sob o princípio de baixa fricção e zero dependências de empacotamento local. Funciona imediatamente via protocolo local (`file://`) ou qualquer servidor HTTP estático.

- **Padrão Modular IIFE (Universal Namespace `window.CbEth`):**
  - `js/icons.js`: Biblioteca de ícones SVG monocromáticos inline customizados, em estrito cumprimento ao Art. 9º da governança de Yggdrasil (proibição absoluta de emojis Unicode).
  - `js/fallback-data.js`: Repositório de dados canônicos da carteira de referência e gerador determinístico de séries temporais baseado em hash FNV-1a do endereço EVM e PRNG Mulberry32, permitindo consultar qualquer carteira arbitrária com total consistência visual e matemática nas 6 janelas temporais.
  - `js/calculator.js`: Motor de inteligência financeira que replica com rigor absoluto as fórmulas canônicas:
    - Preço Médio Ponderado de Aquisição (DCA) estrito sobre entradas, invariante após saídas.
    - Preço Médio do Ativo no Período para cada janela selecionada.
    - P&L instantâneo monetário e percentual vs. DCA da carteira.
    - Segregação analítica de P&L: rendimento do staking algorítmico da Beacon Chain vs. flutuação de mercado do ETH.
    - Projeções de ganho de staking linear diário, mensal e anual com APY canônico de 3.10%.
    - Termômetro Decisório de Compra com Score limitado no intervalo [40, 100] e 3 sinais técnicos ("OPORTUNIDADE DE APORTE", "ZONA NEUTRA / FAVORÁVEL", "CAUTELA / AGUARDAR").
  - `js/api.js`: Ingestão on-chain com failover automático entre nós Base RPC (`https://mainnet.base.org` e `https://base-rpc.publicnode.com`), consulta de saldos via `eth_getBalance` e `eth_call` (`balanceOf`), cotações spot DeFiLlama, câmbio USD/BRL e chaveamento gracioso para fallback em caso de indisponibilidade de rede ou CORS.
  - `js/charts.js`: Camada de renderização dinâmica com Chart.js v4 UMD:
    - Gráfico 1 (Patrimônio & Saldo): Curva de evolução do saldo físico de tokens cbETH e valor patrimonial convertido em USD ou BRL.
    - Gráfico 2 (Cotação de Mercado & Paridade): Curva histórica de preço do cbETH em USD com toggle interativo no cabeçalho para alternar para a taxa de conversão `cbETH/ETH`.
  - `js/app.js`: Orquestrador central da aplicação, responsável pela reatividade do seletor de carteiras, alternância das 6 janelas temporais (`24h`, `7d`, `14d`, `30d`, `90d`, `Tudo`), toggle de moeda (`USD` / `BRL`) e renderização da tabela de transações (Ledger) com ordenação dinâmica e formatação condicional (#16a34a para entradas e #dc2626 para saídas).

- **Sincronização de Interfaces:**
  - `index.html`: Ponto de entrada padrão da aplicação SPA.
  - `dashboard_interativo.html`: Espelho sincronizado mantido com idêntica paridade funcional.

### 2. Relatório Analítico Power BI PBIP/PBIR v2.0.0

Artefato analítico construído no formato aberto PBIR v2.0.0, permitindo versionamento granular no Git sem arquivos binários opacos:
- `Monitor_cbETH.pbip`: Arquivo de entrada do projeto Power BI Desktop.
- `Monitor_cbETH.SemanticModel/definition/tables/_Medidas.tmdl`: 34 medidas DAX canônicas estruturadas em seções lógicas (Posição, Cotações, Patrimônio, Rendimento, P&L Decomposto, Projeções e Termômetro Decisório).
- `Monitor_cbETH.Report/`: Definição de layout PBIR v2.0.0 (`version: 2.0.0`) com 7 visual containers atômicos (IDs hexadecimais de 20 caracteres `a1000000000000000001` a `a100000000000000000a`), grade dimensional calibrada em 1280x720 e tema `CryptoExecutiveDark`.

### 3. Camada de Ingestão Python

- `extrator_onchain.py`: Script autônomo em Python para snapshot programático dos dados on-chain da carteira configurada em `carteira.json`, gravando os datasets em `dados/fato_posicao_atual.csv` e `dados/fato_historico_30d.csv`.

---

## Como Utilizar

### Execução da SPA Web Zero-Build

A SPA Web pode ser executada de duas formas, sem necessidade de instalar dependências npm ou rodar etapas de build:

#### Método A: Abertura Direta no Navegador (`file://`)
Basta dar um duplo clique ou abrir o arquivo `index.html` (ou `dashboard_interativo.html`) diretamente em qualquer navegador moderno (Chrome, Edge, Firefox, Safari).

#### Método B: Servidor HTTP Estático Local
Para testar a experiência com chamadas de rede em ambiente web local:
```bash
cd /home/ubuntu/Yggdrasil/02_Projetos_Ativos/Monitor_cbETH
python3 -m http.server 8000
```
Em seguida, acesse no navegador: `http://localhost:8000`

---

### Execução da Extração Python & Atualização do Power BI

1. Configure seu endereço público de carteira em `carteira.json`:
   ```json
   {
     "endereco_carteira": "0xc4cfde467bc76d0d6df365584648371b1954b154"
   }
   ```
2. Execute o extrator on-chain:
   ```bash
   python3 extrator_onchain.py
   ```
3. Abra `Monitor_cbETH.pbip` no Power BI Desktop e clique em **Atualizar** para incorporar os novos dados físicos de `dados/*.csv`.

---

## Suíte de Testes Automatizados E2E

O projeto possui uma suíte completa de testes automatizados E2E executados sobre os componentes JavaScript via Node.js e emulação de ambiente:

### Comando de Execução

```bash
cd /home/ubuntu/Yggdrasil/02_Projetos_Ativos/Monitor_cbETH
python3 tests/test_e2e_runner.py
```

### Estrutura dos Tiers de Testes (80 Testes, 100% de Sucesso)

- **Tier 1: Feature Coverage (35 testes):** Cobertura unitária e funcional de cada uma das features isoladas (validação de endereços EVM, decodificação RPC e recibos USDC/Uniswap V4, cotações e histórico vivo DeFiLlama, DCA ponderado das 5 transações canônicas, Preço Médio de Período, P&L não realizado, conservação algébrica Staking vs Mercado invariante à janela temporal, curvas sem inversão pré-aporte, APY 3.10%, Termômetro Decisório, reatividade das 6 janelas temporais, alternância USD/ETH e ordenação do ledger).
- **Tier 2: Boundary & Corner Cases (27 testes):** Testes de estresse e casos de borda (saldo zero, carteira nula `0x000...`, tolerância a falhas de rede, divisão segura por zero, clamping estrito do score em [40, 100], drawdown nulo e paridade 1.0).
- **Tier 3: Cross-Feature Combinations (7 testes):** Combinações entre recursos múltiplos (troca simultânea de endereço + alternância de moedas USD/BRL + filtro temporal multi-janela + ordenação do ledger).
- **Tier 4: Real-World Workloads (5 testes):** Workloads emulando fluxos reais de ponta a ponta (paridade dos 5 aportes auditados `0.036161 cbETH`, consulta sequencial de múltiplas carteiras, alternâncias rápidas de parâmetros e responsividade multi-resolução).
- **Static & Normative Compliance (6 testes):** Auditoria estática automatizada verificando cumprimento estrito do Art. 9º (ausência total de caracteres Unicode emoji), Art. 7º (ausência de TODOs e stubs incompletos), manifesto PWA (`manifest.webmanifest`), Service Worker (`sw.js`), pacote de ícones e integridade dos artefatos TMDL/PBIR.

---

## Estrutura de Arquivos

```text
02_Projetos_Ativos/Monitor_cbETH/
├── index.html                           # SPA Web Zero-Build principal com suporte a PWA e Fullscreen
├── dashboard_interativo.html             # Espelho sincronizado da SPA
├── manifest.webmanifest                 # Manifesto PWA com display fullscreen/standalone para todos os navegadores
├── manifest.json                        # Cópia do manifesto para ferramentas legadas
├── sw.js                                # Service Worker PWA com cache-first do app shell
├── favicon.ico                          # Ícone de favoritos padrão
├── assets/
│   └── icons/                           # Ícones PWA vetoriais (SVG) e bitmaps (192, 512, maskable)
├── js/
│   ├── icons.js                         # Biblioteca SVG inline monocromática com maximize/minimize (Art. 9º)
│   ├── fallback-data.js                 # Dados canônicos e gerador determinístico Mulberry32
│   ├── calculator.js                    # Motor financeiro e matemático (DCA, P&L, Termômetro)
│   ├── api.js                           # Camada de ingestão on-chain resiliente (RPC, DeFiLlama, Câmbio)
│   ├── charts.js                        # Camada de renderização dinâmica Chart.js v4 UMD
│   └── app.js                           # Controlador principal, manipulador do DOM, PWA e Fullscreen
├── tests/
│   ├── test_e2e_runner.py               # Runner automatizado da suíte unificada E2E
│   ├── helpers.py                       # Harness de execução Node.js e asserções
│   ├── test_tier1_feature_coverage.py   # Tier 1: Cobertura de features isoladas
│   ├── test_tier2_boundary_corner.py    # Tier 2: Casos de borda e limites
│   ├── test_tier3_cross_feature.py      # Tier 3: Combinações entre recursos
│   ├── test_tier4_workloads.py          # Tier 4: Fluxos de uso reais fim-a-fim
│   └── test_static_normative.py         # Conformidade estática e normativa (6 testes)
├── carteira.json                        # Endereço da carteira monitorada
├── extrator_onchain.py                  # Script Python de extração de dados
├── dados/
│   ├── fato_posicao_atual.csv           # Snapshot em tempo real da carteira padrão
│   └── fato_historico_30d.csv           # Histórico de 30 dias de cotações e taxa
├── Monitor_cbETH.pbip                   # Projeto analítico Power BI Desktop
├── Monitor_cbETH.Report/                # Definição visual PBIR v2.0.0
└── Monitor_cbETH.SemanticModel/         # Modelo tabular semântico TMDL (34 medidas DAX)
```
