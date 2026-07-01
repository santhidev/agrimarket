"use client";

import { forwardRef } from "react";

type InputProps = {
  label?: string;
  placeholder?: string;
  type?: string;
  prefix?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  autoComplete?: string;
  required?: boolean;
  id?: string;
};

/**
 * Controlled input with optional label and prefix slot, matching the
 * AgriMarket field style (surface background, green focus ring).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    placeholder,
    type = "text",
    prefix,
    value,
    onChange,
    className = "",
    inputMode,
    maxLength,
    autoComplete,
    required,
    id,
  },
  ref,
) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block mb-2 text-sm font-semibold text-ink">
          {label}
        </label>
      )}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-surface border border-line rounded-xl transition-colors focus-within:border-green-600"
      >
        {prefix && <span className="shrink-0 text-sm text-muted">{prefix}</span>}
        <input
          ref={ref}
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={autoComplete}
          required={required}
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>
    </div>
  );
});
