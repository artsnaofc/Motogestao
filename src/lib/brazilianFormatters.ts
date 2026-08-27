/**
 * Utilitários de Máscaras e Formatação Brasileira para Fintechs e Operações de Transporte
 * - Telefone/WhatsApp com DDD
 * - CPF (11 dígitos) e CNPJ (14 dígitos) dinâmico
 * - CEP (8 dígitos)
 * - Busca de Endereço via ViaCEP e OpenStreetMap Nominatim
 */

/**
 * Remove todos os caracteres não-numéricos
 */
export function cleanDigits(val: string | undefined | null): string {
  if (!val) return '';
  return val.replace(/\D/g, '');
}

/**
 * Aplica máscara de telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export function maskPhone(val: string | undefined | null): string {
  if (!val) return '';
  const digits = cleanDigits(val).slice(0, 11);
  
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Aplica máscara de CPF: 000.000.000-00
 */
export function maskCpf(val: string | undefined | null): string {
  if (!val) return '';
  const digits = cleanDigits(val).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Aplica máscara de CNPJ: 00.000.000/0000-00
 */
export function maskCnpj(val: string | undefined | null): string {
  if (!val) return '';
  const digits = cleanDigits(val).slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Aplica máscara inteligente para Documento (CPF se <= 11 dígitos, CNPJ se > 11 dígitos)
 */
export function maskCpfCnpj(val: string | undefined | null): string {
  if (!val) return '';
  const digits = cleanDigits(val).slice(0, 14);
  if (digits.length <= 11) {
    return maskCpf(digits);
  }
  return maskCnpj(digits);
}

/**
 * Aplica máscara de CEP: 00000-000
 */
export function maskCep(val: string | undefined | null): string {
  if (!val) return '';
  const digits = cleanDigits(val).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

export interface AddressSearchResult {
  display_name: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postcode?: string;
  lat?: string;
  lon?: string;
}

/**
 * Busca sugestões de endereço via OpenStreetMap Nominatim com foco no Brasil
 */
export async function searchAddressNominatim(query: string, signal?: AbortSignal): Promise<AddressSearchResult[]> {
  if (!query || query.trim().length < 3) return [];

  try {
    const cleanQuery = encodeURIComponent(`${query.trim()}, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${cleanQuery}&addressdetails=1&limit=5&countrycodes=br`;
    
    const response = await fetch(url, {
      signal,
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
      const addr = item.address || {};
      const road = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || '';
      const suburb = addr.suburb || addr.neighbourhood || addr.city_district || addr.district || '';
      const city = addr.city || addr.town || addr.municipality || addr.village || '';
      const state = addr.state || '';
      const houseNumber = addr.house_number || '';

      let streetDisplay = road;
      if (streetDisplay && houseNumber) {
        streetDisplay = `${road}, ${houseNumber}`;
      } else if (!streetDisplay) {
        streetDisplay = item.name || '';
      }

      let formattedNeighborhood = suburb;
      if (city && city !== suburb) {
        formattedNeighborhood = suburb ? `${suburb} - ${city}` : city;
      }
      if (state && !formattedNeighborhood.includes(state)) {
        formattedNeighborhood = formattedNeighborhood ? `${formattedNeighborhood}/${state}` : state;
      }

      return {
        display_name: item.display_name,
        street: streetDisplay || item.display_name.split(',')[0],
        number: houseNumber,
        neighborhood: formattedNeighborhood,
        city,
        state,
        postcode: addr.postcode,
        lat: item.lat,
        lon: item.lon,
      };
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return [];
    }
    console.warn('[searchAddressNominatim] Falha ao consultar endereço:', err);
    return [];
  }
}

/**
 * Consulta CEP na API pública ViaCEP
 */
export async function fetchViaCep(cep: string): Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
} | null> {
  const clean = cleanDigits(cep);
  if (clean.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;

    return {
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
    };
  } catch (e) {
    console.warn('[fetchViaCep] Erro ao consultar CEP:', e);
    return null;
  }
}
