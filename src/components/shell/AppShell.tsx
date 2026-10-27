"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Activity, Bird, BookOpenCheck, ClipboardList, Compass, Feather, HeartPulse, IdCard, LayoutDashboard, ListChecks, LogOut, Map as MapIcon, Search, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";
import { useDemo } from "@/state/DemoProvider";
import { fmtDateTime } from "@/logic/time";
import { cx } from "@/components/ui/primitives";
import { PenguinSearch } from "./PenguinSearch";
import { ScenarioDrawer } from "./ScenarioDrawer";
import { LoginScreen } from "./LoginScreen";
import { PenguinChat } from "@/features/chat/PenguinChat";
import { ChartTipLayer } from "@/components/charts/Charts";

const SESSION_KEY = "penguin-demo/session";

/** Demo user saved in this browser; `undefined` while it is read. */
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

type ModuleId = "overview" | "penguins" | "aviary";

const MODULES: { id: ModuleId; label: string; home: string }[] = [
  { id: "overview", label: "Overview", home: "/" },
  { id: "penguins", label: "Penguins", home: "/penguins/overview" },
  { id: "aviary", label: "Aviary", home: "/aviary" },
];

const NAV: Record<ModuleId, { href: string; label: string; icon: LucideIcon; exact?: boolean }[]> = {
  overview: [
    { href: "/", label: "Platform overview", icon: Compass, exact: true },
    { href: "/roadmap", label: "Validation & roadmap", icon: BookOpenCheck },
  ],
  penguins: [
    { href: "/penguins/overview", label: "Overview", icon: LayoutDashboard },
    { href: "/map", label: "Habitat map", icon: MapIcon },
    { href: "/species", label: "Species", icon: Bird },
    { href: "/penguins", label: "Penguin registry", icon: IdCard },
    { href: "/teams", label: "Care teams", icon: Users },
    { href: "/health", label: "Health follow-up", icon: HeartPulse },
    { href: "/analytics", label: "Activity analytics", icon: Activity },
    { href: "/penguins/rules", label: "Proposed rules", icon: ListChecks },
  ],
  aviary: [
    { href: "/aviary", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/aviary/birds", label: "Birds", icon: Feather },
    { href: "/aviary/habitat", label: "Habitat", icon: MapIcon },
    { href: "/aviary/inventory", label: "Inventory", icon: ClipboardList },
    { href: "/aviary/rules", label: "Proposed rules", icon: ListChecks },
  ],
};

function moduleOf(pathname: string): ModuleId {
  if (pathname === "/" || pathname.startsWith("/roadmap")) return "overview";
  if (pathname.startsWith("/aviary")) return "aviary";
  return "penguins";
}

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact || href === "/") return pathname === href;
  // "/penguins" must not light up for /penguins/overview or /penguins/rules.
  if (href === "/penguins") return pathname === "/penguins" || (/^\/penguins\/[^/]+$/.test(pathname) && !/\/(overview|rules)$/.test(pathname));
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { now } = useDemo();
  const [searchOpen, setSearchOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
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


  const mod = moduleOf(pathname);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-panel-solid/80 px-3 py-5 backdrop-blur md:flex">
        <Link href="/" className="mb-5 block px-1">
          <span className="flex justify-center rounded-2xl bg-white px-4 py-2.5 shadow-[0_4px_14px_rgba(11,36,64,0.10)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/seaworld-abu-dhabi.png" alt="SeaWorld Abu Dhabi" className="h-14 w-auto" />
          </span>
          <span className="mt-2.5 block text-center leading-tight">
            <span className="block text-[13px] font-semibold tracking-tight">Animal Care Platform</span>
            <span className="block text-[11px] text-faint">Concept demo</span>
          </span>
        </Link>

        <ModuleSwitch mod={mod} />

        {mod === "penguins" && (
          <button
            onClick={() => setSearchOpen(true)}
            className="mb-3 flex h-9 items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 text-xs text-muted transition hover:border-line-strong hover:text-ink"
          >
            <Search size={14} />
            Find a penguin
            <kbd className="ml-auto rounded border border-line px-1 font-mono text-[10px] text-faint">Ctrl K</kbd>
          </button>
        )}

        <nav aria-label={`${MODULES.find((m) => m.id === mod)!.label} sections`} className="flex flex-col gap-0.5">
          {NAV[mod].map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition",
                  active ? "bg-gradient-to-r from-accent/14 to-transparent text-ink" : "text-muted hover:bg-ink/[0.03] hover:text-ink",
                )}
              >
                {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
                <Icon size={17} className={active ? "text-accent" : "text-faint group-hover:text-muted"} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 px-1">
          <div className="rounded-xl border border-line bg-ink/[0.02] p-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />
              <span className="text-[11px] font-medium text-ink">Demo · Simulated data</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted">
              Fictional scenario, no live systems connected. Data cut-off: {fmtDateTime(now, now)}.
            </p>
            <Link href="/roadmap" className="mt-1 inline-block text-[11px] font-medium text-accent hover:underline">
              What needs validation →
            </Link>
          </div>
          {mod === "penguins" && (
            <button
              onClick={() => setScenarioOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-faint transition hover:text-muted"
            >
              <SlidersHorizontal size={13} />
              Demo scenario & reset
            </button>
          )}
          <button
            onClick={session.leave}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-faint transition hover:text-muted"
          >
            <LogOut size={13} />
            <span className="truncate">Sign out · {session.user}</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <MobileNav pathname={pathname} mod={mod} />
        {children}
      </div>

      <PenguinSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ScenarioDrawer open={scenarioOpen} onClose={() => setScenarioOpen(false)} />
      {/* The chat is about penguins; it reads ?penguin= from the map, and useSearchParams needs its own Suspense. */}
      {mod === "penguins" && (
        <Suspense fallback={null}>
          <PenguinChat />
        </Suspense>
      )}
      <ChartTipLayer />
    </div>
  );
}

/** Switches between the platform overview and each animal area. */
function ModuleSwitch({ mod, compact }: { mod: ModuleId; compact?: boolean }) {
  return (
    <div role="tablist" aria-label="Area" className={cx("grid grid-cols-3 rounded-xl border border-line bg-ink/[0.05] p-0.5", compact ? "w-full" : "mb-4")}>
      {MODULES.map((m) => (
        <Link
          key={m.id}
          href={m.home}
          role="tab"
          aria-selected={mod === m.id}
          className={cx(
            "rounded-[10px] py-1.5 text-center text-xs font-medium transition",
            mod === m.id ? "bg-panel-solid text-ink shadow-[0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-ink",
          )}
        >
          {m.label}
        </Link>
      ))}
    </div>
  );
}

function MobileNav({ pathname, mod }: { pathname: string; mod: ModuleId }) {
  return (
    <div className="sticky top-0 z-30 space-y-2 border-b border-line bg-bg/90 px-3 py-2 backdrop-blur md:hidden">
      <ModuleSwitch mod={mod} compact />
      <nav aria-label="Sections" className="scroll-thin flex gap-1 overflow-x-auto">
        {NAV[mod].map(({ href, label, exact }) => (
          <Link
            key={href}
            href={href}
            className={cx("whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs", isActive(pathname, href, exact) ? "bg-accent/15 text-ink" : "text-muted")}
          >
            {label}
          </Link>
        ))}
      </nav>
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
