import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Search, Loader2, History, X } from 'lucide-react';
import { searchAddressNominatim, AddressSearchResult, fetchViaCep, cleanDigits } from '@/lib/brazilianFormatters';

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  neighborhoodValue?: string;
  onNeighborhoodChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  historyAddresses?: Array<{ address: string; neighborhood?: string }>;
  id?: string;
}

export function AddressAutocompleteInput({
  value,
  onChange,
  neighborhoodValue,
  onNeighborhoodChange,
  placeholder = 'Rua / Avenida, Número, Bairro',
  className = '',
  required = false,
  historyAddresses = [],
  id,
}: AddressAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  useEffect(() => {
    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    // Se o usuário digitou exatamente 8 dígitos ou um CEP (ex: 01310-100), busca no ViaCEP
    const rawDigits = cleanDigits(value);
    if (rawDigits.length === 8 && value.trim().length <= 10) {
      setIsLoading(true);
      fetchViaCep(rawDigits).then((via) => {
        setIsLoading(false);
        if (via && via.street) {
          setSuggestions([
            {
              display_name: `${via.street}, ${via.neighborhood} - ${via.city}/${via.state}`,
              street: via.street,
              neighborhood: `${via.neighborhood} - ${via.city}/${via.state}`,
              city: via.city,
              state: via.state,
            },
          ]);
          setIsOpen(true);
        }
      });
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      const results = await searchAddressNominatim(value, controller.signal);
      setIsLoading(false);
      setSuggestions(results);
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (item: AddressSearchResult) => {
    onChange(item.street || item.display_name);
    if (onNeighborhoodChange && item.neighborhood) {
      onNeighborhoodChange(item.neighborhood);
    }
    setIsOpen(false);
  };

  const handleSelectHistory = (item: { address: string; neighborhood?: string }) => {
    onChange(item.address);
    if (onNeighborhoodChange && item.neighborhood) {
      onNeighborhoodChange(item.neighborhood);
    }
    setIsOpen(false);
  };

  // Filtrar histórico local correspondente
  const matchingHistory = historyAddresses
    .filter(
      (h) =>
        h.address &&
        h.address.toLowerCase() !== value.toLowerCase() &&
        (value.length < 2 || h.address.toLowerCase().includes(value.toLowerCase()))
    )
    .slice(0, 3);

  const hasItemsToShow = isOpen && (suggestions.length > 0 || matchingHistory.length > 0 || isLoading);

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
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none text-muted-foreground">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          ) : value ? (
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <Search className="w-3.5 h-3.5 text-muted-foreground/60" />
          )}
        </div>
      </div>

      {hasItemsToShow && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-popover/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-xl max-h-64 overflow-y-auto p-1.5 space-y-1 text-xs animate-in fade-in-50 zoom-in-95">
          {/* Histórico local */}
          {matchingHistory.length > 0 && (
            <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-muted-foreground flex items-center gap-1 border-b border-border/40 mb-1">
              <History className="w-3 h-3 text-primary" /> Endereços Recentes
            </div>
          )}
          {matchingHistory.map((h, i) => (
            <button
              key={`hist_${i}`}
              type="button"
              onClick={() => handleSelectHistory(h)}
              className="w-full text-left p-2 rounded-xl hover:bg-muted/70 transition-colors flex items-start gap-2 text-foreground cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 overflow-hidden">
                <div className="font-semibold text-xs text-foreground truncate">{h.address}</div>
                {h.neighborhood && (
                  <div className="text-[10px] text-muted-foreground truncate">{h.neighborhood}</div>
                )}
              </div>
            </button>
          ))}

          {/* Sugestões Nominatim / CEP */}
          {suggestions.length > 0 && (
            <>
              {matchingHistory.length > 0 && (
                <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-muted-foreground flex items-center gap-1 border-t border-border/40 mt-1 pt-1.5">
                  <Search className="w-3 h-3 text-emerald-500" /> Sugestões Encontradas
                </div>
              )}
              {suggestions.map((item, idx) => (
                <button
                  key={`sug_${idx}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full text-left p-2 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-start gap-2 text-foreground cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 overflow-hidden">
                    <div className="font-semibold text-xs truncate">
                      {item.street || item.display_name.split(',')[0]}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {item.neighborhood || item.display_name}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {isLoading && suggestions.length === 0 && (
            <div className="p-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              Buscando endereços no mapa...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
