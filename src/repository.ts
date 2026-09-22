import { loadState, saveState } from "./storage";
import type { CheckIn, LocalAppState, SessionLog, WeightEntry } from "./types";
import { planFromState, type UserPlan } from "./syncMerge";
import { upsertWeightEntry } from "./weightLog";

/**
 * Persistence boundary from docs/PRODUCTION.md.
 * Check-ins and weight entries are included because they sync with the same privacy rules.
 * A syncing repository composes this local store; it does not replace guest storage.
 */
export interface RehabRepository {
  readSnapshot(): Promise<LocalAppState>;
  savePlan(plan: UserPlan): Promise<void>;
  saveSession(session: SessionLog): Promise<void>;
  saveCheckIn(checkIn: CheckIn): Promise<void>;
  saveWeight(entry: WeightEntry): Promise<void>;
  exportData(): Promise<string>;
}

export function createLocalStorageRehabRepository(): RehabRepository {
  return {
    async readSnapshot() {
      return loadState().state;
    },
    async savePlan(plan) {
      const current = loadState().state;
      saveState({
        ...current,
        ...plan,
        sessions: current.sessions,
        checkIns: current.checkIns,
        weightEntries: current.weightEntries,
        sessionDraft: current.sessionDraft,
        syncConsentAt: current.syncConsentAt,
      });
    },
    async saveSession(session) {
      const current = loadState().state;
      if (current.sessions.some((item) => item.id === session.id)) return;
      saveState({ ...current, sessions: [session, ...current.sessions] });
    },
    async saveCheckIn(checkIn) {
      const current = loadState().state;
      if (current.checkIns.some((item) => item.id === checkIn.id)) return;
      saveState({ ...current, checkIns: [...current.checkIns, checkIn] });
    },
    async saveWeight(entry) {
      const current = loadState().state;
      saveState({ ...current, weightEntries: upsertWeightEntry(current.weightEntries, entry) });
    },
    async exportData() {
      return JSON.stringify(loadState().state, null, 2);
    },
  };
}

export function planForRepository(state: LocalAppState) {
  return planFromState(state);
}
