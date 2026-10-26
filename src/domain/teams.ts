import type { CareTeam, SpeciesId } from "./types";

/** Equipos ficticios. Nombres y personas son de demostración. */
export const TEAMS: CareTeam[] = [
  {
    id: "alpha",
    name: "Team Alpha",
    lead: "Lucía Ferrer",
    members: ["Lucía Ferrer", "Diego Salas", "Ana Robles", "Marco Ibarra"],
    zoneIds: ["snow-beach", "ice-ridge"],
    color: "#38BDF8",
    focus: "Pingüinos rey en la playa de nieve y la cresta de hielo",
  },
  {
    id: "bravo",
    name: "Team Bravo",
    lead: "Tomás Herrera",
    members: ["Tomás Herrera", "Sofía Lara", "Iván Medina", "Paula Núñez"],
    zoneIds: ["nesting-rocks", "observation-ledge"],
    color: "#F59E0B",
    focus: "Saltarrocas en la zona rocosa y el mirador",
  },
  {
    id: "charlie",
    name: "Team Charlie",
    lead: "Renata Campos",
    members: ["Renata Campos", "Julián Vega", "Carla Ríos", "Nora Paz"],
    zoneIds: ["main-pool", "pebble-beach"],
    color: "#A78BFA",
    focus: "Barbijos en la piscina principal y la playa de grava",
  },
  {
    id: "delta",
    name: "Team Delta",
    lead: "Emilio Soto",
    members: ["Emilio Soto", "Mariana Olvera", "Hugo Peña"],
    zoneIds: ["wading-shore", "feeding-north"],
    color: "#FB7185",
    focus: "Papúas en la orilla y la estación de alimentación norte",
  },
  {
    id: "echo",
    name: "Team Echo",
    lead: "Fernanda Quiroz",
    members: ["Fernanda Quiroz", "Rodrigo Aguilar", "Lía Montes"],
    zoneIds: ["deep-dive"],
    color: "#84CC16",
    focus: "Macaroni en la piscina profunda",
  },
  {
    id: "foxtrot",
    name: "Team Foxtrot",
    lead: "Gabriel Ortega",
    members: ["Gabriel Ortega", "Daniela Fuentes", "Samuel Rivas"],
    zoneIds: ["feeding-south"],
    color: "#6366F1",
    focus: "Pingüinos de Adelia en la plataforma de alimentación sur",
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
  gentoo: "delta",
  rockhopper: "bravo",
  macaroni: "echo",
  chinstrap: "charlie",
  adelie: "foxtrot",
};
