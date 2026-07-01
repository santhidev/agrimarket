import Link from "next/link";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-colors cursor-pointer select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

const VARIANTS: Record<Variant, string> = {
  // Accent orange used on the hero "ประกาศรับซื้อ" CTA is composed at the
  // call site via className; primary stays the brand green.
  primary: "bg-green-600 text-white hover:bg-green-700 shadow-sm",
  secondary: "bg-surface text-ink hover:bg-green-50",
  outline: "border border-green-600 text-green-600 hover:bg-green-50",
  ghost: "text-muted hover:bg-surface",
  danger: "bg-error text-white hover:opacity-90",
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
