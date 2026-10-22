import { CorporateEvent, Dividend } from '../../types';

export interface DeduplicationDecision {
  action: 'insert' | 'update' | 'cancel' | 'ignore';
  reason: string;
  targetDividendId?: string;
  updatedFields?: Partial<Dividend>;
}

/**
 * Creates a deterministic, collision-resistant event ID for a corporate action.
 * Format: [provider]:[ticker]:[dateCom]:[paymentDate]:[type]:[parcel/ISIN/docId]
 */
export function generateDeterministicEventId(
  provider: string,
  ticker: string,
  dateCom: string,
  paymentDate: string,
  type: string,
  subKey = 'default'
): string {
  const normTicker = ticker.trim().toUpperCase();
  const normProvider = provider.trim().toLowerCase();
  const normType = type.trim();
  const normSub = subKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `${normProvider}:${normTicker}:${dateCom}:${paymentDate}:${normType}:${normSub}`;
}

/**
 * Reconciles an incoming CorporateEvent against the user's existing dividends list.
 * 
 * Rules:
 * 1. Strict idempotency: same event processed multiple times results in 'ignore'.
 * 2. Versioning & Retificação: newer document version or modified value updates the record.
 * 3. Never overwrite or cancel an already 'received' dividend silently.
 * 4. Cancellation: updates status to 'cancelled' if still provisioned.
 */
export function evaluateEventDeduplication(
  event: CorporateEvent,
  existingDividends: Dividend[]
): DeduplicationDecision {
  const normTicker = event.ticker.trim().toUpperCase();

  // 1. Direct match by source_event_id
  const matchByEventId = existingDividends.find(d => 
    d.source_event_id && d.source_event_id === event.eventId
  );

  // 2. Direct match by document ID & ticker
  const matchByDocId = !matchByEventId && event.documentId
    ? existingDividends.find(d => 
        d.source_document_id === event.documentId && 
        d.ticker.toUpperCase() === normTicker &&
        d.date === event.paymentDate
      )
    : undefined;

  // 3. Heuristic match by business keys (ticker + data_com + payment_date + type)
  const matchByBusinessKey = (!matchByEventId && !matchByDocId)
    ? existingDividends.find(d => 
        d.ticker.toUpperCase() === normTicker &&
        d.type === event.type &&
        d.date === event.paymentDate &&
        (d.data_com === event.dateCom || !d.data_com || !event.dateCom)
      )
    : undefined;

  const existing = matchByEventId || matchByDocId || matchByBusinessKey;

  // Case A: Event does not exist in user's records -> Insert as new
  if (!existing) {
    if (event.status === 'cancelled') {
      return {
        action: 'ignore',
        reason: 'Evento cancelado antes de ser importado'
      };
    }
    return {
      action: 'insert',
      reason: 'Novo provento identificado'
    };
  }

  // Case B: Event already exists and was cancelled by the issuer
  if (event.status === 'cancelled') {
    if (existing.status === 'received') {
      return {
        action: 'ignore',
        targetDividendId: existing.id,
        reason: 'Evento cancelado pela companhia, mas já foi recebido/liquidado na carteira (preservando histórico financeiro)'
      };
    }
    if (existing.status === 'cancelled') {
      return {
        action: 'ignore',
        targetDividendId: existing.id,
        reason: 'Evento já registrado como cancelado'
      };
    }
    return {
      action: 'cancel',
      targetDividendId: existing.id,
      updatedFields: {
        status: 'cancelled',
        notes: `Cancelado oficialmente em anúncio retificador: ${event.notes || 'Cancelamento pela emissora'}`
      },
      reason: 'Provento cancelado pela companhia emissora'
    };
  }

  // Case C: Check for Retificação (document version upgrade or value modification)
  const isNewerVersion = Boolean(
    event.documentVersion && 
    existing.source_document_version && 
    event.documentVersion > existing.source_document_version
  );

  const unitAmountChanged = Boolean(
    event.unitAmount > 0 && 
    existing.unit_amount && 
    Math.abs(event.unitAmount - existing.unit_amount) > 0.000001
  );

  const paymentDateChanged = Boolean(
    event.paymentDate && 
    existing.date !== event.paymentDate
  );

  if (isNewerVersion || unitAmountChanged || paymentDateChanged) {
    // If dividend was already received, we do not arbitrarily overwrite received amounts
    if (existing.status === 'received') {
      return {
        action: 'ignore',
        targetDividendId: existing.id,
        reason: 'Retificação recebida mas provento já foi liquidado pelo usuário (preservado)'
      };
    }

    const updatedFields: Partial<Dividend> = {
      source_document_version: event.documentVersion || existing.source_document_version,
      source_updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      validation_status: event.validationStatus,
    };

    if (unitAmountChanged) {
      updatedFields.unit_amount = event.unitAmount;
      if (existing.eligible_quantity && existing.eligible_quantity > 0) {
        updatedFields.amount = Number((existing.eligible_quantity * event.unitAmount).toFixed(2));
      }
    }

    if (paymentDateChanged) {
      updatedFields.date = event.paymentDate;
    }

    if (event.documentUrl) {
      updatedFields.source_url = event.documentUrl;
    }

    return {
      action: 'update',
      targetDividendId: existing.id,
      updatedFields,
      reason: isNewerVersion 
        ? `Retificação oficial (Versão ${event.documentVersion}) aplicada` 
        : 'Valores ou datas atualizados conforme aviso de mercado'
    };
  }

  // Case D: Exact duplicate / already synchronized
  return {
    action: 'ignore',
    targetDividendId: existing.id,
    reason: 'Provento já sincronizado e sem alterações'
  };
}
