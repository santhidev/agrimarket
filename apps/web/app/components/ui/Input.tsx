"use client";

import { forwardRef } from "react";

type InputProps = {
  label?: string;
  placeholder?: string;
  type?: string;
  prefix?: string;
  value?: string;
  /**
   * Fires with the raw value. Kept as a string callback (not the change
   * event) because the only current consumer — the OTP login form — wants
   * the value directly. Form pages can wire `onChange` to their state.
   */
  onChange?: (value: string) => void;
  /** Error message shown under the field; also wires aria-invalid. */
  error?: string;
  /** Non-error helper text shown under the field. */
  hint?: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  autoComplete?: string;
  required?: boolean;
  id?: string;
};

/**
 * Controlled input with optional label, prefix, helper and error — the
 * AgriMarket field style (surface background, forest focus ring).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    placeholder,
    type = "text",
    prefix,
    value,
    onChange,
    error,
    hint,
    className = "",
    inputMode,
    maxLength,
    autoComplete,
    required,
    id,
  },
  ref,
) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block mb-2 text-sm font-semibold text-ink">
          {label}
          {required && (
            <span className="text-error ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div
        className={`flex items-center gap-2 px-3 py-2.5 bg-surface border rounded-xl transition-colors ${
          error ? "border-error" : "border-line focus-within:border-green-600"
        }`}
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
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted min-w-0"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
