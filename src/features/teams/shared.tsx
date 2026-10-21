"use client";

import { useMemo, useState } from "react";
import { HABITAT } from "@/domain/habitat";
import type { CareTeam } from "@/domain/types";
import { isOpenTask, taskCompliance } from "@/logic/tasks";
import { PERMISSIONS, useDemo, type TeamInput } from "@/state/DemoProvider";
import { Button, Drawer, cx } from "@/components/ui/primitives";

export const isActive = (t: CareTeam) => t.active !== false;

export function initials(name: string) {
  return name
    .replace(/^(Dra?\.)\s/, "")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Iniciales de los integrantes (no hay fotografías del personal en la demo). */
export function Avatars({ team, max = 4, size = 28 }: { team: CareTeam; max?: number; size?: number }) {
  const shown = team.members.slice(0, max);
  const rest = team.members.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((m, i) => (
        <span
          key={m}
          title={m}
          className="grid place-items-center rounded-full border-2 border-panel-solid font-semibold text-[#03101c]"
          style={{ width: size, height: size, marginLeft: i ? -size / 3.2 : 0, fontSize: size * 0.36, background: i % 2 ? `${team.color}cc` : team.color }}
        >
          {initials(m)}
        </span>
      ))}
      {rest > 0 && (
        <span className="grid place-items-center rounded-full border-2 border-panel-solid bg-panel-2 font-semibold text-muted" style={{ width: size, height: size, marginLeft: -size / 3.2, fontSize: size * 0.34 }}>
          +{rest}
        </span>
      )}
    </span>
  );
}

export function ActiveBadge({ team }: { team: CareTeam }) {
  const on = isActive(team);
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-xs font-medium", on ? "text-ok" : "text-faint")}>
      <span className={cx("h-2 w-2 rounded-full", on ? "bg-ok" : "bg-faint")} />
      {on ? "Activo" : "Inactivo"}
    </span>
  );
}

export interface TeamStats {
  team: CareTeam;
  penguinIds: string[];
  recent: number;
  openTasks: number;
  urgentTasks: number;
  openAlerts: number;
  highAlerts: number;
  compliance: { done: number; total: number; pct: number | null };
  zones: [string, number][];
}

/** Indicadores de cada equipo, calculados desde la asignación vigente (un equipo por ejemplar). */
export function useTeamStats(): TeamStats[] {
  const { dataset, teamOf, snapshots, tasks, alerts, range, now } = useDemo();
  return useMemo(
    () =>
      dataset.teams.map((team) => {
        const penguinIds = dataset.penguins.filter((p) => teamOf(p.id) === team.id).map((p) => p.id);
        const myTasks = tasks.filter((t) => t.teamId === team.id);
        const open = myTasks.filter(isOpenTask);
        const myAlerts = alerts.filter((a) => a.teamId === team.id && a.status !== "resolved");
        const zones = new Map<string, number>();
        for (const id of penguinIds) {
          const z = snapshots.get(id)?.reading?.zoneId;
          if (z) zones.set(z, (zones.get(z) ?? 0) + 1);
        }
        return {
          team,
          penguinIds,
          recent: penguinIds.filter((id) => {
            const s = snapshots.get(id)!;
            return s.recent && s.status !== "offline";
          }).length,
          openTasks: open.length,
          urgentTasks: open.filter((t) => t.dueAt < now).length,
          openAlerts: myAlerts.length,
          highAlerts: myAlerts.filter((a) => a.priority === "high").length,
          compliance: taskCompliance(myTasks, range.from, range.to, now),
          zones: [...zones.entries()].sort((a, b) => b[1] - a[1]),
        };
      }),
    [dataset, teamOf, snapshots, tasks, alerts, range, now],
  );
}

/** Formulario para crear o editar un equipo. La asignación de pingüinos se hace aparte. */
export function TeamFormDrawer({ open, onClose, team, onSaved }: { open: boolean; onClose: () => void; team?: CareTeam; onSaved?: (id: string) => void }) {
  return (
    <Drawer open={open} onClose={onClose} width={520} title={team ? `Editar ${team.name}` : "Nuevo equipo"}>
      {open && <TeamForm key={team?.id ?? "new"} team={team} onClose={onClose} onSaved={onSaved} />}
    </Drawer>
  );
}

function TeamForm({ team, onClose, onSaved }: { team?: CareTeam; onClose: () => void; onSaved?: (id: string) => void }) {
  const { addTeam, updateTeam, dataset, teamOf } = useDemo();
  const [name, setName] = useState(team?.name ?? "");
  const [focus, setFocus] = useState(team?.focus ?? "");
  const [lead, setLead] = useState(team?.lead ?? "");
  const [members, setMembers] = useState((team?.members ?? []).filter((m) => m !== team?.lead).join("\n"));
  const [zones, setZones] = useState<string[]>(team?.zoneIds ?? []);
  const [active, setActive] = useState(team ? isActive(team) : true);
  const assigned = team ? dataset.penguins.filter((p) => teamOf(p.id) === team.id).length : 0;
  const duplicate = dataset.teams.some((t) => t.id !== team?.id && t.name.trim().toLowerCase() === name.trim().toLowerCase());
  const valid = name.trim() && lead.trim() && !duplicate;

  if (!PERMISSIONS.manageTeams) return <p className="p-5 text-sm text-muted">Tu perfil no permite crear ni editar equipos.</p>;

  const save = () => {
    const input: TeamInput = {
      name: name.trim(),
      focus: focus.trim(),
      lead: lead.trim(),
      members: [lead.trim(), ...members.split("\n").map((m) => m.trim()).filter((m) => m && m !== lead.trim())],
      zoneIds: zones,
      active,
    };
    if (team) {
      updateTeam(team.id, input);
      onSaved?.(team.id);
    } else {
      onSaved?.(addTeam(input));
    }
    onClose();
  };

  const field = "mt-1 w-full rounded-xl border border-line-strong bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent/60";
  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save();
      }}
    >
      <label className="block text-xs text-muted">
        Nombre
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Team Delta" />
        {duplicate && <span className="mt-1 block text-[11px] text-danger">Ya existe un equipo con ese nombre.</span>}
      </label>
      <label className="block text-xs text-muted">
        Descripción
        <input value={focus} onChange={(e) => setFocus(e.target.value)} className={field} placeholder="Zona o enfoque del equipo" />
      </label>
      <label className="block text-xs text-muted">
        Responsable
        <input value={lead} onChange={(e) => setLead(e.target.value)} className={field} placeholder="Nombre y apellido" />
      </label>
      <label className="block text-xs text-muted">
        Integrantes <span className="text-faint">(uno por línea; el responsable se incluye solo)</span>
        <textarea value={members} onChange={(e) => setMembers(e.target.value)} rows={4} className={cx(field, "resize-none")} />
      </label>
      <div>
        <p className="text-xs text-muted">Zonas de responsabilidad</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {HABITAT.zones
            .filter((z) => z.kind !== "restricted")
            .map((z) => (
              <label key={z.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-xs hover:border-line-strong">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={zones.includes(z.id)}
                  onChange={() => setZones(zones.includes(z.id) ? zones.filter((x) => x !== z.id) : [...zones, z.id])}
                />
                {z.name}
              </label>
            ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-muted">Estado</p>
        <div className="mt-1.5 flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setActive(v)}
              className={cx("h-8 rounded-xl border px-3 text-xs", active === v ? "border-accent/50 bg-accent/10 text-ink" : "border-line-strong text-muted")}
            >
              {v ? "Activo" : "Inactivo"}
            </button>
          ))}
        </div>
        {team && !active && assigned > 0 && (
          <p className="mt-2 rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-2 text-[11px] text-warn">
            Sus {assigned} pingüinos seguirán asignados a este equipo. Reasígnalos de forma explícita desde la pestaña Pingüinos si es necesario.
          </p>
        )}
      </div>
      <p className="text-[11px] text-faint">
        {team ? "Los cambios quedan en el historial del equipo; no se borra nada." : "Los pingüinos se asignan después, desde el detalle del equipo, con una reasignación explícita."}
      </p>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={!valid}>{team ? "Guardar cambios" : "Crear equipo"}</Button>
      </div>
    </form>
  );
}
