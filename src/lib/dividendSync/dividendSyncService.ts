import { 
  CorporateEvent, 
  Dividend, 
  DividendSyncResult, 
  InvestmentTransaction, 
  DividendType 
} from '../../types';
import { calculateEligiblePosition } from './dividendEligibilityEngine';
import { evaluateEventDeduplication } from './dividendDeduplicator';
import { fetchCvmIpeAnnouncements } from './cvmIpeCollector';
import { fetchFnetAnnouncements } from './fnetCollector';
import { fetchB3MarketDividends } from './b3MarketDividendCollector';
import { fetchBrapiDividends } from './brapiDividendCollector';

export interface DividendSyncParams {
  portfolioTickers: string[];
  transactions: InvestmentTransaction[];
  existingDividends: Dividend[];
  userId: string;
  userCnpjMap?: Record<string, string>;
  brapiToken?: string;
  forceProvider?: 'all' | 'cvm_ipe' | 'fnet_b3' | 'b3_market' | 'brapi';
}

export interface SyncExecutionOutput {
  result: DividendSyncResult;
  newDividends: Dividend[];
  updatedDividends: { id: string; fields: Partial<Dividend> }[];
  cancelledDividendIds: string[];
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * 10-Layer Corporate Actions Synchronization Engine:
 * 1. Descoberta (Discovery)
 * 2. Download
 * 3. Extração (Extraction)
 * 4. Normalização (Normalization)
 * 5. Validação (Validation)
 * 6. Elegibilidade (Eligibility)
 * 7. Deduplicação (Deduplication)
 * 8. Reconciliação (Reconciliation)
 * 9. Persistência (Persistence payload generation)
 * 10. Auditoria e Métricas (Audit & reporting)
 */
export async function executeDividendSync(
  params: DividendSyncParams
): Promise<SyncExecutionOutput> {
  const startTime = performance.now();
  const {
    portfolioTickers,
    transactions,
    existingDividends,
    userId,
    userCnpjMap = {},
    brapiToken,
    forceProvider = 'all',
  } = params;

  const cleanTickers = Array.from(
    new Set(portfolioTickers.map(t => t.trim().toUpperCase()))
  ).filter(Boolean);

  const discoveredEvents: CorporateEvent[] = [];
  const errors: string[] = [];
  const details: DividendSyncResult['details'] = [];

  // Layer 1, 2, 3: Discovery, Download & Extraction from primary sources
  if (forceProvider === 'all' || forceProvider === 'cvm_ipe') {
    const cvmRes = await fetchCvmIpeAnnouncements(cleanTickers, userCnpjMap);
    discoveredEvents.push(...cvmRes.events);
    errors.push(...cvmRes.errors);
  }

  if (forceProvider === 'all' || forceProvider === 'fnet_b3') {
    const fnetRes = await fetchFnetAnnouncements(cleanTickers);
    discoveredEvents.push(...fnetRes.events);
    errors.push(...fnetRes.errors);
  }

  if (forceProvider === 'all' || forceProvider === 'b3_market') {
    const b3Res = await fetchB3MarketDividends(cleanTickers);
    discoveredEvents.push(...b3Res.events);
    errors.push(...b3Res.errors);
  }

  if (forceProvider === 'all' || forceProvider === 'brapi') {
    const brapiRes = await fetchBrapiDividends(cleanTickers, brapiToken);
    discoveredEvents.push(...brapiRes.events);
    errors.push(...brapiRes.errors);
  }

  let importedCount = 0;
  let updatedCount = 0;
  let ignoredCount = 0;
  let errorCount = errors.length;

  const newDividends: Dividend[] = [];
  const updatedDividends: { id: string; fields: Partial<Dividend> }[] = [];
  const cancelledDividendIds: string[] = [];

  const nowIso = new Date().toISOString();

  // Layer 4, 5, 6, 7, 8: Normalization, Validation, Eligibility, Deduplication, Reconciliation
  for (const event of discoveredEvents) {
    try {
      // Layer 5: Strict Validation
      if (!event.ticker || !event.paymentDate || !event.unitAmount || event.unitAmount <= 0) {
        ignoredCount++;
        details.push({
          ticker: event.ticker || 'UNKNOWN',
          type: event.type,
          unitAmount: event.unitAmount,
          paymentDate: event.paymentDate,
          status: 'ignored',
          reason: 'Dados mínimos incompletos ou valor unitário não positivo'
        });
        continue;
      }

      // Layer 6: Eligibility calculation based on user's transactions on data_com
      const eligibility = calculateEligiblePosition(transactions, event.ticker, event.dateCom);

      // If user had zero shares on data_com, do not create an unentitled payment for them
      if (!eligibility.hasPosition || eligibility.eligibleQuantity <= 0) {
        ignoredCount++;
        details.push({
          ticker: event.ticker,
          type: event.type,
          unitAmount: event.unitAmount,
          paymentDate: event.paymentDate,
          status: 'ignored',
          reason: `Sem posição na data-com (${event.dateCom})`
        });
        continue;
      }

      const totalExpectedAmount = Number(
        (eligibility.eligibleQuantity * event.unitAmount).toFixed(2)
      );

      // Layer 7: Deduplication & Reconciliation
      const decision = evaluateEventDeduplication(event, existingDividends);

      if (decision.action === 'insert') {
        const newDivId = generateUUID();
        const displayType = event.type === 'JCP' ? 'JSCP' : event.type;
        const description = `Provento automático: ${event.ticker} (${displayType}) - Ref: ${event.referenceMonthYear || event.dateCom}`;

        const createdDiv: Dividend = {
          id: newDivId,
          user_id: userId,
          ticker: event.ticker,
          amount: totalExpectedAmount,
          unit_amount: event.unitAmount,
          type: event.type as DividendType,
          status: 'provisioned', // All auto-discovered events begin strictly as provisioned
          date: event.paymentDate, // The scheduled payment date
          data_com: event.dateCom,
          data_ex: event.dateEx || undefined,
          description,
          created_at: nowIso,

          // Provenance Metadata
          source_provider: event.provider,
          source_event_id: event.eventId,
          source_document_id: event.documentId,
          source_document_version: event.documentVersion || 1,
          source_url: event.documentUrl,
          source_published_at: event.announcementDate ? `${event.announcementDate}T12:00:00Z` : nowIso,
          source_updated_at: nowIso,
          last_synced_at: nowIso,
          eligible_quantity: eligibility.eligibleQuantity,
          validation_status: event.validationStatus || 'valid',
          notes: event.notes,
        };

        newDividends.push(createdDiv);
        importedCount++;
        details.push({
          ticker: event.ticker,
          type: event.type,
          unitAmount: event.unitAmount,
          paymentDate: event.paymentDate,
          status: 'imported',
          reason: `Importado como previsto (Posição: ${eligibility.eligibleQuantity} un. Total: R$ ${totalExpectedAmount})`
        });
      } else if (decision.action === 'update' && decision.targetDividendId) {
        updatedDividends.push({
          id: decision.targetDividendId,
          fields: decision.updatedFields || {}
        });
        updatedCount++;
        details.push({
          ticker: event.ticker,
          type: event.type,
          unitAmount: event.unitAmount,
          paymentDate: event.paymentDate,
          status: 'updated',
          reason: decision.reason
        });
      } else if (decision.action === 'cancel' && decision.targetDividendId) {
        cancelledDividendIds.push(decision.targetDividendId);
        updatedDividends.push({
          id: decision.targetDividendId,
          fields: decision.updatedFields || { status: 'cancelled' }
        });
        updatedCount++;
        details.push({
          ticker: event.ticker,
          type: event.type,
          unitAmount: event.unitAmount,
          paymentDate: event.paymentDate,
          status: 'cancelled',
          reason: decision.reason
        });
      } else {
        ignoredCount++;
        details.push({
          ticker: event.ticker,
          type: event.type,
          unitAmount: event.unitAmount,
          paymentDate: event.paymentDate,
          status: 'ignored',
          reason: decision.reason
        });
      }
    } catch (itemErr: any) {
      errorCount++;
      errors.push(`Erro processando ${event.ticker}: ${itemErr?.message || itemErr}`);
      details.push({
        ticker: event.ticker || 'UNKNOWN',
        type: event.type,
        unitAmount: event.unitAmount,
        paymentDate: event.paymentDate,
        status: 'error',
        reason: itemErr?.message || String(itemErr)
      });
    }
  }

  const durationMs = Math.round(performance.now() - startTime);

  const result: DividendSyncResult = {
    provider: forceProvider === 'all' ? 'Multi-Fonte Oficial (CVM/B3)' : forceProvider,
    discovered: discoveredEvents.length,
    imported: importedCount,
    updated: updatedCount,
    ignored: ignoredCount,
    errors: errorCount,
    durationMs,
    timestamp: nowIso,
    details
  };

  return {
    result,
    newDividends,
    updatedDividends,
    cancelledDividendIds
  };
}
