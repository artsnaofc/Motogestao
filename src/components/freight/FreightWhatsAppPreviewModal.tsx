import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Copy, ExternalLink, Check, Sparkles, Send } from 'lucide-react';
import { toast } from 'sonner';
import { FreightQuote } from '../../types/freight';
import { freightStorage } from '../../lib/freightStorage';

interface FreightWhatsAppPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: FreightQuote | null;
}

export function FreightWhatsAppPreviewModal({ open, onOpenChange, quote }: FreightWhatsAppPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [customText, setCustomText] = useState('');

  React.useEffect(() => {
    if (quote) {
      setCustomText(freightStorage.formatWhatsAppMessage(quote));
      setCopied(false);
    }
  }, [quote]);

  if (!quote) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customText);
      setCopied(true);
      toast.success('Mensagem copiada para a área de transferência!', {
        description: 'Cole no WhatsApp para enviar ao cliente.',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      toast.error('Erro ao copiar texto.');
    }
  };

  const handleOpenWhatsApp = () => {
    const rawPhone = quote.client_phone.replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('55') ? rawPhone : (rawPhone ? `55${rawPhone}` : '');
    const encoded = encodeURIComponent(customText);

    let url = '';
    if (cleanPhone && cleanPhone.length >= 10) {
      url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    } else {
      url = `https://wa.me/?text=${encoded}`;
    }

    window.open(url, '_blank');
    toast.success('Abrindo WhatsApp...');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl p-0 overflow-hidden rounded-3xl border-border bg-card max-h-[85vh] sm:max-h-[90vh] flex flex-col">
        <DialogHeader className="p-5 sm:p-6 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                Enviar via WhatsApp
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  {quote.code}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Revise ou personalize a mensagem antes de disparar para {quote.client_name || 'o cliente'}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                Mensagem Formatada (WhatsApp Markdown):
              </label>
              <span className="text-[10px] text-muted-foreground">
                {quote.client_phone ? `Destino: ${quote.client_phone}` : 'Sem número salvo'}
              </span>
            </div>
            <Textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="min-h-[260px] max-h-[360px] font-mono text-xs leading-relaxed bg-muted/20 border-border/60 rounded-2xl p-4 resize-y focus-visible:ring-emerald-500"
              placeholder="Digite ou edite a mensagem..."
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-3 text-xs text-emerald-700 dark:text-emerald-300">
            <div className="p-1 rounded-lg bg-emerald-500/20 shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="leading-relaxed text-[11px]">
              <strong>Dica de Ouro:</strong> A mensagem inclui todas as informações essenciais (valores, rota, regras de espera e chave PIX), facilitando o fechamento imediato do frete.
            </p>
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-6 bg-muted/10 border-t border-border/60 flex flex-col sm:flex-row gap-2.5 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            className="rounded-2xl h-11 font-bold text-xs border-border hover:bg-muted gap-2 cursor-pointer w-full sm:w-auto"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-muted-foreground" />
                Copiar Mensagem
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={handleOpenWhatsApp}
            className="rounded-2xl h-11 font-extrabold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 gap-2 cursor-pointer w-full sm:w-auto"
          >
            <Send className="w-4 h-4" />
            Abrir WhatsApp
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
