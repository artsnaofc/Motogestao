import React, { useState } from 'react';
import { X, Gauge, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '../lib/toast';

interface OdometerLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (km: number, date: string, notes?: string) => Promise<void>;
  currentKm: number;
}

export const OdometerLogModal: React.FC<OdometerLogModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentKm,
}) => {
  const [km, setKm] = useState<number>(currentKm || 0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (km < currentKm) {
      if (!window.confirm(`O KM informado (${km}) é menor do que o último registro (${currentKm}). Confirma a correção manual de hodômetro?`)) {
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onSave(Number(km), date, notes);
      toast.success('Hodômetro atualizado com sucesso!');
      onClose();
    } catch (err) {
      toast.error('Erro ao atualizar hodômetro');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Atualizar Hodômetro</h3>
              <p className="text-[11px] text-muted-foreground">Registre a quilometragem atualizada da moto</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-muted/20 border border-border/50 rounded-2xl flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Último KM Registrado:</span>
            <strong className="text-foreground font-black text-sm">{currentKm.toLocaleString('pt-BR')} km</strong>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Novo KM Atual *</label>
            <div className="relative mt-1">
              <input
                type="number"
                value={km}
                onChange={e => setKm(Number(e.target.value))}
                className="w-full h-11 pl-10 pr-3 bg-card border border-border rounded-xl text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/30"
                required
              />
              <Gauge className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Data do Registro</label>
            <div className="relative mt-1">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-11 pl-10 pr-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
              />
              <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Observações (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Troca de painel / Verificação mensal"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs text-foreground mt-1"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11 rounded-2xl text-xs font-bold">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 h-11 rounded-2xl text-xs font-bold bg-primary text-primary-foreground">
              {isSubmitting ? 'Salvando...' : 'Confirmar KM'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
