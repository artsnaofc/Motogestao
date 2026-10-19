# Correção Definitiva de Saldo Fantasma e Sincronização de Proventos/Aportes

Eliminação do loop de duplicações na Reserva de Investimentos, implementação de travas anti-duplicidade em proventos e fornecimento de script SQL de auditoria para o Supabase.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisões confirmadas pelo usuário:**
> 1. **Lançamento de Proventos:** O crédito na Reserva de Investimentos ocorre automaticamente ao receber (`status: 'received'`), com **trava estrita atômica** para impedir a criação de mais de uma movimentação por provento.
> 2. **Exclusão em Cascata:** Ao excluir uma movimentação de provento na reserva, o provento correspondente na carteira de investimentos também será excluído, eliminando inconsistências cruzadas e impedindo recriações fantasmas.
> 3. **Script SQL para o Supabase:** O script fornecerá inicialmente uma **consulta de auditoria detalhada** para você inspecionar exatamente quais movimentações estão duplicadas ou órfãs antes de efetivar qualquer remoção.

---

## 1. Overview & Diagnóstico da Causa Raiz

### O Problema do "Saldo Fantasma"
Identificamos 4 fatores concorrentes que causavam a inflação constante do saldo da reserva de investimentos:
1. **Loop no processador de proventos (`InvestmentsContext.tsx`):** A função em segundo plano `processReadyDividends` buscava proventos com `(status === 'received' && !d.transaction_id)`. Ao criar a movimentação de reserva, ela atualizava o Supabase mas não atualizava o estado local/cache com o `transaction_id`, ou a fila `syncQueueManager` sobrescrevia o campo com `null` em seguida. No recarregamento seguinte, o provento era processado novamente como novo, gerando mais uma movimentação de rendimento.
2. **Ressurreição após exclusão:** Ao tentar deletar uma movimentação duplicada na reserva, o arquivo `syncQueue.ts` executava `update dividends set transaction_id = null`. Isso imediatamente ativava o gatilho automático de proventos para criar outro registro, recriando o valor fantasma.
3. **Cache Local Imune a Exclusões (`DataContext.tsx`):** O algoritmo de mesclagem do cache (`else { merged.push(localItem) }`) preservava transações que já haviam sido deletadas no Supabase, perpetuando o saldo fantasma mesmo após correções manuais.
4. **Falta de verificação de duplicidade prévia:** Não havia verificação se já existia uma movimentação de rendimento na reserva para aquele mesmo ativo, data e valor antes de inserir uma nova.

---

## 2. Fluxo da Solução & Experiência do Usuário

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           REGISTRO / ATUALIZAÇÃO                                │
│                                                                                 │
│   Provento Registrado (Recebido) ──► Gera ReserveTx Atômica                     │
│                                  └─► Vincula dividend.transaction_id = rt.id   │
│                                  └─► Vincula rt.linked_dividend_id = div.id    │
│                                                                                 │
│   Provento Provisionado (Futuro) ──► Aguarda data de pagamento (data_ex)       │
│                                  └─► No vencimento, credita reserva 1 única vez │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             TRAVA ANTI-DUPLICIDADE                              │
│                                                                                 │
│   Rotina de Checagem:                                                           │
│   1. Verifica se já existe ReserveTx com mesmo linked_dividend_id               │
│   2. Verifica se já existe rendimento idêntico (ativo, data, valor)             │
│   3. Se já existir: apenas reaproveita o vínculo; NÃO duplica saldo!            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               EXCLUSÃO SINCRONIZADA                             │
│                                                                                 │
│   Excluir movimentação na Reserva ──► Exclui provento da carteira (sem recriar) │
│   Excluir provento na Carteira    ──► Exclui movimentação na Reserva            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Principais Decisões Técnicas

1. **Geração Atômica e Imediata do Vínculo:**
   - Ao adicionar ou editar um provento com status `received`, o registro de movimentação da reserva é criado no mesmo fluxo de salvamento, associando imediatamente seus IDs mútuos.
   - A rotina de segundo plano servirá estritamente para transições de proventos que eram `provisioned` e atingiram a data de corte (`data_ex <= hoje`), nunca reprocessando cegamente proventos já recebidos.

2. **Detecção e Prevenção de Duplicatas no Cliente:**
   - Antes de qualquer inserção na tabela `reserve_transactions`, o código valida se já existe movimentação de rendimento para o ativo/provento em questão. Se já existir, recupera o ID existente em vez de gerar um novo.

3. **Exclusão Mútua Sem Loops:**
   - Em `ReservesContext.tsx`, `deleteReserveTransaction` identificará se a movimentação é proveniente de provento (via descrição `Provento: ...` ou `transaction_id`) e removerá o dividendo correspondente via fila sincronizada, sem deixar o provento órfão com `transaction_id = null`.
   - Em `InvestmentsContext.tsx`, `deleteDividend` removerá a movimentação de reserva vinculada.

4. **Saneamento do Cache Local (`DataContext.tsx`):**
   - Ao receber os dados remotos confirmados do Supabase, o cache não reterá registros que não existam mais no banco (exceto os que estiverem com ação pendente na fila de sincronização).

---

## 4. Script SQL para Auditoria e Limpeza no Supabase

Este script foi elaborado para o **SQL Editor do Supabase**. Ele foi dividido em duas partes: **Etapa 1 (Auditoria/Listagem)** e **Etapa 2 (Limpeza Segura)**.

```sql
-- ==============================================================================
-- ETAPA 1: AUDITORIA DE PROVENTOS E MOVIMENTAÇÕES FANTASMAS (SOMENTE LEITURA)
-- Execute este bloco para visualizar as inconsistências sem alterar nenhum dado.
-- ==============================================================================

-- 1.1 Listar proventos recebidos que estão sem vínculo com movimentação de reserva
SELECT 
    d.id AS dividend_id,
    d.ticker,
    d.type,
    d.amount,
    d.date,
    d.status,
    d.transaction_id,
    'Provento sem vínculo' AS status_inconsistencia
FROM public.dividends d
WHERE d.status = 'received' 
  AND (d.transaction_id IS NULL OR d.transaction_id = '');

-- 1.2 Identificar movimentações de rendimento duplicadas na reserva para o mesmo ativo/data/valor
SELECT 
    rt.description,
    rt.date,
    rt.amount,
    COUNT(*) AS total_duplicatas,
    ARRAY_AGG(rt.id) AS ids_movimentacoes
FROM public.reserve_transactions rt
WHERE rt.type = 'rendimento'
  AND (rt.description ILIKE 'Provento:%' OR rt.category = 'Rendimento')
GROUP BY rt.description, rt.date, rt.amount
HAVING COUNT(*) > 1;

-- 1.3 Conferir o saldo calculado vs saldo registrado na tabela de reservas
SELECT 
    r.id,
    r.name,
    COALESCE(r.saldo_inicial, 0) AS saldo_inicial,
    COALESCE(r.saldo_atual, 0) AS saldo_atual_tabela,
    (
        COALESCE(r.saldo_inicial, 0) +
        COALESCE((SELECT SUM(amount) FROM public.reserve_transactions WHERE reserve_id = r.id AND type = 'aporte' AND payment_status != 'pending'), 0) +
        COALESCE((SELECT SUM(amount) FROM public.reserve_transactions WHERE reserve_id = r.id AND type = 'rendimento' AND payment_status != 'pending'), 0) -
        COALESCE((SELECT SUM(amount) FROM public.reserve_transactions WHERE reserve_id = r.id AND type = 'utilizacao' AND payment_status != 'pending'), 0)
    ) AS saldo_calculado_real
FROM public.reserves r;


-- ==============================================================================
-- ETAPA 2: LIMPEZA SEGURA DE DUPLICATAS (EXECUTE APENAS APÓS CONFERIR A ETAPA 1)
-- ==============================================================================

/*
-- 2.1 Remover movimentações duplicadas de rendimento, mantendo apenas a primeira criada:
DELETE FROM public.reserve_transactions
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY reserve_id, description, date, amount, type 
                   ORDER BY created_at ASC
               ) as rnum
        FROM public.reserve_transactions
        WHERE type = 'rendimento' AND description ILIKE 'Provento:%'
    ) t
    WHERE t.rnum > 1
);

-- 2.2 Sincronizar o transaction_id dos proventos com a movimentação correspondente na reserva:
UPDATE public.dividends d
SET transaction_id = rt.id
FROM public.reserve_transactions rt
WHERE d.status = 'received'
  AND (d.transaction_id IS NULL OR d.transaction_id = '')
  AND rt.type = 'rendimento'
  AND rt.date = d.date
  AND rt.amount = d.amount
  AND rt.description ILIKE ('%' || d.ticker || '%');

-- 2.3 Atualizar a coluna saldo_atual da reserva com o valor auditado exato:
UPDATE public.reserves r
SET saldo_atual = (
    COALESCE(r.saldo_inicial, 0) +
    COALESCE((SELECT SUM(amount) FROM public.reserve_transactions WHERE reserve_id = r.id AND type = 'aporte' AND payment_status != 'pending'), 0) +
    COALESCE((SELECT SUM(amount) FROM public.reserve_transactions WHERE reserve_id = r.id AND type = 'rendimento' AND payment_status != 'pending'), 0) -
    COALESCE((SELECT SUM(amount) FROM public.reserve_transactions WHERE reserve_id = r.id AND type = 'utilizacao' AND payment_status != 'pending'), 0)
);
*/
```

---

## 5. Arquivos Que Serão Ajustados na Execução
1. `src/contexts/InvestmentsContext.tsx`:
   - Refatoração completa de `processReadyDividends`: inclusão de checagem contra duplicatas existentes, garantia de vínculo bidirecional no salvamento e prevenção de disparos cíclicos.
   - Atualização de `addDividend` e `updateDividend` para vincular a movimentação de reserva atomicamente na criação se `status === 'received'`.
   - Ajuste de `deleteDividend` para remoção sincronizada da movimentação na reserva.
2. `src/contexts/ReservesContext.tsx`:
   - Atualização de `deleteReserveTransaction` para verificar e excluir em cascata o provento associado na carteira de investimentos.
3. `src/contexts/DataContext.tsx`:
   - Correção da estratégia de mesclagem do cache para descartar registros que foram removidos remotamente do banco.
4. `src/lib/syncQueue.ts`:
   - Eliminação do gatilho que zerava o `transaction_id` do dividendo e disparava a recriação do fantasma.
