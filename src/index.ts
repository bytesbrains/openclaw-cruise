/** BytesBrains Cruise provider plugin entrypoint. */
import { readConfiguredProviderCatalogEntries } from "openclaw/plugin-sdk/provider-catalog-shared";
import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { buildProviderReplayFamilyHooks } from "openclaw/plugin-sdk/provider-model-shared";
import { buildProviderToolCompatFamilyHooks } from "openclaw/plugin-sdk/provider-tools";
import type { OpenClawPluginDefinition } from "openclaw/plugin-sdk/plugin-entry";
import manifest from "../openclaw.plugin.json" with { type: "json" };
import { projectCruiseLiveModels, resolveAllowedCruiseBaseUrl, resolveCruiseDynamicModel } from "./models.js";
import { applyCruiseConfig } from "./onboard.js";
import { buildStaticCruiseProvider } from "./provider-catalog.js";

const PROVIDER_ID = "cruise";

const cruisePlugin: OpenClawPluginDefinition = defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "BytesBrains Cruise",
  description:
    "BytesBrains Cruise — one OpenAI-compatible endpoint with budgets, lanes, and live GET /v1/models discovery",
  manifest,
  provider: {
    label: "BytesBrains Cruise",
    docsPath: "/providers/cruise",
    auth: [
      {
        methodId: "api-key",
        label: "Cruise API key",
        hint: "cru_demo_ or cru_live_ key from https://bytesbrains.com/cruise",
        optionKey: "cruiseApiKey",
        flagName: "--cruise-api-key",
        envVar: "CRUISE_API_KEY",
        promptMessage: "Enter your BytesBrains Cruise API key",
        defaultModel: "cruise/bb/agentic-coding",
      },
    ],
    manifestAuth: {
      applyConfig: applyCruiseConfig,
      noteTitle: "BytesBrains Cruise",
      noteMessage: [
        "Cruise is one OpenAI-compatible base URL in front of every model provider.",
        "Get a cru_demo_ or cru_live_ key at: https://bytesbrains.com/cruise",
        "Demo host: https://cruise-demo.bytesbrains.net/v1",
        "Production: https://cruise.bytesbrains.net/v1",
        "Custom baseUrl must be https and under *.bytesbrains.net.",
      ].join("\n"),
    },
    catalog: {
      buildProvider: buildStaticCruiseProvider,
      buildStaticProvider: buildStaticCruiseProvider,
      allowExplicitBaseUrl: true,
      liveModelDiscovery: {
        timeoutMs: 10_000,
        ttlMs: 60_000,
        projectRows: projectCruiseLiveModels,
      },
    },
    augmentModelCatalog: ({ config }: { config: unknown }) =>
      readConfiguredProviderCatalogEntries({
        config,
        providerId: PROVIDER_ID,
      }),
    resolveDynamicModel: ({
      modelId,
      providerConfig,
    }: {
      modelId: string;
      providerConfig?: { baseUrl?: unknown };
    }) => {
      const raw =
        typeof providerConfig?.baseUrl === "string" ? providerConfig.baseUrl : undefined;
      return resolveCruiseDynamicModel(modelId, resolveAllowedCruiseBaseUrl(raw));
    },
    ...buildProviderReplayFamilyHooks({
      family: "openai-compatible",
      dropReasoningFromHistory: false,
    }),
    ...buildProviderToolCompatFamilyHooks("openai"),
  },
});

export default cruisePlugin;
