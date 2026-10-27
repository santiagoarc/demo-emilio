"use client";

import { useState } from "react";
import { ArrowRightLeft, Check } from "lucide-react";
import { useDemo } from "@/state/DemoProvider";
import { Button, Select } from "@/components/ui/primitives";

export function TeamReassign({ penguinId, compact }: { penguinId: string; compact?: boolean }) {
  const { dataset, teamOf, reassign } = useDemo();
  const current = teamOf(penguinId);
  const [target, setTarget] = useState(current);
  const [done, setDone] = useState(false);
  const team = dataset.teams.find((t) => t.id === current) ?? { name: "Sin asignar", color: "#56718a" };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: team.color }} />
          {team.name}
        </span>
      )}
      <Select
        value={target}
        onChange={(e) => {
          setTarget(e.target.value);
          setDone(false);
        }}
        className="h-8 text-xs"
        aria-label="Equipo"
      >
        {dataset.teams.filter((t) => t.active !== false || t.id === current).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.id === current ? " (actual)" : ""}
          </option>
        ))}
      </Select>
      {target !== current ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            reassign(penguinId, target);
            setDone(true);
          }}
        >
          <ArrowRightLeft size={13} /> Reasignar
        </Button>
      ) : done ? (
        <span className="inline-flex items-center gap-1 text-xs text-ok">
          <Check size={13} /> Reasignado
        </span>
      ) : null}
    </div>
  );
}
