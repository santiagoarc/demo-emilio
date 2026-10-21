import type { CareTeam, SpeciesId } from "./types";

/** Equipos ficticios. Nombres y personas son de demostración. */
export const TEAMS: CareTeam[] = [
  {
    id: "alpha",
    name: "Team Alpha",
    lead: "Lucía Ferrer",
    members: ["Lucía Ferrer", "Diego Salas", "Ana Robles", "Marco Ibarra"],
    zoneIds: ["snow-beach", "ice-ridge", "feeding-north"],
    color: "#38BDF8",
    focus: "Colonia de playa de nieve y cresta de hielo",
  },
  {
    id: "bravo",
    name: "Team Bravo",
    lead: "Tomás Herrera",
    members: ["Tomás Herrera", "Sofía Lara", "Iván Medina", "Paula Núñez"],
    zoneIds: ["nesting-rocks", "deep-dive", "observation-ledge"],
    color: "#F59E0B",
    focus: "Zona rocosa y piscina profunda",
  },
  {
    id: "charlie",
    name: "Team Charlie",
    lead: "Renata Campos",
    members: ["Renata Campos", "Julián Vega", "Carla Ríos", "Emilio Soto", "Nora Paz"],
    zoneIds: ["main-pool", "wading-shore", "pebble-beach", "feeding-south"],
    color: "#A78BFA",
    focus: "Piscina principal, orilla y playa de grava",
  },
  {
    id: "vet",
    name: "Veterinary Team",
    lead: "Dra. Elena Brito",
    members: ["Dra. Elena Brito", "Dr. Andrés Mora", "Valeria Cruz"],
    zoneIds: ["care-bay", "vet-holding"],
    color: "#2DD4BF",
    focus: "Seguimiento de ejemplares en cuidado",
  },
];

/** Equipo por omisión de cada especie al generar el escenario. */
export const DEFAULT_TEAM_BY_SPECIES: Record<SpeciesId, string> = {
  king: "alpha",
  gentoo: "alpha",
  rockhopper: "bravo",
  macaroni: "bravo",
  chinstrap: "charlie",
  adelie: "charlie",
};
