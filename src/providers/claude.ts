/**
 * Claude provider container config — only registered when the user has
 * configured a custom Anthropic-compatible endpoint via setup. Setup
 * appends `import './claude.js'` to providers/index.ts at that point;
 * standard installs hitting api.anthropic.com don't need this file
 * loaded.
 *
 * The real auth token never enters the container. Setup creates an
 * OneCLI generic secret (host-pattern = base URL hostname, header-name
 * = Authorization, value-format = "Bearer {value}") so the proxy
 * rewrites the Authorization header on the wire. The container only
 * needs:
 *   - ANTHROPIC_BASE_URL — so the SDK knows where to call
 *   - ANTHROPIC_AUTH_TOKEN=ROUTED_VIA_ONECLI_PROXY — so the SDK adds an
 *     Authorization: Bearer header for OneCLI to overwrite. The value is
 *     deliberately a non-credential string so any agent inspecting it
 *     stops and reaches for the proxy instead of treating it as auth.
 */
import { readEnvFile } from '../env.js';
import { registerProviderContainerConfig } from './provider-container-registry.js';

registerProviderContainerConfig('claude', () => {
  const dotenv = readEnvFile(['ANTHROPIC_BASE_URL', 'ANTHROPIC_FALLBACK_MODEL', 'FALLBACK_FOR_ALL_PRIMARY_MODELS']);
  const env: Record<string, string> = {};
  if (dotenv.ANTHROPIC_BASE_URL) {
    env.ANTHROPIC_BASE_URL = dotenv.ANTHROPIC_BASE_URL;
    env.ANTHROPIC_AUTH_TOKEN = 'ROUTED_VIA_ONECLI_PROXY';
  }
  if (dotenv.ANTHROPIC_FALLBACK_MODEL) {
    env.ANTHROPIC_FALLBACK_MODEL = dotenv.ANTHROPIC_FALLBACK_MODEL;
  }
  if (dotenv.FALLBACK_FOR_ALL_PRIMARY_MODELS) {
    env.FALLBACK_FOR_ALL_PRIMARY_MODELS = dotenv.FALLBACK_FOR_ALL_PRIMARY_MODELS;
  }
  return { env };
});
