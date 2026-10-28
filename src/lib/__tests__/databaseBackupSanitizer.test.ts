import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeRecord, ALLOWED_TABLE_COLUMNS } from '../databaseBackup';

describe('Database Backup Sanitizer & Resilience Verification', () => {
  it('should strip computed/frontend fields like suggested_balance from reserves', () => {
    const rawReserve = {
      id: 'res-123',
      user_id: 'user-abc',
      name: 'Reserva de Emergência',
      color: '#10b981',
      icon: 'PiggyBank',
      saldo_inicial: 500,
      saldo_atual: 1200,
      suggested_balance: 1500, // Frontend-only/transient field that caused PGRST204
      calculated_pending: 300,
      status: 'active'
    };

    const sanitized = sanitizeRecord('reserves', rawReserve);

    assert.strictEqual(sanitized.id, 'res-123');
    assert.strictEqual(sanitized.saldo_inicial, 500);
    assert.strictEqual(sanitized.saldo_atual, 1200);
    assert.strictEqual(sanitized.suggested_balance, undefined, 'suggested_balance must be stripped');
    assert.strictEqual(sanitized.calculated_pending, undefined, 'calculated_pending must be stripped');
  });

  it('should strip dynamically ignored columns during auto-recovery', () => {
    const rawTx = {
      id: 'tx-1',
      user_id: 'user-abc',
      type: 'expense',
      amount: 45.5,
      date: '2026-10-28',
      category: 'Combustível',
      unknown_future_column: 'value_xyz'
    };

    const ignored = new Set<string>(['unknown_future_column']);
    const sanitized = sanitizeRecord('transactions', rawTx, ignored);

    assert.strictEqual(sanitized.id, 'tx-1');
    assert.strictEqual(sanitized.amount, 45.5);
    assert.strictEqual(sanitized.unknown_future_column, undefined);
  });

  it('should normalize targetPrice to target_price in valuation_targets', () => {
    const rawVal = {
      id: 'val-1',
      user_id: 'user-abc',
      ticker: 'BBAS3',
      targetPrice: 32.50
    };

    const sanitized = sanitizeRecord('valuation_targets', rawVal);
    assert.strictEqual(sanitized.target_price, 32.50);
  });
});
