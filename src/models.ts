/**
 * Cruise model catalog: static seeds, live GET /v1/models projection, dynamic ids.
 */
import type { ProviderRuntimeModel } from "openclaw/plugin-sdk/plugin-entry";
import type {
  ModelCompatConfig,
  ModelDefinitionConfig,
} from "openclaw/plugin-sdk/provider-model-shared";
import manifest from "../openclaw.plugin.json" with { type: "json" };

const CRUISE_MANIFEST_CATALOG = manifest.modelCatalog.providers.cruise;
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8_192;
const MICROS_PER_DOLLAR = 1_000_000;

/** Jobs that typically need extended thinking / tool-heavy agent loops. */
const REASONING_LANE_JOBS = new Set([
  "agentic-coding",
  "deep-reasoning",
  "code-review",
  "hunter",
  "builder",
]);

const CRUISE_MODEL_COMPAT: ModelCompatConfig = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsUsageInStreaming: true,
  supportsTools: true,
  maxTokensField: "max_tokens",
};

/** Production Cruise OpenAI-compatible base URL. */
export const CRUISE_BASE_URL = CRUISE_MANIFEST_CATALOG.baseUrl;
/** Demo Cruise host — set via provider `baseUrl` override (`allowExplicitBaseUrl`). */
export const CRUISE_DEMO_BASE_URL = "https://cruise-demo.bytesbrains.net/v1";
/** Default Cruise model id used for onboarding. */
export const CRUISE_DEFAULT_MODEL_ID = CRUISE_MANIFEST_CATALOG.defaultModel;
/** Default Cruise model ref (`cruise/<id>`) used for onboarding. */
export const CRUISE_DEFAULT_MODEL_REF = `cruise/${CRUISE_DEFAULT_MODEL_ID}`;
/** Bundled offline seed rows (replaced by live discovery when auth works). */
export const CRUISE_MODEL_CATALOG = CRUISE_MANIFEST_CATALOG.models;

type ManifestModelRow = (typeof CRUISE_MODEL_CATALOG)[number];

function fromManifestRow(row: ManifestModelRow): ModelDefinitionConfig {
  return {
    id: row.id,
    name: row.name,
    reasoning: row.reasoning,
    input: [...row.input] as ModelDefinitionConfig["input"],
    cost: { ...row.cost },
    contextWindow: row.contextWindow,
    maxTokens: row.maxTokens,
    compat: { ...CRUISE_MODEL_COMPAT },
  };
}

/** Builds the network-free fallback catalog. */
export function buildStaticCruiseModels(): ModelDefinitionConfig[] {
  return CRUISE_MODEL_CATALOG.map(fromManifestRow);
}

type CruiseLiveModelRow = {
  id?: unknown;
  object?: unknown;
  "x-cruise"?: unknown;
};

type CruiseExtension = {
  lane?: unknown;
  job?: unknown;
  description?: unknown;
  modality?: unknown;
  tools?: unknown;
  vision?: unknown;
  max_context?: unknown;
  max_output?: unknown;
  pricing?: unknown;
};

function readPositiveInteger(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

/**
 * Cruise publishes rates as integer micros per million tokens.
 * OpenClaw costs are dollars per million tokens → divide by 1e6.
 */
export function microsToDollarsPerMtok(micros: unknown): number | undefined {
  if (typeof micros !== "number" && (typeof micros !== "string" || !micros.trim())) {
    return undefined;
  }
  const number = typeof micros === "number" ? micros : Number(micros);
  if (!Number.isFinite(number) || number < 0) {
    return undefined;
  }
  return number / MICROS_PER_DOLLAR;
}

function readCruisePricing(value: unknown): {
  input?: number;
  output?: number;
  cacheRead?: number;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const pricing = value as Record<string, unknown>;
  return {
    input: microsToDollarsPerMtok(pricing.input_micros_per_mtok),
    output: microsToDollarsPerMtok(pricing.output_micros_per_mtok),
    cacheRead: microsToDollarsPerMtok(pricing.cached_input_micros_per_mtok),
  };
}

function readCruiseExtension(row: CruiseLiveModelRow): CruiseExtension | undefined {
  const raw = row["x-cruise"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  return raw as CruiseExtension;
}

function laneDisplayName(ext: CruiseExtension, id: string): string {
  if (typeof ext.description === "string" && ext.description.trim()) {
    return ext.description.trim();
  }
  if (typeof ext.job === "string" && ext.job.trim()) {
    return `Cruise ${ext.job.trim()} (lane)`;
  }
  return id;
}

function projectLiveModel(
  row: CruiseLiveModelRow,
  fallback: ModelDefinitionConfig | undefined,
): ModelDefinitionConfig | undefined {
  if (row.object !== undefined && row.object !== "model") {
    return undefined;
  }
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) {
    return undefined;
  }

  const ext = readCruiseExtension(row);
  // Chat inference only for v1. Image/speech/embedding rows are other OpenClaw surfaces.
  const modality = typeof ext?.modality === "string" ? ext.modality.trim().toLowerCase() : "";
  if (modality && modality !== "chat") {
    return undefined;
  }
  // Rows without x-cruise are unknown — keep only if a static seed already trusts the id.
  if (!ext && !fallback) {
    return undefined;
  }

  const isLane = ext?.lane === true;
  const job = typeof ext?.job === "string" ? ext.job.trim() : "";
  const pricing = readCruisePricing(ext?.pricing);

  const input: ModelDefinitionConfig["input"] =
    ext?.vision === true
      ? ["text", "image"]
      : ext?.vision === false
        ? ["text"]
        : (fallback?.input ?? ["text"]);

  const reasoning =
    fallback?.reasoning ??
    (isLane && REASONING_LANE_JOBS.has(job) ? true : false);

  return {
    id,
    name: isLane
      ? laneDisplayName(ext ?? {}, id)
      : (fallback?.name ?? id),
    reasoning,
    input,
    cost: {
      input: pricing.input ?? fallback?.cost.input ?? 0,
      output: pricing.output ?? fallback?.cost.output ?? 0,
      cacheRead: pricing.cacheRead ?? fallback?.cost.cacheRead ?? 0,
      cacheWrite: fallback?.cost.cacheWrite ?? 0,
    },
    contextWindow:
      readPositiveInteger(ext?.max_context) ??
      fallback?.contextWindow ??
      DEFAULT_CONTEXT_WINDOW,
    maxTokens:
      readPositiveInteger(ext?.max_output) ?? fallback?.maxTokens ?? DEFAULT_MAX_TOKENS,
    compat: {
      ...CRUISE_MODEL_COMPAT,
      ...(fallback?.compat ?? {}),
      ...(ext?.tools === false ? { supportsTools: false } : {}),
    },
  };
}

/** Projects Cruise's authenticated `/models` response into OpenClaw model rows. */
export function projectCruiseLiveModels(rows: readonly unknown[]): ModelDefinitionConfig[] {
  const fallbacks = new Map(buildStaticCruiseModels().map((model) => [model.id, model]));
  const seen = new Set<string>();
  const models: ModelDefinitionConfig[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }
    const typed = row as CruiseLiveModelRow;
    const model = projectLiveModel(typed, fallbacks.get(String(typed.id)));
    if (!model || seen.has(model.id)) {
      continue;
    }
    seen.add(model.id);
    models.push(model);
  }
  return models;
}

/** Resolves a forward-compatible Cruise model id not yet in the bundled catalog. */
export function resolveCruiseDynamicModel(
  modelId: string,
  baseUrl?: string,
): ProviderRuntimeModel | undefined {
  const id = modelId.trim();
  if (!id || CRUISE_MODEL_CATALOG.some((model) => model.id === id)) {
    return undefined;
  }
  const resolvedBaseUrl = baseUrl?.trim() || CRUISE_BASE_URL;
  return {
    id,
    name: id,
    provider: "cruise",
    api: "openai-completions" as const,
    baseUrl: resolvedBaseUrl,
    reasoning: false,
    input: ["text"] as Array<"text" | "image">,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsUsageInStreaming: true,
      supportsTools: true,
      maxTokensField: "max_tokens" as const,
    },
  } as ProviderRuntimeModel;
}
