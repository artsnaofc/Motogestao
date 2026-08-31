import { addDays, addWeeks, addMonths, addYears, format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PaymentStatus, RecurrenceFrequency, Transaction, ReserveTransaction } from '../types';

export type { PaymentStatus, RecurrenceFrequency };

export const parseLocalDate = (dateStr: string | Date | undefined | null): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  
  const parsed = parseISO(dateStr);
  if (isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

export const formatDateToISO = (d: Date): string => {
  return format(d, 'yyyy-MM-dd');
};

/**
 * Adds frequency step to a date string YYYY-MM-DD
 */
export function calculateNextOccurrence(baseDateStr: string, frequency: RecurrenceFrequency, step = 1): string {
  const base = parseLocalDate(baseDateStr);
  let nextDate: Date;

  switch (frequency) {
    case 'daily':
      nextDate = addDays(base, step);
      break;
    case 'weekly':
      nextDate = addWeeks(base, step);
      break;
    case 'biweekly':
      nextDate = addDays(base, step * 14);
      break;
    case 'monthly':
      nextDate = addMonths(base, step);
      break;
    case 'bimonthly':
      nextDate = addMonths(base, step * 2);
      break;
    case 'quarterly':
      nextDate = addMonths(base, step * 3);
      break;
    case 'semiannual':
      nextDate = addMonths(base, step * 6);
      break;
    case 'yearly':
      nextDate = addYears(base, step);
      break;
    default:
      nextDate = addMonths(base, step);
  }

  return formatDateToISO(nextDate);
}

export function getFrequencyLabel(frequency?: RecurrenceFrequency): string {
  switch (frequency) {
    case 'daily': return 'Diário';
    case 'weekly': return 'Semanal';
    case 'biweekly': return 'Quinzenal (14 dias)';
    case 'monthly': return 'Mensal';
    case 'bimonthly': return 'Bimestral (2 meses)';
    case 'quarterly': return 'Trimestral (3 meses)';
    case 'semiannual': return 'Semestral (6 meses)';
    case 'yearly': return 'Anual';
    default: return 'Mensal';
  }
}

export function getFrequencyShortLabel(frequency?: RecurrenceFrequency): string {
  switch (frequency) {
    case 'daily': return 'Diário';
    case 'weekly': return 'Semanal';
    case 'biweekly': return 'Quinzenal';
    case 'monthly': return 'Mensal';
    case 'bimonthly': return 'Bimestral';
    case 'quarterly': return 'Trimestral';
    case 'semiannual': return 'Semestral';
    case 'yearly': return 'Anual';
    default: return 'Recorrente';
  }
}

export const formatRecurrenceFrequency = getFrequencyShortLabel;

export interface RecurrenceConfig {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  installments: number; // 2 to 36
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns complete visual and semantic metadata for transaction payment status
 */
export function getPaymentStatusMeta(
  status?: PaymentStatus,
  dueDate?: string | null,
  date?: string,
  paymentDate?: string | null
): {
  status: PaymentStatus;
  isPaid: boolean;
  isPending: boolean;
  isOverdue: boolean;
  label: string;
  badgeClass: string;
  borderClass: string;
  pillBg: string;
  pillText: string;
  dotColor: string;
  bgColor: string;
  color: string;
  borderColor: string;
  icon: string;
  descriptionText: string;
} {
  const effectiveStatus: PaymentStatus = status || 'paid';
  const isPaid = effectiveStatus === 'paid';

  if (isPaid) {
    const pDate = paymentDate || date;
    let formattedPaid = '';
    if (pDate) {
      try {
        formattedPaid = format(parseLocalDate(pDate), 'dd/MM/yyyy');
      } catch {
        formattedPaid = pDate;
      }
    }

    return {
      status: 'paid',
      isPaid: true,
      isPending: false,
      isOverdue: false,
      label: 'Pago',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      borderClass: 'border-emerald-500/30',
      pillBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      pillText: 'text-emerald-700 dark:text-emerald-300',
      dotColor: 'bg-emerald-500',
      bgColor: 'bg-emerald-500/10',
      color: 'text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-emerald-500/30',
      icon: '✅',
      descriptionText: formattedPaid ? `Pago em ${formattedPaid}` : 'Pagamento realizado'
    };
  }

  // Pending evaluation
  const targetDueDate = dueDate || date;
  const today = startOfDay(new Date());
  let isOverdue = false;
  let formattedDue = '';

  if (targetDueDate) {
    try {
      const dueParsed = parseLocalDate(targetDueDate);
      isOverdue = isBefore(dueParsed, today);
      formattedDue = format(dueParsed, 'dd/MM/yyyy');
    } catch {
      isOverdue = false;
    }
  }

  if (isOverdue) {
    return {
      status: 'pending',
      isPaid: false,
      isPending: true,
      isOverdue: true,
      label: 'Atrasada',
      badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse',
      borderClass: 'border-rose-500/40',
      pillBg: 'bg-rose-50 dark:bg-rose-950/40',
      pillText: 'text-rose-700 dark:text-rose-300 font-bold',
      dotColor: 'bg-rose-500',
      bgColor: 'bg-rose-500/15',
      color: 'text-rose-600 dark:text-rose-400',
      borderColor: 'border-rose-500/40',
      icon: '⚠️',
      descriptionText: formattedDue ? `Venceu em ${formattedDue}` : 'Vencimento em atraso'
    };
  }

  return {
    status: 'pending',
    isPaid: false,
    isPending: true,
    isOverdue: false,
    label: 'A Pagar',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    borderClass: 'border-amber-500/30',
    pillBg: 'bg-amber-50 dark:bg-amber-950/40',
    pillText: 'text-amber-700 dark:text-amber-300 font-bold',
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-500/15',
    color: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-500/30',
    icon: '⏳',
    descriptionText: formattedDue ? `Vence em ${formattedDue}` : 'Pendente de pagamento'
  };
}
