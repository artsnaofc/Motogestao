# MotoGestão — Importação Automática de Proventos (Ações e FIIs)

Este documento detalha a arquitetura, regras financeiras, fontes de dados e operação da funcionalidade de descoberta e importação automática de proventos corporativos no **MotoGestão**.

---

## 1. Visão Geral e Princípios Arquiteturais

A funcionalidade foi concebida para integrar-se organicamente ao ecossistema existente do MotoGestão (módulo de investimentos, autenticação Supabase, tabela `dividends`, extrato de aportes e reservas), sem criar módulos paralelos nem alterar o fluxo financeiro de proventos manuais já existentes.

### Princípios Chave:
1. **Fontes Oficiais Públicas Brasileiras:** Priorização de dados abertos da **CVM (Comissão de Valores Mobiliários)** para Ações e **Fundos.NET / B3** para Fundos de Investimento Imobiliário (FIIs), com **Brapi** atuando como provedor complementar.
2. **Entrada como Provisionado:** Todo provento novo descoberto é inserido como **Provisionado** (`status: 'provisioned'`).
3. **Cálculo Determinístico de Elegibilidade:** A quantidade de cotas elegíveis é calculada exatamente na **data de corte (Data-Com)** com base nas operações de compra e venda registradas em `investment_transactions`.
4. **Liquidação Automática e Crédito na Reserva:** Na data de pagamento (`date <= today`), o provento é efetivado para `status: 'received'` e creditado automaticamente na **Reserva de Investimentos** configurada como um **aporte** (categoria `Proventos`), com trava estrita contra duplicidades.
5. **Idempotência e Versionamento:** Documentos retificadores (versões superiores) atualizam o registro provisionado sem duplicar lançamentos. Cancelamentos oficiais marcam o registro como `status: 'cancelled'`, preservando o histórico de auditoria.

---

## 2. Pipeline em 10 Camadas

A arquitetura de coleta segue estrita separação de responsabilidades em 10 camadas:

```
[Fontes Públicas: CVM IPE / FNET B3 / Brapi]
                   │
                   ▼
       1. Descoberta (Discovery)
                   │
                   ▼
        2. Download (Ingestion)
                   │
                   ▼
        3. Extração (Parsing)
                   │
                   ▼
     4. Normalização (CorporateEvent)
                   │
                   ▼
       5. Validação (Schema Check)
                   │
                   ▼
     6. Elegibilidade (Data-Com Position)
                   │
                   ▼
     7. Deduplicação (Deterministic Hash)
                   │
                   ▼
      8. Persistência (Supabase DB)
                   │
                   ▼
    9. Reconciliação (Liquidação / Reserva)
                   │
                   ▼
         10. Interface (UI / Extrato)
```

1. **Descoberta:** Identifica novos documentos e avisos emitidos para os ativos presentes na carteira do usuário.
2. **Download:** Obtém metadados ou documentos em lote via streaming e registra links de origem.
3. **Extração:** Converte HTML, tabelas estruturadas, avisos e JSONs em estruturas legíveis, identificando tickers ON/PN (ISINs), parcelas e datas.
4. **Normalização:** Mapeia todos os eventos para a interface única `CorporateEvent`.
5. **Validação:** Valida tipos de proventos (`Dividendo`, `JCP`, `Rendimento`, `Amortizacao`, `Outros`), descartando cargas malformadas ou com valores inconsistentes.
6. **Elegibilidade:** Cruza a `data_com` do evento com o histórico de compras e vendas do usuário em `investment_transactions`.
7. **Deduplicação:** Gera identificador determinístico via hash (`[provider]:[ticker]:[dateCom]:[paymentDate]:[type]:[subKey]`).
8. **Persistência:** Grava novos proventos provisionados no banco de dados.
9. **Reconciliação:** Atualiza eventos retificados, cancela eventos revogados e efetiva pagamentos vencidos na reserva.
10. **Interface:** Apresenta badges de proveniência (`CVM IPE`, `FNET B3`, `Brapi`, `Manual`), posição elegível, links para documentos oficiais e modal de status de sincronização.

---

## 3. Fontes de Dados

### A. Ações — CVM IPE (Informações Periódicas e Eventuais)
- **Origem:** Dados abertos da CVM (`https://dados.cvm.gov.br/dados/cia_aberta/DOC/IPE/DADOS/`).
- **Arquivos:** `ipe_cia_aberta_{ANO}.csv`.
- **Filtro:** Documentos categorizados como `Relatório Proventos` e tipos correlatos (`Aviso aos Acionistas`, `Juros Sobre Capital`).
- **Multi-ISIN & Multi-Parcelas:** Parser preparado para identificar desdobramento de dividendos entre ações ordinárias (ON) e preferenciais (PN) — ex: PETR3 vs PETR4 — e pagamentos parcelados (1ª parcela, 2ª parcela com datas distintas).

### B. Fundos Imobiliários — FNET / B3
- **Origem:** Repositório oficial de avisos aos cotistas (`https://fnet.bmfbovespa.com.br/fnet/publico/`).
- **Diferenciação Crítica:**
  - `Rendimento`: Rendimentos periódicos isentos distribuídos aos cotistas.
  - `Amortizacao`: Devolução de capital investido / amortização de cotas (não tributado como lucro recorrente).
- **Tratamento de Conexão:** Endpoints públicos protegidos por Cloudflare são consultados com timeout controlado e fallback transparente para estruturas normatizadas.

### C. Provedor Complementar — Brapi
- Integrado como contingência caso as fontes governamentais estejam em janela de manutenção programada.

---

## 4. Banco de Dados e Migration Supabase

O arquivo `supabase-dividends-auto-sync.sql` contém a migração completa:

```sql
-- Extensão das colunas na tabela dividends
ALTER TABLE dividends 
  ADD COLUMN IF NOT EXISTS source_provider text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_event_id text,
  ADD COLUMN IF NOT EXISTS source_document_id text,
  ADD COLUMN IF NOT EXISTS source_document_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS eligible_quantity numeric(14, 4),
  ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS notes text;

-- Índice único determinístico para idempotência estrita
CREATE UNIQUE INDEX IF NOT EXISTS idx_dividends_user_source_event 
  ON dividends(user_id, source_event_id) 
  WHERE source_event_id IS NOT NULL;

-- Tabela de auditoria de sincronização
CREATE TABLE IF NOT EXISTS dividend_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  discovered_count integer DEFAULT 0,
  imported_count integer DEFAULT 0,
  updated_count integer DEFAULT 0,
  ignored_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  duration_ms integer DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  details jsonb,
  created_at timestamptz DEFAULT now()
);
```

---

## 5. Endpoints de Backend e Execução Automatizada

No arquivo `server.ts`:

- `POST /api/dividends/sync`: Dispara a sincronização sob demanda para a carteira de ativos do usuário.
- `GET /api/dividends/sync-status`: Retorna o histórico das últimas execuções, contagem de proventos importados/atualizados e métricas operacionais.
- **Cron Periódico em Segundo Plano:** Agendador automático que executa a cada 6 horas (com controle de concorrência que impede sobreposição) para checar novos avisos e liquidar proventos na data do pagamento.

---

## 6. Cobertura de Testes Automatizados

O sistema conta com 20 cenários de testes automatizados executados pelo test runner nativo do Node 22 (`src/lib/dividendSync/__tests__/dividendSync.test.ts`):

1. Extração de proventos a partir do CSV IPE da CVM.
2. Filtragem de documentos exclusivamente para empresas da carteira do usuário.
3. Diferenciação de ISINs múltiplos (ex.: Petrobras PETR3 vs PETR4).
4. Suporte a avisos com múltiplas parcelas em datas de pagamento distintas.
5. Robustez contra arquivos vazios ou fora do formato esperado.
6. Extração de avisos estruturados do Fundos.NET (ex.: BTCI11).
7. Diferenciação estrita entre Rendimento e Amortização de cotas.
8. Rejeição de cargas inválidas ou com valores negativos.
9. Idempotência estrita: reprocessamento não cria novos proventos.
10. Atualização de retificações quando a versão do documento é superior.
11. Cancelamento oficial de proventos preservando histórico contábil.
12. Cálculo exato da quantidade elegível com base na Data-Com.
13. Respeito à data de pagamento (não liquida provento antes do prazo).
14. Estabilidade do gerador determinístico de identificadores de evento.
15. Resiliência e cadastro correto mesmo sem reserva padrão configurada.
16. Tratamento de limites de rede e timeouts sem travamento da aplicação.
17. Unicidade de IDs determinísticos entre ativos e parcelas diferentes.
18. Preservação integral de proventos lançados manualmente pelo usuário.
19. Deduplicação em lote de múltiplos eventos repetidos no mesmo ciclo.
20. Segurança de fusos horários (formato ISO sem deslocamento de dia no calendário brasileiro).

---

## 7. Instruções para Executar os Testes

Para rodar a suíte de testes completa:

```bash
npx tsx --test src/lib/dividendSync/__tests__/dividendSync.test.ts
```
