import Link from "next/link";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl " +
  "transition-[background-color,border-color,color,transform] duration-150 ease-out " +
  "cursor-pointer select-none active:scale-[0.98] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs min-h-8",
  md: "px-4 py-2.5 text-sm min-h-10",
  lg: "px-6 py-3 text-base min-h-12",
};

const VARIANTS: Record<Variant, string> = {
  primary: "bg-green-600 text-white hover:bg-green-700 shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:border-green-200 hover:bg-green-50",
  outline: "border border-green-600 text-green-700 hover:bg-green-50",
  ghost: "text-ink hover:bg-surface",
  danger: "bg-error text-white hover:opacity-90 shadow-sm",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps & {
  href: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * Button supports two render modes:
 * - default `<button>` (forms, actions)
 * - `href` → renders a Next.js `<Link>` styled as a button (navigation CTAs)
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", children, ...rest },
  ref,
) {
  const classes = `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`;

  if ("href" in rest && rest.href !== undefined) {
    const { href, ...linkRest } = rest;
    // Filter button-only props before delegating to Link.
    const {
      type: _type,
      disabled: _disabled,
      ...safeRest
    } = linkRest as React.ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <Link href={href} className={classes} {...(safeRest as Record<string, unknown>)}>
        {children}
      </Link>
    );
  }

  const { disabled, ...buttonRest } = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button ref={ref} className={classes} disabled={disabled} {...buttonRest}>
      {children}
    </button>
  );
});
