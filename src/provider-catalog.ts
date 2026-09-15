/** Cruise static provider catalog builder. */
import type { ModelProviderConfig } from "openclaw/plugin-sdk/provider-model-shared";
import { buildStaticCruiseModels, CRUISE_BASE_URL } from "./models.js";

/** Builds Cruise's network-free fallback provider catalog. */
export function buildStaticCruiseProvider(): ModelProviderConfig {
  return {
    baseUrl: CRUISE_BASE_URL,
    api: "openai-completions",
    models: buildStaticCruiseModels(),
  };
}
