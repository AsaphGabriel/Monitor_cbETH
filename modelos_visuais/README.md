# 📋 Modelos de Visuais PBIR (Cópia e Cola Rápida)

Esta pasta contém a suíte completa dos 7 visuais pré-formatados e validados para o dashboard `Monitor_cbETH`.

## Como usar em qualquer projeto Power BI PBIR:

1. No formato PBIR v2.0.0 (`definition/version.json` com `"version": "2.0.0"`), toda pasta dentro de `definition/pages/<pageId>/visuals/` deve usar um identificador hexadecimal minúsculo de 20 caracteres que coincida com a propriedade `"name"` do `visual.json`:
   - `a1000000000000000001` (`card_patrimonio_brl`)
   - `a1000000000000000002` (`card_patrimonio_usd`)
   - `a1000000000000000003` (`card_exchange_rate`)
   - `a1000000000000000004` (`card_yield_eth`)
   - `a1000000000000000005` (`grafico_taxa_historica`)
   - `a1000000000000000006` (`grafico_alocacao_donut`)
   - `a1000000000000000007` (`tabela_posicao_ativos`)
2. Valide com `npx @microsoft/powerbi-report-authoring-cli@latest validate <CaminhoDoReport>` antes de abrir no Power BI Desktop.
