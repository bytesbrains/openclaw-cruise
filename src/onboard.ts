/** Cruise onboarding config helpers. */
import {
  createModelCatalogPresetAppliers,
  type OpenClawConfig,
} from "openclaw/plugin-sdk/provider-onboard";
import { buildStaticCruiseModels, CRUISE_BASE_URL, CRUISE_DEFAULT_MODEL_REF } from "./models.js";

const cruisePresetAppliers = createModelCatalogPresetAppliers({
  primaryModelRef: CRUISE_DEFAULT_MODEL_REF,
  resolveParams: (_cfg: OpenClawConfig) => ({
    providerId: "cruise",
    api: "openai-completions",
    baseUrl: CRUISE_BASE_URL,
    catalogModels: buildStaticCruiseModels(),
  }),
});

/** Applies Cruise's provider catalog and default model during onboarding. */
export function applyCruiseConfig(cfg: OpenClawConfig): OpenClawConfig {
  return cruisePresetAppliers.applyConfig(cfg);
}
