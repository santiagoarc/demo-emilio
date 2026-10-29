import type { CareTeam, SpeciesId } from "./types";

/** Fictional teams. Names and people are for demonstration only. */
export const TEAMS: CareTeam[] = [
  {
    id: "alpha",
    name: "Team Alpha",
    lead: "Lucía Ferrer",
    members: ["Lucía Ferrer", "Diego Salas", "Ana Robles", "Marco Ibarra"],
    zoneIds: ["snow-beach", "ice-ridge"],
    color: "#38BDF8",
    focus: "King penguins on Snow Beach and Ice Ridge",
  },
  {
    id: "bravo",
    name: "Team Bravo",
    lead: "Tomás Herrera",
    members: ["Tomás Herrera", "Sofía Lara", "Iván Medina", "Paula Núñez"],
    zoneIds: ["nesting-rocks", "observation-ledge"],
    color: "#F59E0B",
    focus: "Rockhoppers on the Nesting Rocks and Observation Ledge",
  },
  {
    id: "charlie",
    name: "Team Charlie",
    lead: "Renata Campos",
    members: ["Renata Campos", "Julián Vega", "Carla Ríos", "Nora Paz"],
    zoneIds: ["main-pool", "pebble-beach"],
    color: "#A78BFA",
    focus: "Chinstraps in the Main Pool and on Pebble Beach",
  },
  {
    id: "delta",
    name: "Team Delta",
    lead: "Emilio Soto",
    members: ["Emilio Soto", "Mariana Olvera", "Hugo Peña"],
    zoneIds: ["wading-shore", "feeding-north"],
    color: "#FB7185",
    focus: "Gentoos at the Wading Shore and Feeding Station North",
  },
  {
    id: "echo",
    name: "Team Echo",
    lead: "Fernanda Quiroz",
    members: ["Fernanda Quiroz", "Rodrigo Aguilar", "Lía Montes"],
    zoneIds: ["deep-dive"],
    color: "#84CC16",
    focus: "Macaronis in the Deep Dive Pool",
  },
  {
    id: "foxtrot",
    name: "Team Foxtrot",
    lead: "Gabriel Ortega",
    members: ["Gabriel Ortega", "Daniela Fuentes", "Samuel Rivas"],
    zoneIds: ["feeding-south"],
    color: "#6366F1",
    focus: "Adélies at Feeding Platform South",
  },
  {
    id: "vet",
    name: "Veterinary Team",
    lead: "Dr. Elena Brito",
    members: ["Dr. Elena Brito", "Dr. Andrés Mora", "Valeria Cruz"],
    zoneIds: ["care-bay", "vet-holding"],
    color: "#2DD4BF",
    focus: "Follow-up of penguins under care",
  },
];

/** Default team for each species when generating the scenario. */
export const DEFAULT_TEAM_BY_SPECIES: Record<SpeciesId, string> = {
  king: "alpha",
  gentoo: "delta",
  rockhopper: "bravo",
  macaroni: "echo",
  chinstrap: "charlie",
  adelie: "foxtrot",
};
