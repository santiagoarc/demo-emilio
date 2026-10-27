/**
 * Casos de seguimiento de salud con los que arranca la demo. Son ficticios y
 * salen de la misma semilla que el resto del escenario.
 */
import type { Dataset, HealthCase, HealthReason } from "@/domain/types";
import { between, hashSeed, mulberry32, pick } from "@/logic/rng";
import { DAY, HOUR } from "@/logic/time";

interface Template {
  reason: HealthReason;
  title: string;
  notes: string[];
  weight?: [number, number]; // kg inicial y cambio total durante el caso
}

const TEMPLATES: Template[] = [
  {
    reason: "injury",
    title: "Cojera leve en pata izquierda",
    notes: ["Se observa cojera al caminar en la playa; nada sin dificultad.", "Revisión veterinaria: sin fractura, inflamación leve. Reposo relativo.", "Camina mejor; se mantiene en observación."],
  },
  {
    reason: "weight",
    title: "Baja de peso en las últimas semanas",
    notes: ["Pesaje por debajo de su rango habitual.", "Se ajusta ración y se registra cuánto come en cada alimentación.", "Come completo en las dos últimas alimentaciones."],
    weight: [4.9, 0.25],
  },
  {
    reason: "molt",
    title: "Muda catastrófica",
    notes: ["Inicia muda; pasa más tiempo en tierra y no entra al agua.", "Se refuerza la alimentación durante la muda.", "Muda avanzada, plumaje nuevo en el dorso."],
    weight: [5.6, -0.45],
  },
  {
    reason: "treatment",
    title: "Tratamiento por pododermatitis",
    notes: ["Lesión en planta de la pata derecha; inicia tratamiento tópico.", "Curación diaria; la lesión se ve más limpia.", "Se cambia el sustrato de su zona de descanso."],
  },
  {
    reason: "behavior",
    title: "Pasa poco tiempo en el agua",
    notes: ["El equipo nota que entra poco al agua comparado con su grupo.", "Sin signos clínicos a la vista; se sigue su actividad diaria en el sistema."],
  },
  {
    reason: "weight",
    title: "Control de peso postratamiento",
    notes: ["Terminó tratamiento; se pesa cada tercer día.", "Recupera peso dentro de lo esperado."],
    weight: [3.8, 0.3],
  },
];

const OWNER_BY_REASON: Record<HealthReason, "vet" | "team"> = { injury: "vet", weight: "team", molt: "team", treatment: "vet", behavior: "team", other: "team" };

export function seedHealthCases(ds: Dataset, seed: number): HealthCase[] {
  const rng = mulberry32(hashSeed(seed, "health-cases"));
  const used = new Set<string>();
  const vet = ds.teams.find((t) => t.id === "vet");
  const cases: HealthCase[] = [];

  TEMPLATES.forEach((tpl, i) => {
    let p = pick(rng, ds.penguins);
    for (let k = 0; k < 10 && used.has(p.id); k++) p = pick(rng, ds.penguins);
    if (used.has(p.id)) return;
    used.add(p.id);
    const team = ds.teams.find((t) => t.id === p.initialTeamId);
    const owner = OWNER_BY_REASON[tpl.reason] === "vet" ? (vet?.lead ?? "Equipo veterinario") : (team?.lead ?? "Equipo de cuidado");
    const openedAt = ds.now - between(rng, 3, 12) * DAY;
    const closed = i === TEMPLATES.length - 1; // uno ya cerrado, para que haya historial
    const span = (closed ? openedAt + 6 * DAY : ds.now - 2 * HOUR) - openedAt;
    const entries = tpl.notes.map((text, k) => {
      const at = Math.round(openedAt + (span * k) / Math.max(1, tpl.notes.length - 1));
      const weightKg = tpl.weight ? Math.round((tpl.weight[0] + (tpl.weight[1] * k) / Math.max(1, tpl.notes.length - 1)) * 100) / 100 : undefined;
      const by = k === 0 || OWNER_BY_REASON[tpl.reason] === "team" ? owner : pick(rng, vet?.members ?? [owner]);
      return { id: `HC-${p.id}-${k}`, at, by, text, weightKg };
    });
    cases.push({
      id: `HC-${p.id}`,
      penguinId: p.id,
      reason: tpl.reason,
      title: tpl.title,
      owner,
      openedAt,
      status: closed ? "closed" : "open",
      closedAt: closed ? openedAt + 6 * DAY : undefined,
      entries: entries.reverse(),
      simulated: true,
    });
  });
  return cases;
}
