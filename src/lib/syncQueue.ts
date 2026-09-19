import { supabase } from './supabase';
import { cacheManager } from './cacheManager';
import { toast } from './toast';

export interface SyncTask {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  targetId: string;
  payload?: any;
  createdAt: number;
  attempts: number;
}

class SyncQueueManager {
  private queueKey = 'sync_queue';
  private processing = false;
  private listeners: ((queue: SyncTask[]) => void)[] = [];
  private hadMultipleOfflineTasks = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncQueue] Dispositivo voltou a ficar online. Retomando processamento...');
        if (this.getQueue().length > 1) {
          this.hadMultipleOfflineTasks = true;
        }
        this.processQueue();
      });
      // Process queue immediately on load
      setTimeout(() => this.processQueue(), 200);
      // Poll queue every 15 seconds as a safety net
      setInterval(() => this.processQueue(), 15000);
    }
  }

  public getQueue(): SyncTask[] {
    return cacheManager.get<SyncTask[]>(this.queueKey) || [];
  }

  public getPendingCount(): number {
    return this.getQueue().length;
  }

  private saveQueue(queue: SyncTask[]) {
    cacheManager.set(this.queueKey, queue, undefined, 'sync');
    this.notifyListeners(queue);
  }

  public subscribe(listener: (queue: SyncTask[]) => void) {
    this.listeners.push(listener);
    listener(this.getQueue());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(queue: SyncTask[]) {
    this.listeners.forEach(l => l(queue));
  }

  /**
   * Add a database mutation to the background queue
   */
  public enqueue(table: string, action: 'insert' | 'update' | 'delete', targetId: string, payload?: any) {
    const queue = this.getQueue();

    // 1. De-duplicate consecutive updates on the same record
    if (action === 'update') {
      const existingIdx = queue.findIndex(t => t.table === table && t.targetId === targetId && t.action === 'update');
      if (existingIdx !== -1) {
        queue[existingIdx].payload = { ...queue[existingIdx].payload, ...payload };
        this.saveQueue(queue);
        this.processQueue();
        return;
      }
    }

    // 2. Optimization: If we delete a record that was inserted but not yet synced, discard both!
    if (action === 'delete') {
      const insertIdx = queue.findIndex(t => t.table === table && t.targetId === targetId && t.action === 'insert');
      if (insertIdx !== -1) {
        const filtered = queue.filter((_, idx) => idx !== insertIdx);
        this.saveQueue(filtered);
        console.log(`[SyncQueue] Otimização: Descartados insert e delete locais concorrentes para ${table}:${targetId}`);
        return;
      }
    }

    const newTask: SyncTask = {
      id: Math.random().toString(36).substring(2, 11),
      table,
      action,
      targetId,
      payload,
      createdAt: Date.now(),
      attempts: 0
    };

    queue.push(newTask);
    this.saveQueue(queue);
    
    // Start processing background tasks immediately
    this.processQueue();
  }

  /**
   * Process the persistent queue items sequentially
   */
  public async processQueue() {
    if (this.processing || !navigator.onLine) return;
    const queue = this.getQueue();
    if (queue.length === 0) return;

    this.processing = true;
    const task = queue[0];

    try {
      let error: any = null;

      if (task.action === 'insert') {
        const payloadToInsert = {
          id: task.targetId,
          ...(task.payload || {})
        };

        const { error: insertErr } = await supabase
          .from(task.table)
          .insert(payloadToInsert);
        error = insertErr;

        // Auto fallback 1: If column does not exist in schema (e.g. newer columns before migration)
        if (error && (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('column'))) {
          console.warn(`[SyncQueue] Tentando payload simplificado para ${task.table}:${task.targetId}`);
          const coreKeys = [
            'id', 'user_id', 'reserve_id', 'type', 'amount', 'date', 'description', 
            'category', 'operation', 'ticker', 'price', 'quantity', 'costs', 'cnpj', 
            'transaction_id', 'linked_investment_id', 'asset_type', 'unit_amount', 
            'status', 'data_com', 'data_ex', 'created_at', 'saldo_inicial', 'color', 
            'payment_status', 'payment_date', 'due_date'
          ];
          const simplified: Record<string, any> = {};
          for (const k of coreKeys) {
            if (payloadToInsert[k] !== undefined) simplified[k] = payloadToInsert[k];
          }
          const { error: fallbackErr } = await supabase.from(task.table).insert(simplified);
          if (!fallbackErr) {
            error = null;
          }
        }

        // Auto fallback 2: Foreign key violation (23503) e.g., circular FK between reserve_transactions and investment_transactions
        if (error && error.code === '23503') {
          console.warn(`[SyncQueue] Foreign Key violation (23503) em ${task.table}:${task.targetId}. Tentando inserir sem chaves de vínculo externo...`);
          const fkKeysToOmit = ['linked_investment_id', 'transaction_id', 'reserve_id'];
          const sanitizedPayload: Record<string, any> = { ...payloadToInsert };
          let omitted = false;

          for (const key of fkKeysToOmit) {
            if (sanitizedPayload[key] !== undefined && sanitizedPayload[key] !== null) {
              delete sanitizedPayload[key];
              omitted = true;
            }
          }

          if (omitted) {
            const { error: fkRetryErr } = await supabase.from(task.table).insert(sanitizedPayload);
            if (!fkRetryErr) {
              error = null;
              // Re-queue an update so the FK link is applied after referenced records exist
              const updatePayload: Record<string, any> = {};
              for (const key of fkKeysToOmit) {
                if (payloadToInsert[key] !== undefined && payloadToInsert[key] !== null) {
                  updatePayload[key] = payloadToInsert[key];
                }
              }
              if (Object.keys(updatePayload).length > 0) {
                this.enqueue(task.table, 'update', task.targetId, updatePayload);
              }
            }
          }
        }
      } else if (task.action === 'update') {
        const { error: updateErr } = await supabase
          .from(task.table)
          .update(task.payload)
          .eq('id', task.targetId);
        error = updateErr;

        // If update failed due to FK constraint (23503), retry by unlinking invalid FK
        if (error && error.code === '23503') {
          console.warn(`[SyncQueue] FK violation (23503) no update de ${task.table}:${task.targetId}.`);
          const fkKeysToOmit = ['linked_investment_id', 'transaction_id', 'reserve_id'];
          const sanitizedUpdate = { ...task.payload };
          let omitted = false;
          for (const key of fkKeysToOmit) {
            if (sanitizedUpdate[key] !== undefined) {
              delete sanitizedUpdate[key];
              omitted = true;
            }
          }
          if (omitted && Object.keys(sanitizedUpdate).length > 0) {
            const { error: retryUpdateErr } = await supabase
              .from(task.table)
              .update(sanitizedUpdate)
              .eq('id', task.targetId);
            if (!retryUpdateErr) {
              error = null;
            }
          }
        }
      } else if (task.action === 'delete') {
        let { error: deleteErr } = await supabase
          .from(task.table)
          .delete()
          .eq('id', task.targetId);
        
        // If delete is blocked by FK constraint (23503), clear references in referencing tables first
        if (deleteErr && deleteErr.code === '23503') {
          console.warn(`[SyncQueue] FK violation (23503) ao excluir de ${task.table}:${task.targetId}. Desvinculando registros dependentes...`);
          try {
            if (task.table === 'investment_transactions') {
              await supabase.from('reserve_transactions').update({ linked_investment_id: null }).eq('linked_investment_id', task.targetId);
            } else if (task.table === 'reserve_transactions') {
              await supabase.from('investment_transactions').update({ transaction_id: null }).eq('transaction_id', task.targetId);
              await supabase.from('dividends').update({ transaction_id: null }).eq('transaction_id', task.targetId);
            } else if (task.table === 'transactions') {
              await supabase.from('reserve_transactions').update({ transaction_id: null }).eq('transaction_id', task.targetId);
            }
            const retryRes = await supabase.from(task.table).delete().eq('id', task.targetId);
            deleteErr = retryRes.error;
          } catch (e) {
            console.warn('[SyncQueue] Falha ao desvincular dependências antes da exclusão:', e);
          }
        }
        error = deleteErr;
      }

      if (error) {
        const isRlsError = error.code === '42501' || error.message?.includes('row-level security');
        if (isRlsError) {
          console.error(`[SyncQueue] [RLS VIOLATION] A tabela '${task.table}' bloqueou a operação '${task.action}' via Row Level Security (RLS). Execute as políticas de liberação no Supabase SQL Editor:`, error);
        } else {
          console.error(`[SyncQueue] Falha na sincronização do item ${task.id}:`, error);
        }
        
        // Critical database validation failures or exceeded retry threshold
        const isDatabaseConstraint = error.code && ['23505', '42P01', '22P02', 'P0001'].includes(error.code);
        
        if (isDatabaseConstraint || task.attempts >= 4) {
          console.warn(`[SyncQueue] Descartando item por limite de tentativas ou restrição irremediável:`, task);
          const remaining = this.getQueue().filter(t => t.id !== task.id);
          this.saveQueue(remaining);
        } else {
          // Rotate task to back of queue so subsequent independent items are not blocked
          const currentQueue = this.getQueue();
          if (currentQueue[0]?.id === task.id) {
            const [failedTask, ...rest] = currentQueue;
            this.saveQueue([...rest, { ...failedTask, attempts: failedTask.attempts + 1 }]);
          }
          this.processing = false;
          // Delay next attempt slightly
          setTimeout(() => this.processQueue(), 800);
          return;
        }
      } else {
        // Succeeded syncing mutation to Supabase!
        const remaining = this.getQueue().filter(t => t.id !== task.id);
        this.saveQueue(remaining);

        if (remaining.length === 0 && this.hadMultipleOfflineTasks) {
          this.hadMultipleOfflineTasks = false;
          toast.success('Todas as alterações offline foram sincronizadas com a nuvem!', { id: 'sync-queue-finish' });
        }
      }
    } catch (err) {
      console.error('[SyncQueue] Erro inesperado ao processar tarefa da fila:', err);
    } finally {
      this.processing = false;
      // Loop recursively with a slight delay
      setTimeout(() => this.processQueue(), 150);
    }
  }

  /**
   * Check if there are un-synced operations for a specific record
   */
  public hasPendingTaskFor(table: string, targetId: string): boolean {
    const queue = this.getQueue();
    return queue.some(t => t.table === table && t.targetId === targetId);
  }

  /**
   * Get pending update payload for a record if any
   */
  public getPendingPayload(table: string, targetId: string): any | undefined {
    const queue = this.getQueue();
    const task = queue.find(t => t.table === table && t.targetId === targetId);
    return task?.payload;
  }

  /**
   * Waits until the queue is fully drained or cannot proceed
   */
  public async flushQueue(timeoutMs = 5000): Promise<void> {
    if (!navigator.onLine || this.getPendingCount() === 0) return;
    const start = Date.now();
    this.processQueue();
    while (this.getPendingCount() > 0 && Date.now() - start < timeoutMs && navigator.onLine) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  public clearQueue() {
    this.saveQueue([]);
  }
}

export const syncQueueManager = new SyncQueueManager();
