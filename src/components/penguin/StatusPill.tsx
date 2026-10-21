import { CloudOff, Clock3, Droplets, Mountain, PauseCircle, CircleDashed } from "lucide-react";
import { STATUS_HINT, STATUS_LABEL, type LiveStatus } from "@/logic/status";
import { cx } from "@/components/ui/primitives";

export const STATUS_COLOR: Record<LiveStatus, string> = {
  water: "#5cb8ff",
  land: "#cde7f7",
  resting: "#9fb3c8",
  stale: "#f5b84b",
  offline: "#ff6b6b",
  no_data: "#56718a",
};

const ICON = { water: Droplets, land: Mountain, resting: PauseCircle, stale: Clock3, offline: CloudOff, no_data: CircleDashed };

export function StatusPill({ status, compact, className }: { status: LiveStatus; compact?: boolean; className?: string }) {
  const Icon = ICON[status];
  const color = STATUS_COLOR[status];
  return (
    <span
      title={STATUS_HINT[status]}
      className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", className)}
      style={{ color, borderColor: `${color}40`, background: `${color}14` }}
    >
      <Icon size={12} />
      {compact && status === "resting" ? "Sin movimiento" : STATUS_LABEL[status]}
    </span>
  );
}
