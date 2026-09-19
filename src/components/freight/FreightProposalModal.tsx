import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Printer, 
  Download, 
  Share2, 
  MapPin, 
  Calendar, 
  Clock, 
  Bike, 
  Car, 
  Truck, 
  CheckCircle2, 
  ShieldCheck, 
  QrCode, 
  Phone, 
  Mail,
  Loader2,
  FileText,
  FileCheck2,
  Info,
  Maximize2,
  Sparkles
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { FreightQuote } from '../../types/freight';
import { freightStorage } from '../../lib/freightStorage';
import { downloadFreightQuotePDF, shareFreightQuotePDF } from '../../lib/freightPdfGenerator';

interface FreightProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: FreightQuote | null;
}

const serviceLabels: Record<string, string> = {
  express: 'Express / Urgente (Direto)',
  agendado: 'Agendado com Data/Hora Fixa',
  dedicado: 'Transporte Dedicado Exclusivo',
  fracionado: 'Fracionado / Coleta Programada',
};

export function FreightProposalModal({ open, onOpenChange, quote }: FreightProposalModalProps) {
  const printableRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);

  if (!quote) return null;

  const vehicleInfo = freightStorage.getVehicleInfo(quote, quote.user_id || 'default');

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPdf(true);
      await downloadFreightQuotePDF(quote, quote.user_id || 'default');
      toast.success(`PDF do orçamento ${quote.code} gerado e baixado com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar arquivo PDF: ' + (error?.message || 'Tente novamente.'));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSharePDF = async () => {
    try {
      setIsSharingPdf(true);
      const shared = await shareFreightQuotePDF(quote, quote.user_id || 'default');
      if (shared) {
        toast.success(`Proposta comercial em PDF (${quote.code}) pronta para envio!`);
      }
    } catch (error: any) {
      console.error('Erro ao compartilhar PDF:', error);
      toast.error('Erro ao compartilhar: ' + (error?.message || 'Tente novamente.'));
    } finally {
      setIsSharingPdf(false);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      handleDownloadPDF();
    }
  };

  const paymentLabels: Record<string, string> = {
    pix: 'PIX (À Vista / Chave Direta)',
    dinheiro: 'Dinheiro na Entrega',
    cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito',
    faturado_15d: 'Faturado 15 Dias (Boleto/Transferência)',
    faturado_30d: 'Faturado 30 Dias (Boleto/Transferência)',
    '50_50': '50% no Carregamento + 50% na Entrega',
  };

  // Build itemization list
  const tableRows: Array<{ label: string; ref: string; value: number; isDiscount?: boolean }> = [
    {
      label: 'Taxa Base de Saída e Disponibilidade de Veículo',
      ref: 'Taxa Fixa',
      value: quote.base_fee,
    },
    {
      label: `Deslocamento Quilométrico (${quote.total_calculated_km.toFixed(1)} km × ${formatBRL(quote.price_per_km)}/km)`,
      ref: `${quote.total_calculated_km.toFixed(1)} km`,
      value: quote.total_calculated_km * quote.price_per_km,
    },
  ];

  if (quote.extra_stops_fee > 0) {
    tableRows.push({
      label: 'Paradas Intermediárias Adicionais',
      ref: `${quote.additional_stops?.length || 1} parada(s)`,
      value: quote.extra_stops_fee,
    });
  }

  if (quote.heavy_cargo_fee > 0) {
    tableRows.push({
      label: 'Adicional de Carga Especial / Ajudante Carga e Descarga',
      ref: 'Adicional',
      value: quote.heavy_cargo_fee,
    });
  }

  if (quote.stairs_floor_fee > 0) {
    tableRows.push({
      label: 'Subida / Descida de Escadas e Acesso Difícil',
      ref: 'Serviço',
      value: quote.stairs_floor_fee,
    });
  }

  if (quote.urgent_or_rain_fee > 0) {
    tableRows.push({
      label: 'Adicional de Urgência Imediata / Condições Adversas',
      ref: 'Prioritário',
      value: quote.urgent_or_rain_fee,
    });
  }

  if (quote.night_fee > 0) {
    tableRows.push({
      label: 'Adicional de Horário Noturno / Madrugada',
      ref: 'Noturno',
      value: quote.night_fee,
    });
  }

  if (quote.tolls_fee > 0) {
    tableRows.push({
      label: 'Reembolso de Tarifas de Pedágio no Trajeto',
      ref: 'Tarifas',
      value: quote.tolls_fee,
    });
  }

  if (quote.waiting_hours_fee > 0) {
    tableRows.push({
      label: 'Tempo de Espera no Ponto Contratado',
      ref: 'Horas',
      value: quote.waiting_hours_fee,
    });
  }

  if (quote.discount > 0) {
    tableRows.push({
      label: 'Desconto Comercial Aplicado',
      ref: 'Bonificação',
      value: quote.discount,
      isDiscount: true,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[96vw] sm:max-w-4xl p-0 overflow-hidden rounded-3xl border-border bg-card max-h-[92vh] flex flex-col shadow-2xl"
        aria-describedby="proposal-modal-desc"
      >
        {/* Modal Header Controls */}
        <DialogHeader className="px-4 py-3.5 sm:px-6 sm:py-4 bg-muted/40 border-b border-border/80 print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground">
                  Proposta Comercial Formal
                </DialogTitle>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-600/20">
                  {quote.code}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground hidden xs:inline-block">
                  A4 Vetorial
                </span>
              </div>
              <DialogDescription id="proposal-modal-desc" className="text-xs text-muted-foreground mt-0.5">
                Layout de visualização fiel ao documento oficial em PDF gerado.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSharePDF}
              disabled={isSharingPdf || isGeneratingPdf}
              className="rounded-xl h-9 px-3 font-bold text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 cursor-pointer"
              title="Compartilhar PDF por WhatsApp ou aplicativos"
            >
              {isSharingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden xs:inline">Compartilhar</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf || isSharingPdf}
              className="rounded-xl h-9 px-3.5 font-black text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5 cursor-pointer"
              title="Baixar arquivo PDF de alta definição"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Baixar PDF</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl h-9 px-2.5 font-bold text-xs text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1 cursor-pointer"
              title="Imprimir documento"
            >
              <Printer className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Outer Scroll Area with Neutral Backdrop (PDF Desk style) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-muted/30 dark:bg-zinc-950/60 print:p-0">
          
          {/* Exact A4 Document Sheet Wrapper */}
          <div 
            ref={printableRef}
            className="max-w-[780px] mx-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden print:shadow-none print:border-0 print:rounded-0 font-sans p-5 sm:p-8 space-y-5 sm:space-y-6"
          >
            {/* 1. TOP HEADER & BRANDING BAR (Navy / Slate Header Matching PDF) */}
            <div className="bg-[#0f172a] text-white rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
              
              <div className="space-y-1 z-10">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                    {vehicleInfo.iconName === 'Car' ? (
                      <Car className="w-4 h-4" />
                    ) : vehicleInfo.iconName === 'Truck' ? (
                      <Truck className="w-4 h-4" />
                    ) : (
                      <Bike className="w-4 h-4" />
                    )}
                  </div>
                  <h1 className="text-lg sm:text-xl font-black tracking-tight text-white leading-tight">
                    {quote.driver_company || quote.driver_name || 'Transportes & Logística'}
                  </h1>
                </div>
                <p className="text-xs text-slate-300 font-medium pl-10">
                  {quote.driver_document 
                    ? `Soluções em Logística e Transporte | CNPJ/CPF: ${quote.driver_document}`
                    : 'Soluções Ágeis em Frete Dedicado e Entregas Expressas'}
                </p>
                {quote.driver_phone && (
                  <p className="text-[11px] text-slate-400 pl-10 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-indigo-400" />
                    <span>Contato Direto: <strong className="text-slate-200">{quote.driver_phone}</strong></span>
                  </p>
                )}
              </div>

              <div className="bg-[#1665C0] text-white px-4 py-3 rounded-xl sm:text-center shrink-0 shadow-sm border border-blue-400/30 z-10">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-100 block">
                  ORÇAMENTO DE FRETE
                </span>
                <span className="text-base font-black tracking-tight block py-0.5">
                  {quote.code}
                </span>
                <span className="text-[10px] text-blue-100 font-medium block">
                  Emissão: {formatDate(quote.created_at)}
                </span>
              </div>
            </div>

            {/* 2. CLIENT & TRANSPORTER INFO CARDS (Matching PDF Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Client Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#1665C0] dark:text-blue-400 flex items-center gap-1">
                  DADOS DO CLIENTE / CONTRATANTE
                </span>
                <p className="text-sm font-black text-slate-900 dark:text-white pt-0.5">
                  {quote.client_name || 'Cliente'}
                </p>
                {quote.client_company && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                    Empresa: {quote.client_company}
                  </p>
                )}
                {quote.client_phone && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#1665C0] shrink-0" />
                    <span>Telefone / WhatsApp: {quote.client_phone}</span>
                  </p>
                )}
                {quote.client_email && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#1665C0] shrink-0" />
                    <span className="truncate">E-mail: {quote.client_email}</span>
                  </p>
                )}
                {quote.client_document && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Documento: {quote.client_document}
                  </p>
                )}
              </div>

              {/* Transporter / Vehicle Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#1665C0] dark:text-blue-400 flex items-center gap-1">
                  PRESTADOR & VEÍCULO DESIGNADO
                </span>
                <p className="text-sm font-black text-slate-900 dark:text-white pt-0.5">
                  {quote.driver_name || 'Profissional Autônomo'}
                </p>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-0.5">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <span>Veículo:</span>
                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold">
                      {vehicleInfo.label}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Capacidade Máxima: <strong className="text-slate-700 dark:text-slate-200">{vehicleInfo.maxWeight || 'Padrão'}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Validade da Proposta: <strong className="text-slate-800 dark:text-slate-200">{quote.valid_until ? `até ${formatDate(quote.valid_until)}` : '48 horas após emissão'}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* 3. ROUTE & CARGO SPECIFICATION (Matching PDF Itinerary Box) */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              {/* Header Bar */}
              <div className="px-4 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#1665C0]" />
                  ITINERÁRIO E DETALHES DO TRANSPORTE
                </span>
                <span className="text-[11px] font-bold text-[#1665C0] dark:text-blue-400 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
                  {quote.total_calculated_km.toFixed(1)} KM {quote.is_round_trip ? '(Ida e Volta)' : '(Apenas Ida)'} • {serviceLabels[quote.service_type] || 'Transporte Direto'}
                </span>
              </div>

              <div className="p-4 space-y-3">
                {/* Origin */}
                <div className="flex items-start gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 mt-0.5 shrink-0 ring-4 ring-emerald-500/20" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                      COLETA (ORIGEM):
                    </span>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {quote.origin_address}
                    </p>
                    {quote.origin_neighborhood && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Bairro: {quote.origin_neighborhood}</p>
                    )}
                  </div>
                </div>

                {/* Additional Stops */}
                {quote.additional_stops && quote.additional_stops.length > 0 && (
                  <div className="pl-6 space-y-2 border-l-2 border-dashed border-slate-300 dark:border-slate-700 ml-1.5 my-1">
                    {quote.additional_stops.map((stop, idx) => (
                      <div key={stop.id || idx} className="text-xs">
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          PARADA {idx + 1}:
                        </span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{stop.address}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Destination */}
                <div className="flex items-start gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-rose-500 mt-0.5 shrink-0 ring-4 ring-rose-500/20" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                      ENTREGA (DESTINO):
                    </span>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {quote.destination_address}
                    </p>
                    {quote.destination_neighborhood && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Bairro: {quote.destination_neighborhood}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Cargo Mini-Bar */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 text-xs">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  <span className="text-slate-500 dark:text-slate-400 font-normal">Carga:</span> {quote.cargo_description || 'Volumes diversos para transporte'}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  {quote.cargo_weight_kg ? (
                    <span>Peso Estimado: <strong className="text-slate-800 dark:text-slate-200">{quote.cargo_weight_kg} kg</strong></span>
                  ) : null}
                  {quote.cargo_value ? (
                    <span>Valor Declarado: <strong className="text-slate-800 dark:text-slate-200">{formatBRL(quote.cargo_value)}</strong></span>
                  ) : null}
                  {quote.scheduled_date ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-indigo-500" />
                      Data: <strong className="text-slate-800 dark:text-slate-200">{formatDate(quote.scheduled_date)}</strong>
                    </span>
                  ) : null}
                  {quote.scheduled_time ? (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      Horário: <strong className="text-slate-800 dark:text-slate-200">{quote.scheduled_time}</strong>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* 4. FINANCIAL DISCRIMINATION TABLE (Exact PDF Layout) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  DISCRIMINAÇÃO DETALHADA DOS VALORES
                </h3>
              </div>

              {/* Scrollable Container with rounded border */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto w-full">
                <table className="w-full text-xs min-w-[520px]">
                  <thead>
                    <tr className="bg-[#0f172a] text-white font-black text-[11px]">
                      <th className="px-3.5 py-2.5 text-left font-black w-[55%]">ITEM / ESPECIFICAÇÃO DO SERVIÇO</th>
                      <th className="px-3.5 py-2.5 text-center font-black w-[20%]">QUANTIDADE / REF.</th>
                      <th className="px-3.5 py-2.5 text-right font-black w-[25%]">VALOR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 bg-white dark:bg-slate-900">
                    {tableRows.map((row, idx) => {
                      const isEven = idx % 2 === 0;
                      return (
                        <tr 
                          key={idx} 
                          className={isEven ? 'bg-slate-50/60 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900'}
                        >
                          <td className={`px-3.5 py-2 text-left font-medium ${row.isDiscount ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>
                            {row.label}
                          </td>
                          <td className={`px-3.5 py-2 text-center text-[11px] ${row.isDiscount ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                            {row.ref}
                          </td>
                          <td className={`px-3.5 py-2 text-right font-bold text-xs whitespace-nowrap ${row.isDiscount ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                            {row.isDiscount ? `- ${formatBRL(row.value)}` : formatBRL(row.value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#1665C0] text-white">
                      <td colSpan={2} className="px-4 py-3 text-xs sm:text-sm font-black tracking-wide">
                        VALOR TOTAL DO SERVIÇO DE FRETE:
                      </td>
                      <td className="px-4 py-3 text-right text-base sm:text-lg font-black tracking-tight text-white whitespace-nowrap">
                        {formatBRL(quote.total_price)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 5. PAYMENT & PIX CONDITIONS (Matching PDF Box) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#1665C0] dark:text-blue-400 block">
                  FORMA DE PAGAMENTO & INFORMAÇÕES BANCÁRIAS
                </span>
                <p className="font-black text-slate-900 dark:text-white">
                  Condição: {paymentLabels[quote.payment_method] || quote.payment_method}
                </p>
                {quote.pix_key && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <QrCode className="w-3.5 h-3.5 text-[#1665C0] shrink-0" />
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[11px]">
                      Chave PIX ({quote.pix_key_type.toUpperCase()}): {quote.pix_key}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 sm:text-right space-y-0.5">
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold sm:justify-end">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Transporte Seguro & Rastreável</span>
                </div>
                <p>Comprovante deve ser enviado após a quitação.</p>
              </div>
            </div>

            {/* 6. TERMS & OBSERVATIONS */}
            {(quote.terms_and_conditions || quote.observations) && (
              <div className="space-y-1.5 pt-1">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  TERMOS E OBSERVAÇÕES
                </h4>
                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                  {quote.terms_and_conditions}
                  {quote.observations ? `\n\nNotas adicionais: ${quote.observations}` : ''}
                </div>
              </div>
            )}

            {/* 7. SIGNATURES & ACCEPTANCE FOOTER (Exact PDF Signatures) */}
            <div className="pt-6 sm:pt-8 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-6 sm:gap-12 text-center text-xs">
              <div className="space-y-1">
                <div className="border-b border-slate-400 dark:border-slate-600 pb-8 mb-1.5" />
                <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{quote.driver_name || 'Transportador Responsável'}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Assinatura do Prestador</p>
              </div>
              <div className="space-y-1">
                <div className="border-b border-slate-400 dark:border-slate-600 pb-8 mb-1.5" />
                <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{quote.client_name || 'Cliente Contratante'}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Aceite e Autorização</p>
              </div>
            </div>

            {/* Document Footer Watermark */}
            <div className="text-center pt-2 text-[10px] text-slate-400 dark:text-slate-500">
              Documento gerado eletronicamente • Proposta comercial sujeita a confirmação de agendamento.
            </div>

          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-muted/40 border-t border-border/80 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${
              quote.status === 'approved' 
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' 
                : quote.status === 'completed'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : quote.status === 'rejected'
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}>
              Status: {
                quote.status === 'approved' ? 'Aprovado pelo Cliente' :
                quote.status === 'completed' ? 'Frete Concluído' :
                quote.status === 'rejected' ? 'Cancelado' :
                'Aguardando Aprovação'
              }
            </span>
          </div>

          <div className="flex items-center gap-2">
            {quote.status === 'pending' && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  freightStorage.updateQuoteStatus(quote.id, 'approved', quote.user_id || 'default');
                  toast.success(`Orçamento ${quote.code} marcado como Aprovado pelo Cliente!`);
                  onOpenChange(false);
                }}
                className="rounded-xl h-9 px-4 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aprovar Orçamento
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-9 px-5 text-xs font-bold text-foreground border-border hover:bg-muted cursor-pointer"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

