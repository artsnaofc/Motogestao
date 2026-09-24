import React from 'react';
import { Bike, ChevronDown, Check, Plus } from 'lucide-react';
import { useVehicles } from '../contexts/VehiclesContext';
import { useNavigate } from 'react-router-dom';

interface VehicleSelectProps {
  value?: string;
  onChange: (vehicleId: string) => void;
  label?: string;
  showAddOption?: boolean;
  className?: string;
}

export const VehicleSelect: React.FC<VehicleSelectProps> = ({
  value,
  onChange,
  label = 'Veículo Relacionado',
  showAddOption = false,
  className = '',
}) => {
  const { vehicles, activeVehicle } = useVehicles();

  // Selected vehicle or default active
  const selectedId = value !== undefined ? value : (activeVehicle?.id || '');

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
          <span>{label}</span>
          {selectedId && (() => {
            const cur = vehicles.find(v => v.id === selectedId);
            return (
              <span className="text-[10px] text-primary font-bold">
                {cur?.nickname || `${cur?.brand} ${cur?.model}`}
              </span>
            );
          })()}
        </label>
      )}

      <div className="relative">
        <select
          value={selectedId}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="w-full h-11 pl-10 pr-8 bg-card border border-border/70 rounded-xl text-xs font-medium text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer"
        >
          <option value="">Nenhum Veículo (Geral)</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              🏍️ {v.nickname ? `${v.nickname} (${v.brand} ${v.model})` : `${v.brand} ${v.model}`} {v.plate ? `• ${v.plate}` : ''} {v.is_active ? '★ (Ativo)' : ''}
            </option>
          ))}
        </select>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-primary">
          <Bike className="w-4 h-4" />
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
