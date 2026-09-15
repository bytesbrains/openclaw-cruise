import { describe, expect, it } from "vitest";
import {
  microsToDollarsPerMtok,
  projectCruiseLiveModels,
  resolveAllowedCruiseBaseUrl,
  resolveCruiseDynamicModel,
  buildStaticCruiseModels,
  CRUISE_BASE_URL,
  CRUISE_DEMO_BASE_URL,
} from "../src/models.js";
import { buildStaticCruiseProvider } from "../src/provider-catalog.js";

describe("microsToDollarsPerMtok", () => {
  it("converts Cruise micros to dollars per million tokens", () => {
    expect(microsToDollarsPerMtok(220_000)).toBe(0.22);
    expect(microsToDollarsPerMtok(0)).toBe(0);
    expect(microsToDollarsPerMtok("14000")).toBe(0.014);
    expect(microsToDollarsPerMtok(null)).toBeUndefined();
    expect(microsToDollarsPerMtok(-1)).toBeUndefined();
  });
});

describe("resolveAllowedCruiseBaseUrl", () => {
  it("allows production and demo HTTPS hosts", () => {
    expect(resolveAllowedCruiseBaseUrl(CRUISE_BASE_URL)).toBe(CRUISE_BASE_URL);
    expect(resolveAllowedCruiseBaseUrl(CRUISE_DEMO_BASE_URL)).toBe(CRUISE_DEMO_BASE_URL);
  });

  it("rejects non-Cruise and non-HTTPS hosts", () => {
    expect(resolveAllowedCruiseBaseUrl("http://cruise.bytesbrains.net/v1")).toBe(CRUISE_BASE_URL);
    expect(resolveAllowedCruiseBaseUrl("https://169.254.169.254/")).toBe(CRUISE_BASE_URL);
    expect(resolveAllowedCruiseBaseUrl("https://evil.example/v1")).toBe(CRUISE_BASE_URL);
    expect(resolveAllowedCruiseBaseUrl("not a url")).toBe(CRUISE_BASE_URL);
  });
});

describe("projectCruiseLiveModels", () => {
  it("maps chat models and lanes from x-cruise metadata", () => {
    const models = projectCruiseLiveModels([
      {
        id: "deepseek/deepseek-v4-flash",
        object: "model",
        "x-cruise": {
          modality: "chat",
          tools: true,
          vision: null,
          max_context: 1_000_000,
          max_output: 384_000,
          pricing: {
            input_micros_per_mtok: 220_000,
            output_micros_per_mtok: 660_000,
            cached_input_micros_per_mtok: 7_000,
          },
        },
      },
      {
        id: "bb/agentic-coding",
        object: "model",
        "x-cruise": {
          lane: true,
          job: "agentic-coding",
          description: "Agent loops that write and repair code.",
          modality: "chat",
          tools: true,
          vision: false,
          max_context: 262_144,
          max_output: 64_000,
          pricing: {
            input_micros_per_mtok: 440_000,
            output_micros_per_mtok: 1_320_000,
            cached_input_micros_per_mtok: 14_000,
          },
        },
      },
      {
        id: "some/image-model",
        object: "model",
        "x-cruise": {
          modality: "image",
          max_context: 1,
          max_output: 1,
          pricing: {
            input_micros_per_mtok: 0,
            output_micros_per_mtok: 0,
            cached_input_micros_per_mtok: null,
          },
        },
      },
    ]);

    expect(models.map((m) => m.id)).toEqual([
      "deepseek/deepseek-v4-flash",
      "bb/agentic-coding",
    ]);

    const flash = models[0]!;
    expect(flash.cost).toEqual({
      input: 0.22,
      output: 0.66,
      cacheRead: 0.007,
      cacheWrite: 0,
    });
    expect(flash.contextWindow).toBe(1_000_000);
    expect(flash.maxTokens).toBe(384_000);
    expect(flash.input).toEqual(["text"]);

    const lane = models[1]!;
    expect(lane.name).toBe("Agent loops that write and repair code.");
    expect(lane.reasoning).toBe(true);
    expect(lane.cost.input).toBe(0.44);
    expect(lane.contextWindow).toBe(262_144);
  });

  it("drops rows without usable x-cruise unless they match a static seed", () => {
    const models = projectCruiseLiveModels([
      { id: "unknown/no-meta", object: "model" },
      { id: "bb/chat-assistant", object: "model" },
    ]);
    expect(models.map((m) => m.id)).toEqual(["bb/chat-assistant"]);
  });

  it("trims live ids before static fallback lookup", () => {
    const models = projectCruiseLiveModels([
      {
        id: "  bb/agentic-coding  ",
        object: "model",
        "x-cruise": {
          lane: true,
          job: "agentic-coding",
          modality: "chat",
          max_context: 200_000,
          max_output: 16_000,
          pricing: {
            input_micros_per_mtok: 100_000,
            output_micros_per_mtok: 200_000,
            cached_input_micros_per_mtok: 10_000,
          },
        },
      },
    ]);
    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe("bb/agentic-coding");
    expect(models[0]!.contextWindow).toBe(200_000);
  });

  it("requires modality chat when x-cruise is present", () => {
    const models = projectCruiseLiveModels([
      {
        id: "mystery/no-modality",
        object: "model",
        "x-cruise": {
          tools: true,
          max_context: 128_000,
          pricing: { input_micros_per_mtok: 1, output_micros_per_mtok: 1 },
        },
      },
    ]);
    expect(models).toEqual([]);
  });

  it("prefers live lane job for reasoning over a stale seed false", () => {
    const models = projectCruiseLiveModels([
      {
        id: "bb/chat-assistant",
        object: "model",
        "x-cruise": {
          lane: true,
          job: "deep-reasoning",
          modality: "chat",
          max_context: 128_000,
          max_output: 8_192,
          pricing: {
            input_micros_per_mtok: 1_000_000,
            output_micros_per_mtok: 2_000_000,
            cached_input_micros_per_mtok: null,
          },
        },
      },
    ]);
    expect(models[0]!.reasoning).toBe(true);
  });

  it("does not inherit seed placeholder costs when live x-cruise has null pricing", () => {
    const models = projectCruiseLiveModels([
      {
        id: "bb/agentic-coding",
        object: "model",
        "x-cruise": {
          lane: true,
          job: "agentic-coding",
          modality: "chat",
          max_context: 128_000,
          max_output: 8_192,
          pricing: null,
        },
      },
    ]);
    // Seed costs are also 0; the contract is we do not prefer seed over live absence.
    expect(models[0]!.cost).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });

  it("keeps last row on duplicate ids", () => {
    const models = projectCruiseLiveModels([
      {
        id: "dup/model",
        object: "model",
        "x-cruise": {
          modality: "chat",
          max_context: 1_000,
          max_output: 100,
          pricing: {
            input_micros_per_mtok: 1_000_000,
            output_micros_per_mtok: 1_000_000,
            cached_input_micros_per_mtok: 0,
          },
        },
      },
      {
        id: "dup/model",
        object: "model",
        "x-cruise": {
          modality: "chat",
          max_context: 2_000,
          max_output: 200,
          pricing: {
            input_micros_per_mtok: 2_000_000,
            output_micros_per_mtok: 2_000_000,
            cached_input_micros_per_mtok: 0,
          },
        },
      },
    ]);
    expect(models).toHaveLength(1);
    expect(models[0]!.contextWindow).toBe(2_000);
    expect(models[0]!.cost.input).toBe(2);
  });

  it("sets supportsTools false when live tools is false", () => {
    const models = projectCruiseLiveModels([
      {
        id: "no-tools/model",
        object: "model",
        "x-cruise": {
          modality: "chat",
          tools: false,
          max_context: 8_000,
          max_output: 1_000,
          pricing: {
            input_micros_per_mtok: 1,
            output_micros_per_mtok: 1,
            cached_input_micros_per_mtok: 0,
          },
        },
      },
    ]);
    expect(models[0]!.compat?.supportsTools).toBe(false);
  });
});

describe("buildStaticCruiseModels", () => {
  it("seeds the recipe lanes offline", () => {
    const ids = buildStaticCruiseModels().map((m) => m.id);
    expect(ids).toContain("bb/agentic-coding");
    expect(ids).toContain("bb/chat-assistant");
  });
});

describe("buildStaticCruiseProvider", () => {
  it("exposes production base URL and seed models", () => {
    const provider = buildStaticCruiseProvider();
    expect(provider.baseUrl).toBe(CRUISE_BASE_URL);
    expect(provider.api).toBe("openai-completions");
    expect(provider.models.length).toBeGreaterThan(0);
  });
});

describe("resolveCruiseDynamicModel", () => {
  it("forwards unknown Cruise ids with an allowed base URL", () => {
    const model = resolveCruiseDynamicModel("bb/hunter", CRUISE_DEMO_BASE_URL);
    expect(model).toMatchObject({
      id: "bb/hunter",
      provider: "cruise",
      api: "openai-completions",
      baseUrl: CRUISE_DEMO_BASE_URL,
    });
  });

  it("skips ids already in the static catalog", () => {
    expect(resolveCruiseDynamicModel("bb/agentic-coding")).toBeUndefined();
  });

  it("falls back to production when baseUrl is disallowed", () => {
    const model = resolveCruiseDynamicModel("bb/hunter", "https://evil.example/v1");
    expect(model?.baseUrl).toBe(CRUISE_BASE_URL);
  });
});
