export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  args?: string[];
  stack?: string;
}

type LogListener = (logs: LogEntry[]) => void;

const MAX_LOGS = 250;
const STORAGE_KEY = 'motogestao_debug_logs';

let logsMemory: LogEntry[] = [];
let listeners: Set<LogListener> = new Set();
let isInitialized = false;

// Format arguments nicely into printable strings
function formatArg(arg: any): string {
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
  }
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

function saveLogsToStorage() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logsMemory.slice(-100)));
  } catch {
    // ignore quota errors
  }
}

function loadLogsFromStorage() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        logsMemory = parsed;
      }
    }
  } catch {
    logsMemory = [];
  }
}

function notifyListeners() {
  const logsCopy = [...logsMemory];
  listeners.forEach(fn => {
    try {
      fn(logsCopy);
    } catch (e) {
      // ignore listener errors
    }
  });
  saveLogsToStorage();
}

export function addLogEntry(level: LogEntry['level'], message: string, ...args: any[]) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
  
  const formattedArgs = args.length > 0 ? args.map(formatArg) : undefined;
  
  const entry: LogEntry = {
    id: Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
    timestamp: timeStr,
    level,
    message,
    args: formattedArgs,
  };

  logsMemory.push(entry);
  if (logsMemory.length > MAX_LOGS) {
    logsMemory.shift();
  }

  notifyListeners();
}

export function initDebugLogger() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  loadLogsFromStorage();

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    originalLog.apply(console, args);
    const msg = typeof args[0] === 'string' ? args[0] : formatArg(args[0]);
    addLogEntry('log', msg, ...args.slice(1));
  };

  console.info = (...args: any[]) => {
    originalInfo.apply(console, args);
    const msg = typeof args[0] === 'string' ? args[0] : formatArg(args[0]);
    addLogEntry('info', msg, ...args.slice(1));
  };

  console.warn = (...args: any[]) => {
    originalWarn.apply(console, args);
    const msg = typeof args[0] === 'string' ? args[0] : formatArg(args[0]);
    addLogEntry('warn', msg, ...args.slice(1));
  };

  console.error = (...args: any[]) => {
    originalError.apply(console, args);
    const msg = typeof args[0] === 'string' ? args[0] : formatArg(args[0]);
    addLogEntry('error', msg, ...args.slice(1));
  };

  window.addEventListener('error', (event) => {
    addLogEntry('error', `[Uncaught Exception] ${event.message}`, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack || event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    addLogEntry('error', `[Unhandled Rejection] ${reason?.message || reason}`, reason);
  });

  addLogEntry('info', '🚀 DebugLogger inicializado com sucesso.');
}

export function getDebugLogs(): LogEntry[] {
  return [...logsMemory];
}

export function clearDebugLogs() {
  logsMemory = [];
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notifyListeners();
}

export function subscribeDebugLogs(listener: LogListener): () => void {
  listeners.add(listener);
  listener([...logsMemory]);
  return () => {
    listeners.delete(listener);
  };
}
