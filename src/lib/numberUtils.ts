/**
 * Utility functions for robust numerical parsing and formatting across financial inputs and calculations.
 */

export function parseNumericValue(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let s = val.toString().trim();
  if (!s) return 0;

  // Clean currency symbols or spaces
  s = s.replace(/R\$\s?/gi, '').trim();

  // Handle formatted numeric strings:
  // 1. Both dot and comma present (e.g., "1.234,56" vs "1,234.56")
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // pt-BR "1.234,56" -> remove dots, replace comma with dot
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US "1,234.56" -> remove commas
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Only comma present (e.g., "1234,56" or "10,5")
    s = s.replace(',', '.');
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function formatToCurrencyInputString(val: number | undefined | null, decimals = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '';
  return val.toFixed(decimals).replace('.', ',');
}
