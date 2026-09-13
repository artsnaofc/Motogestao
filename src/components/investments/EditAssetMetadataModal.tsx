import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Save, 
  Building2, 
  FileText, 
  Layers, 
  Tag, 
  Search, 
  Check, 
  Sparkles,
  Briefcase,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCnpj, fetchCnpjOnline, isValidCnpj } from '../../lib/cnpjUtils';
import { useInvestments } from '../../contexts/InvestmentsContext';
import { useData } from '../../contexts/DataContext';

interface EditAssetMetadataModalProps {
  isOpen?: boolean;
  onClose: () => void;
  ticker: string;
  initialType?: string;
  onSaved?: () => void;
}

const COMMON_SECTORS = [
  'Financeiro',
  'Utilidade Pública',
  'Bens Industriais',
  'Consumo Cíclico',
  'Consumo Não Cíclico',
  'Materiais Básicos',
  'Petróleo, Gás e Biocombustíveis',
  'Saúde',
  'Tecnologia da Informação',
  'Imobiliário',
  'Comunicações'
];

const COMMON_SEGMENTS = [
  'Bancos',
  'Seguradoras',
  'Energia Elétrica',
  'Saneamento',
  'Logística',
  'Shopping Centers',
  'Lajes Corporativas',
  'Papel e Celulose',
  'Mineração',
  'Siderurgia',
  'Varejo',
  'Construção Civil',
  'Serviços Médicos',
  'Petróleo e Gás',
  'Crédito Imobiliário (CRIs)',
  'Fiagro / Agronegócio',
  'Fundos de Fundos (FOF)'
];

const FII_TYPES = ['Tijolo', 'Papel', 'FOF', 'Híbrido', 'Fiagro', 'Infra', 'Outros'];

export const EditAssetMetadataModal: React.FC<EditAssetMetadataModalProps> = ({
  isOpen = true,
  onClose,
  ticker,
  initialType,
  onSaved
}) => {
  const { b3AssetsMetadata, saveAssetMetadata } = useInvestments();
  const { settings, updateAssetCnpj } = useData();

  const [cleanTicker, setCleanTicker] = useState('');
  const [assetType, setAssetType] = useState<string>('Ação');
  const [cnpj, setCnpj] = useState('');
  const [sector, setSector] = useState('');
  const [subsector, setSubsector] = useState('');
  const [segment, setSegment] = useState('');
  const [fiiType, setFiiType] = useState('Tijolo');
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !ticker) return;

    const tk = ticker.toUpperCase().trim();
    setCleanTicker(tk);

    // Look up existing metadata
    const meta = b3AssetsMetadata[tk] || {};
    const existingCnpj = settings?.asset_cnpjs?.[tk] || meta.cnpj || '';

    setCnpj(existingCnpj ? formatCnpj(existingCnpj) : '');
    const detectedType = initialType || meta.asset_type || (tk.endsWith('11') ? 'FII' : 'Ação');
    setAssetType(detectedType);

    setSector(meta.sector || meta.fii_segment || '');
    setSubsector(meta.subsector || '');
    setSegment(meta.segment || meta.fii_segment || '');
    setFiiType(meta.fii_type || meta.fiiType || 'Tijolo');
  }, [isOpen, ticker, b3AssetsMetadata, settings, initialType]);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(formatCnpj(e.target.value));
  };

  const handleFetchOnlineCnpj = async () => {
    if (!cleanTicker) return;
    setIsSearchingCnpj(true);
    try {
      const found = await fetchCnpjOnline(cleanTicker);
      if (found) {
        setCnpj(formatCnpj(found));
        toast.success(`CNPJ encontrado para ${cleanTicker}: ${found}`);
      } else {
        toast.error(`Não foi possível encontrar automaticamente o CNPJ de ${cleanTicker}. Por favor digite manualmente.`);
      }
    } catch (e) {
      toast.error('Erro ao buscar CNPJ online.');
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanTicker) {
      toast.error('Ticker inválido');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanCnpjVal = cnpj.replace(/\D/g, '');

      // 1. Save CNPJ to user settings
      if (cleanCnpjVal) {
        await updateAssetCnpj(cleanTicker, cnpj);
      }

      // 2. Save complete metadata row
      const existingMeta = b3AssetsMetadata[cleanTicker] || {};
      const updatedMeta = {
        ...existingMeta,
        ticker: cleanTicker,
        cnpj: cnpj || existingMeta.cnpj || null,
        asset_type: assetType,
        sector: sector.trim() || existingMeta.sector || 'Outros',
        subsector: subsector.trim() || existingMeta.subsector || 'Diversos',
        segment: segment.trim() || existingMeta.segment || 'Geral',
        fii_segment: segment.trim() || sector.trim() || existingMeta.fii_segment || 'Geral',
        fii_type: assetType === 'FII' ? fiiType : (existingMeta.fii_type || null),
        updated_at: new Date().toISOString()
      };

      await saveAssetMetadata(updatedMeta, 'ManualEdit');

      toast.success(`Dados do ativo ${cleanTicker} atualizados com sucesso!`);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar metadados do ativo:', err);
      toast.error(`Falha ao salvar: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-card border border-border/60 rounded-3xl shadow-2xl overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black border border-amber-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                  Editar Ativo: <span className="text-primary font-mono">{cleanTicker}</span>
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  CNPJ, Segmento e Setor para Alocações e Relatório Executivo
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Asset Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                <span>Tipo de Ativo</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['Ação', 'FII', 'ETF', 'BDR'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAssetType(t)}
                    className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      assetType === t
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* CNPJ Input & Auto Fetch */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  CNPJ do Ativo / Emissor
                </span>
                <span className="text-[10px] text-muted-foreground">Ex: 00.000.000/0001-00</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cnpj}
                  onChange={handleCnpjChange}
                  placeholder="00.000.000/0001-00"
                  className="flex-1 bg-muted/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleFetchOnlineCnpj}
                  disabled={isSearchingCnpj}
                  className="px-3.5 py-2.5 text-xs font-extrabold rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  title="Buscar CNPJ na CVM / APIs públicas"
                >
                  <Search className={`w-3.5 h-3.5 ${isSearchingCnpj ? 'animate-spin' : ''}`} />
                  <span>{isSearchingCnpj ? 'Buscando...' : 'Buscar'}</span>
                </button>
              </div>
            </div>

            {/* Segmento */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-500" />
                  Segmento de Atuação
                </span>
                <span className="text-[10px] text-muted-foreground">Usado em Gráficos de Alocação</span>
              </label>
              <input
                type="text"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex: Bancos de Varejo, Logística, Galpões Industriais, Shopping"
                className="w-full bg-muted/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all"
              />
              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-1 pt-1">
                {COMMON_SEGMENTS.slice(0, 8).map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => setSegment(seg)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                      segment === seg
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                        : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/70'
                    }`}
                  >
                    {seg}
                  </button>
                ))}
              </div>
            </div>

            {/* Setor Econômico / Tipo de FII */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-sky-500" />
                  {assetType === 'FII' ? 'Tipo de FII & Setor Macro' : 'Setor Econômico'}
                </span>
              </label>
              
              {assetType === 'FII' && (
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {FII_TYPES.map((ft) => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => {
                        setFiiType(ft);
                        if (!sector) setSector(`FII - ${ft}`);
                      }}
                      className={`py-1.5 text-[10.5px] font-black rounded-lg border transition-all cursor-pointer ${
                        fiiType === ft
                          ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/40'
                          : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/70'
                      }`}
                    >
                      {ft}
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ex: Financeiro, Utilidade Pública, Bens Industriais, Imobiliário"
                className="w-full bg-muted/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {COMMON_SECTORS.slice(0, 7).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSector(sec)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                      sector === sec
                        ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/40'
                        : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/70'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            </div>

            {/* Subsetor */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-purple-500" />
                  Subsetor (Opcional)
                </span>
              </label>
              <input
                type="text"
                value={subsector}
                onChange={(e) => setSubsector(e.target.value)}
                placeholder="Ex: Bancos, Seguros, Energia Elétrica, Transmissão"
                className="w-full bg-muted/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all"
              />
            </div>

            {/* Info hint */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 text-primary font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Atualização nos Relatórios</span>
              </div>
              <p className="leading-relaxed">
                As alterações do CNPJ e Segmento serão salvas e aplicadas instantaneamente aos gráficos da <strong>aba Alocações</strong> e aos diagnósticos do <strong>Relatório Executivo da Carteira</strong>.
              </p>
            </div>

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-extrabold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
