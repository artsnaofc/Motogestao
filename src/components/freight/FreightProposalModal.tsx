import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, MapPin, Calendar, Clock, Bike, Car, Truck, CheckCircle2, Shield, QrCode, Phone, Mail } from 'lucide-react';
import { FreightQuote } from '../../types/freight';
import { VEHICLE_PRESETS } from '../../lib/freightStorage';

interface FreightProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: FreightQuote | null;
}

export function FreightProposalModal({ open, onOpenChange, quote }: FreightProposalModalProps) {
  const printableRef = useRef<HTMLDivElement>(null);

  if (!quote) return null;

  const vehicleInfo = VEHICLE_PRESETS[quote.vehicle_type] || {
    label: quote.vehicle_type,
    maxWeight: 'Padrão',
    desc: 'Transporte dedicado',
  };

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const handlePrint = () => {
    window.print();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl p-0 overflow-hidden rounded-3xl border-border bg-card max-h-[85vh] sm:max-h-[90vh] flex flex-col">
        {/* Modal Header Controls (Hidden during print) */}
        <DialogHeader className="p-4 sm:p-6 bg-muted/30 border-b border-border/60 print:hidden flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              Proposta Comercial Formal
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {quote.code}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Documento pronto para impressão ou envio em PDF para empresas e clientes.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrint}
              className="rounded-2xl h-10 px-4 font-extrabold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Proposal Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-background text-foreground space-y-8 print:p-0 print:space-y-6" ref={printableRef}>
          {/* Header & Logo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b-2 border-border/80">
            <div className="flex items-center gap-3.5">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-foreground shadow-md shrink-0">
                {quote.vehicle_type === 'fiorino' || quote.vehicle_type === 'carro' ? (
                  <Car className="w-7 h-7" />
                ) : quote.vehicle_type === 'van' || quote.vehicle_type === 'caminhao' ? (
                  <Truck className="w-7 h-7" />
                ) : (
                  <Bike className="w-7 h-7" />
                )}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  {quote.driver_company || quote.driver_name || 'Transportes & Logística'}
                </h1>
                <p className="text-xs text-muted-foreground font-semibold">
                  Soluções Ágeis de Entrega e Frete Dedicado
                </p>
                {quote.driver_document && (
                  <p className="text-[11px] text-muted-foreground">
                    CNPJ/CPF: {quote.driver_document}
                  </p>
                )}
              </div>
            </div>

            <div className="sm:text-right space-y-1 bg-muted/20 sm:bg-transparent p-4 sm:p-0 rounded-2xl border sm:border-0 border-border/50">
              <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary font-black text-xs border border-primary/20">
                ORÇAMENTO DE FRETE
              </div>
              <p className="text-sm font-black text-foreground pt-1">{quote.code}</p>
              <p className="text-xs text-muted-foreground">
                Emissão: {new Date(quote.created_at).toLocaleDateString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                Validade: até {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('pt-BR') : '48 horas'}
              </p>
            </div>
          </div>

          {/* Parties: Client & Transporter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                Dados do Cliente
              </span>
              <p className="text-sm font-black text-foreground">{quote.client_name || 'Não informado'}</p>
              {quote.client_company && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                  {quote.client_company}
                </p>
              )}
              {quote.client_phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" /> {quote.client_phone}
                </p>
              )}
              {quote.client_email && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" /> {quote.client_email}
                </p>
              )}
              {quote.client_document && (
                <p className="text-xs text-muted-foreground">
                  Doc: {quote.client_document}
                </p>
              )}
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                Transportador Responsável
              </span>
              <p className="text-sm font-black text-foreground">{quote.driver_name || 'Profissional Autônomo'}</p>
              {quote.driver_phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" /> {quote.driver_phone}
                </p>
              )}
              <div className="pt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="px-2 py-0.5 rounded-lg bg-background border border-border font-bold">
                  {vehicleInfo.label}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-background border border-border">
                  Capacidade: {vehicleInfo.maxWeight}
                </span>
              </div>
            </div>
          </div>

          {/* Route & Cargo Details */}
          <div className="p-5 sm:p-6 rounded-2xl border border-border/80 bg-card/60 space-y-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Especificações do Itinerário & Carga
              </h3>
              <span className="text-xs font-black text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                {quote.total_calculated_km.toFixed(1)} KM {quote.is_round_trip ? '(Ida e Volta)' : '(Apenas Ida)'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 shrink-0 ring-4 ring-emerald-500/20" />
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Ponto de Coleta</span>
                    <p className="text-xs font-bold text-foreground leading-snug">{quote.origin_address}</p>
                    {quote.origin_neighborhood && <p className="text-[11px] text-muted-foreground">{quote.origin_neighborhood}</p>}
                  </div>
                </div>

                {quote.additional_stops && quote.additional_stops.length > 0 && (
                  <div className="pl-6 space-y-2 border-l-2 border-dashed border-border ml-1.5 my-2">
                    {quote.additional_stops.map((stop, idx) => (
                      <div key={stop.id || idx} className="text-xs">
                        <span className="text-[10px] font-bold text-amber-500 uppercase">Parada {idx + 1}</span>
                        <p className="font-semibold text-foreground text-[11px]">{stop.address}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-start gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 shrink-0 ring-4 ring-rose-500/20" />
                  <div>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Ponto de Entrega Final</span>
                    <p className="text-xs font-bold text-foreground leading-snug">{quote.destination_address}</p>
                    {quote.destination_neighborhood && <p className="text-[11px] text-muted-foreground">{quote.destination_neighborhood}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 bg-muted/20 p-4 rounded-xl border border-border/50 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Descrição da Mercadoria</span>
                  <p className="font-bold text-foreground">{quote.cargo_description || 'Volumes padrões para transporte'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-[11px]">
                  {quote.cargo_weight_kg ? (
                    <div>
                      <span className="text-muted-foreground block">Peso Estimado:</span>
                      <strong className="text-foreground">{quote.cargo_weight_kg} kg</strong>
                    </div>
                  ) : null}
                  {quote.cargo_value ? (
                    <div>
                      <span className="text-muted-foreground block">Valor Declarado:</span>
                      <strong className="text-foreground">{formatBRL(quote.cargo_value)}</strong>
                    </div>
                  ) : null}
                  {quote.scheduled_date ? (
                    <div>
                      <span className="text-muted-foreground block">Data Prevista:</span>
                      <strong className="text-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-primary" />
                        {new Date(quote.scheduled_date).toLocaleDateString('pt-BR')}
                      </strong>
                    </div>
                  ) : null}
                  {quote.scheduled_time ? (
                    <div>
                      <span className="text-muted-foreground block">Horário Previsto:</span>
                      <strong className="text-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" />
                        {quote.scheduled_time}
                      </strong>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Itemization Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-foreground">Discriminação de Valores e Serviços</h3>
            <div className="overflow-x-auto rounded-2xl border border-border/80">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-muted-foreground font-bold">
                    <th className="p-3 text-left">Item / Descrição</th>
                    <th className="p-3 text-center">Referência</th>
                    <th className="p-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="p-3 font-semibold text-foreground">Taxa Base de Saída / Disponibilidade de Frota</td>
                    <td className="p-3 text-center text-muted-foreground">Fixo</td>
                    <td className="p-3 text-right font-medium">{formatBRL(quote.base_fee)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-foreground">Quilometragem Rodada ({quote.total_calculated_km.toFixed(1)} km × {formatBRL(quote.price_per_km)}/km)</td>
                    <td className="p-3 text-center text-muted-foreground">{quote.total_calculated_km.toFixed(1)} km</td>
                    <td className="p-3 text-right font-medium">{formatBRL(quote.total_calculated_km * quote.price_per_km)}</td>
                  </tr>
                  {quote.extra_stops_fee > 0 && (
                    <tr>
                      <td className="p-3 font-semibold text-foreground">Paradas Adicionais no Percurso</td>
                      <td className="p-3 text-center text-muted-foreground">{quote.additional_stops?.length || 1} parada(s)</td>
                      <td className="p-3 text-right font-medium">{formatBRL(quote.extra_stops_fee)}</td>
                    </tr>
                  )}
                  {quote.heavy_cargo_fee > 0 && (
                    <tr>
                      <td className="p-3 font-semibold text-foreground">Adicional de Peso / Ajudante para Carga e Descarga</td>
                      <td className="p-3 text-center text-muted-foreground">Especial</td>
                      <td className="p-3 text-right font-medium">{formatBRL(quote.heavy_cargo_fee)}</td>
                    </tr>
                  )}
                  {quote.stairs_floor_fee > 0 && (
                    <tr>
                      <td className="p-3 font-semibold text-foreground">Subida de Escadas / Acesso Especial</td>
                      <td className="p-3 text-center text-muted-foreground">Serviço</td>
                      <td className="p-3 text-right font-medium">{formatBRL(quote.stairs_floor_fee)}</td>
                    </tr>
                  )}
                  {quote.urgent_or_rain_fee > 0 && (
                    <tr>
                      <td className="p-3 font-semibold text-foreground">Adicional de Urgência Imediata</td>
                      <td className="p-3 text-center text-muted-foreground">Prioritário</td>
                      <td className="p-3 text-right font-medium">{formatBRL(quote.urgent_or_rain_fee)}</td>
                    </tr>
                  )}
                  {quote.night_fee > 0 && (
                    <tr>
                      <td className="p-3 font-semibold text-foreground">Adicional de Horário Noturno / Madrugada</td>
                      <td className="p-3 text-center text-muted-foreground">Noturno</td>
                      <td className="p-3 text-right font-medium">{formatBRL(quote.night_fee)}</td>
                    </tr>
                  )}
                  {quote.tolls_fee > 0 && (
                    <tr>
                      <td className="p-3 font-semibold text-foreground">Reembolso de Tarifas de Pedágio</td>
                      <td className="p-3 text-center text-muted-foreground">Tarifas</td>
                      <td className="p-3 text-right font-medium">{formatBRL(quote.tolls_fee)}</td>
                    </tr>
                  )}
                  {quote.waiting_hours_fee > 0 && (
                    <tr>
                      <td className="p-3 font-semibold text-foreground">Tempo de Espera Excedente Contratado</td>
                      <td className="p-3 text-center text-muted-foreground">Horas</td>
                      <td className="p-3 text-right font-medium">{formatBRL(quote.waiting_hours_fee)}</td>
                    </tr>
                  )}
                  {quote.discount > 0 && (
                    <tr className="text-emerald-600 dark:text-emerald-400">
                      <td className="p-3 font-bold">Desconto Comercial Aplicado</td>
                      <td className="p-3 text-center font-bold">Desconto</td>
                      <td className="p-3 text-right font-bold">- {formatBRL(quote.discount)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-primary/10 border-t-2 border-primary/30">
                    <td colSpan={2} className="p-4 text-sm font-black text-foreground">
                      VALOR TOTAL DO SERVIÇO DE FRETE:
                    </td>
                    <td className="p-4 text-right text-base sm:text-lg font-black text-primary">
                      {formatBRL(quote.total_price)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment & Bank Details */}
          <div className="p-5 sm:p-6 rounded-2xl bg-muted/30 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                Condições de Pagamento
              </span>
              <p className="text-sm font-black text-foreground">
                {paymentLabels[quote.payment_method] || quote.payment_method}
              </p>
              {quote.pix_key && (
                <div className="flex items-center gap-2 pt-1">
                  <QrCode className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-mono font-bold bg-background px-2.5 py-1 rounded-lg border border-border">
                    PIX ({quote.pix_key_type.toUpperCase()}): {quote.pix_key}
                  </span>
                </div>
              )}
            </div>

            <div className="sm:text-right space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:justify-end">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span>Transporte Seguro & Rastreável</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Para confirmação e emissão de recibo, apresente este comprovante.
              </p>
            </div>
          </div>

          {/* Terms & Conditions */}
          {quote.terms_and_conditions && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                Termos & Observações Gerais
              </h4>
              <div className="p-4 rounded-xl bg-muted/15 border border-border/60 text-[11px] text-muted-foreground whitespace-pre-line leading-relaxed">
                {quote.terms_and_conditions}
                {quote.observations ? `\n\nNotas adicionais: ${quote.observations}` : ''}
              </div>
            </div>
          )}

          {/* Signatures Footer */}
          <div className="pt-8 border-t border-border/80 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-1">
              <div className="border-b border-border/80 pb-6 mb-1" />
              <p className="font-bold text-foreground">{quote.driver_name || 'Transportador'}</p>
              <p className="text-[10px] text-muted-foreground">Assinatura do Prestador</p>
            </div>
            <div className="space-y-1">
              <div className="border-b border-border/80 pb-6 mb-1" />
              <p className="font-bold text-foreground">{quote.client_name || 'Cliente Contratante'}</p>
              <p className="text-[10px] text-muted-foreground">Aceite e Autorização</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
