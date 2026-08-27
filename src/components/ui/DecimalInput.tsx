import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { parseNumericValue } from '@/lib/numberUtils';

export interface DecimalInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'prefix'> {
  value?: number | string | null;
  onChange?: (val: number) => void;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  allowNegative?: boolean;
}

export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, onChange, prefix, suffix, className, allowNegative = false, onBlur, ...props }, ref) => {
    const [internalStr, setInternalStr] = useState<string>(() => {
      if (value === undefined || value === null || value === '') return '';
      if (typeof value === 'number') {
        return isNaN(value) ? '' : String(value).replace('.', ',');
      }
      return String(value);
    });

    useEffect(() => {
      if (value === undefined || value === null || value === '') {
        if (internalStr !== '') setInternalStr('');
        return;
      }
      const numValue = typeof value === 'number' ? value : parseNumericValue(value);
      const parsedInternal = parseNumericValue(internalStr);
      if (Math.abs(parsedInternal - numValue) > 0.0001) {
        setInternalStr(String(numValue).replace('.', ','));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Allow digits, commas, dots, and optional negative sign if allowed
      const regex = allowNegative ? /[^0-9.,-]/g : /[^0-9.,]/g;
      const sanitized = raw.replace(regex, '');
      
      setInternalStr(sanitized);
      const parsed = parseNumericValue(sanitized);
      if (onChange) {
        onChange(parsed);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (onBlur) onBlur(e);
      // Format cleanly on blur if numeric
      if (internalStr.trim()) {
        const parsed = parseNumericValue(internalStr);
        if (!isNaN(parsed) && parsed !== 0) {
          // If ends with comma or dot, keep parsed formatted
          setInternalStr(String(parsed).replace('.', ','));
        }
      }
    };

    return (
      <div className="relative flex items-center w-full">
        {prefix && (
          <div className="absolute left-3 z-10 text-muted-foreground text-xs font-bold select-none pointer-events-none flex items-center justify-center">
            {prefix}
          </div>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={internalStr}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn(
            prefix && "pl-8 sm:pl-9",
            suffix && "pr-8 sm:pr-9",
            className
          )}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3 z-10 text-muted-foreground text-xs font-bold select-none pointer-events-none flex items-center justify-center">
            {suffix}
          </div>
        )}
      </div>
    );
  }
);

DecimalInput.displayName = 'DecimalInput';
