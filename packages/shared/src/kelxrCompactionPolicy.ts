import type { ModelSelection, ProviderDriverKind } from "@t3tools/contracts";

export const KELXR_COMPACTION_TOKEN_LIMIT_OPTION_ID = "kelxrCompactionTokenLimit";
export const KELXR_COMPACTION_PRESETS = [
  { label: "Short", tokenLimit: 120_000 },
  { label: "Normal", tokenLimit: 280_000 },
  { label: "Long", tokenLimit: 500_000 },
  { label: "Max", tokenLimit: 850_000 },
] as const;
export const KELXR_COMPACTION_TOKEN_LIMITS = KELXR_COMPACTION_PRESETS.map(
  ({ tokenLimit }) => tokenLimit,
);

export type KelxrCompactionTokenLimit = number;
export type KelxrCompactionCapability = "configurable" | "provider-managed";

export function kelxrCompactionCapability(provider: ProviderDriverKind): KelxrCompactionCapability {
  return provider === "codex" || provider === "opencode" ? "configurable" : "provider-managed";
}

export function isKelxrCompactionTokenLimit(value: unknown): value is KelxrCompactionTokenLimit {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 8_000;
}

export function readKelxrCompactionTokenLimit(
  modelSelection: ModelSelection | null | undefined,
): KelxrCompactionTokenLimit | null {
  const raw = modelSelection?.options?.find(
    (selection) => selection.id === KELXR_COMPACTION_TOKEN_LIMIT_OPTION_ID,
  )?.value;
  if (typeof raw !== "string") return null;
  const parsed = Number(raw);
  return isKelxrCompactionTokenLimit(parsed) ? parsed : null;
}

export function withKelxrCompactionTokenLimit(
  modelSelection: ModelSelection,
  provider: ProviderDriverKind,
  tokenLimit: KelxrCompactionTokenLimit | null,
): ModelSelection {
  const options = (modelSelection.options ?? []).filter(
    (selection) => selection.id !== KELXR_COMPACTION_TOKEN_LIMIT_OPTION_ID,
  );
  if (kelxrCompactionCapability(provider) === "configurable" && tokenLimit !== null) {
    options.push({ id: KELXR_COMPACTION_TOKEN_LIMIT_OPTION_ID, value: String(tokenLimit) });
  }
  return options.length > 0
    ? { ...modelSelection, options }
    : { instanceId: modelSelection.instanceId, model: modelSelection.model };
}
