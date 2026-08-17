import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface CurrencyInputProps extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> {
  value: string | number;
  onChange: (val: string) => void;
  decimals?: number;
}

// Robust parsing helper to convert any parent value (number, pt-BR string or JS string) to units
function parseValueToUnits(val: string | number, decimals: number): number {
  if (val === undefined || val === null || val === '') return 0;
  const multiplier = Math.pow(10, decimals);
  if (typeof val === 'number') {
    return Math.round(val * multiplier);
  }
  const str = val.toString().trim();
  if (!str) return 0;

  // If there's a comma, treat it as pt-BR format (e.g., "1.234,56" or "12,50")
  if (str.includes(',')) {
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : Math.round(parsed * multiplier);
  }

  // Otherwise, it's a standard JS float representation (e.g., "12.34" or "12")
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.round(parsed * multiplier);
}

export function CurrencyInput({ value, onChange, decimals = 2, ...props }: CurrencyInputProps) {
  // Keep local state of raw digits to handle typing fluidly (right-to-left)
  const [digits, setDigits] = useState(() => {
    return parseValueToUnits(value, decimals).toString();
  });

  // Sync state with parent changes
  useEffect(() => {
    const parentUnits = parseValueToUnits(value, decimals);
    const currentUnits = parseInt(digits, 10) || 0;

    // Only update if there's a real discrepancy to avoid input jitter
    if (parentUnits !== currentUnits) {
      setDigits(parentUnits.toString());
    }
  }, [value, decimals]);

  const formatDigits = (d: string) => {
    const parsed = parseInt(d, 10);
    if (isNaN(parsed) || parsed === 0) return (0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const floatVal = parsed / Math.pow(10, decimals);
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(floatVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    
    // Extract only digits
    const cleanDigits = rawVal.replace(/\D/g, '');
    
    // Parse to remove leading zeros, e.g. "0001" -> "1"
    const parsedDigits = cleanDigits ? parseInt(cleanDigits, 10).toString() : '0';
    
    setDigits(parsedDigits);
    
    // Notify parent with the float value as string (standard dot-notation, e.g., "12.34")
    const floatVal = parseInt(parsedDigits, 10) / Math.pow(10, decimals);
    onChange(floatVal.toString());
  };

  const displayValue = formatDigits(digits);

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleInputChange}
    />
  );
}
