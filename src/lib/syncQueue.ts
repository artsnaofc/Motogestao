import { supabase } from './supabase';
import { cacheManager } from './cacheManager';
import { toast } from 'sonner';

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

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncQueue] Dispositivo voltou a ficar online. Retomando processamento...');
        this.processQueue();
      });
      // Poll queue every 15 seconds as a safety net
      setInterval(() => this.processQueue(), 15000);
    }
  }

  public getQueue(): SyncTask[] {
    return cacheManager.get<SyncTask[]>(this.queueKey) || [];
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
        const { error: insertErr } = await supabase
          .from(task.table)
          .insert(task.payload);
        error = insertErr;
      } else if (task.action === 'update') {
        const { error: updateErr } = await supabase
          .from(task.table)
          .update(task.payload)
          .eq('id', task.targetId);
        error = updateErr;
      } else if (task.action === 'delete') {
        const { error: deleteErr } = await supabase
          .from(task.table)
          .delete()
          .eq('id', task.targetId);
        error = deleteErr;
      }

      if (error) {
        console.error(`[SyncQueue] Falha na sincronização do item ${task.id}:`, error);
        
        // Critical database validation failures (wrong columns, constraints, format error)
        const isDatabaseConstraint = error.code && ['23503', '23505', '42P01', '22P02', 'P0001'].includes(error.code);
        
        if (isDatabaseConstraint || task.attempts >= 5) {
          console.warn(`[SyncQueue] Forçando descarte do item por erro crítico ou limite de tentativas excedido:`, task);
          const remaining = this.getQueue().filter(t => t.id !== task.id);
          this.saveQueue(remaining);
        } else {
          // Increment retry attempt for next trigger
          const currentQueue = this.getQueue();
          if (currentQueue[0]?.id === task.id) {
            currentQueue[0].attempts++;
            this.saveQueue(currentQueue);
          }
          this.processing = false;
          return; // Pause execution loop to avoid endless high frequency retries while offline or server down
        }
      } else {
        // Succeeded syncing mutation to Supabase!
        const remaining = this.getQueue().filter(t => t.id !== task.id);
        this.saveQueue(remaining);

        if (remaining.length === 0) {
          toast.success('Todos os lançamentos pendentes foram salvos na nuvem!');
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

  public clearQueue() {
    this.saveQueue([]);
  }
}

export const syncQueueManager = new SyncQueueManager();
