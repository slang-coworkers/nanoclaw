import fs from 'fs';
import path from 'path';
import { log } from './log.js';

/**
 * Parse the .env file and return values for the requested keys.
 * Does NOT load anything into process.env — callers decide what to
 * do with the values. This keeps secrets out of the process environment
 * so they don't leak to child processes.
 *
 * `projectRoot` defaults to the current working directory; pass it when
 * reading a .env that is not the running process's own.
 */
export function readEnvFile(keys: string[], projectRoot?: string): Record<string, string> {
  const result: Record<string, string> = {};
  const wanted = new Set(keys);

  const envFile = path.join(projectRoot ?? process.cwd(), '.env');
  let content: string | undefined;
  try {
    content = fs.readFileSync(envFile, 'utf-8');
  } catch (err) {
    log.debug('.env file not found', { err });
  }

  if (content !== undefined) {
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      if (!wanted.has(key)) continue;
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }
      if (value) result[key] = value;
    }
  }

  // Opt-in process.env fallback. Off by default so the file-only contract above
  // is preserved everywhere it matters (a docker-host install keeps its secrets
  // in the .env FILE, out of the host process's environment, so they never leak
  // to spawned tools — see the doc comment). Platforms that deliver config as
  // process environment instead of a mounted/rendered .env — notably Astra,
  // where Vault → External Secrets injects them as pod env — set
  // NANOCLAW_ENV_ALLOW_PROCESS_FALLBACK=1 so these readers resolve without us
  // writing a second, plaintext copy of the secrets to disk.
  if (process.env.NANOCLAW_ENV_ALLOW_PROCESS_FALLBACK) {
    for (const key of wanted) {
      if (result[key] === undefined) {
        const v = process.env[key];
        if (v) result[key] = v;
      }
    }
  }

  return result;
}

/**
 * Read one key from the .env file. Same parser, same rules as `readEnvFile` —
 * this is the single-key form of it, so a caller wanting one value does not
 * hand-roll `readEnvFile([KEY])[KEY]` and does not grow a second parser.
 *
 * Returns undefined when the file, the key, or the value is absent.
 */
export function envValue(key: string, projectRoot?: string): string | undefined {
  return readEnvFile([key], projectRoot)[key];
}
