import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  FileText, 
  MoreVertical, 
  Edit, 
  Copy, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  CheckCheck, 
  Bike, 
  Car, 
  Truck, 
  MapPin, 
  DollarSign, 
  ArrowUpRight, 
  Sparkles,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { FreightQuote, FreightQuoteStatus } from '../../types/freight';
import { freightStorage, VEHICLE_PRESETS } from '../../lib/freightStorage';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';

interface FreightQuotesListProps {
  quotes: FreightQuote[];
  onEditQuote: (quote: FreightQuote) => void;
  onOpenWhatsApp: (quote: FreightQuote) => void;
  onOpenProposal: (quote: FreightQuote) => void;
  onQuotesChanged: () => void;
  userId?: string;
}

export function FreightQuotesList({
  quotes,
  onEditQuote,
  onOpenWhatsApp,
  onOpenProposal,
  onQuotesChanged,
  userId = 'default',
}: FreightQuotesListProps) {
  const { refreshData, settings } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [isConverting, setIsConverting] = useState<string | null>(null);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const statusConfig: Record<FreightQuoteStatus, { label: string; bg: string; text: string; icon: any }> = {
    draft: { label: 'Rascunho', bg: 'bg-muted', text: 'text-muted-foreground', icon: Clock },
    pending: { label: 'Aguardando Aprovação', bg: 'bg-amber-500/10 border-amber-500/25', text: 'text-amber-600 dark:text-amber-400', icon: Clock },
    approved: { label: 'Aprovado pelo Cliente', bg: 'bg-indigo-500/10 border-indigo-500/25', text: 'text-indigo-600 dark:text-indigo-400', icon: CheckCircle2 },
    completed: { label: 'Frete Concluído', bg: 'bg-emerald-500/10 border-emerald-500/25', text: 'text-emerald-600 dark:text-emerald-400', icon: CheckCheck },
    rejected: { label: 'Recusado / Cancelado', bg: 'bg-rose-500/10 border-rose-500/25', text: 'text-rose-600 dark:text-rose-400', icon: XCircle },
  };

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const matchSearch =
        q.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.client_company && q.client_company.toLowerCase().includes(searchTerm.toLowerCase())) ||
        q.origin_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.destination_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.cargo_description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'all' || q.status === statusFilter;
      const matchVehicle = vehicleFilter === 'all' || q.vehicle_type === vehicleFilter;

      return matchSearch && matchStatus && matchVehicle;
    });
  }, [quotes, searchTerm, statusFilter, vehicleFilter]);

  const handleStatusChange = (quote: FreightQuote, newStatus: FreightQuoteStatus) => {
    freightStorage.updateQuoteStatus(quote.id, newStatus, userId);
    toast.success(`Status de ${quote.code} atualizado para ${statusConfig[newStatus].label}.`);
    onQuotesChanged();
  };

  const handleDelete = (id: string, code: string) => {
    if (window.confirm(`Deseja realmente excluir o orçamento ${code}?`)) {
      freightStorage.deleteQuote(id, userId);
      toast.success(`Orçamento ${code} removido.`);
      onQuotesChanged();
    }
  };

  const handleDuplicate = (quote: FreightQuote) => {
    const nextCode = freightStorage.generateNextCode(userId);
    const duplicated: FreightQuote = {
      ...quote,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `frt_${Date.now()}`,
      code: nextCode,
      created_at: new Date().toISOString(),
      status: 'draft',
      converted_to_transaction_id: undefined,
      converted_at: undefined,
    };

    freightStorage.saveQuote(duplicated, userId);
    toast.success(`Orçamento duplicado como ${nextCode}!`);
    onQuotesChanged();
  };

  // Convert Quote into Financial Income Transaction in Supabase
  const handleConvertToTransaction = async (quote: FreightQuote) => {
    try {
      setIsConverting(quote.id);
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id || quote.user_id;

      // Choose preferred income category
      const incomeCategory = 
        settings?.income_categories?.find(c => c.toLowerCase().includes('frete') || c.toLowerCase().includes('entrega')) ||
        'Fretes e Corridas';

      const transactionPayload = {
        user_id: currentUserId,
        type: 'income' as const,
        amount: quote.total_price,
        date: quote.scheduled_date || new Date().toISOString().split('T')[0],
        category: incomeCategory,
        description: `Frete ${quote.code} - ${quote.client_name} (${quote.origin_neighborhood || 'Origem'} ➔ ${quote.destination_neighborhood || 'Destino'})`,
        notes: `Gerado automaticamente pelo Orçamento de Frete ${quote.code}.\nDistância: ${quote.total_calculated_km.toFixed(1)} km.\nCarga: ${quote.cargo_description}.`,
      };

      const { data, error } = await supabase
        .from('transactions')
        .insert([transactionPayload])
        .select()
        .single();

      if (error) {
        console.warn('Erro ao inserir no Supabase (utilizando fallback offline):', error);
      }

      // Mark quote as completed and converted
      const updatedQuote: FreightQuote = {
        ...quote,
        status: 'completed',
        converted_to_transaction_id: data?.id || `local_tx_${Date.now()}`,
        converted_at: new Date().toISOString(),
      };

      freightStorage.saveQuote(updatedQuote, userId);
      await refreshData(true);
      toast.success(`Receita de ${formatBRL(quote.total_price)} lançada no caixa com sucesso!`, {
        description: `Transação vinculada ao orçamento ${quote.code}.`,
      });
      onQuotesChanged();
    } catch (e: any) {
      toast.error('Erro ao converter em receita: ' + (e.message || 'Falha desconhecida'));
    } finally {
      setIsConverting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, código, endereço ou mercadoria..."
            className="rounded-2xl pl-10 h-10 text-xs bg-card border-border/70 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-2xl h-10 text-xs bg-card border-border/70 min-w-[140px]">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pending">Aguardando</SelectItem>
              <SelectItem value="approved">Aprovados</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="draft">Rascunhos</SelectItem>
              <SelectItem value="rejected">Recusados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="rounded-2xl h-10 text-xs bg-card border-border/70 min-w-[130px]">
              <SelectValue placeholder="Veículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Veículos</SelectItem>
              <SelectItem value="moto">Moto</SelectItem>
              <SelectItem value="fiorino">Fiorino</SelectItem>
              <SelectItem value="carro">Carro</SelectItem>
              <SelectItem value="van">Van</SelectItem>
              <SelectItem value="caminhao">Caminhão</SelectItem>
              <SelectItem value="bike">Bike</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* QUOTES LIST */}
      {filteredQuotes.length === 0 ? (
        <Card className="border-border/60 bg-muted/10 rounded-3xl p-8 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-muted/40 text-muted-foreground mx-auto flex items-center justify-center">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Nenhum orçamento encontrado</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all'
              ? 'Tente alterar os termos de busca ou filtros selecionados.'
              : 'Clique em "Novo Orçamento" para gerar sua primeira proposta de frete profissional.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredQuotes.map((quote) => {
            const statusInfo = statusConfig[quote.status] || statusConfig.pending;
            const StatusIcon = statusInfo.icon;
            const vehicleInfo = freightStorage.getVehicleInfo(quote, userId);

            return (
              <Card
                key={quote.id}
                className="border-border/60 bg-card/85 hover:border-border transition-all shadow-2xs hover:shadow-xs rounded-3xl overflow-hidden group"
              >
                <CardContent className="p-4 sm:p-5 space-y-3">
                  {/* Top Bar: Code, Status & Price */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        {vehicleInfo.iconName === 'Car' ? (
                          <Car className="w-4 h-4" />
                        ) : vehicleInfo.iconName === 'Truck' ? (
                          <Truck className="w-4 h-4" />
                        ) : (
                          <Bike className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-foreground tracking-tight">{quote.code}</span>
                          <div className={`px-2 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 ${statusInfo.bg} ${statusInfo.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Criado em {new Date(quote.created_at).toLocaleDateString('pt-BR')} • {quote.vehicle_label || vehicleInfo.label}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block font-bold uppercase">Valor do Frete</span>
                        <span className="text-base font-black text-primary">{formatBRL(quote.total_price)}</span>
                      </div>

                      {/* Dropdown Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl cursor-pointer">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl text-xs w-48">
                          <DropdownMenuItem onClick={() => onOpenWhatsApp(quote)} className="gap-2 cursor-pointer">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                            Enviar no WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onOpenProposal(quote)} className="gap-2 cursor-pointer">
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            Imprimir Proposta PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEditQuote(quote)} className="gap-2 cursor-pointer">
                            <Edit className="w-3.5 h-3.5 text-primary" />
                            Editar Orçamento
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(quote)} className="gap-2 cursor-pointer">
                            <Copy className="w-3.5 h-3.5 text-amber-500" />
                            Duplicar Orçamento
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <div className="px-2 py-1 text-[10px] font-black uppercase text-muted-foreground">
                            Alterar Status:
                          </div>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, 'pending')} className="gap-2 cursor-pointer">
                            <Clock className="w-3.5 h-3.5 text-amber-500" /> Marcar Aguardando
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, 'approved')} className="gap-2 cursor-pointer">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Marcar Aprovado
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, 'completed')} className="gap-2 cursor-pointer">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> Marcar Concluído
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, 'rejected')} className="gap-2 cursor-pointer text-rose-500">
                            <XCircle className="w-3.5 h-3.5" /> Marcar Cancelado
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem onClick={() => handleDelete(quote.id, quote.code)} className="gap-2 cursor-pointer text-rose-600 dark:text-rose-400">
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir Registro
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Middle Info: Client, Route & Cargo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Cliente</span>
                      <p className="font-bold text-foreground truncate">{quote.client_name}</p>
                      {quote.client_phone && (
                        <p className="text-[11px] text-muted-foreground">{quote.client_phone}</p>
                      )}
                    </div>

                    <div className="space-y-0.5 sm:col-span-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-primary" />
                        Itinerário ({quote.total_calculated_km.toFixed(1)} km {quote.is_round_trip ? 'Ida e Volta' : ''})
                      </span>
                      <p className="text-[11px] text-foreground truncate">
                        <span className="text-emerald-500 font-bold">Origem:</span> {quote.origin_address}
                      </p>
                      <p className="text-[11px] text-foreground truncate">
                        <span className="text-rose-500 font-bold">Destino:</span> {quote.destination_address}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Lucro Líquido: {formatBRL(quote.driver_net_profit)} ({quote.profit_margin_percent.toFixed(0)}%)
                      </span>
                      {quote.converted_to_transaction_id && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                          ✓ Lançado no Caixa
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* One-click convert to income */}
                      {!quote.converted_to_transaction_id && (quote.status === 'approved' || quote.status === 'completed') && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleConvertToTransaction(quote)}
                          disabled={isConverting === quote.id}
                          className="rounded-xl h-8 text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-xs"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Lançar no Caixa
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenWhatsApp(quote)}
                        className="rounded-xl h-8 text-[11px] font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WhatsApp
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenProposal(quote)}
                        className="rounded-xl h-8 text-[11px] font-bold border-border hover:bg-muted gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
