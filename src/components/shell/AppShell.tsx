"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, BellRing, Bird, LayoutDashboard, LogOut, Map as MapIcon, Search, SlidersHorizontal, Users, IdCard } from "lucide-react";
import { useDemo } from "@/state/DemoProvider";
import { fmtDateTime } from "@/logic/time";
import { cx } from "@/components/ui/primitives";
import { PenguinSearch } from "./PenguinSearch";
import { ScenarioDrawer } from "./ScenarioDrawer";
import { LoginScreen } from "./LoginScreen";

const SESSION_KEY = "penguin-demo/session";

/** Usuario de la demo guardado en este navegador; `undefined` mientras se lee. */
function useDemoSession() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(SESSION_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(saved);
  }, []);
  const enter = (name: string) => {
    try {
      localStorage.setItem(SESSION_KEY, name);
    } catch {}
    setUser(name);
  };
  const leave = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
    setUser(null);
  };
  return { user, enter, leave };
}

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/map", label: "Habitat Map", icon: MapIcon },
  { href: "/species", label: "Species", icon: Bird },
  { href: "/penguins", label: "Penguins", icon: IdCard },
  { href: "/teams", label: "Care Teams", icon: Users },
  { href: "/analytics", label: "Activity Analytics", icon: Activity },
  { href: "/alerts", label: "Alerts & Tasks", icon: BellRing },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { alerts, now } = useDemo();
  const [searchOpen, setSearchOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const pending = alerts.filter((a) => a.status !== "resolved").length;
  const session = useDemoSession();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (session.user === undefined) return <div className="min-h-screen bg-bg" />;
  if (session.user === null) return <LoginScreen onEnter={session.enter} />;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-line bg-[rgba(3,14,26,0.7)] px-3 py-5 backdrop-blur md:flex">
        <Link href="/" className="mb-6 block px-1">
          <span className="flex justify-center rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.25)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/seaworld-abu-dhabi.png" alt="SeaWorld Abu Dhabi" className="h-14 w-auto" />
          </span>
          <span className="mt-2.5 block text-center leading-tight">
            <span className="block text-[13px] font-semibold tracking-tight">Penguin Tracking & Care</span>
          </span>
        </Link>

        <button
          onClick={() => setSearchOpen(true)}
          className="mb-4 flex h-9 items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 text-xs text-muted transition hover:border-line-strong hover:text-ink"
        >
          <Search size={14} />
          Buscar ejemplar
          <kbd className="ml-auto rounded border border-line px-1 font-mono text-[10px] text-faint">Ctrl K</kbd>
        </button>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cx(
                  "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition",
                  active ? "bg-gradient-to-r from-accent/14 to-transparent text-ink" : "text-muted hover:bg-white/[0.03] hover:text-ink",
                )}
              >
                {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
                <Icon size={17} className={active ? "text-accent" : "text-faint group-hover:text-muted"} />
                {label}
                {href === "/alerts" && pending > 0 && (
                  <span className="num ml-auto rounded-full bg-warn/15 px-1.5 text-[11px] font-semibold text-warn">{pending}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 px-1">
          <div className="rounded-xl border border-line bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />
              <span className="text-[11px] font-medium text-ice">Demo · Datos simulados</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-faint">
              Escenario ficticio, sin dispositivos conectados. Corte de lecturas: {fmtDateTime(now, now)}.
            </p>
          </div>
          <button
            onClick={() => setScenarioOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-faint transition hover:text-muted"
          >
            <SlidersHorizontal size={13} />
            Escenario y reinicio de la demo
          </button>
          <button
            onClick={session.leave}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-faint transition hover:text-muted"
          >
            <LogOut size={13} />
            <span className="truncate">Salir · {session.user}</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <MobileNav pathname={pathname} />
        {children}
      </div>

      <PenguinSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ScenarioDrawer open={scenarioOpen} onClose={() => setScenarioOpen(false)} />
    </div>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <div className="scroll-thin sticky top-0 z-30 flex gap-1 overflow-x-auto border-b border-line bg-bg/90 px-3 py-2 backdrop-blur md:hidden">
      {NAV.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cx(
            "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs",
            (href === "/" ? pathname === "/" : pathname.startsWith(href)) ? "bg-accent/15 text-ink" : "text-muted",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-6 lg:px-8">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
