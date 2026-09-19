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

