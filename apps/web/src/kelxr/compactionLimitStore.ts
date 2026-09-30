import { createJSONStorage, persist } from "zustand/middleware";
import { create } from "zustand";
import type { KelxrCompactionTokenLimit } from "@t3tools/shared/kelxrCompactionPolicy";
import { resolveStorage } from "~/lib/storage";

// KelXR: compaction threshold chosen per thread, keyed by the scoped thread key. A draft already
// carries the thread id it is promoted to, so the key survives promotion. The storage name is
// kept so thresholds saved by earlier fork builds still apply.
interface CompactionLimitStore {
  readonly byThreadKey: Readonly<Record<string, KelxrCompactionTokenLimit>>;
  setLimit: (threadKey: string, tokenLimit: KelxrCompactionTokenLimit | null) => void;
}

export const useCompactionLimitStore = create<CompactionLimitStore>()(
  persist(
    (set) => ({
      byThreadKey: {},
      setLimit: (threadKey, tokenLimit) =>
        set((state) => {
          const byThreadKey = { ...state.byThreadKey };
          if (tokenLimit === null) delete byThreadKey[threadKey];
          else byThreadKey[threadKey] = tokenLimit;
          return { byThreadKey };
        }),
    }),
    {
      name: "t3code:kelxr-lifecycle:v1",
      version: 4,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({ byThreadKey: state.byThreadKey }),
      migrate: (persisted, version) => {
        const stored = (persisted as { byThreadKey?: Record<string, unknown> } | null)?.byThreadKey;
        if (version >= 4 || !stored)
          return { byThreadKey: (stored ?? {}) as CompactionLimitStore["byThreadKey"] };
        const byThreadKey: Record<string, KelxrCompactionTokenLimit> = {};
        for (const [threadKey, value] of Object.entries(stored)) {
          const limit = (value as { compactionTokenLimit?: KelxrCompactionTokenLimit | null })
            ?.compactionTokenLimit;
          if (limit !== undefined && limit !== null) byThreadKey[threadKey] = limit;
        }
        return { byThreadKey };
      },
    },
  ),
);
