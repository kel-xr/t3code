import { describe, expect, it } from "vite-plus/test";
import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import {
  kelxrCompactionCapability,
  readKelxrCompactionTokenLimit,
  withKelxrCompactionTokenLimit,
} from "./kelxrCompactionPolicy.ts";

const selection = {
  instanceId: ProviderInstanceId.make("codex"),
  model: "gpt-5.6-luna",
  options: [{ id: "reasoningEffort", value: "low" }],
} as const;

describe("lab compaction policy", () => {
  it("accepts exact custom counts beyond the largest preset", () => {
    for (const limit of [175_321, 900_000]) {
      expect(
        readKelxrCompactionTokenLimit(
          withKelxrCompactionTokenLimit(selection, ProviderDriverKind.make("codex"), limit),
        ),
      ).toBe(limit);
    }
  });
  it("accepts a low custom threshold for bounded runtime validation", () => {
    expect(
      readKelxrCompactionTokenLimit(
        withKelxrCompactionTokenLimit(selection, ProviderDriverKind.make("codex"), 8_000),
      ),
    ).toBe(8_000);
    expect(
      readKelxrCompactionTokenLimit({
        ...selection,
        options: [{ id: "kelxrCompactionTokenLimit", value: "NaN" }],
      }),
    ).toBeNull();
  });
  it("round-trips a configurable provider threshold without losing model options", () => {
    const configured = withKelxrCompactionTokenLimit(
      selection,
      ProviderDriverKind.make("codex"),
      280_000,
    );
    expect(readKelxrCompactionTokenLimit(configured)).toBe(280_000);
    expect(configured.options).toContainEqual({ id: "reasoningEffort", value: "low" });
  });

  it("removes the lab threshold for provider-managed harnesses", () => {
    const configured = withKelxrCompactionTokenLimit(
      selection,
      ProviderDriverKind.make("codex"),
      120_000,
    );
    const managed = withKelxrCompactionTokenLimit(
      configured,
      ProviderDriverKind.make("cursor"),
      500_000,
    );
    expect(readKelxrCompactionTokenLimit(managed)).toBeNull();
    expect(kelxrCompactionCapability(ProviderDriverKind.make("cursor"))).toBe("provider-managed");
  });

  it("exposes the external threshold controller for OpenCode", () => {
    expect(kelxrCompactionCapability(ProviderDriverKind.make("opencode"))).toBe("configurable");
  });
});
