import { create } from "zustand";
import { applyServiceWorkerUpdate } from "../utils/sw-register";

/**
 * PWA / service worker UI state. Updated by `registerServiceWorker` in sw-register
 * and by user actions (dismiss, retry) from InstallPrompt / UpdateBanner.
 */
export type ServiceWorkerUiPhase =
  | "idle"
  | "registering"
  | "ready"
  | "update_available"
  | "error"
  | "unsupported";

export type ServiceWorkerStore = {
  phase: ServiceWorkerUiPhase;
  error: string | null;
  registration: ServiceWorkerRegistration | null;

  setPhase: (phase: ServiceWorkerUiPhase) => void;
  setError: (message: string | null) => void;
  setRegistration: (reg: ServiceWorkerRegistration | null) => void;
  setUpdateAvailable: (available?: boolean) => void;
  /** Dispatches message to the waiting worker to take immediate control and reloads. */
  applyUpdate: () => void;
  /** Hide the "new version" bar until a future update is detected. */
  dismissUpdateBanner: () => void;
  clearError: () => void;
  /** Tests only: reset to initial. */
  reset: () => void;
};

const initial = {
  phase: "idle" as ServiceWorkerUiPhase,
  error: null as string | null,
  registration: null as ServiceWorkerRegistration | null,
};

export const useServiceWorkerStore = create<ServiceWorkerStore>((set, get) => ({
  ...initial,

  setPhase: (phase) => set({ phase }),

  setError: (message) => {
    if (message) {
      set({ error: message, phase: "error" });
      return;
    }
    set((s) => ({
      error: null,
      phase: s.phase === "error" ? "ready" : s.phase,
    }));
  },

  setRegistration: (registration) => set({ registration }),

  setUpdateAvailable: (available = true) => {
    if (get().phase === "error") return;
    if (available) {
      set({ phase: "update_available", error: null });
    } else {
      set((s) => ({
        phase: s.phase === "update_available" ? "ready" : s.phase,
      }));
    }
  },

  applyUpdate: () => {
    // Gracefully trigger the centralized lifecycle skip-waiting sequence 
    applyServiceWorkerUpdate();
  },

  dismissUpdateBanner: () => {
    set({ phase: "ready" });
  },

  clearError: () => {
    set((s) => ({
      error: null,
      phase: s.phase === "error" ? "idle" : s.phase,
    }));
  },

  reset: () => set({ ...initial }),
}));