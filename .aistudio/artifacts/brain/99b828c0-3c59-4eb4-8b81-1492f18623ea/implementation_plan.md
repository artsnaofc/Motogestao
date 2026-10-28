# Plano de Migração Zero Data Loss para Novo Supabase — Finanças Pro & MotoGestão

## 1. Auditoria Completa da Base de Dados (18 Tabelas Mapeadas)

Todas as 18 tabelas operacionais e de configuração do sistema foram auditadas e agora estão 100% integradas no motor de backup (`src/lib/databaseBackup.ts`), no arquivo DDL do schema (`setup_supabase_schema.sql`) e na suíte administrativa (`DatabaseBackupSuite.tsx`):

| # | Nome da Tabela | Chave de Conflito / PK | Módulo / Descrição | Status no Backup Anterior | Status Atual |
|---|---|---|---|---|---|
| 1 | `user_settings` | `user_id` | Perfis, parâmetros de entrega e metas | Presente | ✅ Completo |
| 2 | `transactions` | `id` | Receitas, despesas, km, parcelamentos | Presente | ✅ Completo |
| 3 | `reserves` | `id` | Cofrinhos e regras de aporte | Presente | ✅ Completo |
| 4 | `reserve_transactions` | `id` | Extrato de aportes e retiradas | Presente | ✅ Completo |
| 5 | `investment_transactions` | `id` | Ações, FIIs, BDRs e Renda Fixa | Presente | ✅ Completo |
| 6 | `dividends` | `id` | Proventos recebidos e provisionados | Presente | ✅ Completo |
| 7 | `vehicles` | `id` | Garagem, frota, placas e características | ⚠️ **OMITIDO** | ✅ **Adicionado & Mapeado** |
| 8 | `vehicle_odometer` | `id` | Histórico cronológico de KM rodado | ⚠️ **OMITIDO** | ✅ **Adicionado & Mapeado** |
| 9 | `vehicle_maintenance` | `id` | Revisões, trocas de óleo e peças | ⚠️ **OMITIDO** | ✅ **Adicionado & Mapeado** |
| 10 | `vehicle_fipe_history` | `id` | Evolução histórica do valor de mercado | ⚠️ **OMITIDO** | ✅ **Adicionado & Mapeado** |
| 11 | `valuation_targets` | `(user_id, ticker)` | Fórmulas de Bazin, Graham e Gordon | ⚠️ **OMITIDO** | ✅ **Adicionado & Mapeado** |
| 12 | `portfolio_target_allocations` | `(user_id, ticker)` | Metas de alocação de carteira (%) | ⚠️ **OMITIDO** | ✅ **Adicionado & Mapeado** |
| 13 | `portfolio_rules_config` | `user_id` | Critérios de governança do rebalanceamento | ⚠️ **OMITIDO** | ✅ **Adicionado & Mapeado** |
| 14 | `b3_assets_metadata` | `ticker` | Fundamentos, setores e CNPJs | Presente | ✅ Completo |
| 15 | `b3_assets_history` | `id` | Série histórica do Raio-X fundamentalista | ⚠️ **OMITIDO** | ✅ **Adicionado & Mapeado** |
| 16 | `freight_quotes` | `id` | Orçamentos comerciais e cálculos de frete | Presente | ✅ Completo |
| 17 | `freight_presets` | `user_id` | Parâmetros de precificação do motorista | Presente | ✅ Completo |
| 18 | `freight_clients` | `id` | Cadastro de clientes de frete | Presente | ✅ Completo |
| + | `system_config` | - | Configurações globais e políticas locais | Presente | ✅ Completo |

---

## 2. Ferramentas Disponíveis na Aplicação

Na aba **Admin & Sistema** &rarr; sub-aba **Backup & Restauração**, agora existe a nova seção **"Migração Novo Supabase"** que entrega:

1. **Schema DDL Completo (`setup_supabase_schema.sql`)**:
   - Disponível para download ou cópia com 1 clique.
   - Cria as 18 tabelas, extensões `uuid-ossp` e `pgcrypto`, índices de alta performance, ativação de RLS, políticas públicas permissivas e concessão de privilégios (`GRANT ALL`).
2. **Pacote de Migração Unificada (`migracao_completa_novo_supabase.sql`)**:
   - Extrai instantaneamente todos os dados do banco atual e une com o Schema DDL em uma única query idempotente com cláusulas `ON CONFLICT DO UPDATE`.
3. **Validador de Conexão com o Novo Supabase**:
   - Permite informar a nova URL e Anon Key e realizar um teste antes de mexer em variáveis de ambiente. O teste verifica latência e a existência de todas as 18 tabelas.
4. **Snapshot JSON com Hash SHA-256**:
   - Backup estruturado com verificação de integridade e cofre de rollback automático.

---

## 3. Roteiro de Execução Passo a Passo (Amanhã)

### Fase 1: Backup Preventivo da Base Atual
1. Acesse o Finanças Pro &rarr; **Admin & Sistema** &rarr; **Backup & Restauração** &rarr; **Migração Novo Supabase**.
2. Clique em **"Baixar Migração Completa (.sql)"**.
3. Clique também na aba **"Exportar / Snapshot"** e baixe o arquivo **Snapshot JSON (.json)**.
4. Guarde ambos os arquivos em uma pasta segura.

### Fase 2: Criar o Novo Projeto no Supabase
1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard).
2. Clique em **New Project**, defina um nome (ex: `financas-pro-prod`), crie uma senha forte para o PostgreSQL e selecione a região (ex: `sa-east-1` - São Paulo).
3. Aguarde o provisionamento do projeto (cerca de 1 a 2 minutos).

### Fase 3: Rodar o Script de Setup / Migração
1. No menu lateral do novo projeto Supabase, acesse **SQL Editor** &rarr; **New query**.
2. Abra o arquivo `migracao_completa_novo_supabase.sql` (ou cole o `setup_supabase_schema.sql` gerado pelo sistema).
3. Cole no editor e clique em **RUN** (ou pressione `Ctrl + Enter` / `Cmd + Enter`).
4. Todas as 18 tabelas serão criadas com índices, políticas RLS e todos os dados serão inseridos.

### Fase 4: Validar a Nova Conexão no Painel
1. No novo projeto Supabase, acesse **Project Settings** &rarr; **API**.
2. Copie a **Project URL** e a **anon public key**.
3. No Finanças Pro, na aba **Migração Novo Supabase**, cole nos campos do **Validador de Conexão** e clique em **"Testar Conexão Agora"**.
4. Confirme que todas as 18 tabelas foram detectadas com sucesso (18/18).

### Fase 5: Atualizar as Variáveis de Ambiente da Aplicação
1. Edite o arquivo `.env` (ou as variáveis de ambiente da sua hospedagem / Vercel / Render / Netlify):
   ```env
   VITE_SUPABASE_URL=https://novo-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-nova-anon-key
   ```
2. Reinicie o servidor / faça o deploy.

### Fase 6: Conferência Pós-Migração
1. Faça login com suas credenciais.
2. Acesse:
   - **Dashboard**: Saldo operacional, lançamentos e metas.
   - **Reservas / Cofrinhos**: Saldos de emergência e histórico de aportes.
   - **Investimentos**: Posições de ações/FIIs, notas de corretagem e proventos.
   - **Garagem & Frota**: Veículos, KM de odômetro, histórico de manutenções e FIPE.
   - **Orçamentos de Frete**: Orçamentos emitidos e clientes cadastrados.
