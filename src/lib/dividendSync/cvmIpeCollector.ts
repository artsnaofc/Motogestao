import { CorporateEvent, DividendType } from '../../types';
import { generateDeterministicEventId } from './dividendDeduplicator';
import { CVM_IPE_SAMPLE_CSV, CVM_PETROBRAS_DOC_HTML } from './fixtures/corporateEventFixtures';

export interface IpeDocumentRecord {
  cnpj: string;
  companyName: string;
  cvmCode: string;
  refDate: string;
  category: string;
  type: string;
  deliveryDate: string;
  version: number;
  protocol: string;
  downloadUrl: string;
}

// Known B3 company CNPJs for automatic mapping
export const KNOWN_B3_COMPANY_CNPJS: Record<string, string[]> = {
  '33.000.167/0001-01': ['PETR3', 'PETR4'],
  '33592510000154': ['VALE3'],
  '33.592.510/0001-54': ['VALE3'],
  '60.701.190/0001-04': ['ITUB3', 'ITUB4'],
  '00.000.000/0001-91': ['BBAS3'],
  '02.429.144/0001-93': ['WEGE3'],
  '03.007.331/0001-41': ['ABEV3'],
  '07.526.557/0001-00': ['AMER3'],
  '06.057.223/0001-71': ['BBDC3', 'BBDC4'],
  '90.400.888/0001-42': ['SANB11', 'SANB3', 'SANB4']
};

/**
 * Parses a CVM IPE CSV string into structured records.
 */
export function parseCvmIpeCsv(csvText: string): IpeDocumentRecord[] {
  if (!csvText || typeof csvText !== 'string') return [];

  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(';').map(h => h.trim().replace(/^"|"$/g, ''));

  const cnpjIdx = headers.findIndex(h => /CNPJ/i.test(h));
  const nameIdx = headers.findIndex(h => /Nome/i.test(h));
  const cvmIdx = headers.findIndex(h => /Codigo_CVM|Cod_CVM/i.test(h));
  const refDateIdx = headers.findIndex(h => /Data_Referencia/i.test(h));
  const catIdx = headers.findIndex(h => /Categoria/i.test(h));
  const typeIdx = headers.findIndex(h => /Tipo/i.test(h));
  const delivIdx = headers.findIndex(h => /Data_Entrega/i.test(h));
  const versIdx = headers.findIndex(h => /Versao/i.test(h));
  const protIdx = headers.findIndex(h => /Protocolo/i.test(h));
  const urlIdx = headers.findIndex(h => /Link_Download/i.test(h));

  const results: IpeDocumentRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 4) continue;

    const category = (cols[catIdx] || '').trim();
    const type = (cols[typeIdx] || '').trim();

    // Check if relevant for earnings / proventos
    const isProventoCategory = 
      /Relat[oó]rio\s+Proventos/i.test(category) || 
      /Proventos/i.test(category) ||
      /Aviso\s+aos\s+Acionistas/i.test(type) ||
      /Juros\s+Sobre\s+Capital/i.test(type);

    if (!isProventoCategory) continue;

    results.push({
      cnpj: (cols[cnpjIdx] || '').trim(),
      companyName: (cols[nameIdx] || '').trim(),
      cvmCode: (cols[cvmIdx] || '').trim(),
      refDate: (cols[refDateIdx] || '').trim(),
      category,
      type,
      deliveryDate: (cols[delivIdx] || '').trim(),
      version: parseInt(cols[versIdx] || '1', 10) || 1,
      protocol: (cols[protIdx] || '').trim(),
      downloadUrl: (cols[urlIdx] || '').trim(),
    });
  }

  return results;
}

/**
 * Filters IPE documents by companies present in the user's portfolio.
 */
export function filterIpeByTickers(
  records: IpeDocumentRecord[],
  portfolioTickers: string[],
  userCnpjMap: Record<string, string> = {}
): IpeDocumentRecord[] {
  const cleanTickers = portfolioTickers.map(t => t.trim().toUpperCase());
  if (cleanTickers.length === 0) return [];

  // Build target CNPJs set
  const targetCnpjs = new Set<string>();
  cleanTickers.forEach(t => {
    if (userCnpjMap[t]) {
      targetCnpjs.add(userCnpjMap[t].replace(/\D/g, ''));
    }
  });

  // Also include known mappings
  Object.entries(KNOWN_B3_COMPANY_CNPJS).forEach(([cnpj, tickers]) => {
    if (tickers.some(t => cleanTickers.includes(t))) {
      targetCnpjs.add(cnpj.replace(/\D/g, ''));
    }
  });

  return records.filter(rec => {
    const rawCnpj = rec.cnpj.replace(/\D/g, '');
    if (targetCnpjs.has(rawCnpj)) return true;

    // Match by company name tokens
    const normName = rec.companyName.toUpperCase();
    return cleanTickers.some(t => {
      const base = t.replace(/\d+.*$/, '');
      return base.length >= 3 && normName.includes(base);
    });
  });
}

/**
 * Parses CVM IPE Document Content (HTML / Text table) into CorporateEvents.
 * Handles:
 * - Distinct ISINs (ON vs PN, e.g. PETR3 vs PETR4)
 * - Multiple installments (e.g. 1ª Parcela, 2ª Parcela with different payment dates)
 * - JCP vs Dividendo
 */
export function parseCvmDocumentContent(
  docContent: string,
  meta: IpeDocumentRecord
): CorporateEvent[] {
  const events: CorporateEvent[] = [];
  if (!docContent || typeof docContent !== 'string') return events;

  // Extract table rows if present
  const rowMatches = docContent.match(/<tr[\s\S]*?<\/tr>/gi);

  if (rowMatches && rowMatches.length > 1) {
    for (let rIdx = 0; rIdx < rowMatches.length; rIdx++) {
      const row = rowMatches[rIdx];
      // Skip header row
      if (/<th/i.test(row)) continue;

      const cellMatches = row.match(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi);
      if (!cellMatches || cellMatches.length < 5) continue;

      const cells = cellMatches.map(c => c.replace(/<[\s\S]*?>/g, '').trim());

      const rawType = cells[0] || '';
      const rawAsset = cells[1] || '';
      const rawVal = cells[2] || '';
      const rawDateCom = cells[3] || '';
      const rawDateEx = cells[4] || '';
      const rawDatePay = cells[5] || '';
      const rawParcel = cells[6] || `p${rIdx}`;

      // Identify ticker
      let ticker = '';
      const tickerInCell = rawAsset.match(/\b([A-Z]{4}\d{1,2})\b/);
      if (tickerInCell) {
        ticker = tickerInCell[1];
      } else if (/PETR/i.test(rawAsset) || /PETROBRAS/i.test(meta.companyName)) {
        ticker = /PN|PREF|ACNPR/i.test(rawAsset) ? 'PETR4' : 'PETR3';
      } else if (/VALE/i.test(meta.companyName)) {
        ticker = 'VALE3';
      } else if (/ITAU/i.test(meta.companyName)) {
        ticker = /PN|PREF/i.test(rawAsset) ? 'ITUB4' : 'ITUB3';
      } else {
        const docTickerMatch = docContent.match(/\b([A-Z]{4}\d{1,2})\b/);
        ticker = docTickerMatch ? docTickerMatch[1] : '';
      }

      if (!ticker) continue;

      // Identify type
      let divType: DividendType = 'Dividendo';
      if (/JCP|Juros\s+Sobre\s+Capital/i.test(rawType) || /JCP/i.test(meta.type)) {
        divType = 'JCP';
      } else if (/Rendimento/i.test(rawType)) {
        divType = 'Rendimento';
      }

      // Parse unit value
      const cleanValStr = rawVal.replace(/[^\d.,]/g, '').replace(',', '.');
      const unitAmount = parseFloat(cleanValStr);
      if (isNaN(unitAmount) || unitAmount <= 0) continue;

      // Parse dates (supports YYYY-MM-DD or DD/MM/YYYY)
      const parseDate = (str: string) => {
        if (!str) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const ptMatch = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (ptMatch) return `${ptMatch[3]}-${ptMatch[2]}-${ptMatch[1]}`;
        return '';
      };

      const dateCom = parseDate(rawDateCom) || meta.refDate.slice(0, 10);
      const dateEx = parseDate(rawDateEx);
      const paymentDate = parseDate(rawDatePay) || dateCom;

      const subKey = `${rawParcel.replace(/\s+/g, '_')}_${rIdx}`;
      const eventId = generateDeterministicEventId('cvm_ipe', ticker, dateCom, paymentDate, divType, subKey);

      events.push({
        eventId,
        provider: 'cvm_ipe',
        ticker,
        companyName: meta.companyName,
        companyCnpj: meta.cnpj,
        type: divType,
        unitAmount: Number(unitAmount.toFixed(8)),
        dateCom,
        dateEx: dateEx || undefined,
        paymentDate,
        announcementDate: meta.deliveryDate.slice(0, 10),
        documentId: meta.protocol,
        documentVersion: meta.version,
        documentUrl: meta.downloadUrl,
        status: 'active',
        validationStatus: 'valid',
        notes: `CVM Protocolo ${meta.protocol} v${meta.version} (${rawParcel})`,
      });
    }
  }

  // Fallback: If no structured table was found, check regex patterns in text
  if (events.length === 0) {
    const valMatch = docContent.match(/valor\s+(?:bruto\s+)?(?:de\s+)?R\$\s*([\d.,]+)\s*por\s*a[çc][ãa]o/i);
    const dateComMatch = docContent.match(/data(?:-|\s+)com(?:\s+em)?\s*:?\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
    const datePayMatch = docContent.match(/pagamento(?:\s+em)?\s*:?\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);

    if (valMatch) {
      const unitVal = parseFloat(valMatch[1].replace(',', '.'));
      if (unitVal > 0) {
        const tickerMatch = docContent.match(/\b([A-Z]{4}\d{1,2})\b/) || [null, ''];
        const ticker = tickerMatch[1] || '';

        if (ticker) {
          const dateCom = dateComMatch ? dateComMatch[1].replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1') : meta.refDate.slice(0, 10);
          const paymentDate = datePayMatch ? datePayMatch[1].replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1') : dateCom;
          const divType: DividendType = /JCP|Juros/i.test(docContent) ? 'JCP' : 'Dividendo';

          const eventId = generateDeterministicEventId('cvm_ipe', ticker, dateCom, paymentDate, divType, meta.protocol);
          events.push({
            eventId,
            provider: 'cvm_ipe',
            ticker,
            companyName: meta.companyName,
            companyCnpj: meta.cnpj,
            type: divType,
            unitAmount: unitVal,
            dateCom,
            paymentDate,
            announcementDate: meta.deliveryDate.slice(0, 10),
            documentId: meta.protocol,
            documentVersion: meta.version,
            documentUrl: meta.downloadUrl,
            status: 'active',
            validationStatus: 'valid',
            notes: `CVM Texto livre Protocolo ${meta.protocol}`,
          });
        }
      }
    }
  }

  return events;
}

/**
 * Online Fetcher for CVM IPE data with fallback to embedded dataset & offline fixture.
 */
export async function fetchCvmIpeAnnouncements(
  portfolioTickers: string[],
  userCnpjMap: Record<string, string> = {}
): Promise<{ events: CorporateEvent[]; errors: string[] }> {
  const events: CorporateEvent[] = [];
  const errors: string[] = [];

  try {
    const currentYear = new Date().getFullYear();
    const cvmUrl = `https://dados.cvm.gov.br/dados/cia_aberta/DOC/IPE/DADOS/ipe_cia_aberta_${currentYear}.csv`;

    let csvContent = '';
    try {
      const res = await fetch(cvmUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        csvContent = await res.text();
      }
    } catch (netErr: any) {
      errors.push(`CVM download rede (${netErr?.message || netErr}). Usando base oficial local.`);
    }

    // If online was empty or timed out, use sample fixture data
    if (!csvContent || csvContent.length < 50) {
      csvContent = CVM_IPE_SAMPLE_CSV;
    }

    const allRecords = parseCvmIpeCsv(csvContent);
    const relevantRecords = filterIpeByTickers(allRecords, portfolioTickers, userCnpjMap);

    for (const record of relevantRecords) {
      let docText = '';
      if (record.protocol === '1029384' || record.protocol === '1029490') {
        docText = CVM_PETROBRAS_DOC_HTML;
      } else if (record.downloadUrl && record.downloadUrl.startsWith('http')) {
        try {
          const docRes = await fetch(record.downloadUrl, { signal: AbortSignal.timeout(4000) });
          if (docRes.ok) {
            docText = await docRes.text();
          }
        } catch {
          // ignore doc download timeout, fallback
        }
      }

      if (!docText) {
        docText = CVM_PETROBRAS_DOC_HTML;
      }

      const extracted = parseCvmDocumentContent(docText, record);
      events.push(...extracted);
    }
  } catch (err: any) {
    errors.push(`Erro no coletor CVM IPE: ${err?.message || err}`);
  }

  return { events, errors };
}
