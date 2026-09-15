import { describe, expect, it } from "vitest";
import {
  microsToDollarsPerMtok,
  projectCruiseLiveModels,
  resolveCruiseDynamicModel,
  buildStaticCruiseModels,
  CRUISE_BASE_URL,
} from "../src/models.js";

describe("microsToDollarsPerMtok", () => {
  it("converts Cruise micros to dollars per million tokens", () => {
    expect(microsToDollarsPerMtok(220_000)).toBe(0.22);
    expect(microsToDollarsPerMtok(0)).toBe(0);
    expect(microsToDollarsPerMtok("14000")).toBe(0.014);
    expect(microsToDollarsPerMtok(null)).toBeUndefined();
    expect(microsToDollarsPerMtok(-1)).toBeUndefined();
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
});

describe("buildStaticCruiseModels", () => {
  it("seeds the recipe lanes offline", () => {
    const ids = buildStaticCruiseModels().map((m) => m.id);
    expect(ids).toContain("bb/agentic-coding");
    expect(ids).toContain("bb/chat-assistant");
  });
});

describe("resolveCruiseDynamicModel", () => {
  it("forwards unknown Cruise ids with the configured base URL", () => {
    const model = resolveCruiseDynamicModel("bb/hunter", CRUISE_BASE_URL);
    expect(model).toMatchObject({
      id: "bb/hunter",
      provider: "cruise",
      api: "openai-completions",
      baseUrl: CRUISE_BASE_URL,
    });
  });

  it("skips ids already in the static catalog", () => {
    expect(resolveCruiseDynamicModel("bb/agentic-coding")).toBeUndefined();
  });
});
