/**
 * Intelligent Parser for Fundamentus tables (Ações & FIIs)
 * Automatically detects Brazilian numerical formatting, currency symbols, percentages,
 * classifies table type (Stocks vs FIIs) and handles dirty pastes gracefully.
 */

export interface ParsedStockData {
  ticker: string;
  lastPrice: number | null;
  pl: number | null;
  pvp: number | null;
  psr: number | null;
  dividendYield: number | null;
  pAtivo: number | null;
  pCapGiro: number | null;
  pEbit: number | null;
  pAtivCircLiq: number | null;
  evEbit: number | null;
  evEbitda: number | null;
  grossMargin: number | null;
  ebitMargin: number | null;
  netMargin: number | null;
  currentLiquidity: number | null;
  roic: number | null;
  roe: number | null;
  dailyLiquidity: number | null;
  netWorth: number | null;
  netDebtOverEquity: number | null;
  revenueCagr5y: number | null;
  [key: string]: any;
}

export interface ParsedFiiData {
  ticker: string;
  segment: string;
  lastPrice: number | null;
  ffoYield: number | null;
  dividendYield: number | null;
  pvp: number | null;
  marketCap: number | null;
  dailyLiquidity: number | null;
  propertiesCount: number | null;
  pricePerSqm: number | null;
  rentPerSqm: number | null;
  capRate: number | null;
  physicalVacancy: number | null;
  [key: string]: any;
}

export interface ParsedItemResult {
  index: number;
  rawTicker: string;
  ticker: string;
  assetType: 'Ação' | 'FII';
  isValid: boolean;
  errors: string[];
  stockData?: ParsedStockData;
  fiiData?: ParsedFiiData;
}

export interface FundamentusParseResult {
  detectedType: 'Ação' | 'FII' | 'Unknown';
  totalLines: number;
  validCount: number;
  errorCount: number;
  recognizedColumns: string[];
  items: ParsedItemResult[];
  errors: { line: number; message: string; rawText: string }[];
}

/**
 * Normalizes Brazilian numeric string into float
 * e.g. "1.234,56" -> 1234.56, "9,2%" -> 9.2, "R$ 160,00" -> 160.00, "-" -> null, "N/A" -> null
 */
export function parseBrazilianNumber(raw: any): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') {
    return isNaN(raw) ? null : raw;
  }

  let str = String(raw).trim();
  if (!str || str === '-' || str === '--' || str.toUpperCase() === 'N/A' || str.toUpperCase() === 'N/D' || str.toUpperCase() === 'NULL') {
    return null;
  }

  // Remove currency symbol, spaces, invisible characters
  str = str.replace(/R\$\s*/gi, '').replace(/\s+/g, '').replace(/%/g, '');

  // Handle scientific or clean representations
  // Check if standard Brazilian format with dots as thousands and comma as decimal
  if (str.includes(',') && str.includes('.')) {
    // 1.234.567,89 -> remove dot, replace comma with dot
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // 160,00 -> 160.00
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Cleans and standardizes a B3 Ticker (e.g. "PETR4", "HGLG11", "VALE3F" -> "VALE3")
 */
export function sanitizeTicker(raw: string): string {
  if (!raw) return '';
  let clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  // If ends with 'F' (fracionário B3) and length is 6 (e.g. PETR4F), normalize to standard 5/6 chars
  if (clean.length === 6 && clean.endsWith('F') && /\dF$/.test(clean)) {
    clean = clean.slice(0, 5);
  }
  return clean;
}

/**
 * Header canonical mapping for Fundamentus
 */
const STOCK_HEADER_SYNONYMS: Record<string, string> = {
  'PAPEL': 'ticker',
  'TICKER': 'ticker',
  'CODIGO': 'ticker',
  'CÓDIGO': 'ticker',
  'COTACAO': 'lastPrice',
  'COTAÇÃO': 'lastPrice',
  'PRECO': 'lastPrice',
  'PREÇO': 'lastPrice',
  'P/L': 'pl',
  'PL': 'pl',
  'P/VP': 'pvp',
  'PVP': 'pvp',
  'P/VPA': 'pvp',
  'PSR': 'psr',
  'P/SR': 'psr',
  'DIV.YIELD': 'dividendYield',
  'DIV. YIELD': 'dividendYield',
  'DIV YIELD': 'dividendYield',
  'DIVIDEND YIELD': 'dividendYield',
  'DY': 'dividendYield',
  'P/ATIVO': 'pAtivo',
  'P/ATIV': 'pAtivo',
  'P/CAP.GIRO': 'pCapGiro',
  'P/CAP. GIRO': 'pCapGiro',
  'P/CAPGIRO': 'pCapGiro',
  'P/EBIT': 'pEbit',
  'P/ATIV CIRC.LIQ': 'pAtivCircLiq',
  'P/ATIV CIRC. LIQ': 'pAtivCircLiq',
  'P/ATIVCIRC.LIQ': 'pAtivCircLiq',
  'P/ATIV CIRC LIQ': 'pAtivCircLiq',
  'EV/EBIT': 'evEbit',
  'EV/EBITDA': 'evEbitda',
  'MRG BRUTA': 'grossMargin',
  'MARGEM BRUTA': 'grossMargin',
  'MRGBRUTA': 'grossMargin',
  'MRG. BRUTA': 'grossMargin',
  'MRG EBIT': 'ebitMargin',
  'MARGEM EBIT': 'ebitMargin',
  'MRGEBIT': 'ebitMargin',
  'MRG. EBIT': 'ebitMargin',
  'MRG. LÍQ.': 'netMargin',
  'MRG. LIQ.': 'netMargin',
  'MRG LIQ': 'netMargin',
  'MRG LÍQ': 'netMargin',
  'MARGEM LIQUIDA': 'netMargin',
  'MARGEM LÍQUIDA': 'netMargin',
  'LIQ. CORR.': 'currentLiquidity',
  'LIQ. CORR': 'currentLiquidity',
  'LIQ CORR': 'currentLiquidity',
  'LIQUIDEZ CORRENTE': 'currentLiquidity',
  'ROIC': 'roic',
  'ROE': 'roe',
  'LIQ.2MESES': 'dailyLiquidity',
  'LIQ. 2 MESES': 'dailyLiquidity',
  'LIQ 2 MESES': 'dailyLiquidity',
  'LIQ.2M': 'dailyLiquidity',
  'LIQUIDEZ 2 MESES': 'dailyLiquidity',
  'PATRIM. LÍQ': 'netWorth',
  'PATRIM. LIQ': 'netWorth',
  'PATRIMONIO LIQUIDO': 'netWorth',
  'PATRIMÔNIO LÍQUIDO': 'netWorth',
  'PATRIM.LÍQ': 'netWorth',
  'DÍV.LÍQ/ PATRIM.': 'netDebtOverEquity',
  'DIV.LIQ/ PATRIM.': 'netDebtOverEquity',
  'DIV.LIQ/PATRIM.': 'netDebtOverEquity',
  'DIV. LÍQ/ PATRIM': 'netDebtOverEquity',
  'DIV. LIQ/ PATRIM': 'netDebtOverEquity',
  'DIVIDA LIQUIDA / PL': 'netDebtOverEquity',
  'DIV. LIQ / PL': 'netDebtOverEquity',
  'CRESC. REC.5A': 'revenueCagr5y',
  'CRESC. REC. 5A': 'revenueCagr5y',
  'CRESC REC 5A': 'revenueCagr5y',
  'CRESCIMENTO RECEITA 5A': 'revenueCagr5y'
};

const FII_HEADER_SYNONYMS: Record<string, string> = {
  'PAPEL': 'ticker',
  'TICKER': 'ticker',
  'FUNDO': 'ticker',
  'SEGMENTO': 'segment',
  'SETOR': 'segment',
  'SUBSETOR': 'segment',
  'CATEGORIA': 'segment',
  'TIPO': 'segment',
  'TIPO DE ATIVO': 'segment',
  'ESTRATÉGIA': 'segment',
  'ESTRATEGIA': 'segment',
  'COTACAO': 'lastPrice',
  'COTAÇÃO': 'lastPrice',
  'PRECO': 'lastPrice',
  'PREÇO': 'lastPrice',
  'FFO YIELD': 'ffoYield',
  'FFOYIELD': 'ffoYield',
  'FFO YLD': 'ffoYield',
  'DIVIDEND YIELD': 'dividendYield',
  'DIV.YIELD': 'dividendYield',
  'DIV. YIELD': 'dividendYield',
  'DIV YIELD': 'dividendYield',
  'DY': 'dividendYield',
  'DY 12M': 'dividendYield',
  'DY (12M)': 'dividendYield',
  'P/VP': 'pvp',
  'PVP': 'pvp',
  'VALOR DE MERCADO': 'marketCap',
  'VAL. MERCADO': 'marketCap',
  'VAL MERCADO': 'marketCap',
  'CAP. MERCADO': 'marketCap',
  'LIQUIDEZ': 'dailyLiquidity',
  'LIQUIDEZ DIARIA': 'dailyLiquidity',
  'LIQUIDEZ DIÁRIA': 'dailyLiquidity',
  'LIQ. DIARIA': 'dailyLiquidity',
  'LIQ DIARIA': 'dailyLiquidity',
  'QTD DE IMÓVEIS': 'propertiesCount',
  'QTD DE IMOVEIS': 'propertiesCount',
  'QTD. DE IMOVEIS': 'propertiesCount',
  'QTD. DE IMÓVEIS': 'propertiesCount',
  'QTD IMOVEIS': 'propertiesCount',
  'QTD. IMOVEIS': 'propertiesCount',
  'QTD. IMÓVEIS': 'propertiesCount',
  'QTD IMÓVEIS': 'propertiesCount',
  'IMOVEIS': 'propertiesCount',
  'IMÓVEIS': 'propertiesCount',
  'QUANTIDADE DE IMÓVEIS': 'propertiesCount',
  'QUANTIDADE DE IMOVEIS': 'propertiesCount',
  'Nº DE IMÓVEIS': 'propertiesCount',
  'NO. DE IMOVEIS': 'propertiesCount',
  'QTD ATIVOS': 'propertiesCount',
  'PREÇO DO M2': 'pricePerSqm',
  'PRECO DO M2': 'pricePerSqm',
  'PREÇO/M2': 'pricePerSqm',
  'PRECO/M2': 'pricePerSqm',
  'PRECO M2': 'pricePerSqm',
  'PREÇO M2': 'pricePerSqm',
  'ALUGUEL POR M2': 'rentPerSqm',
  'ALUGUEL/M2': 'rentPerSqm',
  'ALUGUEL M2': 'rentPerSqm',
  'CAP RATE': 'capRate',
  'CAPRATE': 'capRate',
  'CAP RATE %': 'capRate',
  'CAPRATE %': 'capRate',
  'TAXA CAP': 'capRate',
  'VACÂNCIA MÉDIA': 'physicalVacancy',
  'VACANCIA MEDIA': 'physicalVacancy',
  'VACANCIA': 'physicalVacancy',
  'VACÂNCIA': 'physicalVacancy',
  'VACANCIA FISICA': 'physicalVacancy',
  'VACÂNCIA FÍSICA': 'physicalVacancy',
  'VACANCIA %': 'physicalVacancy',
  'VACÂNCIA %': 'physicalVacancy',
  'VACANCIA FISICA %': 'physicalVacancy',
  'VACÂNCIA FÍSICA %': 'physicalVacancy',
  'VACANCIA MED.': 'physicalVacancy',
  'VACÂNCIA MED.': 'physicalVacancy'
};

/**
 * Standardizes a column header string by removing accents, special characters, uppercase
 */
function normalizeHeaderName(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Splits raw pasted text into rows and columns, supporting tabs, semicolons, or commas
 */
function tokenizePaste(rawText: string): string[][] {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return [];

  // Determine separator: test first 5 lines for tab count vs semicolon vs comma
  const sample = lines.slice(0, Math.min(5, lines.length));
  let tabCount = 0;
  let semiCount = 0;
  let commaCount = 0;

  sample.forEach(line => {
    tabCount += (line.match(/\t/g) || []).length;
    semiCount += (line.match(/;/g) || []).length;
    commaCount += (line.match(/,/g) || []).length;
  });

  let separator = '\t';
  if (tabCount >= 2) {
    separator = '\t';
  } else if (semiCount >= 3) {
    separator = ';';
  } else if (commaCount >= 6) {
    separator = ',';
  } else {
    // If spaces separate columns (e.g. 2 or more spaces)
    return lines.map(line => line.split(/\s{2,}|\t/));
  }

  return lines.map(line => line.split(separator).map(cell => cell.trim()));
}

/**
 * Parses raw Fundamentus text data
 */
export function parseFundamentusTable(rawText: string): FundamentusParseResult {
  const tokenized = tokenizePaste(rawText);
  if (tokenized.length === 0) {
    return {
      detectedType: 'Unknown',
      totalLines: 0,
      validCount: 0,
      errorCount: 0,
      recognizedColumns: [],
      items: [],
      errors: [{ line: 0, message: 'Nenhum dado encontrado para processar.', rawText: '' }]
    };
  }

  // 1. Detect Header Row and Asset Type
  let headerRowIndex = 0;
  let headerCells: string[] = [];
  let detectedType: 'Ação' | 'FII' | 'Unknown' = 'Unknown';
  let stockMatches = 0;
  let fiiMatches = 0;

  for (let i = 0; i < Math.min(5, tokenized.length); i++) {
    const row = tokenized[i];
    let sMatch = 0;
    let fMatch = 0;

    row.forEach(cell => {
      const norm = normalizeHeaderName(cell);
      if (STOCK_HEADER_SYNONYMS[norm] || STOCK_HEADER_SYNONYMS[cell.toUpperCase().trim()]) sMatch++;
      if (FII_HEADER_SYNONYMS[norm] || FII_HEADER_SYNONYMS[cell.toUpperCase().trim()]) fMatch++;
      if (norm.includes('FFO') || norm.includes('SEGMENTO') || norm.includes('CAP RATE') || norm.includes('IMOVEIS') || norm.includes('IMÓVEIS')) fMatch += 3;
      if (norm.includes('ROIC') || norm.includes('ROE') || norm.includes('EBITDA') || norm.includes('EBIT') || norm.includes('MARGEM') || norm.includes('PATRIM')) sMatch += 2;
    });

    if (sMatch + fMatch > stockMatches + fiiMatches) {
      stockMatches = sMatch;
      fiiMatches = fMatch;
      headerRowIndex = i;
      headerCells = row;
    }
  }

  // If no clear header found, try to inspect the first row columns count & characteristics
  if (stockMatches === 0 && fiiMatches === 0 && tokenized.length > 0) {
    // Check if row 0 has tickers or header names
    headerRowIndex = 0;
    headerCells = tokenized[0];
  }

  // Determine Type
  if (fiiMatches > stockMatches) {
    detectedType = 'FII';
  } else if (stockMatches > 0) {
    detectedType = 'Ação';
  } else {
    // Heuristic: Check if first data row ticker ends in 11 and has segment or vacancy
    const firstData = tokenized[headerRowIndex + 1] || tokenized[0];
    const firstTk = sanitizeTicker(firstData[0] || '');
    if (firstTk.endsWith('11') && firstData.length <= 15) {
      detectedType = 'FII';
    } else {
      detectedType = 'Ação';
    }
  }

  // 2. Map Column Indices to Canonical Keys
  const columnMap: Record<number, string> = {};
  const recognizedColumns: string[] = [];

  headerCells.forEach((cell, idx) => {
    const norm = normalizeHeaderName(cell);
    const rawUpper = cell.toUpperCase().trim();

    let canonicalKey: string | undefined;
    if (detectedType === 'FII') {
      canonicalKey = FII_HEADER_SYNONYMS[norm] || FII_HEADER_SYNONYMS[rawUpper];
    } else {
      canonicalKey = STOCK_HEADER_SYNONYMS[norm] || STOCK_HEADER_SYNONYMS[rawUpper];
    }

    // Fallback search
    if (!canonicalKey) {
      if (norm.includes('PAPEL') || norm.includes('TICKER') || norm.includes('CODIGO') || norm.includes('FUNDO')) canonicalKey = 'ticker';
      else if (norm.includes('COTACAO') || norm.includes('PRECO') || norm.includes('ULTIMO')) canonicalKey = 'lastPrice';
      else if (norm.includes('P/VP') || norm.includes('PVP')) canonicalKey = 'pvp';
      else if (norm.includes('P/L') || norm.includes('PL')) canonicalKey = 'pl';
      else if (norm.includes('DY') || norm.includes('DIVIDEND') || norm.includes('YIELD')) canonicalKey = 'dividendYield';
      else if (norm.includes('ROE')) canonicalKey = 'roe';
      else if (norm.includes('ROIC')) canonicalKey = 'roic';
      else if (norm.includes('FFO')) canonicalKey = 'ffoYield';
      else if (norm.includes('SEGMENTO') || norm.includes('SETOR') || norm.includes('SUBSETOR') || norm.includes('CATEGORIA') || norm.includes('TIPO')) canonicalKey = 'segment';
      else if (norm.includes('CAP RATE') || norm.includes('CAPRATE') || norm.includes('CAP_RATE') || norm.includes('TAXA CAP')) canonicalKey = 'capRate';
      else if (norm.includes('VACANCIA') || norm.includes('VACANC')) canonicalKey = 'physicalVacancy';
      else if (norm.includes('IMOVEIS') || norm.includes('IMOVEL') || norm.includes('PROPRIEDAD') || norm.includes('ATIVOS')) canonicalKey = 'propertiesCount';
      else if (norm.includes('EV/EBITDA')) canonicalKey = 'evEbitda';
      else if (norm.includes('EV/EBIT')) canonicalKey = 'evEbit';
      else if (norm.includes('LIQ') && norm.includes('2')) canonicalKey = 'dailyLiquidity';
      else if (norm.includes('LIQ') && norm.includes('CORR')) canonicalKey = 'currentLiquidity';
      else if (norm.includes('MERCADO')) canonicalKey = 'marketCap';
      else if (norm.includes('PATRIM')) canonicalKey = 'netWorth';
    }

    if (canonicalKey) {
      columnMap[idx] = canonicalKey;
      recognizedColumns.push(`${cell} -> ${canonicalKey}`);
    }
  });

  // Default index-based mapping if header was not detected accurately
  if (Object.keys(columnMap).length <= 2) {
    if (detectedType === 'FII') {
      // Standard Fundamentus FII columns:
      // Papel, Segmento, Cotação, FFO Yield, Dividend Yield, P/VP, Valor de Mercado, Liquidez, Qtd de imóveis, Preço do m2, Aluguel por m2, Cap Rate, Vacância Média
      const defaultFiiKeys = [
        'ticker', 'segment', 'lastPrice', 'ffoYield', 'dividendYield', 'pvp',
        'marketCap', 'dailyLiquidity', 'propertiesCount', 'pricePerSqm', 'rentPerSqm',
        'capRate', 'physicalVacancy'
      ];
      defaultFiiKeys.forEach((k, i) => { columnMap[i] = k; });
    } else {
      // Standard Fundamentus Stock columns:
      // Papel, Cotação, P/L, P/VP, PSR, Div.Yield, P/Ativo, P/Cap.Giro, P/EBIT, P/Ativ Circ.Liq, EV/EBIT, EV/EBITDA, Mrg Bruta, Mrg Ebit, Mrg. Líq., Liq. Corr., ROIC, ROE, Liq.2meses, Patrim. Líq, Dív.Líq/ Patrim., Cresc. Rec.5a
      const defaultStockKeys = [
        'ticker', 'lastPrice', 'pl', 'pvp', 'psr', 'dividendYield', 'pAtivo',
        'pCapGiro', 'pEbit', 'pAtivCircLiq', 'evEbit', 'evEbitda', 'grossMargin',
        'ebitMargin', 'netMargin', 'currentLiquidity', 'roic', 'roe', 'dailyLiquidity',
        'netWorth', 'netDebtOverEquity', 'revenueCagr5y'
      ];
      defaultStockKeys.forEach((k, i) => { columnMap[i] = k; });
    }
  }

  // 3. Process Data Rows
  const items: ParsedItemResult[] = [];
  const errors: { line: number; message: string; rawText: string }[] = [];

  const startRow = headerRowIndex + 1;
  for (let r = startRow; r < tokenized.length; r++) {
    const row = tokenized[r];
    if (row.length === 0 || (row.length === 1 && !row[0])) continue;

    // Check if this row is repeated header
    const firstVal = normalizeHeaderName(row[0] || '');
    if (firstVal === 'PAPEL' || firstVal === 'TICKER' || firstVal === 'CODIGO') {
      continue;
    }

    const rowObj: any = {};
    row.forEach((cell, colIdx) => {
      const key = columnMap[colIdx];
      if (key) {
        if (key === 'ticker' || key === 'segment') {
          rowObj[key] = cell.trim();
        } else {
          rowObj[key] = parseBrazilianNumber(cell);
        }
      }
    });

    const rawTicker = rowObj.ticker || row[0] || '';
    const cleanTicker = sanitizeTicker(rawTicker);
    const rowErrors: string[] = [];

    // Validation
    if (!cleanTicker || cleanTicker.length < 3 || cleanTicker.length > 7) {
      rowErrors.push(`Ticker inválido: "${rawTicker}"`);
    }

    const isValid = rowErrors.length === 0;

    if (!isValid) {
      errors.push({
        line: r + 1,
        message: rowErrors.join(', '),
        rawText: row.join(' | ')
      });
    }

    if (detectedType === 'FII') {
      const fiiData: ParsedFiiData = {
        ticker: cleanTicker,
        segment: rowObj.segment || 'Outros',
        lastPrice: rowObj.lastPrice ?? null,
        ffoYield: rowObj.ffoYield ?? null,
        dividendYield: rowObj.dividendYield ?? null,
        pvp: rowObj.pvp ?? null,
        marketCap: rowObj.marketCap ?? null,
        dailyLiquidity: rowObj.dailyLiquidity ?? null,
        propertiesCount: rowObj.propertiesCount ? Math.round(rowObj.propertiesCount) : null,
        pricePerSqm: rowObj.pricePerSqm ?? null,
        rentPerSqm: rowObj.rentPerSqm ?? null,
        capRate: rowObj.capRate ?? null,
        physicalVacancy: rowObj.physicalVacancy ?? null
      };

      items.push({
        index: r + 1,
        rawTicker,
        ticker: cleanTicker,
        assetType: 'FII',
        isValid,
        errors: rowErrors,
        fiiData
      });
    } else {
      const stockData: ParsedStockData = {
        ticker: cleanTicker,
        lastPrice: rowObj.lastPrice ?? null,
        pl: rowObj.pl ?? null,
        pvp: rowObj.pvp ?? null,
        psr: rowObj.psr ?? null,
        dividendYield: rowObj.dividendYield ?? null,
        pAtivo: rowObj.pAtivo ?? null,
        pCapGiro: rowObj.pCapGiro ?? null,
        pEbit: rowObj.pEbit ?? null,
        pAtivCircLiq: rowObj.pAtivCircLiq ?? null,
        evEbit: rowObj.evEbit ?? null,
        evEbitda: rowObj.evEbitda ?? null,
        grossMargin: rowObj.grossMargin ?? null,
        ebitMargin: rowObj.ebitMargin ?? null,
        netMargin: rowObj.netMargin ?? null,
        currentLiquidity: rowObj.currentLiquidity ?? null,
        roic: rowObj.roic ?? null,
        roe: rowObj.roe ?? null,
        dailyLiquidity: rowObj.dailyLiquidity ?? null,
        netWorth: rowObj.netWorth ?? null,
        netDebtOverEquity: rowObj.netDebtOverEquity ?? null,
        revenueCagr5y: rowObj.revenueCagr5y ?? null
      };

      items.push({
        index: r + 1,
        rawTicker,
        ticker: cleanTicker,
        assetType: 'Ação',
        isValid,
        errors: rowErrors,
        stockData
      });
    }
  }

  const validCount = items.filter(i => i.isValid).length;
  const errorCount = items.length - validCount;

  return {
    detectedType,
    totalLines: items.length,
    validCount,
    errorCount,
    recognizedColumns,
    items,
    errors
  };
}
