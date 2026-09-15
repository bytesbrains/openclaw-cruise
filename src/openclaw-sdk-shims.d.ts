/**
 * Ambient types for OpenClaw plugin-sdk subpaths that ship JS without .d.ts
 * in openclaw@2026.9.4. Keep these minimal and local — the host still owns runtime.
 */
declare module "openclaw/plugin-sdk/provider-entry" {
  import type { OpenClawPluginDefinition } from "openclaw/plugin-sdk/plugin-entry";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function defineSingleProviderPluginEntry(config: any): OpenClawPluginDefinition;
}

declare module "openclaw/plugin-sdk/provider-catalog-shared" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function readManifestProviderDefaultModelRef(manifest: any, providerId: string): string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function readConfiguredProviderCatalogEntries(opts: { config: any; providerId: string }): any;
}

declare module "openclaw/plugin-sdk/provider-model-shared" {
  export type ModelCompatConfig = {
    supportsStore?: boolean;
    supportsDeveloperRole?: boolean;
    supportsUsageInStreaming?: boolean;
    supportsTools?: boolean;
    maxTokensField?: "max_tokens" | "max_completion_tokens";
    codeMode?: string;
  };

  export type ModelDefinitionConfig = {
    id: string;
    name: string;
    reasoning: boolean;
    input: Array<"text" | "image">;
    cost: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
    };
    contextWindow: number;
    maxTokens: number;
    compat?: ModelCompatConfig;
  };

  export type ModelProviderConfig = {
    baseUrl: string;
    api: "openai-completions" | string;
    models: ModelDefinitionConfig[];
    apiKey?: string;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function buildProviderReplayFamilyHooks(opts: any): Record<string, unknown>;
}

declare module "openclaw/plugin-sdk/provider-tools" {
  export function buildProviderToolCompatFamilyHooks(
    family: string,
  ): Record<string, unknown>;
}

declare module "openclaw/plugin-sdk/provider-onboard" {
  import type { OpenClawConfig } from "openclaw/plugin-sdk/plugin-entry";
  export type { OpenClawConfig };
  export function createModelCatalogPresetAppliers(opts: {
    primaryModelRef: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolveParams: (cfg: OpenClawConfig) => any;
  }): {
    applyConfig: (cfg: OpenClawConfig) => OpenClawConfig;
  };
}
