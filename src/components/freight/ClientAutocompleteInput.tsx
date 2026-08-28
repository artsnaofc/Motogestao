import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { User, Phone, Building2, Search, Check } from 'lucide-react';
import { FreightClient } from '@/types/freight';

interface ClientAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  clients: FreightClient[];
  onSelectClient: (client: FreightClient) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}

export function ClientAutocompleteInput({
  value,
  onChange,
  clients,
  onSelectClient,
  placeholder = 'Ex: Carlos Silva / Loja Central',
  className = '',
  required = false,
  id,
}: ClientAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtrar clientes
  const filtered = clients
    .filter((c) => {
      if (!value || value.trim().length === 0) return true;
      const q = value.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.document && c.document.includes(q))
      );
    })
    .slice(0, 10);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (client: FreightClient) => {
    onSelectClient(client);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`pr-8 ${className}`}
          required={required}
          autoComplete="off"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
          <Search className="w-3.5 h-3.5 text-muted-foreground/60" />
        </div>
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-popover/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-xl max-h-60 overflow-y-auto p-1.5 space-y-1 text-xs animate-in fade-in-50 zoom-in-95">
          <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-muted-foreground flex items-center justify-between border-b border-border/40 mb-1">
            <span>Clientes Cadastrados</span>
            <span className="text-primary font-bold">{filtered.length} sugestões</span>
          </div>

          {filtered.map((client) => {
            const isMatchExact = client.name.toLowerCase() === value.toLowerCase();
            return (
              <button
                key={client.id}
                type="button"
                onClick={() => handleSelect(client)}
                className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                  isMatchExact
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'hover:bg-muted/70 text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-xs truncate text-foreground flex items-center gap-1.5">
                      {client.name}
                      {client.company && (
                        <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-0.5">
                          • <Building2 className="w-2.5 h-2.5" /> {client.company}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 truncate mt-0.5">
                      {client.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5 text-emerald-500" /> {client.phone}
                        </span>
                      )}
                      {client.document && (
                        <span>Doc: {client.document}</span>
                      )}
                    </div>
                  </div>
                </div>

                {isMatchExact && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
