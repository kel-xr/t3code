import { isRuntimeModeAvailableForProvider, type RuntimeMode } from "@t3tools/contracts";
import { type LucideIcon, LockIcon, LockOpenIcon, PenLineIcon, SparklesIcon } from "lucide-react";

export const runtimeModeConfig: Record<
  RuntimeMode,
  { label: string; description: string; icon: LucideIcon }
> = {
  "approval-required": {
    label: "Supervised",
    description: "Ask before commands and file changes.",
    icon: LockIcon,
  },
  "auto-accept-edits": {
    label: "Auto-accept edits",
    description: "Auto-approve edits, ask before other actions.",
    icon: PenLineIcon,
  },
  auto: {
    label: "Auto",
    description: "Supported providers approve routine actions; others still ask.",
    icon: SparklesIcon,
  },
  "codex-auto-full-access": {
    label: "Approve for me",
    description: "Codex auto-reviews sensitive actions with unrestricted system access.",
    icon: SparklesIcon,
  },
  "full-access": {
    label: "Full access",
    description: "Allow commands and edits without prompts.",
    icon: LockOpenIcon,
  },
};

export const runtimeModeOptions = Object.keys(runtimeModeConfig) as RuntimeMode[];

/** Modes the composer offers for one provider (KelXR: "Approve for me" is Codex-only). */
export function runtimeModeOptionsForProvider(providerDriver: string): RuntimeMode[] {
  return runtimeModeOptions.filter((mode) =>
    isRuntimeModeAvailableForProvider(mode, providerDriver),
  );
}
