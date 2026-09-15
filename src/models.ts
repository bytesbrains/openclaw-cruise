/**
 * Cruise model catalog: static seeds, live GET /v1/models projection, dynamic ids.
 *
 * Manifest `modelCatalog.models` rows are **offline seeds only** — live discovery
 * replaces them when auth works. Costs/windows on seeds are placeholders, not a
 * frozen catalogue of what the key can reach.
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

/**
 * Only HTTPS hosts under bytesbrains.net (prod, demo, future enterprise).
 * Rejects loopback / private / arbitrary hosts so a tampered config cannot SSRF.
 * Invalid or disallowed values fall back to production.
 */
export function resolveAllowedCruiseBaseUrl(baseUrl?: string): string {
  const candidate = (baseUrl ?? "").trim() || CRUISE_BASE_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") {
      return CRUISE_BASE_URL;
    }
    const host = url.hostname.toLowerCase();
    const allowed =
      host === "bytesbrains.net" ||
      host.endsWith(".bytesbrains.net");
    if (!allowed) {
      return CRUISE_BASE_URL;
    }
    return candidate.replace(/\/+$/, "");
  } catch {
    return CRUISE_BASE_URL;
  }
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
  /** True when `pricing` was a non-null object (even if rates are missing). */
  present: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { present: false };
  }
  const pricing = value as Record<string, unknown>;
  return {
    present: true,
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

function resolveReasoning(ext: CruiseExtension | undefined, fallback?: ModelDefinitionConfig): boolean {
  const isLane = ext?.lane === true;
  const job = typeof ext?.job === "string" ? ext.job.trim() : "";
  // Live lane job wins over a stale seed flag (issue #2: do not freeze catalogue semantics).
  if (isLane && job) {
    return REASONING_LANE_JOBS.has(job);
  }
  return fallback?.reasoning ?? false;
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
  // Rows without x-cruise are unknown — keep only if a static seed already trusts the id.
  if (!ext && !fallback) {
    return undefined;
  }

  // Chat inference only for v1. Require an explicit chat modality when x-cruise is present
  // (missing modality must not default to chat — image/speech rows could omit it).
  if (ext) {
    const modality = typeof ext.modality === "string" ? ext.modality.trim().toLowerCase() : "";
    if (modality !== "chat") {
      return undefined;
    }
  }

  const isLane = ext?.lane === true;
  const pricing = readCruisePricing(ext?.pricing);

  const input: ModelDefinitionConfig["input"] =
    ext?.vision === true
      ? ["text", "image"]
      : ext?.vision === false
        ? ["text"]
        : (fallback?.input ?? ["text"]);

  // When live x-cruise is present, do not inherit seed placeholder costs (often 0).
  // Missing/null live rates stay 0 as "unknown to OpenClaw's required number fields",
  // not as "seed said free".
  const useLiveCosts = Boolean(ext);
  const cost = {
    input: useLiveCosts ? (pricing.input ?? 0) : (pricing.input ?? fallback?.cost.input ?? 0),
    output: useLiveCosts ? (pricing.output ?? 0) : (pricing.output ?? fallback?.cost.output ?? 0),
    cacheRead: useLiveCosts
      ? (pricing.cacheRead ?? 0)
      : (pricing.cacheRead ?? fallback?.cost.cacheRead ?? 0),
    cacheWrite: useLiveCosts ? 0 : (fallback?.cost.cacheWrite ?? 0),
  };

  return {
    id,
    name: isLane
      ? laneDisplayName(ext ?? {}, id)
      : (fallback?.name ?? id),
    reasoning: resolveReasoning(ext, fallback),
    input,
    cost,
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
  // Last-wins on duplicate ids (override semantics if Cruise ever repeats a row).
  const byId = new Map<string, ModelDefinitionConfig>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }
    const typed = row as CruiseLiveModelRow;
    const rawId = typeof typed.id === "string" ? typed.id.trim() : "";
    const model = projectLiveModel(typed, rawId ? fallbacks.get(rawId) : undefined);
    if (!model) {
      continue;
    }
    byId.set(model.id, model);
  }
  return [...byId.values()];
}

/**
 * Resolves a forward-compatible Cruise model id not yet in the bundled catalog.
 *
 * Costs/windows here are **unverified placeholders** (zeros / defaults) until the
 * next live catalog refresh — do not treat them as Cruise pricing. Prefer ids
 * that already appeared in `GET /v1/models` for the presented key.
 */
export function resolveCruiseDynamicModel(
  modelId: string,
  baseUrl?: string,
): ProviderRuntimeModel | undefined {
  const id = modelId.trim();
  if (!id || CRUISE_MODEL_CATALOG.some((model) => model.id === id)) {
    return undefined;
  }
  const resolvedBaseUrl = resolveAllowedCruiseBaseUrl(baseUrl);
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
