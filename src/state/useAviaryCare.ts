"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { BirdFollowKind, BirdFollowUp, BirdNote, FollowPriority } from "@/domain/aviaryCare";
import type { TrackingDataset } from "@/domain/aviaryTracking";
import { seedAviaryCare } from "@/data/aviaryCareSeed";
import { CURRENT_USER } from "./DemoProvider";

/**
 * Follow-ups and keeper notes of the aviary, kept in this browser like the penguin ones.
 * They belong to the registry they were made on: a new registry starts from the seed again.
 */

interface CareState {
  createdAt: number;
  cases: BirdFollowUp[];
  notes: BirdNote[];
}

const KEY = "aviary-demo/care/v2";
let state: CareState | null = null;
const listeners = new Set<() => void>();
const EMPTY: CareState = { createdAt: 0, cases: [], notes: [] };

function load(ds: TrackingDataset): CareState {
  const createdAt = ds.registry.createdAt;
  if (state?.createdAt === createdAt) return state;
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as CareState) : null;
    if (saved && saved.createdAt === createdAt && Array.isArray(saved.cases) && Array.isArray(saved.notes)) {
      state = saved;
      return state;
    }
  } catch {}
  state = { createdAt, ...seedAviaryCare(ds) };
  save();
  return state;
}

function save() {
  try {
    if (state) window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // No storage: changes last for this session only.
  }
}

function update(fn: (s: CareState) => CareState) {
  if (!state) return;
  state = fn(state);
  save();
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface NewFollowUp {
  birdId: string;
  kind: BirdFollowKind;
  title: string;
  owner: string;
  priority: FollowPriority;
  text: string;
  weightKg?: number;
  nextReviewAt?: number;
}

/** The aviary care records, and the actions the follow-up screens use. */
export function useAviaryCare(ds: TrackingDataset) {
  const s = useSyncExternalStore(
    subscribe,
    () => load(ds),
    () => EMPTY,
  );

  const openCase = useCallback((input: NewFollowUp, at: number) => {
    const id = `FU-${input.birdId}-U${at}`;
    update((c) => ({
      ...c,
      cases: [
        {
          id,
          birdId: input.birdId,
          kind: input.kind,
          title: input.title,
          owner: input.owner,
          priority: input.priority,
          openedAt: at,
          nextReviewAt: input.nextReviewAt,
          status: "open",
          entries: [{ id: `${id}-0`, at, by: CURRENT_USER, text: input.text, weightKg: input.weightKg }],
          simulated: false,
        },
        ...c.cases,
      ],
    }));
    return id;
  }, []);

  const addEntry = useCallback((caseId: string, text: string, at: number, weightKg?: number) => {
    update((c) => ({ ...c, cases: c.cases.map((x) => (x.id === caseId ? { ...x, entries: [{ id: `${caseId}-${at}-${x.entries.length}`, at, by: CURRENT_USER, text, weightKg }, ...x.entries] } : x)) }));
  }, []);

  const closeCase = useCallback((caseId: string, text: string, at: number) => {
    update((c) => ({
      ...c,
      cases: c.cases.map((x) =>
        x.id === caseId ? { ...x, status: "closed", closedAt: at, nextReviewAt: undefined, entries: [{ id: `${caseId}-close-${at}`, at, by: CURRENT_USER, text: text || "Follow-up closed." }, ...x.entries] } : x,
      ),
    }));
  }, []);

  const updateCase = useCallback((caseId: string, patch: Partial<Pick<BirdFollowUp, "priority" | "nextReviewAt">>) => {
    update((c) => ({ ...c, cases: c.cases.map((x) => (x.id === caseId ? { ...x, ...patch } : x)) }));
  }, []);

  const addNote = useCallback((birdId: string, text: string, at: number) => {
    update((c) => ({ ...c, notes: [{ id: `NOTE-U${at}-${birdId}`, birdId, at, by: CURRENT_USER, text, simulated: false }, ...c.notes] }));
  }, []);

  return { cases: s.cases, notes: s.notes, openCase, addEntry, closeCase, updateCase, addNote };
}
