import { useId, useState } from "react";
import { GaugeIcon } from "lucide-react";
import {
  KELXR_COMPACTION_PRESETS,
  isKelxrCompactionTokenLimit,
  type KelxrCompactionCapability,
  type KelxrCompactionTokenLimit,
} from "@t3tools/shared/kelxrCompactionPolicy";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { formatContextWindowTokens, type ContextWindowSnapshot } from "~/lib/contextWindow";

export function ContextControl({
  capability,
  tokenLimit,
  usage,
  modelName,
  modelCapacity,
  providerAutoCompactThreshold,
  providerName,
  thresholdNote,
  changeDisabledReason,
  onChange,
  onCompact,
  compactDisabled,
  compactDisabledReason,
  manualUnavailableReason,
}: {
  capability: KelxrCompactionCapability;
  tokenLimit: KelxrCompactionTokenLimit | null;
  usage: ContextWindowSnapshot | null;
  modelName: string;
  modelCapacity: number | null;
  providerAutoCompactThreshold?: number | undefined;
  providerName: string;
  thresholdNote: string;
  changeDisabledReason?: string | null | undefined;
  onChange: (limit: KelxrCompactionTokenLimit | null) => void;
  onCompact?: (() => void) | undefined;
  compactDisabled?: boolean | undefined;
  compactDisabledReason?: string | null | undefined;
  manualUnavailableReason?: string | undefined;
}) {
  const [custom, setCustom] = useState(tokenLimit?.toString() ?? "");
  const customId = useId();
  const value = Number(custom);
  const capacity = usage?.maxTokens ?? modelCapacity;
  const automaticThreshold = usage?.autoCompactThreshold ?? providerAutoCompactThreshold ?? null;
  const threshold = (capability === "configurable" ? tokenLimit : null) ?? automaticThreshold;
  const bars = [
    { label: "Model", limit: capacity, color: "bg-primary", empty: "not reported" },
    { label: "Compact", limit: threshold, color: "bg-warning", empty: "auto · not reported" },
  ];
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setCustom(tokenLimit?.toString() ?? "");
      }}
    >
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            aria-label="Context and compaction"
            title={`${modelName} · ${providerName}. Reported capacity and compaction threshold.`}
          />
        }
      >
        <GaugeIcon className="size-4" />
        <span className="grid w-36 gap-1 text-xs leading-none tabular-nums" aria-hidden="true">
          {bars.map((bar) => (
            <span key={bar.label} className="grid grid-cols-[3.5rem_1fr_2.3rem] items-center gap-1">
              <span className="text-left text-muted-foreground">{bar.label}</span>
              <span className="h-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={`block h-full ${bar.color}`}
                  style={{
                    width: `${usage && bar.limit ? Math.min(100, (usage.usedTokens / bar.limit) * 100) : 0}%`,
                  }}
                />
              </span>
              <span className="text-right text-muted-foreground">
                {bar.limit
                  ? formatContextWindowTokens(bar.limit)
                  : bar.label === "Model"
                    ? "—"
                    : "auto"}
              </span>
            </span>
          ))}
        </span>
      </PopoverTrigger>
      <PopoverPopup
        align="end"
        side="top"
        className="w-80 max-w-[calc(100vw-2rem)]"
        aria-label="Context and compaction"
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Context</p>
            <p className="text-xs text-muted-foreground">
              {modelName} · {providerName}
            </p>
            <p className="text-xs text-muted-foreground">
              {usage
                ? `${formatContextWindowTokens(usage.usedTokens)} used${usage.maxTokens ? ` of ${formatContextWindowTokens(usage.maxTokens)}` : ""}`
                : "The provider reports usage when the session starts."}
            </p>
          </div>
          <div className="space-y-2">
            {bars.map((bar) => (
              <div key={bar.label} className="space-y-1">
                <div className="flex justify-between gap-2 text-xs">
                  <span>
                    {bar.label === "Model" ? "Reported capacity" : "Configured threshold"}
                  </span>
                  <span>
                    {usage ? formatContextWindowTokens(usage.usedTokens) : "—"} /{" "}
                    {bar.limit ? formatContextWindowTokens(bar.limit) : bar.empty}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={bar.label}
                  aria-valuemin={0}
                  aria-valuemax={bar.limit ?? undefined}
                  aria-valuenow={
                    usage && bar.limit ? Math.min(usage.usedTokens, bar.limit) : undefined
                  }
                  aria-valuetext={bar.limit ? undefined : bar.empty}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={`h-full ${bar.color}`}
                    style={{
                      width: `${usage && bar.limit ? Math.min(100, (usage.usedTokens / bar.limit) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {capability === "provider-managed" ? (
            <p className="text-sm text-muted-foreground">This provider manages compaction.</p>
          ) : (
            <>
              <label className="block space-y-1 text-sm">
                <span>Compact near</span>
                <select
                  aria-label="Compaction threshold"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  disabled={Boolean(changeDisabledReason)}
                  value={tokenLimit ?? "default"}
                  onChange={(event) =>
                    onChange(event.target.value === "default" ? null : Number(event.target.value))
                  }
                >
                  <option value="default">
                    Provider default
                    {automaticThreshold
                      ? ` · ${formatContextWindowTokens(automaticThreshold)} tokens`
                      : ""}
                  </option>
                  {KELXR_COMPACTION_PRESETS.map(({ label, tokenLimit: limit }) => (
                    <option key={limit} value={limit}>
                      {label} · {formatContextWindowTokens(limit)} tokens
                    </option>
                  ))}
                  {tokenLimit !== null &&
                    !KELXR_COMPACTION_PRESETS.some(
                      (preset) => preset.tokenLimit === tokenLimit,
                    ) && (
                      <option value={tokenLimit}>
                        Custom · {formatContextWindowTokens(tokenLimit)} tokens
                      </option>
                    )}
                </select>
              </label>
              <div className="space-y-1 text-sm">
                <label htmlFor={customId}>Custom tokens · this thread</label>
                <div
                  className="flex gap-2"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!changeDisabledReason && isKelxrCompactionTokenLimit(value))
                        onChange(value);
                    }
                  }}
                >
                  <Input
                    nativeInput
                    id={customId}
                    type="number"
                    min={8000}
                    step={1}
                    aria-label="Tokens personalizados"
                    placeholder="e.g. 175000"
                    value={custom}
                    aria-invalid={custom !== "" && !isKelxrCompactionTokenLimit(value)}
                    onChange={(event) => setCustom(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={Boolean(changeDisabledReason) || !isKelxrCompactionTokenLimit(value)}
                    onClick={() => {
                      if (isKelxrCompactionTokenLimit(value)) onChange(value);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
              {custom !== "" && !isKelxrCompactionTokenLimit(value) && (
                <p className="text-xs text-destructive">
                  Enter a whole number of at least 8000 tokens.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Saved for this thread only. {changeDisabledReason ?? thresholdNote}
              </p>
            </>
          )}
          {onCompact && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCompact}
              disabled={compactDisabled}
            >
              Compact context
            </Button>
          )}
          {onCompact && compactDisabled && compactDisabledReason && (
            <p className="text-xs text-muted-foreground">{compactDisabledReason}</p>
          )}
          {!onCompact && manualUnavailableReason && (
            <p className="text-xs text-muted-foreground">{manualUnavailableReason}</p>
          )}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
