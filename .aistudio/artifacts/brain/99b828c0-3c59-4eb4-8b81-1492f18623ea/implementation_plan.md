# Relatório de Auditoria e Otimização do Consumo do Supabase — MotoGestão

## 1. Diagnóstico e Causas-Raízes Comprovadas (Fatos vs. Hipóteses)

| Elemento Analisado | Diagnóstico | Fato Comprovado vs. Hipótese | Impacto no Consumo |
| :--- | :--- | :--- | :--- |
| **Loop Infinito em `DataContext.tsx`** | `refreshData` continha `settings` em sua lista de dependências. Ao rodar `setSettings(finalSettings)`, gerava um novo objeto de referência a cada consulta, recriando o `useCallback(refreshData)`. O `useEffect` que observava `refreshData` disparava sem parar. | **Fato Comprovado** (Linhas 248–344 em `DataContext.tsx`) | **Crítico:** Baixava repetidamente 6 tabelas (`user_settings`, `transactions`, `reserves`, `reserve_transactions`, `investment_transactions`, `dividends`) a cada 300–800ms enquanto a aba estivesse aberta. |
| **Ping-Pong Re-render em Providers Filhos** | `DataContext` passava `onDataChange={() => refreshData(true)}` como função inline anônima instável para `InvestmentsProvider` e `ReservesProvider`. Ao re-renderizar, os contexts filhos disparavam `processReadyDividends`, que por sua vez executava `await onDataChange()`. | **Fato Comprovado** (Linhas 565–575 em `DataContext.tsx`) | **Alto:** Multiplicava o ciclo de re-fetch a cada render de componente. |
| **Loop Acelerado na Fila de Sincronização (`syncQueue.ts`)** | No método `processQueue()`, se uma mutação falhasse (ex: erro de permissão RLS 42501 ou FK 23503), o backoff exponencial era calculado, porém o bloco `finally` executava incondicionalmente `setTimeout(() => this.processQueue(), 100)`. | **Fato Comprovado** (Linhas 339–357 em `syncQueue.ts`) | **Crítico:** Em caso de erro transitório ou RLS, gerava ~10 requisições por segundo (36.000 requisições/hora), inundando os logs do PostgREST. |
| **Chamadas de Rede Repetidas a `/auth/v1/user`** | Inúmeros componentes e contextos chamavam `supabase.auth.getUser()` diretamente para obter o ID do usuário em vez de ler a sessão local em cache. | **Fato Comprovado** (Presente em 15+ locais na árvore de contexts) | **Médio/Alto:** Cada operação realizava um round-trip de validação de token na API Auth do Supabase. |
| **Download Integral de `b3_assets_metadata` no Mount** | `InvestmentsContext` realizava `select('*')` em `b3_assets_metadata` a cada montagem de componente, mesmo com os metadados já salvos em cache local. | **Fato Comprovado** (Linhas 112–132 em `InvestmentsContext.tsx`) | **Médio:** Payload de dados fundamentalistas pesados sendo transferido desnecessariamente a cada carregamento de página. |
| **Supabase Realtime (`channels`)** | Varredura de código por `supabase.channel()` e `.on('postgres_changes')`. | **Fato Comprovado: 0 canais ativos.** | **Nenhum:** Realtime não era a fonte do consumo. |

---

## 2. Ações Implementadas e Arquivos Modificados

### A. `src/contexts/DataContext.tsx`
- **Desacoplamento do State `settings`**: Substituição da dependência `settings` em `refreshData` por `settingsRef.current`. A dependência do `useCallback` foi estabilizada para `[]`.
- **Cooldown de Requisição (`MIN_REFRESH_COOLDOWN_MS = 15000`)**: Bloqueio de consultas silenciosas ou em segundo plano repetidas em intervalos menores que 15 segundos.
- **Deep Compare em `setSettings`**: Adicionada verificação por igualdade de JSON antes de atualizar o estado `settings`, evitando re-renderizações espúrias caso o payload retornado seja idêntico ao já em memória.
- **Memoização Estável de Handlers**: `handleDataChange` e `handleUpdateSettings` agora são memoizados com `useCallback`, garantindo que `InvestmentsProvider` e `ReservesProvider` não recebam referências novas a cada render.

### B. `src/lib/syncQueue.ts`
- **Respeito Estrito ao Backoff Exponencial**: O `setTimeout(() => this.processQueue(), 100)` no bloco `finally` só é acionado se a fila tiver itens pendentes e nenhum timeout de backoff estiver agendado (`!this.retryBackoffTimeout`). Em caso de erro, a fila aguarda o tempo exponencial (1s, 2s, 4s, 8s... até 30s) sem floodar o Supabase.

### C. `src/lib/authUtils.ts`
- **Otimização de `getEffectiveUser()` e `getEffectiveUserId()`**:
  - Consulta primária 100% em memória / local session (`cacheManager` e `supabase.auth.getSession()` do localStorage).
  - Consulta à rede `/auth/v1/user` somente se `forceNetworkRefresh` for solicitado ou não houver credenciais locais. Zero chamadas de rede para consultas rotineiras de identidade.

### D. `src/contexts/InvestmentsContext.tsx`
- Adicionada verificação de TTL (24 horas) para a tabela `b3_assets_metadata`. Se o cache local contiver os dados, o download completo é suprimido.
- Adicionada verificação de existência em cache antes de consultar `portfolio_target_allocations`, `portfolio_rules_config` e `valuation_targets`.
- Substituídas todas as ocorrências de `supabase.auth.getUser()` por `getEffectiveUser()`.

### E. `src/contexts/QuotesContext.tsx`
- Suprimida a consulta redundante a `user_settings.select('cached_quotes')` no mount caso o cache local de cotações já esteja populado.

### F. `src/contexts/VehiclesContext.tsx` e `src/lib/freightStorage.ts`
- Adicionado cooldown de 15 segundos em `refreshVehicles`.
- Substituídas as chamadas diretas de rede `supabase.auth.getUser()` por `getEffectiveUserId()`.

### G. Instrumentação Segura (`src/lib/supabase.ts`)
- Implementado o `supabaseRequestMonitor` via wrap transparente da chamada `fetch`. Registra estatísticas volumétricas, quantidade de requisições por janela e alerta no console contra rajadas (>15 requisições em 5 segundos) sem armazenar nenhum dado sensível ou financeiro.
- Compatibilizado para execução tanto em ambiente Vite quanto em Node.js (`tsx`).

---

## 3. Validação e Testes Executados

1. **Testes Unitários Automatizados (`src/lib/__tests__/supabaseOptimization.test.ts`)**:
   - `should accurately track requests and estimate egress volume`: **PASSOU**
   - `should detect burst traffic when request volume exceeds safe threshold`: **PASSOU**
   - `should return effective user from in-memory cache without hitting network`: **PASSOU**
   - `should throttle and cache B3 assets metadata to avoid daily refetches`: **PASSOU**
   - `should prevent exponential backoff from being overridden by 100ms rapid retries`: **PASSOU**
   - Resultado: **5/5 testes aprovados (0 falhas)**.
2. **Checagem de Tipos e Linter (`npm run lint` / `tsc --noEmit`)**:
   - **0 erros de compilação ou tipos.**
3. **Compilação de Produção (`npm run build`)**:
   - Vite e bundling do servidor Node.js concluídos com sucesso.
