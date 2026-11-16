import { cacheManager } from './cacheManager';
import { supabase } from './supabase';

export type CreditCardBrand =
  | 'nubank'
  | 'inter'
  | 'itau'
  | 'bradesco'
  | 'santander'
  | 'bb'
  | 'caixa'
  | 'c6'
  | 'mercadopago'
  | 'outro';

export interface CreditCardConfig {
  id: string;
  name: string;
  brand: CreditCardBrand;
  color: string;
  closingDay: number; // 1..31
  dueDay: number;     // 1..31
  limit?: number;
  createdAt?: string;
}

export interface TxQuickTemplate {
  id: string;
  name: string;
  tab: 'pizzaria' | 'frete' | 'despesa' | 'avulso';
  category: string;
  amount: string;
  description: string;
  deliveries?: string;
  outOfNeighborhood?: string;
  operationalExpenses?: string;
  paymentStatus?: 'paid' | 'pending';
  ignoreInCharts?: boolean;
  createdAt: string;
}

export interface PlatformReconciliation {
  id: string;
  platformCategory: string;
  periodStart: string; // yyyy-MM-dd
  periodEnd: string;   // yyyy-MM-dd
  expectedAmount: number;
  actualPaidAmount: number;
  difference: number;
  reconciledAt: string; // yyyy-MM-dd
  notes?: string;
  adjustmentTxId?: string;
}

const getCardsKey = (userId: string) => `credit_cards_${userId}`;
const getBudgetsKey = (userId: string) => `category_budgets_${userId}`;
const getTemplatesKey = (userId: string) => `tx_quick_templates_${userId}`;
const getReconciliationsKey = (userId: string) => `platform_reconciliations_${userId}`;
const getTxCardMapKey = (userId: string) => `tx_card_map_${userId}`;

function readStore<T>(key: string, fallback: T): T {
  const fromCache = cacheManager.get<T>(key);
  if (fromCache !== null && fromCache !== undefined) return fromCache;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore storage errors
  }
  return fallback;
}

function writeStore<T>(key: string, value: T): void {
  cacheManager.set(key, value, undefined, 'settings');
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

// ----------------------------------------------------------------------
// DB Mappings & Helpers
// ----------------------------------------------------------------------
function toDBCard(card: CreditCardConfig, userId: string) {
  return {
    id: card.id,
    user_id: userId,
    name: card.name,
    brand: card.brand,
    color: card.color,
    closing_day: card.closingDay,
    due_day: card.dueDay,
    limit_amount: card.limit ?? null,
    created_at: card.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function fromDBCard(row: any): CreditCardConfig {
  return {
    id: row.id,
    name: row.name,
    brand: (row.brand || 'outro') as CreditCardBrand,
    color: row.color || '#820ad1',
    closingDay: Number(row.closing_day) || 5,
    dueDay: Number(row.due_day) || 12,
    limit: row.limit_amount !== null && row.limit_amount !== undefined ? Number(row.limit_amount) : undefined,
    createdAt: row.created_at,
  };
}

function toDBTemplate(tpl: TxQuickTemplate, userId: string) {
  return {
    id: tpl.id,
    user_id: userId,
    name: tpl.name,
    tab: tpl.tab,
    category: tpl.category,
    amount: tpl.amount ? Number(tpl.amount) || 0 : 0,
    description: tpl.description || '',
    deliveries: tpl.deliveries ? Number(tpl.deliveries) || 0 : 0,
    out_of_neighborhood: tpl.outOfNeighborhood ? Number(tpl.outOfNeighborhood) || 0 : 0,
    operational_expenses: tpl.operationalExpenses ? Number(tpl.operationalExpenses) || 0 : 0,
    payment_status: tpl.paymentStatus || 'paid',
    ignore_in_charts: Boolean(tpl.ignoreInCharts),
    created_at: tpl.createdAt || new Date().toISOString(),
  };
}

function fromDBTemplate(row: any): TxQuickTemplate {
  return {
    id: row.id,
    name: row.name,
    tab: row.tab || 'despesa',
    category: row.category,
    amount: row.amount ? String(row.amount) : '',
    description: row.description || '',
    deliveries: row.deliveries ? String(row.deliveries) : undefined,
    outOfNeighborhood: row.out_of_neighborhood ? String(row.out_of_neighborhood) : undefined,
    operationalExpenses: row.operational_expenses ? String(row.operational_expenses) : undefined,
    paymentStatus: row.payment_status || 'paid',
    ignoreInCharts: Boolean(row.ignore_in_charts),
    createdAt: row.created_at,
  };
}

function toDBReconciliation(item: PlatformReconciliation, userId: string) {
  return {
    id: item.id,
    user_id: userId,
    platform_category: item.platformCategory,
    period_start: item.periodStart,
    period_end: item.periodEnd,
    expected_amount: item.expectedAmount,
    actual_paid_amount: item.actualPaidAmount,
    difference: item.difference,
    reconciled_at: item.reconciledAt,
    notes: item.notes || null,
    adjustment_tx_id: item.adjustmentTxId || null,
    created_at: new Date().toISOString(),
  };
}

function fromDBReconciliation(row: any): PlatformReconciliation {
  return {
    id: row.id,
    platformCategory: row.platform_category,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    expectedAmount: Number(row.expected_amount) || 0,
    actualPaidAmount: Number(row.actual_paid_amount) || 0,
    difference: Number(row.difference) || 0,
    reconciledAt: row.reconciled_at,
    notes: row.notes || undefined,
    adjustmentTxId: row.adjustment_tx_id || undefined,
  };
}

// ----------------------------------------------------------------------
// planningStorage Public API
// ----------------------------------------------------------------------
export const planningStorage = {
  // Credit Cards
  getCards(userId: string): CreditCardConfig[] {
    if (!userId) return [];
    return readStore<CreditCardConfig[]>(getCardsKey(userId), []);
  },

  saveCards(userId: string, cards: CreditCardConfig[]): void {
    if (!userId) return;
    writeStore(getCardsKey(userId), cards);

    // Asynchronously synchronize with Supabase (fire-and-forget with error safety)
    (async () => {
      try {
        if (!navigator.onLine) return;
        const dbCards = cards.map(c => toDBCard(c, userId));
        if (dbCards.length > 0) {
          const { error } = await supabase.from('credit_cards').upsert(dbCards);
          if (error && error.code !== '42P01') {
            console.warn('[planningStorage] Erro ao sincronizar cartões:', error);
          }
        }
        // Sync deletions: remove cards no longer present
        const currentIds = cards.map(c => c.id);
        if (currentIds.length > 0) {
          await supabase
            .from('credit_cards')
            .delete()
            .eq('user_id', userId)
            .not('id', 'in', `(${currentIds.map(id => `"${id}"`).join(',')})`);
        } else {
          await supabase.from('credit_cards').delete().eq('user_id', userId);
        }
      } catch (err) {
        console.warn('[planningStorage] Falha silenciosa ao salvar cartões no Supabase:', err);
      }
    })();
  },

  // Transaction ID -> Credit Card ID mapping
  getTxCardMap(userId: string): Record<string, string> {
    if (!userId) return {};
    return readStore<Record<string, string>>(getTxCardMapKey(userId), {});
  },

  linkTxsToCard(userId: string, txIds: string[], cardId: string): void {
    if (!userId || !cardId || txIds.length === 0) return;
    const current = this.getTxCardMap(userId);
    const next = { ...current };
    txIds.forEach(id => {
      if (id) next[id] = cardId;
    });
    writeStore(getTxCardMapKey(userId), next);

    // Asynchronously update transactions table in Supabase
    (async () => {
      try {
        if (!navigator.onLine) return;
        const { error } = await supabase
          .from('transactions')
          .update({ card_id: cardId })
          .in('id', txIds);
        if (error && error.code !== '42703' && error.code !== '42P01') {
          console.warn('[planningStorage] Erro ao vincular cartao nas transacoes:', error);
        }
      } catch (err) {
        console.warn('[planningStorage] Falha ao atualizar vínculo de cartao no Supabase:', err);
      }
    })();
  },

  unlinkTxFromCard(userId: string, txId: string): void {
    if (!userId || !txId) return;
    const current = this.getTxCardMap(userId);
    if (current[txId]) {
      const next = { ...current };
      delete next[txId];
      writeStore(getTxCardMapKey(userId), next);

      // Asynchronously update transaction in Supabase
      (async () => {
        try {
          if (!navigator.onLine) return;
          await supabase
            .from('transactions')
            .update({ card_id: null, card_name: null })
            .eq('id', txId);
        } catch (err) {
          console.warn('[planningStorage] Falha ao desvincular cartao no Supabase:', err);
        }
      })();
    }
  },

  // Category Monthly Budgets (category -> max monthly BRL)
  getCategoryBudgets(userId: string): Record<string, number> {
    if (!userId) return {};
    return readStore<Record<string, number>>(getBudgetsKey(userId), {});
  },

  saveCategoryBudgets(userId: string, budgets: Record<string, number>): void {
    if (!userId) return;
    writeStore(getBudgetsKey(userId), budgets);

    // Asynchronously synchronize with Supabase
    (async () => {
      try {
        if (!navigator.onLine) return;
        const entries = Object.entries(budgets);
        if (entries.length > 0) {
          const dbRows = entries.map(([category, monthlyLimit]) => ({
            id: `${userId}_${category.trim().toLowerCase().replace(/\s+/g, '_')}`,
            user_id: userId,
            category,
            monthly_limit: monthlyLimit,
            updated_at: new Date().toISOString(),
          }));
          const { error } = await supabase.from('category_budgets').upsert(dbRows);
          if (error && error.code !== '42P01') {
            console.warn('[planningStorage] Erro ao salvar orçamentos no Supabase:', error);
          }
        }
      } catch (err) {
        console.warn('[planningStorage] Falha ao sincronizar orçamentos no Supabase:', err);
      }
    })();
  },

  // Quick Transaction Templates (1-click favorites)
  getTemplates(userId: string): TxQuickTemplate[] {
    if (!userId) return [];
    return readStore<TxQuickTemplate[]>(getTemplatesKey(userId), []);
  },

  saveTemplates(userId: string, templates: TxQuickTemplate[]): void {
    if (!userId) return;
    writeStore(getTemplatesKey(userId), templates);

    // Asynchronously synchronize with Supabase
    (async () => {
      try {
        if (!navigator.onLine) return;
        const dbTemplates = templates.map(t => toDBTemplate(t, userId));
        if (dbTemplates.length > 0) {
          const { error } = await supabase.from('tx_quick_templates').upsert(dbTemplates);
          if (error && error.code !== '42P01') {
            console.warn('[planningStorage] Erro ao salvar modelos rápidos:', error);
          }
        }
        // Handle deletions
        const currentIds = templates.map(t => t.id);
        if (currentIds.length > 0) {
          await supabase
            .from('tx_quick_templates')
            .delete()
            .eq('user_id', userId)
            .not('id', 'in', `(${currentIds.map(id => `"${id}"`).join(',')})`);
        } else {
          await supabase.from('tx_quick_templates').delete().eq('user_id', userId);
        }
      } catch (err) {
        console.warn('[planningStorage] Falha ao sincronizar modelos rápidos no Supabase:', err);
      }
    })();
  },

  // Platform Payout Reconciliations
  getReconciliations(userId: string): PlatformReconciliation[] {
    if (!userId) return [];
    return readStore<PlatformReconciliation[]>(getReconciliationsKey(userId), []);
  },

  saveReconciliations(userId: string, items: PlatformReconciliation[]): void {
    if (!userId) return;
    writeStore(getReconciliationsKey(userId), items);

    // Asynchronously synchronize with Supabase
    (async () => {
      try {
        if (!navigator.onLine) return;
        const dbItems = items.map(item => toDBReconciliation(item, userId));
        if (dbItems.length > 0) {
          const { error } = await supabase.from('platform_reconciliations').upsert(dbItems);
          if (error && error.code !== '42P01') {
            console.warn('[planningStorage] Erro ao salvar reconciliações:', error);
          }
        }
        // Handle deletions
        const currentIds = items.map(i => i.id);
        if (currentIds.length > 0) {
          await supabase
            .from('platform_reconciliations')
            .delete()
            .eq('user_id', userId)
            .not('id', 'in', `(${currentIds.map(id => `"${id}"`).join(',')})`);
        } else {
          await supabase.from('platform_reconciliations').delete().eq('user_id', userId);
        }
      } catch (err) {
        console.warn('[planningStorage] Falha ao sincronizar reconciliações no Supabase:', err);
      }
    })();
  },

  // --------------------------------------------------------------------
  // Full Bi-directional Cloud Hydration
  // Fetches cloud data on boot/refresh and merges with local data safely
  // --------------------------------------------------------------------
  async loadAllFromCloud(userId: string): Promise<void> {
    if (!userId || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

    try {
      const [cardsRes, templatesRes, budgetsRes, reconciliationsRes] = await Promise.allSettled([
        supabase.from('credit_cards').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('tx_quick_templates').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('category_budgets').select('*').eq('user_id', userId),
        supabase.from('platform_reconciliations').select('*').eq('user_id', userId).order('period_start', { ascending: false }),
      ]);

      // 1. Credit Cards
      if (cardsRes.status === 'fulfilled' && !cardsRes.value.error && cardsRes.value.data) {
        const cloudCards = cardsRes.value.data.map(fromDBCard);
        const localCards = this.getCards(userId);
        if (cloudCards.length > 0) {
          writeStore(getCardsKey(userId), cloudCards);
        } else if (localCards.length > 0) {
          // Cloud empty but local has data: auto-seed to cloud!
          const dbCards = localCards.map(c => toDBCard(c, userId));
          await supabase.from('credit_cards').upsert(dbCards);
        }
      }

      // 2. Quick Templates
      if (templatesRes.status === 'fulfilled' && !templatesRes.value.error && templatesRes.value.data) {
        const cloudTemplates = templatesRes.value.data.map(fromDBTemplate);
        const localTemplates = this.getTemplates(userId);
        if (cloudTemplates.length > 0) {
          writeStore(getTemplatesKey(userId), cloudTemplates);
        } else if (localTemplates.length > 0) {
          const dbTemplates = localTemplates.map(t => toDBTemplate(t, userId));
          await supabase.from('tx_quick_templates').upsert(dbTemplates);
        }
      }

      // 3. Category Budgets
      if (budgetsRes.status === 'fulfilled' && !budgetsRes.value.error && budgetsRes.value.data) {
        const cloudBudgets: Record<string, number> = {};
        budgetsRes.value.data.forEach((row: any) => {
          if (row.category && typeof row.monthly_limit === 'number') {
            cloudBudgets[row.category] = row.monthly_limit;
          }
        });
        const localBudgets = this.getCategoryBudgets(userId);
        if (Object.keys(cloudBudgets).length > 0) {
          writeStore(getBudgetsKey(userId), cloudBudgets);
        } else if (Object.keys(localBudgets).length > 0) {
          const dbRows = Object.entries(localBudgets).map(([category, monthlyLimit]) => ({
            id: `${userId}_${category.trim().toLowerCase().replace(/\s+/g, '_')}`,
            user_id: userId,
            category,
            monthly_limit: monthlyLimit,
            updated_at: new Date().toISOString(),
          }));
          await supabase.from('category_budgets').upsert(dbRows);
        }
      }

      // 4. Platform Reconciliations
      if (reconciliationsRes.status === 'fulfilled' && !reconciliationsRes.value.error && reconciliationsRes.value.data) {
        const cloudItems = reconciliationsRes.value.data.map(fromDBReconciliation);
        const localItems = this.getReconciliations(userId);
        if (cloudItems.length > 0) {
          writeStore(getReconciliationsKey(userId), cloudItems);
        } else if (localItems.length > 0) {
          const dbItems = localItems.map(item => toDBReconciliation(item, userId));
          await supabase.from('platform_reconciliations').upsert(dbItems);
        }
      }
    } catch (err) {
      console.warn('[planningStorage] Erro ao sincronizar dados da nuvem:', err);
    }
  },
};

/**
 * Clamp day to the last day of a given year/month (0-indexed month).
 */
function clampDayToMonth(year: number, monthIndex: number, day: number): number {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(day, daysInMonth));
}

/**
 * Calculates the exact invoice due date (YYYY-MM-DD) for a credit card purchase.
 * Standard Brazilian card rule:
 * - If purchaseDay >= closingDay -> enters NEXT month's closing cycle.
 * - If dueDay < closingDay -> due date falls in the month AFTER the closing month.
 * - installmentIndex is 1-based (1 = first installment).
 */
export function computeCardStatementDueDate(
  purchaseDateStr: string,
  closingDay: number,
  dueDay: number,
  installmentIndex: number = 1
): { statementDueDate: string; statementMonthKey: string } {
  const [yStr, mStr, dStr] = (purchaseDateStr || '').split('-');
  const now = new Date();
  const baseYear = Number(yStr) || now.getFullYear();
  const baseMonthIdx = (Number(mStr) ? Number(mStr) - 1 : now.getMonth());
  const purchaseDay = Number(dStr) || now.getDate();

  const safeClosing = Math.max(1, Math.min(31, Number(closingDay) || 1));

  const clampedClosingInPurchaseMonth = clampDayToMonth(baseYear, baseMonthIdx, safeClosing);
  const entersNextClosingCycle = purchaseDay >= clampedClosingInPurchaseMonth ? 1 : 0;

  const totalMonthShift = entersNextClosingCycle + Math.max(0, installmentIndex - 1);

  const targetAnchor = new Date(baseYear, baseMonthIdx + totalMonthShift, 1, 12, 0, 0);
  const targetYear = targetAnchor.getFullYear();
  const targetMonthIdx = targetAnchor.getMonth();
  const targetDay = clampDayToMonth(targetYear, targetMonthIdx, safeClosing);

  const mm = String(targetMonthIdx + 1).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');
  return {
    statementDueDate: `${targetYear}-${mm}-${dd}`,
    statementMonthKey: `${targetYear}-${mm}`,
  };
}

/**
 * Helper to detect if a category name represents a credit card purchase/invoice.
 */
export function isCreditCardCategoryName(category?: string | null): boolean {
  if (!category) return false;
  const norm = category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return (
    norm.includes('cartao') ||
    norm.includes('credito') ||
    norm.includes('fatura')
  );
}

/**
 * Extracts credit card ID metadata from card_id column, txCardMap, notes, or description prefix `[Cartão <nome>]`.
 */
export function extractCardTagFromTransaction(
  tx: { id?: string; card_id?: string | null; notes?: string; description?: string },
  txCardMap?: Record<string, string>,
  cards?: CreditCardConfig[]
): string | null {
  if (tx.card_id) {
    return tx.card_id;
  }
  if (tx.id && txCardMap && txCardMap[tx.id]) {
    return txCardMap[tx.id];
  }
  const notes = tx.notes || '';
  const m = notes.match(/\[card:([^\]]+)\]/);
  if (m) return m[1];

  const desc = (tx.description || '').toLowerCase();
  if (desc.includes('[cartão ') || desc.includes('[cartao ')) {
    if (cards && cards.length > 0) {
      const matched = cards.find(
        c =>
          desc.includes(`[cartão ${c.name.toLowerCase()}]`) ||
          desc.includes(`[cartao ${c.name.toLowerCase()}]`)
      );
      if (matched) return matched.id;
    }
  }
  return null;
}

export const CARD_BRAND_PRESETS: { value: CreditCardBrand; label: string; color: string }[] = [
  { value: 'nubank', label: 'Nubank', color: '#820ad1' },
  { value: 'inter', label: 'Inter', color: '#ff7a00' },
  { value: 'itau', label: 'Itaú', color: '#ec7000' },
  { value: 'mercadopago', label: 'Mercado Pago', color: '#009ee3' },
  { value: 'c6', label: 'C6 Bank', color: '#3f3f46' },
  { value: 'santander', label: 'Santander', color: '#cc0000' },
  { value: 'bradesco', label: 'Bradesco', color: '#cc092f' },
  { value: 'bb', label: 'Banco do Brasil', color: '#eab308' },
  { value: 'caixa', label: 'Caixa', color: '#005ca9' },
  { value: 'outro', label: 'Outro Cartão', color: '#6366f1' },
];
