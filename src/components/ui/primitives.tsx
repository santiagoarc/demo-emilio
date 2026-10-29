"use client";

import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { X, type LucideIcon } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, title, subtitle, action, icon: Icon }: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <section className={cx("panel fade-up flex min-w-0 flex-col p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
              {Icon && <Icon size={16} className="text-accent" strokeWidth={2} />}
              {title}
            </h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = "ghost", size = "md", className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-accent text-white hover:bg-[#0b8178]",
        variant === "ghost" && "text-muted hover:bg-ink/5 hover:text-ink",
        variant === "outline" && "border border-line-strong text-ink hover:border-accent/50 hover:bg-ink/[0.03]",
        variant === "danger" && "border border-danger/40 text-danger hover:bg-danger/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cx(
        "h-9 rounded-xl border border-line-strong bg-panel-solid px-3 text-sm text-ink outline-none transition focus:border-accent/60",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Chip({ active, color, children, onClick, onRemove, className }: {
  active?: boolean;
  color?: string;
  children: ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => onClick && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
      className={cx(
        "inline-flex h-7 select-none items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition",
        onClick && "cursor-pointer",
        active ? "border-accent/50 bg-accent/12 text-ink" : "border-line-strong text-muted hover:text-ink",
        className,
      )}
    >
      {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
      {children}
      {onRemove && (
        <button onClick={(e) => (e.stopPropagation(), onRemove())} className="-mr-1 rounded-full p-0.5 hover:bg-ink/10" aria-label="Remove">
          <X size={12} />
        </button>
      )}
    </span>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "accent" | "warn" | "danger" | "ok" | "info"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-ink/[0.06] text-muted",
    accent: "bg-accent/12 text-accent",
    warn: "bg-warn/12 text-warn",
    danger: "bg-danger/12 text-danger",
    ok: "bg-ok/12 text-ok",
    info: "bg-accent-2/12 text-accent-2",
  };
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}

export function Segmented<T extends string>({ value, options, onChange, size = "md" }: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-ink/[0.05] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-[10px] font-medium transition",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-xs",
            value === o.value ? "bg-panel-2 text-ink shadow-[0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-ink/[0.03]">
        <Icon size={20} className="text-muted" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="max-w-sm text-xs text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="num mt-0.5 text-lg font-semibold" style={tone ? { color: tone } : undefined}>{value}</p>
      {hint && <p className="text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

export function Drawer({ open, onClose, children, width = 420, title }: { open: boolean; onClose: () => void; children: ReactNode; width?: number; title?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="slide-in relative flex h-full flex-col border-l border-line bg-panel-solid shadow-2xl" style={{ width: `min(${width}px, 100vw)` }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="text-sm font-semibold">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
