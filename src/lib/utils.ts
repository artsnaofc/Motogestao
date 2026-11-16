import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

/**
 * Retorna a data no formato YYYY-MM-DD considerando SEMPRE o fuso horário LOCAL do navegador.
 * Evita o bug onde toISOString().split('T')[0] converte para UTC e avança para o dia seguinte
 * a partir das 21h/22h/23h em fusos como o de Brasília (UTC-3).
 */
export function getTodayLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Soma N dias úteis (segunda a sexta) a uma data no formato YYYY-MM-DD,
 * retornando YYYY-MM-DD em fuso horário local (ex: liquidação D+2 da B3).
 */
export function addBusinessDays(dateStr: string, businessDays: number): string {
  const clean = String(dateStr || '').split('T')[0];
  const [y, m, d] = clean.split('-').map(Number);
  const base = (y && m && d) ? new Date(y, m - 1, d) : new Date();
  let remaining = Math.max(0, Math.floor(businessDays));
  while (remaining > 0) {
    base.setDate(base.getDate() + 1);
    const dayOfWeek = base.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }
  return getTodayLocalDateStr(base);
}

/**
 * Formata uma data YYYY-MM-DD para DD/MM/YYYY sem deslocamento de fuso UTC.
 */
export function formatLocalDateBR(dateStr?: string | null): string {
  if (!dateStr) return '--/--/----';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return clean;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
