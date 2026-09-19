import React, { useState } from 'react';
import { X, Wrench, Calendar, Gauge, DollarSign, AlertTriangle } from 'lucide-react';
import { MaintenanceType, VehicleMaintenanceRecord } from '../types';
import { Button } from '@/components/ui/button';
import { toast } from '../lib/toast';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<VehicleMaintenanceRecord, 'id' | 'user_id' | 'created_at'>) => Promise<any>;
  vehicleId: string;
  currentKm: number;
}

const MAINTENANCE_TYPES: MaintenanceType[] = [
  'Óleo',
  'Filtro de Óleo',
  'Filtro de Ar',
  'Pneus',
  'Relação',
  'Freios / Pastilhas',
  'Vela',
  'Bateria',
  'Suspensão',
  'Motor',
  'Elétrica',
  'Revisão Geral',
  'Outros',
];

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  vehicleId,
  currentKm,
}) => {
  const [type, setType] = useState<string>('Óleo');
  const [description, setDescription] = useState('');
  const [lastServiceDate, setLastServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [lastServiceKm, setLastServiceKm] = useState<number>(currentKm || 0);
  const [cost, setCost] = useState<number>(0);
  const [workshop, setWorkshop] = useState('');
  const [nextDueKm, setNextDueKm] = useState<number>((currentKm || 0) + 3000);
  const [nextDueDate, setNextDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSave({
        vehicle_id: vehicleId,
        type,
        description: description || `Manutenção de ${type}`,
        last_service_date: lastServiceDate,
        last_service_km: Number(lastServiceKm),
        cost: Number(cost) || 0,
        workshop,
        next_due_km: nextDueKm ? Number(nextDueKm) : undefined,
        next_due_date: nextDueDate || undefined,
        status: 'ok',
        notes,
      });
      toast.success(`Manutenção de ${type} registrada!`);
      onClose();
    } catch (err) {
      toast.error('Erro ao salvar manutenção');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Programar / Registrar Manutenção</h3>
              <p className="text-[11px] text-muted-foreground">Monitore preventivamente componentes da moto</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Tipo de Componente *</label>
            <select
              value={type}
              onChange={e => {
                const val = e.target.value;
                setType(val);
                // Auto calculate default interval
                if (val === 'Óleo') setNextDueKm(Number(lastServiceKm) + 2000);
                else if (val === 'Pneus') setNextDueKm(Number(lastServiceKm) + 15000);
                else if (val === 'Relação') setNextDueKm(Number(lastServiceKm) + 12000);
                else if (val === 'Freios / Pastilhas') setNextDueKm(Number(lastServiceKm) + 8000);
                else setNextDueKm(Number(lastServiceKm) + 5000);
              }}
              className="w-full h-11 px-3 bg-card border border-border rounded-xl text-xs font-bold text-foreground mt-1"
            >
              {MAINTENANCE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Descrição / Marca das Peças</label>
            <input
              type="text"
              placeholder="Ex: Óleo Yamalube 20W50 / Pneu Levorin"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Data do Serviço</label>
              <input
                type="date"
                value={lastServiceDate}
                onChange={e => setLastServiceDate(e.target.value)}
                className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs text-foreground mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">KM no Serviço</label>
              <input
                type="number"
                value={lastServiceKm}
                onChange={e => {
                  const val = Number(e.target.value);
                  setLastServiceKm(val);
                  setNextDueKm(val + 2500);
                }}
                className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs text-foreground mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Custo Pago (R$)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 45.00"
                value={cost}
                onChange={e => setCost(Number(e.target.value))}
                className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs text-foreground mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Oficina / Mecânico</label>
              <input
                type="text"
                placeholder="Ex: MotoMec"
                value={workshop}
                onChange={e => setWorkshop(e.target.value)}
                className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs text-foreground mt-1"
              />
            </div>
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Alerta de Próxima Manutenção
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Próximo KM Alerta</label>
                <input
                  type="number"
                  placeholder="Ex: 15000"
                  value={nextDueKm || ''}
                  onChange={e => setNextDueKm(Number(e.target.value))}
                  className="w-full h-9 px-3 bg-card border border-border rounded-xl text-xs text-foreground mt-0.5"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Próxima Data Alerta</label>
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={e => setNextDueDate(e.target.value)}
                  className="w-full h-9 px-3 bg-card border border-border rounded-xl text-xs text-foreground mt-0.5"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11 rounded-2xl text-xs font-bold">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 h-11 rounded-2xl text-xs font-bold bg-primary text-primary-foreground">
              {isSubmitting ? 'Salvando...' : 'Salvar Manutenção'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
