"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Activity, Bird, ChevronLeft, TreePine, Feather, HeartPulse, IdCard, LayoutDashboard, ListChecks, LogOut, Map as MapIcon, Search, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { PenguinSearch } from "./PenguinSearch";
import { BirdSearch } from "./BirdSearch";
import { ScenarioDrawer } from "./ScenarioDrawer";
import { LoginScreen } from "./LoginScreen";
import { PenguinChat } from "@/features/chat/PenguinChat";
import { ChartTipLayer } from "@/components/charts/Charts";

const SESSION_KEY = "penguin-demo/session";
const MENU_KEY = "penguin-demo/menu-collapsed";

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

type ModuleId = "penguins" | "aviary";

const MODULES: { id: ModuleId; label: string; home: string }[] = [
  { id: "penguins", label: "Penguins", home: "/penguins/overview" },
  { id: "aviary", label: "Aviary", home: "/aviary/map" },
];

const NAV: Record<ModuleId, { href: string; label: string; icon: LucideIcon; exact?: boolean }[]> = {
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
    { href: "/aviary/map", label: "Map", icon: MapIcon },
    { href: "/aviary/species", label: "Species", icon: Feather },
    { href: "/aviary/birds", label: "Individuals", icon: IdCard },
    { href: "/aviary/trees", label: "Trees", icon: TreePine },
    { href: "/aviary/teams", label: "Teams", icon: Users },
    { href: "/aviary/health", label: "Health follow-up", icon: HeartPulse },
  ],
};

function moduleOf(pathname: string): ModuleId {
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const session = useDemoSession();
  // Compact menu: icons only, so pages like the aviary map get more room. Remembered in this browser.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(MENU_KEY) === "1";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(saved);
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem(MENU_KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });

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
  const slim = collapsed;

  return (
    <div className="flex min-h-screen">
      <aside className={cx("sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-line bg-panel-solid/80 py-5 backdrop-blur transition-[width] duration-300 ease-out md:flex", slim ? "w-[68px] px-2" : "w-[248px] px-3")}>
        {/* Round toggle on the menu's edge: collapses to icons and back. */}
        <button
          onClick={toggleCollapsed}
          title={slim ? "Expand the menu" : "Collapse the menu"}
          aria-label={slim ? "Expand the menu" : "Collapse the menu"}
          aria-expanded={!slim}
          className="absolute -right-3 top-1/2 z-40 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-line bg-panel-solid text-accent shadow-[0_2px_6px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_3px_10px_rgba(0,0,0,0.14)]"
        >
          <ChevronLeft size={13} strokeWidth={2.4} className={cx("transition-transform duration-300", slim && "rotate-180")} />
        </button>
        <Link href="/penguins/overview" className={cx("block", slim ? "mb-4" : "mb-5 px-1")} title="Animal Care Platform">
          <span className={cx("flex justify-center rounded-2xl bg-white shadow-[0_4px_14px_rgba(11,36,64,0.10)]", slim ? "px-1 py-1.5" : "px-4 py-2.5")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/seaworld-abu-dhabi.png" alt="SeaWorld Abu Dhabi" className={slim ? "h-7 w-auto" : "h-14 w-auto"} />
          </span>
          {!slim && (
            <span className="mt-2.5 block text-center leading-tight">
              <span className="block text-[13px] font-semibold tracking-tight">Animal Care Platform</span>
            </span>
          )}
        </Link>

        <ModuleSwitch mod={mod} slim={slim} />

        {(
          <button
            onClick={() => setSearchOpen(true)}
            title={mod === "aviary" ? "Find a bird (Ctrl K)" : "Find a penguin (Ctrl K)"}
            className={cx("mb-3 flex h-9 items-center gap-2 rounded-xl border border-line bg-ink/[0.02] text-xs text-muted transition hover:border-line-strong hover:text-ink", slim ? "justify-center px-0" : "px-3")}
          >
            <Search size={14} />
            {!slim && (mod === "aviary" ? "Find a bird" : "Find a penguin")}
            {!slim && <kbd className="ml-auto rounded border border-line px-1 font-mono text-[10px] text-faint">Ctrl K</kbd>}
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
                title={slim ? label : undefined}
                aria-label={slim ? label : undefined}
                className={cx(
                  "group relative flex h-10 items-center gap-3 rounded-xl text-[13px] font-medium transition",
                  slim ? "justify-center px-0" : "px-3",
                  active ? "bg-gradient-to-r from-accent/14 to-transparent text-ink" : "text-muted hover:bg-ink/[0.03] hover:text-ink",
                )}
              >
                {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
                <Icon size={17} className={active ? "text-accent" : "text-faint group-hover:text-muted"} />
                {!slim && label}
              </Link>
            );
          })}
        </nav>

        <div className={cx("mt-auto space-y-2", !slim && "px-1")}>
          {mod === "penguins" && !slim && (
            <button
              onClick={() => setScenarioOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-faint transition hover:text-muted"
            >
              <SlidersHorizontal size={13} />
              Settings & reset
            </button>
          )}
          <button
            onClick={session.leave}
            title={`Sign out · ${session.user}`}
            className={cx("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-faint transition hover:text-muted", slim && "justify-center")}
          >
            <LogOut size={13} />
            {!slim && <span className="truncate">Sign out · {session.user}</span>}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <MobileNav pathname={pathname} mod={mod} />
        {children}
      </div>

      {mod === "aviary" ? <BirdSearch open={searchOpen} onClose={() => setSearchOpen(false)} /> : <PenguinSearch open={searchOpen} onClose={() => setSearchOpen(false)} />}
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

/** Switches between the two animal areas. */
function ModuleSwitch({ mod, compact, slim }: { mod: ModuleId; compact?: boolean; slim?: boolean }) {
  return (
    <div role="tablist" aria-label="Area" className={cx("grid rounded-xl border border-line bg-ink/[0.05] p-0.5", slim ? "mb-4 grid-cols-1 gap-0.5" : "grid-cols-2", compact ? "w-full" : !slim && "mb-4")}>
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
          {slim ? m.label.slice(0, 3) : m.label}
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
