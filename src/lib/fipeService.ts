import { cacheManager } from './cacheManager';

export interface FipeBrand {
  codigo: string;
  nome: string;
}

export interface FipeModel {
  codigo: string;
  nome: string;
}

export interface FipeYear {
  codigo: string;
  nome: string;
}

export interface FipeResult {
  TipoVeiculo: number;
  Valor: string; // ex "R$ 18.500,00"
  numericValue: number; // ex 18500
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
  SiglaCombustivel: string;
  fetchedAt: string; // ISO Date string
  isOfflineCache?: boolean;
}

const BASE_URL = 'https://parallelum.com.br/fipe/api/v1/motos';

export function parseFipeCurrency(valorStr: string): number {
  if (!valorStr) return 0;
  // Ex: "R$ 18.500,00" -> 18500
  const clean = valorStr
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

class FipeService {
  /**
   * Fetch motorcycle brands from FIPE API with local caching
   */
  public async getBrands(): Promise<FipeBrand[]> {
    const cacheKey = 'fipe_motos_brands';
    const cached = cacheManager.get<FipeBrand[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return cached || [];
    }

    try {
      const res = await fetch(`${BASE_URL}/marcas`, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FipeBrand[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Cache for 30 days
        cacheManager.set(cacheKey, data, 30 * 24 * 60 * 60 * 1000, 'fipe');
        return data;
      }
    } catch (err) {
      console.warn('[FipeService] Erro ao buscar marcas FIPE:', err);
    }
    return cached || [];
  }

  /**
   * Fetch models for a given brand code
   */
  public async getModels(brandCode: string): Promise<FipeModel[]> {
    if (!brandCode) return [];
    const cacheKey = `fipe_motos_models_${brandCode}`;
    const cached = cacheManager.get<FipeModel[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return cached || [];
    }

    try {
      const res = await fetch(`${BASE_URL}/marcas/${brandCode}/modelos`, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const models: FipeModel[] = data.modelos || [];
      if (models.length > 0) {
        cacheManager.set(cacheKey, models, 30 * 24 * 60 * 60 * 1000, 'fipe');
        return models;
      }
    } catch (err) {
      console.warn(`[FipeService] Erro ao buscar modelos da marca ${brandCode}:`, err);
    }
    return cached || [];
  }

  /**
   * Fetch available model years for a brand + model
   */
  public async getYears(brandCode: string, modelCode: string): Promise<FipeYear[]> {
    if (!brandCode || !modelCode) return [];
    const cacheKey = `fipe_motos_years_${brandCode}_${modelCode}`;
    const cached = cacheManager.get<FipeYear[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return cached || [];
    }

    try {
      const res = await fetch(`${BASE_URL}/marcas/${brandCode}/modelos/${modelCode}/anos`, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FipeYear[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cacheManager.set(cacheKey, data, 30 * 24 * 60 * 60 * 1000, 'fipe');
        return data;
      }
    } catch (err) {
      console.warn(`[FipeService] Erro ao buscar anos para modelo ${modelCode}:`, err);
    }
    return cached || [];
  }

  /**
   * Fetch complete FIPE details for a specific brand + model + year
   */
  public async getFipePrice(brandCode: string, modelCode: string, yearCode: string): Promise<FipeResult | null> {
    if (!brandCode || !modelCode || !yearCode) return null;
    const cacheKey = `fipe_price_${brandCode}_${modelCode}_${yearCode}`;
    const cached = cacheManager.get<FipeResult>(cacheKey);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (cached) {
        return { ...cached, isOfflineCache: true };
      }
      return null;
    }

    try {
      const res = await fetch(`${BASE_URL}/marcas/${brandCode}/modelos/${modelCode}/anos/${yearCode}`, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.Valor) {
        const result: FipeResult = {
          ...data,
          numericValue: parseFipeCurrency(data.Valor),
          fetchedAt: new Date().toISOString(),
          isOfflineCache: false,
        };
        cacheManager.set(cacheKey, result, 7 * 24 * 60 * 60 * 1000, 'fipe');
        return result;
      }
    } catch (err) {
      console.warn('[FipeService] Erro ao buscar preço FIPE:', err);
      if (cached) {
        return { ...cached, isOfflineCache: true };
      }
    }
    return cached ? { ...cached, isOfflineCache: true } : null;
  }
}

export const fipeService = new FipeService();
