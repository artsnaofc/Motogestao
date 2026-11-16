/**
 * Dynamic B3 & Multi-Class Fundamentals Data Models & Utilities
 * 100% User-driven architecture (No hardcoded asset base)
 */

export type AssetClass =
  | 'Ação'
  | 'FII'
  | 'ETF'
  | 'BDR'
  | 'Tesouro Direto'
  | 'Renda Fixa'
  | 'Cripto'
  | 'Outros';

export const ASSET_CLASS_OPTIONS: Array<{ value: AssetClass; label: string; shortLabel: string }> = [
  { value: 'Ação', label: 'Ação (Bolsa B3)', shortLabel: 'Ações' },
  { value: 'FII', label: 'Fundo Imobiliário (FII)', shortLabel: 'FIIs' },
  { value: 'ETF', label: 'ETF (Fundo de Índice)', shortLabel: 'ETFs' },
  { value: 'BDR', label: 'BDR (Ação Internacional)', shortLabel: 'BDRs' },
  { value: 'Tesouro Direto', label: 'Tesouro Direto (Selic / IPCA+ / Pré)', shortLabel: 'Tesouro Direto' },
  { value: 'Renda Fixa', label: 'Renda Fixa (CDB / LCI / LCA / Debêntures / Outros)', shortLabel: 'Renda Fixa' },
  { value: 'Cripto', label: 'Criptomoeda', shortLabel: 'Cripto' },
  { value: 'Outros', label: 'Outros Ativos', shortLabel: 'Outros' },
];

export interface B3StockFundamental {
  ticker: string;
  name: string;
  assetClass?: AssetClass;
  cnpj?: string;
  sector: string;
  subsector?: string;
  segment?: string;
  issuer?: string;
  marketCap: number; // R$
  dailyLiquidity: number; // R$ volume diário médio
  
  // Fundamental metrics
  pl: number; // P/L
  pvp: number; // P/VP
  psr?: number; // PSR
  dividendYield: number; // % DY 12M
  pAtivo?: number; // P/Ativo
  pCapGiro?: number; // P/Cap.Giro
  pEbit?: number; // P/EBIT
  pAtivCircLiq?: number; // P/Ativ Circ.Liq
  evEbit?: number; // EV/EBIT
  evEbitda?: number; // EV/EBITDA
  grossMargin?: number; // % Margem Bruta
  ebitMargin?: number; // % Margem EBIT
  netMargin: number; // % Margem Líquida
  ebitdaMargin?: number; // % Margem EBITDA
  currentLiquidity?: number; // Liq. Corr.
  roic: number; // % ROIC
  roe: number; // % ROE
  revenueCagr5y: number; // % CAGR Receita 5a
  profitCagr5y?: number; // % CAGR Lucro 5a
  netWorth?: number; // Patrimônio Líquido
  netDebtOverEquity?: number; // Dívida Líquida / Patrimônio Líquido
  netDebtOverEbitda: number; // Dívida Líquida / EBITDA
  payout?: number; // % Payout médio
  lpa?: number; // Lucro por Ação (R$)
  vpa?: number; // Valor Patrimonial por Ação (R$)
  description?: string;
  lastPrice?: number;
  source?: string;
  updatedAt?: string;
}

export interface B3FiiFundamental {
  ticker: string;
  name: string;
  assetClass?: AssetClass;
  cnpj?: string;
  fiiType: 'Tijolo' | 'Papel' | 'FOF' | 'Híbrido' | 'Fiagro' | 'Infra' | 'Outros';
  fiiSegment: string;
  administrator?: string;
  netWorth: number; // Patrimônio Líquido em R$ milhões
  marketCap: number; // Valor de mercado em R$ milhões
  dailyLiquidity: number; // R$ volume diário médio
  
  // FII specific metrics
  pvp: number; // P/VP
  ffoYield?: number; // % FFO Yield
  dividendYield: number; // % DY 12M
  lastDividend?: number; // R$ último rendimento por cota
  physicalVacancy: number; // % Vacância Física
  financialVacancy?: number; // % Vacância Financeira
  propertiesCount: number; // Número de imóveis
  pricePerSqm?: number; // R$ Preço do m²
  rentPerSqm?: number; // R$ Aluguel por m²
  capRate?: number; // % Cap Rate
  grossLettableArea?: number; // ABL em m² (Área Bruta Locável)
  topTenantsShare?: number; // % Concentração maiores inquilinos
  description?: string;
  lastPrice?: number;
  source?: string;
  updatedAt?: string;
}

export type B3AssetFundamental = 
  | ({ type: 'Ação' } & B3StockFundamental)
  | ({ type: 'FII' } & B3FiiFundamental);

/**
 * Historical fundamental snapshot record
 */
export interface B3AssetHistoryRecord {
  id?: string;
  ticker: string;
  assetType: 'Ação' | 'FII';
  recordedAt: string;
  source: string;
  price?: number | null;
  dy?: number | null;
  pvp?: number | null;
  pl?: number | null;
  roe?: number | null;
  roic?: number | null;
  vacancy?: number | null;
  capRate?: number | null;
  metricsJson?: Record<string, any>;
}

const KNOWN_ETFS_11 = new Set([
  'BOVA11', 'IVVB11', 'SMAL11', 'HASH11', 'DIVO11', 'FIND11', 'MATB11', 'NASD11',
  'SPXI11', 'QBTC11', 'BETH11', 'BOVV11', 'BOVX11', 'BOVB11', 'ECOO11', 'GOVE11',
  'ISUS11', 'PIBB11', 'XFIX11', 'IRFM11', 'IMAB11', 'B5P211', 'TECK11', 'GOLD11',
  'URET11', 'XINA11', 'EURP11', 'ACWI11', 'WRLD11', 'SPYI11', 'CHIP11', 'DEFI11',
  'ETHE11', 'SOLH11', 'NDIV11', 'SMAC11', 'USTK11', 'USAL11', 'LFTB11', 'LFTS11',
  'NTNS11', 'IB5M11', 'FIXA11', 'DEBB11', 'QQQM11', 'JOGO11', 'MILL11', 'DNAI11'
]);

const KNOWN_STOCK_UNITS_11 = new Set([
  'TAEE11', 'SANB11', 'ALUP11', 'SAPR11', 'KLBN11', 'BPAC11', 'CPLE11', 'SULA11',
  'ENGI11', 'IGTI11', 'PPLA11'
]);

const KNOWN_CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC',
  'POL', 'AVAX', 'LINK', 'DOT', 'LTC', 'BITCOIN', 'ETHEREUM', 'SOLANA', 'UNI', 'ATOM'
]);

/**
 * Checks if an asset type or ticker is manual fixed income (no B3 live quote lookup needed)
 */
export function isFixedIncomeAssetType(typeOrTicker?: string, ticker?: string): boolean {
  const tNorm = (typeOrTicker || '').toLowerCase().trim();
  if (
    tNorm === 'tesouro direto' ||
    tNorm === 'renda fixa' ||
    tNorm === 'outros' ||
    tNorm === 'outro'
  ) {
    return true;
  }
  const tk = (ticker || typeOrTicker || '').toUpperCase().trim();
  if (!tk) return false;
  return /^(TESOURO|SELIC|IPCA|PREFIXADO|RENDA\+|EDUCA\+|NTN|LFT|LTN|CDB|LCI|LCA|RDB|DEB|CRI|CRA|LCD|POUPANCA|POUPANÇA|RENDA[\s_-]?FIXA|COE|PGBL|VGBL)/.test(tk) ||
    tk.includes('TESOURO') ||
    tk.includes('CDB') ||
    tk.includes('LCI') ||
    tk.includes('LCA');
}

/**
 * Checks if an asset supports live market quote fetching (B3, BDR, ETF, Crypto)
 */
export function isMarketQuotedAsset(type?: string, ticker?: string): boolean {
  if (isFixedIncomeAssetType(type, ticker)) return false;
  const clean = (ticker || '').trim().toUpperCase();
  if (clean && clean.includes(' ')) return false;
  return true;
}

/**
 * Automatically infers asset class from ticker / label
 */
export function getAssetTypeForTicker(ticker: string): AssetClass {
  if (!ticker) return 'Ação';
  const clean = ticker.toUpperCase().trim();

  // 1. Tesouro Direto
  if (
    clean.includes('TESOURO') ||
    clean.includes('SELIC') ||
    clean.includes('IPCA') ||
    clean.includes('PREFIXADO') ||
    clean.includes('RENDA+') ||
    clean.includes('EDUCA+') ||
    /^(NTN|LFT|LTN)/.test(clean)
  ) {
    return 'Tesouro Direto';
  }

  // 2. Renda Fixa (CDB, LCI, LCA, Debêntures, CRI/CRA, Poupança)
  if (
    /^(CDB|LCI|LCA|RDB|DEB|CRI|CRA|LCD|POUPANCA|POUPANÇA|RENDA[\s_-]?FIXA|COE)/.test(clean) ||
    clean.includes('CDB') ||
    clean.includes('LCI') ||
    clean.includes('LCA') ||
    clean.includes('DEBENTURE') ||
    clean.includes('DEBÊNTURE')
  ) {
    return 'Renda Fixa';
  }

  // 3. Cripto
  const baseSym = clean.replace(/-(USD|BRL|USDT)$/, '');
  if (KNOWN_CRYPTO_SYMBOLS.has(clean) || KNOWN_CRYPTO_SYMBOLS.has(baseSym) || clean.endsWith('-USD') || clean.endsWith('-BRL')) {
    return 'Cripto';
  }

  // 4. BDR (suffix 32, 33, 34, 35)
  if (/^[A-Z]{4}(32|33|34|35)$/.test(clean)) {
    return 'BDR';
  }

  // 5. ETFs ending in 11
  if (KNOWN_ETFS_11.has(clean)) {
    return 'ETF';
  }

  // 6. Stock Units ending in 11
  if (KNOWN_STOCK_UNITS_11.has(clean)) {
    return 'Ação';
  }

  // 7. FIIs ending in 11, 11B, 12
  if (clean.endsWith('11') || clean.endsWith('11B') || clean.endsWith('12')) {
    return 'FII';
  }

  // 8. Outros ativos descritivos
  if (
    clean.includes('FUNDO') ||
    clean.includes('PREVID') ||
    clean.includes('MULTIMERCADO') ||
    clean.includes('OURO') ||
    clean.includes('CAMBIO') ||
    clean.includes('DOLAR')
  ) {
    return 'Outros';
  }

  return 'Ação';
}

/**
 * Builds a dynamic B3AssetFundamental object from user-provided metadata or live quotes
 */
export function getB3AssetFundamental(
  ticker: string, 
  typeHint?: AssetClass | string,
  liveQuote?: number,
  customMetadata?: Record<string, any>
): B3AssetFundamental {
  const clean = (ticker || '').toUpperCase().trim();
  const validClasses: Set<string> = new Set([
    'Ação', 'FII', 'ETF', 'BDR', 'Tesouro Direto', 'Renda Fixa', 'Cripto', 'Outros'
  ]);
  const resolvedClass: AssetClass = (typeHint && validClasses.has(typeHint))
    ? (typeHint as AssetClass)
    : getAssetTypeForTicker(clean);
  const detectedType: 'Ação' | 'FII' = resolvedClass === 'FII' ? 'FII' : 'Ação';

  // 1. If custom metadata is provided for this ticker in database / state
  const custom = customMetadata ? customMetadata[clean] : null;

  if (custom) {
    const isFii = custom.asset_type === 'FII' || custom.type === 'FII' || detectedType === 'FII';
    const quote = liveQuote && liveQuote > 0 ? liveQuote : (custom.last_price || custom.lastPrice || 0);

    if (isFii) {
      return {
        type: 'FII',
        assetClass: 'FII',
        ticker: clean,
        name: custom.name || `${clean} - FII`,
        cnpj: custom.cnpj || undefined,
        fiiType: custom.fii_type || custom.fiiType || (clean.startsWith('KN') || clean.startsWith('MX') || clean.startsWith('CP') || clean.startsWith('RECR') ? 'Papel' : 'Tijolo'),
        fiiSegment: (custom.fii_segment && custom.fii_segment !== 'Outros') 
          ? custom.fii_segment 
          : (custom.segment || custom.fiiSegment || custom.sector || 'Outros'),
        administrator: custom.administrator || 'Gestão do Fundo',
        netWorth: Number(custom.net_worth ?? custom.netWorth ?? 500),
        marketCap: Number(custom.market_cap ?? custom.marketCap ?? (quote > 0 ? quote * 10000000 : 500)),
        dailyLiquidity: Number(custom.daily_liquidity ?? custom.dailyLiquidity ?? 1000000),
        pvp: Number(custom.pvp ?? (quote > 0 ? Number((quote / 100).toFixed(2)) : 1.0)),
        ffoYield: custom.ffo_yield !== undefined && custom.ffo_yield !== null ? Number(custom.ffo_yield) : (custom.ffoYield !== undefined && custom.ffoYield !== null ? Number(custom.ffoYield) : undefined),
        dividendYield: Number(custom.dividend_yield ?? custom.dividendYield ?? 0),
        lastDividend: Number(custom.last_dividend ?? custom.lastDividend ?? (quote > 0 ? Number((quote * 0.008).toFixed(2)) : 0.8)),
        physicalVacancy: Number(custom.physical_vacancy ?? custom.physicalVacancy ?? custom.vacancia_media ?? custom.vacanciaMedia ?? custom.vacancia ?? 0),
        financialVacancy: Number(custom.financial_vacancy ?? custom.financialVacancy ?? 0),
        propertiesCount: Number(custom.properties_count ?? custom.propertiesCount ?? custom.qtd_imoveis ?? custom.qtdImoveis ?? custom.imoveis ?? 0),
        pricePerSqm: custom.price_per_sqm !== undefined && custom.price_per_sqm !== null ? Number(custom.price_per_sqm) : (custom.pricePerSqm !== undefined && custom.pricePerSqm !== null ? Number(custom.pricePerSqm) : undefined),
        rentPerSqm: custom.rent_per_sqm !== undefined && custom.rent_per_sqm !== null ? Number(custom.rent_per_sqm) : (custom.rentPerSqm !== undefined && custom.rentPerSqm !== null ? Number(custom.rentPerSqm) : undefined),
        capRate: custom.cap_rate !== undefined && custom.cap_rate !== null ? Number(custom.cap_rate) : (custom.capRate !== undefined && custom.capRate !== null ? Number(custom.capRate) : (custom.caprate !== undefined && custom.caprate !== null ? Number(custom.caprate) : undefined)),
        grossLettableArea: Number(custom.gross_lettable_area ?? custom.grossLettableArea ?? 0),
        topTenantsShare: Number(custom.top_tenants_share ?? custom.topTenantsShare ?? 0),
        description: custom.description || 'Fundo Imobiliário negociado na B3.',
        lastPrice: quote > 0 ? quote : undefined,
        source: custom.source || 'Usuário',
        updatedAt: custom.updated_at || custom.updatedAt
      };
    } else {
      return {
        type: 'Ação',
        assetClass: resolvedClass,
        ticker: clean,
        name: custom.name || `${clean} ${resolvedClass === 'Ação' ? 'S.A.' : `(${resolvedClass})`}`,
        cnpj: custom.cnpj || undefined,
        sector: custom.sector || (resolvedClass === 'Ação' ? 'Outros' : resolvedClass),
        subsector: custom.subsector || resolvedClass,
        segment: custom.segment || resolvedClass,
        issuer: custom.issuer || `${clean}`,
        marketCap: Number(custom.market_cap ?? custom.marketCap ?? 1000),
        dailyLiquidity: Number(custom.daily_liquidity ?? custom.dailyLiquidity ?? 5000000),
        pl: Number(custom.pl ?? 10.0),
        pvp: Number(custom.pvp ?? 1.2),
        psr: custom.psr !== undefined ? Number(custom.psr) : undefined,
        dividendYield: Number(custom.dividend_yield ?? custom.dividendYield ?? 0),
        pAtivo: custom.p_ativo !== undefined ? Number(custom.p_ativo) : (custom.pAtivo !== undefined ? Number(custom.pAtivo) : undefined),
        pCapGiro: custom.p_cap_giro !== undefined ? Number(custom.p_cap_giro) : (custom.pCapGiro !== undefined ? Number(custom.pCapGiro) : undefined),
        pEbit: custom.p_ebit !== undefined ? Number(custom.p_ebit) : (custom.pEbit !== undefined ? Number(custom.pEbit) : undefined),
        pAtivCircLiq: custom.p_ativ_circ_liq !== undefined ? Number(custom.p_ativ_circ_liq) : (custom.pAtivCircLiq !== undefined ? Number(custom.pAtivCircLiq) : undefined),
        evEbit: custom.ev_ebit !== undefined ? Number(custom.ev_ebit) : (custom.evEbit !== undefined ? Number(custom.evEbit) : undefined),
        evEbitda: custom.ev_ebitda !== undefined ? Number(custom.ev_ebitda) : (custom.evEbitda !== undefined ? Number(custom.evEbitda) : undefined),
        grossMargin: custom.gross_margin !== undefined ? Number(custom.gross_margin) : (custom.grossMargin !== undefined ? Number(custom.grossMargin) : undefined),
        ebitMargin: custom.ebit_margin !== undefined ? Number(custom.ebit_margin) : (custom.ebitMargin !== undefined ? Number(custom.ebitMargin) : undefined),
        netMargin: Number(custom.net_margin ?? custom.netMargin ?? 10.0),
        ebitdaMargin: Number(custom.ebitda_margin ?? custom.ebitdaMargin ?? 20.0),
        currentLiquidity: custom.current_liquidity !== undefined ? Number(custom.current_liquidity) : (custom.currentLiquidity !== undefined ? Number(custom.currentLiquidity) : undefined),
        roic: Number(custom.roic ?? 12.0),
        roe: Number(custom.roe ?? 14.0),
        revenueCagr5y: Number(custom.revenue_cagr_5y ?? custom.revenueCagr5y ?? 5.0),
        profitCagr5y: Number(custom.profit_cagr_5y ?? custom.profitCagr5y ?? 5.0),
        netWorth: Number(custom.net_worth ?? custom.netWorth ?? 500),
        netDebtOverEquity: custom.net_debt_over_equity !== undefined ? Number(custom.net_debt_over_equity) : (custom.netDebtOverEquity !== undefined ? Number(custom.netDebtOverEquity) : undefined),
        netDebtOverEbitda: Number(custom.net_debt_over_ebitda ?? custom.netDebtOverEbitda ?? 1.5),
        payout: Number(custom.payout ?? 50.0),
        lpa: Number(custom.lpa ?? (quote > 0 ? Number((quote / 10).toFixed(2)) : 2.5)),
        vpa: Number(custom.vpa ?? (quote > 0 ? Number((quote / 1.2).toFixed(2)) : 20.0)),
        description: custom.description || 'Ativo da carteira.',
        lastPrice: quote > 0 ? quote : undefined,
        source: custom.source || 'Usuário',
        updatedAt: custom.updated_at || custom.updatedAt
      };
    }
  }

  // 2. Dynamic Default Construction based purely on clean ticker, class and live price
  if (detectedType === 'FII') {
    const isPapel = clean.startsWith('KN') || clean.startsWith('MX') || clean.startsWith('CP') || clean.startsWith('RECR');
    return {
      type: 'FII',
      assetClass: 'FII',
      ticker: clean,
      name: `${clean} - Fundo Imobiliário`,
      fiiType: isPapel ? 'Papel' : 'Tijolo',
      fiiSegment: 'Outros',
      administrator: 'Gestão FII',
      netWorth: 850,
      marketCap: 800,
      dailyLiquidity: 1200000,
      pvp: liveQuote && liveQuote > 0 ? Number((liveQuote / 100).toFixed(2)) : 1.0,
      dividendYield: 9.0,
      lastDividend: liveQuote && liveQuote > 0 ? Number((liveQuote * 0.008).toFixed(2)) : 0.85,
      physicalVacancy: isPapel ? 0 : 5.0,
      financialVacancy: isPapel ? 0 : 4.0,
      propertiesCount: isPapel ? 0 : 8,
      grossLettableArea: 100000,
      topTenantsShare: 20.0,
      description: 'Fundo Imobiliário negociado na B3.',
      lastPrice: liveQuote && liveQuote > 0 ? liveQuote : undefined,
      source: 'Auto'
    };
  }

  if (resolvedClass === 'Tesouro Direto' || resolvedClass === 'Renda Fixa' || resolvedClass === 'Outros') {
    const isTesouro = resolvedClass === 'Tesouro Direto';
    return {
      type: 'Ação',
      assetClass: resolvedClass,
      ticker: clean,
      name: clean,
      sector: resolvedClass,
      subsector: isTesouro ? 'Títulos Públicos Federais' : resolvedClass,
      segment: isTesouro ? 'Tesouro Nacional' : resolvedClass,
      issuer: isTesouro ? 'Tesouro Nacional (Governo Federal)' : resolvedClass,
      marketCap: 50000,
      dailyLiquidity: 50000000,
      pl: 10.0,
      pvp: 1.0,
      roe: 12.0,
      roic: 12.0,
      netMargin: 100.0,
      ebitdaMargin: 100.0,
      revenueCagr5y: 10.0,
      profitCagr5y: 10.0,
      netDebtOverEbitda: 0,
      dividendYield: isTesouro ? 11.0 : 10.5,
      payout: 0,
      lpa: 1,
      vpa: 1,
      description: isTesouro ? 'Título Público do Tesouro Direto.' : 'Título de Renda Fixa / Outros Ativos.',
      lastPrice: liveQuote && liveQuote > 0 ? liveQuote : undefined,
      source: 'Auto'
    };
  }

  if (resolvedClass === 'ETF' || resolvedClass === 'BDR' || resolvedClass === 'Cripto') {
    const sectorLabel =
      resolvedClass === 'ETF' ? 'ETFs & Índices' :
      resolvedClass === 'BDR' ? 'Internacional (BDR)' :
      'Criptoativos';
    return {
      type: 'Ação',
      assetClass: resolvedClass,
      ticker: clean,
      name: `${clean} (${resolvedClass})`,
      sector: sectorLabel,
      subsector: resolvedClass,
      segment: resolvedClass,
      issuer: resolvedClass === 'Cripto' ? 'Rede Descentralizada' : resolvedClass,
      marketCap: 20000,
      dailyLiquidity: 25000000,
      pl: 15.0,
      pvp: 1.5,
      roe: 15.0,
      roic: 14.0,
      netMargin: 15.0,
      ebitdaMargin: 25.0,
      revenueCagr5y: 12.0,
      profitCagr5y: 12.0,
      netDebtOverEbitda: 0.5,
      dividendYield: resolvedClass === 'Cripto' ? 0 : 2.5,
      payout: 20,
      lpa: liveQuote && liveQuote > 0 ? Number((liveQuote / 15).toFixed(2)) : 2.0,
      vpa: liveQuote && liveQuote > 0 ? Number((liveQuote / 1.5).toFixed(2)) : 15.0,
      description: `Ativo da classe ${resolvedClass}.`,
      lastPrice: liveQuote && liveQuote > 0 ? liveQuote : undefined,
      source: 'Auto'
    };
  }

  return {
    type: 'Ação',
    assetClass: 'Ação',
    ticker: clean,
    name: `${clean} S.A.`,
    sector: 'Outros',
    subsector: 'Diversos',
    segment: 'Ações B3',
    issuer: `${clean} S.A.`,
    marketCap: 5000,
    dailyLiquidity: 15000000,
    pl: 10.0,
    pvp: 1.2,
    roe: 15.0,
    roic: 12.0,
    netMargin: 10.0,
    ebitdaMargin: 20.0,
    revenueCagr5y: 8.0,
    profitCagr5y: 8.0,
    netDebtOverEbitda: 1.5,
    dividendYield: 6.0,
    payout: 50,
    lpa: liveQuote && liveQuote > 0 ? Number((liveQuote / 10).toFixed(2)) : 2.50,
    vpa: liveQuote && liveQuote > 0 ? Number((liveQuote / 1.2).toFixed(2)) : 20.00,
    description: 'Empresa listada na B3.',
    lastPrice: liveQuote && liveQuote > 0 ? liveQuote : undefined,
    source: 'Auto'
  };
}
