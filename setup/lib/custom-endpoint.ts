/**
 * Custom Anthropic-compatible endpoints (e.g. the NVIDIA inference API).
 */

/** The NVIDIA inference endpoint, offered as the default in the auth step. */
export const NVIDIA_INFERENCE_URL = 'https://inference-api.nvidia.com';

/**
 * NANOCLAW_ANTHROPIC_BASE_URL as setup records it in .env: trimmed, and only
 * when it is an http(s) URL. Undefined when unset or unusable.
 *
 * The auth step reads this on both of its paths. With a token it stores the
 * credential and records the URL; when the vault already holds a credential it
 * skips the prompt but must still record the URL — otherwise agents call
 * api.anthropic.com, where the stored credential is never injected.
 */
export function customEndpointBaseUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Model ids an endpoint needs in .env. The NVIDIA inference API routes by
 * provider-prefixed ids, so Claude Code's own model names would be rejected;
 * other endpoints get nothing and keep Claude Code's defaults. Setup writes a
 * key only when .env does not already set it.
 *
 * Haiku 5.5 is also served as azure/anthropic/claude-haiku-5-5 — set
 * ANTHROPIC_DEFAULT_HAIKU_MODEL to that if the AWS route is unavailable.
 */
export function endpointModelDefaults(baseUrl: string): Record<string, string> {
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return {};
  }
  if (host !== new URL(NVIDIA_INFERENCE_URL).hostname) return {};
  const origin = baseUrl.replace(/\/+$/, '');
  return {
    ANTHROPIC_MODEL: 'aws/anthropic/bedrock-claude-opus-5-5',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'aws/anthropic/bedrock-claude-opus-5-5',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'aws/anthropic/bedrock-claude-sonnet-5-5',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'aws/anthropic/bedrock-claude-haiku-5-5',
    CODEX_MODEL: 'azure/openai/gpt-6.1-sol',
    CODEX_MODEL_PROVIDER: 'nvinference',
    CODEX_BASE_URL: `${origin}/v1`,
  };
}

/**
 * The endpoint an existing vault credential was stored for, from `onecli
 * secrets list` output: the host pattern of the first Anthropic secret, as an
 * https URL. Undefined for api.anthropic.com (no custom endpoint), wildcard
 * patterns, or anything unreadable. Lets a re-install against an existing
 * vault record the endpoint without asking again.
 */
export function endpointFromSecrets(listOutput: string): string | undefined {
  let rows: unknown;
  try {
    rows = JSON.parse(listOutput);
  } catch {
    return undefined;
  }
  const list = (Array.isArray(rows) ? rows : ((rows as { data?: unknown[] })?.data ?? [])) as {
    name?: string;
    type?: string;
    hostPattern?: string;
  }[];
  const secret = list.find((s) => s.type === 'anthropic' || /anthropic/i.test(s.name ?? ''));
  const host = secret?.hostPattern?.trim();
  if (!host || host.includes('*') || host === 'api.anthropic.com') return undefined;
  return customEndpointBaseUrl(`https://${host}`);
}
