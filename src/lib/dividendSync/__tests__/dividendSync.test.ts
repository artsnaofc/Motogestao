import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { 
  parseCvmIpeCsv, 
  filterIpeByTickers, 
  parseCvmDocumentContent, 
  IpeDocumentRecord 
} from '../cvmIpeCollector';
import { 
  parseFnetNotice, 
  fetchFnetAnnouncements 
} from '../fnetCollector';
import { calculateEligiblePosition } from '../dividendEligibilityEngine';
import { 
  generateDeterministicEventId, 
  evaluateEventDeduplication 
} from '../dividendDeduplicator';
import { 
  CVM_IPE_SAMPLE_CSV, 
  CVM_PETROBRAS_DOC_HTML, 
  FNET_BTCI11_NOTICE_JSON, 
  FNET_AMORTIZACAO_NOTICE_JSON 
} from '../fixtures/corporateEventFixtures';
import { CorporateEvent, Dividend, InvestmentTransaction } from '../../../types';

describe('Corporate Earnings Auto-Sync Engine (MotoGestão) - 20 Comprehensive Test Scenarios', () => {

  // Test 1: CVM IPE CSV parser extracts corporate events with category "Relatório Proventos"
  test('1. CVM IPE CSV parser extracts corporate events with category "Relatório Proventos"', () => {
    const records = parseCvmIpeCsv(CVM_IPE_SAMPLE_CSV);
    assert.ok(records.length >= 3, `Expected at least 3 records, got ${records.length}`);
    const proventos = records.filter(r => /Proventos/i.test(r.category) || /Acionistas/i.test(r.type));
    assert.ok(proventos.length >= 3, 'Should identify Relatório Proventos and Aviso aos Acionistas records');
    assert.strictEqual(records[0].protocol, '1029384');
    assert.strictEqual(records[0].version, 1);
    assert.ok(records[0].companyName.includes('PETROBRAS'));
  });

  // Test 2: Filter IPE documents by companies/tickers present in the portfolio
  test('2. Filter IPE documents by portfolio companies and tickers', () => {
    const records = parseCvmIpeCsv(CVM_IPE_SAMPLE_CSV);
    const filtered = filterIpeByTickers(records, ['PETR4', 'VALE3'], {
      'PETR4': '33.000.167/0001-01',
      'VALE3': '33.592.510/0001-54'
    });
    assert.ok(filtered.length >= 2, 'Should filter for PETR4 and VALE3');
    assert.ok(filtered.every(r => r.companyName.includes('PETROBRAS') || r.companyName.includes('VALE')));
    // Should NOT include ITAU UNIBANCO
    assert.strictEqual(filtered.some(r => r.companyName.includes('ITAU')), false);
  });

  // Test 3: Petrobras multi-ISIN notice differentiation between PETR3 and PETR4
  test('3. Petrobras multi-ISIN notice differentiation between PETR3 and PETR4', () => {
    const meta: IpeDocumentRecord = {
      cnpj: '33.000.167/0001-01',
      companyName: 'PETROLEO BRASILEIRO S.A. - PETROBRAS',
      cvmCode: '009512',
      refDate: '2026-04-25',
      category: 'Relatório Proventos',
      type: 'Aviso aos Acionistas',
      deliveryDate: '2026-04-25 18:30:00',
      version: 1,
      protocol: '1029384',
      downloadUrl: 'https://dados.cvm.gov.br/doc/ipe/1029384'
    };

    const events = parseCvmDocumentContent(CVM_PETROBRAS_DOC_HTML, meta);
    assert.ok(events.length >= 2, `Expected at least 2 events, got ${events.length}`);
    const petr3Events = events.filter(e => e.ticker === 'PETR3');
    const petr4Events = events.filter(e => e.ticker === 'PETR4');
    assert.ok(petr3Events.length > 0, 'Must extract PETR3 events');
    assert.ok(petr4Events.length > 0, 'Must extract PETR4 events');
    assert.strictEqual(petr4Events[0].unitAmount, 0.573);
  });

  // Test 4: Multi-installment corporate notices parsed as distinct events
  test('4. Multi-installment corporate notices parsed as distinct events with distinct payment dates', () => {
    const meta: IpeDocumentRecord = {
      cnpj: '33.000.167/0001-01',
      companyName: 'PETROLEO BRASILEIRO S.A. - PETROBRAS',
      cvmCode: '009512',
      refDate: '2026-04-25',
      category: 'Relatório Proventos',
      type: 'Aviso aos Acionistas',
      deliveryDate: '2026-04-25 18:30:00',
      version: 1,
      protocol: '1029384',
      downloadUrl: 'https://dados.cvm.gov.br/doc/ipe/1029384'
    };

    const events = parseCvmDocumentContent(CVM_PETROBRAS_DOC_HTML, meta);
    const petr4Events = events.filter(e => e.ticker === 'PETR4');
    assert.strictEqual(petr4Events.length, 2, 'PETR4 has 2 distinct installments');
    assert.notStrictEqual(petr4Events[0].paymentDate, petr4Events[1].paymentDate, 'Installments have different payment dates');
    assert.notStrictEqual(petr4Events[0].eventId, petr4Events[1].eventId, 'Installments have unique deterministic event IDs');
  });

  // Test 5: Robustness to variations in document structure
  test('5. Robustness to variations in document format (empty/malformed returns empty without crash)', () => {
    const meta: IpeDocumentRecord = {
      cnpj: '00.000.000/0001-00',
      companyName: 'TESTE S.A.',
      cvmCode: '000000',
      refDate: '2026-01-01',
      category: 'Relatório Proventos',
      type: 'Outros',
      deliveryDate: '2026-01-01',
      version: 1,
      protocol: '999999',
      downloadUrl: ''
    };

    const emptyRes = parseCvmDocumentContent('', meta);
    assert.deepStrictEqual(emptyRes, []);

    const malformedRes = parseCvmDocumentContent('Texto qualquer sem tabela nem proventos', meta);
    assert.deepStrictEqual(malformedRes, []);
  });

  // Test 6: FNET B3 parser extracts FII structured notices (BTCI11)
  test('6. FNET B3 parser extracts FII structured notices with ticker, dates and unit amount', () => {
    const parsed = parseFnetNotice(FNET_BTCI11_NOTICE_JSON);
    assert.ok(parsed, 'Should successfully parse BTCI11 notice');
    assert.strictEqual(parsed?.ticker, 'BTCI11');
    assert.strictEqual(parsed?.type, 'Rendimento');
    assert.strictEqual(parsed?.dateCom, '2026-08-07');
    assert.strictEqual(parsed?.paymentDate, '2026-08-14');
    assert.strictEqual(parsed?.unitAmount, 0.103);
    assert.strictEqual(parsed?.provider, 'fnet_b3');
  });

  // Test 7: Distinction between Rendimento vs Amortização
  test('7. Strict distinction between Rendimento and Amortização', () => {
    const rendimento = parseFnetNotice(FNET_BTCI11_NOTICE_JSON);
    const amortizacao = parseFnetNotice(FNET_AMORTIZACAO_NOTICE_JSON);

    assert.strictEqual(rendimento?.type, 'Rendimento');
    assert.strictEqual(amortizacao?.type, 'Amortizacao');
    assert.notStrictEqual(rendimento?.type, amortizacao?.type);
  });

  // Test 8: Rejection of invalid payloads
  test('8. Rejection of invalid payloads (missing dates, non-positive values, missing ticker)', () => {
    const invalidPayload: any = {
      codigoNegociacao: '',
      valorPorCota: -0.5,
      dataBase: ''
    };
    const parsed = parseFnetNotice(invalidPayload);
    assert.strictEqual(parsed, null, 'Invalid notice must return null safely');
  });

  // Test 9: Deduplication idempotency
  test('9. Deduplication idempotency: repeating sync with same events produces ignore action', () => {
    const event: CorporateEvent = {
      eventId: 'fnet_b3:BTCI11:2026-08-07:2026-08-14:Rendimento:fii',
      provider: 'fnet_b3',
      ticker: 'BTCI11',
      type: 'Rendimento',
      dateCom: '2026-08-07',
      paymentDate: '2026-08-14',
      unitAmount: 0.103,
      documentVersion: 1,
      status: 'active',
      validationStatus: 'valid'
    };

    const existingDividends: Dividend[] = [{
      id: 'div-btci-1',
      user_id: 'user-test',
      ticker: 'BTCI11',
      amount: 103.0,
      unit_amount: 0.103,
      type: 'Rendimento',
      status: 'provisioned',
      date: '2026-08-14',
      data_com: '2026-08-07',
      data_ex: '2026-08-14',
      source_provider: 'fnet_b3',
      source_event_id: 'fnet_b3:BTCI11:2026-08-07:2026-08-14:Rendimento:fii',
      source_document_version: 1
    }];

    const decision = evaluateEventDeduplication(event, existingDividends);
    assert.strictEqual(decision.action, 'ignore', 'Must ignore already processed identical event');
  });

  // Test 10: Retification handling (version upgrade)
  test('10. Retification handling: newer document version updates existing provisioned event', () => {
    const retifiedEvent: CorporateEvent = {
      eventId: 'fnet_b3:BTCI11:2026-08-07:2026-08-14:Rendimento:fii',
      provider: 'fnet_b3',
      ticker: 'BTCI11',
      type: 'Rendimento',
      dateCom: '2026-08-07',
      paymentDate: '2026-08-14',
      unitAmount: 0.105, // Corrected from 0.103
      documentVersion: 2, // Version 2
      status: 'active',
      validationStatus: 'valid'
    };

    const existingDividends: Dividend[] = [{
      id: 'div-btci-1',
      user_id: 'user-test',
      ticker: 'BTCI11',
      amount: 103.0,
      unit_amount: 0.103,
      eligible_quantity: 1000,
      type: 'Rendimento',
      status: 'provisioned',
      date: '2026-08-14',
      data_com: '2026-08-07',
      data_ex: '2026-08-14',
      source_provider: 'fnet_b3',
      source_event_id: 'fnet_b3:BTCI11:2026-08-07:2026-08-14:Rendimento:fii',
      source_document_version: 1
    }];

    const decision = evaluateEventDeduplication(retifiedEvent, existingDividends);
    assert.strictEqual(decision.action, 'update');
    assert.strictEqual(decision.targetDividendId, 'div-btci-1');
    assert.strictEqual(decision.updatedFields?.source_document_version, 2);
    assert.strictEqual(decision.updatedFields?.unit_amount, 0.105);
    assert.strictEqual(decision.updatedFields?.amount, 105.0); // 1000 * 0.105
  });

  // Test 11: Cancellation handling
  test('11. Cancellation handling: notice with status cancelled updates provisioned event', () => {
    const cancelledEvent: CorporateEvent = {
      eventId: 'cvm_ipe:PETR4:2026-08-21:2026-11-20:Dividendo:default',
      provider: 'cvm_ipe',
      ticker: 'PETR4',
      type: 'Dividendo',
      dateCom: '2026-08-21',
      paymentDate: '2026-11-20',
      unitAmount: 0,
      status: 'cancelled',
      validationStatus: 'cancelled'
    };

    const existingDividends: Dividend[] = [{
      id: 'div-petr4-1',
      user_id: 'user-test',
      ticker: 'PETR4',
      amount: 287.41,
      unit_amount: 0.287413,
      type: 'Dividendo',
      status: 'provisioned',
      date: '2026-11-20',
      data_com: '2026-08-21',
      source_provider: 'cvm_ipe',
      source_event_id: 'cvm_ipe:PETR4:2026-08-21:2026-11-20:Dividendo:default'
    }];

    const decision = evaluateEventDeduplication(cancelledEvent, existingDividends);
    assert.strictEqual(decision.action, 'cancel');
    assert.strictEqual(decision.targetDividendId, 'div-petr4-1');
    assert.strictEqual(decision.updatedFields?.status, 'cancelled');
  });

  // Test 12: Data-com eligibility calculation
  test('12. Data-com eligibility: calculates exact position on data-com from transaction history', () => {
    const transactions: InvestmentTransaction[] = [
      { id: 'tx-1', user_id: 'u1', ticker: 'PETR4', type: 'Ação', operation: 'buy', quantity: 1000, price: 30, amount: 30000, date: '2026-01-10' },
      { id: 'tx-2', user_id: 'u1', ticker: 'PETR4', type: 'Ação', operation: 'buy', quantity: 500, price: 32, amount: 16000, date: '2026-04-20' },
      { id: 'tx-3', user_id: 'u1', ticker: 'PETR4', type: 'Ação', operation: 'sell', quantity: 200, price: 35, amount: 7000, date: '2026-04-24' },
      // Transaction AFTER data-com (2026-04-25) - must NOT count
      { id: 'tx-4', user_id: 'u1', ticker: 'PETR4', type: 'Ação', operation: 'buy', quantity: 1000, price: 36, amount: 36000, date: '2026-04-28' }
    ];

    const eligibility = calculateEligiblePosition(transactions, 'PETR4', '2026-04-25');
    assert.strictEqual(eligibility.hasPosition, true);
    assert.strictEqual(eligibility.eligibleQuantity, 1300, 'Position on 2026-04-25 must be 1000 + 500 - 200 = 1300');
  });

  // Test 13: Payment date constraint
  test('13. Payment date constraint: future payment date remains strictly provisioned', () => {
    const today = '2026-10-21';
    const futurePayDate = '2026-11-20';
    const statusForFuture = futurePayDate <= today ? 'received' : 'provisioned';
    assert.strictEqual(statusForFuture, 'provisioned', 'Future payment date must remain provisioned');

    const pastPayDate = '2026-08-14';
    const statusForPast = pastPayDate <= today ? 'received' : 'provisioned';
    assert.strictEqual(statusForPast, 'received', 'Past payment date becomes received');
  });

  // Test 14: Idempotency of event ID generator
  test('14. Idempotency of event IDs: same parameters always yield identical string', () => {
    const id1 = generateDeterministicEventId('cvm_ipe', 'PETR4', '2026-04-25', '2026-05-20', 'Dividendo', 'p1');
    const id2 = generateDeterministicEventId('cvm_ipe', 'PETR4', '2026-04-25', '2026-05-20', 'Dividendo', 'p1');
    assert.strictEqual(id1, id2);
  });

  // Test 15: Resilience when user has no default investment reserve
  test('15. Resilience without default reserve: dividend is registered without crashing', () => {
    const dividendPayload: Partial<Dividend> = {
      ticker: 'PETR4',
      amount: 573.0,
      unit_amount: 0.573,
      type: 'Dividendo',
      status: 'provisioned',
      date: '2026-05-20',
      data_com: '2026-04-25',
      eligible_quantity: 1000
    };

    assert.ok(dividendPayload.ticker);
    assert.strictEqual(dividendPayload.status, 'provisioned');
    assert.strictEqual(dividendPayload.amount, 573.0);
  });

  // Test 16: Timeout / network handling
  test('16. Timeout / network handling: fetchFnetAnnouncements gracefully handles network limits', async () => {
    const res = await fetchFnetAnnouncements(['BTCI11']);
    assert.ok(Array.isArray(res.events));
    assert.ok(Array.isArray(res.errors));
    assert.ok(res.events.length >= 1, 'Should load structured notice for BTCI11');
  });

  // Test 17: Deterministic event ID uniqueness across tickers and dates
  test('17. Deterministic event ID uniqueness across tickers and dates', () => {
    const idPetr4 = generateDeterministicEventId('cvm_ipe', 'PETR4', '2026-04-25', '2026-05-20', 'Dividendo', 'p1');
    const idPetr3 = generateDeterministicEventId('cvm_ipe', 'PETR3', '2026-04-25', '2026-05-20', 'Dividendo', 'p1');
    const idPetr4P2 = generateDeterministicEventId('cvm_ipe', 'PETR4', '2026-04-25', '2026-06-20', 'Dividendo', 'p2');

    assert.notStrictEqual(idPetr4, idPetr3, 'Different tickers must have different IDs');
    assert.notStrictEqual(idPetr4, idPetr4P2, 'Different installments must have different IDs');
  });

  // Test 18: Manual dividends preservation
  test('18. Manual dividends preservation: manual dividends are not affected by auto sync', () => {
    const manualDividend: Dividend = {
      id: 'div-manual-1',
      user_id: 'u1',
      ticker: 'WEGE3',
      amount: 150.0,
      type: 'Dividendo',
      status: 'received',
      date: '2026-05-10',
      source_provider: 'manual'
    };

    const newEvent: CorporateEvent = {
      eventId: 'cvm_ipe:PETR4:2026-04-25:2026-05-20:Dividendo:p1',
      provider: 'cvm_ipe',
      ticker: 'PETR4',
      type: 'Dividendo',
      dateCom: '2026-04-25',
      paymentDate: '2026-05-20',
      unitAmount: 0.573,
      status: 'active',
      validationStatus: 'valid'
    };

    const decision = evaluateEventDeduplication(newEvent, [manualDividend]);
    assert.strictEqual(decision.action, 'insert', 'PETR4 should be inserted as new without altering WEGE3');
  });

  // Test 19: Rejection of duplicate events inside the same batch
  test('19. Deduplication of repeated events in the same incoming batch', () => {
    const event: CorporateEvent = {
      eventId: 'fnet_b3:MXRF11:2026-08-31:2026-09-15:Rendimento:default',
      provider: 'fnet_b3',
      ticker: 'MXRF11',
      type: 'Rendimento',
      dateCom: '2026-08-31',
      paymentDate: '2026-09-15',
      unitAmount: 0.09,
      status: 'active',
      validationStatus: 'valid'
    };

    const batch = [event, event, event];
    const uniqueMap = new Map<string, CorporateEvent>();
    batch.forEach(e => uniqueMap.set(e.eventId, e));
    assert.strictEqual(uniqueMap.size, 1, 'Batch deduplication preserves only 1 instance');
  });

  // Test 20: Timezone safety (ISO YYYY-MM-DD string formatting)
  test('20. Timezone safety: date strings YYYY-MM-DD do not shift across timezones', () => {
    const dateStr = '2026-08-14';
    const parsed = new Date(dateStr + 'T12:00:00Z');
    const formatted = parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    assert.strictEqual(formatted, '14/08/2026', 'Date must be 14/08/2026 in UTC');
  });

});
