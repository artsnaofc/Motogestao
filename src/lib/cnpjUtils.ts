// Utility helpers and database for Brazilian Stock & FII CNPJs (CVM Document lookup)
import { UserSettings } from '../types';

export const KNOWN_CNPJS: Record<string, string> = {
};

/**
 * Remove all non-digit characters from CNPJ
 */
export function getCleanCnpj(cnpj: string): string {
  if (!cnpj) return '';
  return cnpj.replace(/\D/g, '');
}

/**
 * Format CNPJ digits to standard string XX.XXX.XXX/XXXX-XX
 */
export function formatCnpj(cnpj: string): string {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Validates basic CNPJ length
 */
export function isValidCnpj(cnpj: string): boolean {
  const clean = getCleanCnpj(cnpj);
  return clean.length === 14;
}

/**
 * Get FNET / CVM Documents Manager link for given CNPJ
 */
export function getCvmDocumentUrl(cnpj: string): string {
  const clean = getCleanCnpj(cnpj);
  return `https://fnet.bmfbovespa.com.br/fnet/publico/abrirGerenciadorDocumentosCVM?cnpjFundo=${clean}`;
}

/**
 * Retrieve the CNPJ for a given ticker, checking user settings first, then known dictionary
 */
export function getAssetCnpj(ticker: string, settings?: UserSettings | null): string | undefined {
  if (!ticker) return undefined;
  const tk = ticker.toUpperCase().trim();
  
  if (settings?.asset_cnpjs && settings.asset_cnpjs[tk]) {
    return settings.asset_cnpjs[tk];
  }
  
  return KNOWN_CNPJS[tk];
}

/**
 * Attempts to automatically fetch CNPJ online via public APIs (Brapi / CVM / StatusInvest)
 */
export async function fetchCnpjOnline(ticker: string): Promise<string | null> {
  if (!ticker) return null;
  const cleanTicker = ticker.toUpperCase().trim();

  // 1. Check local dictionary
  if (KNOWN_CNPJS[cleanTicker]) {
    return KNOWN_CNPJS[cleanTicker];
  }

  // 2. Try Brapi API (open quote endpoint)
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${cleanTicker}?token=v8aZgGzS54oA3Mh9Yw9oKq`);
    if (res.ok) {
      const data = await res.json();
      if (data?.results?.[0]?.cnpj) {
        return formatCnpj(data.results[0].cnpj);
      }
    }
  } catch (e) {
    console.warn(`Brapi fetch failed for ${cleanTicker}:`, e);
  }

  // 3. Alternative Brapi public endpoint without token
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${cleanTicker}`);
    if (res.ok) {
      const data = await res.json();
      const rawCnpj = data?.results?.[0]?.cnpj || data?.results?.[0]?.taxId;
      if (rawCnpj) {
        return formatCnpj(rawCnpj);
      }
    }
  } catch (e) {
    console.warn(`Public Brapi fetch failed for ${cleanTicker}:`, e);
  }

  // 4. Try mFinance FII API if ending with 11
  if (cleanTicker.endsWith('11')) {
    try {
      const res = await fetch(`https://lab.mfinance.com.br/api/v1/fiis/${cleanTicker}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.cnpj) {
          return formatCnpj(data.cnpj);
        }
      }
    } catch (e) {
      console.warn(`mFinance fetch failed for ${cleanTicker}:`, e);
    }
  }

  return null;
}

