import { readFile } from 'node:fs/promises';

const PING_PATH = '/api/v4/system/ping';

function normalize(value) {
  return value?.trim().replace(/\/+$/, '') || '';
}

async function configuredUrl() {
  if (process.env.MATTERMOST_BASE_URL) return normalize(process.env.MATTERMOST_BASE_URL);
  try {
    const text = await readFile('.env', 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*MATTERMOST_BASE_URL\s*=\s*(.*?)\s*$/);
      if (match?.[1]) return normalize(match[1].replace(/^(['"])(.*)\1$/, '$2'));
    }
  } catch {
    // Any .env read failure means no configured URL; discovery must still
    // resolve so the operator fallback prompt is offered.
  }
  return '';
}

async function isMattermost(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}${PING_PATH}`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return false;
    const body = await response.json();
    return body?.status === 'OK';
  } catch {
    return false;
  }
}

try {
  const candidates = [...new Set([await configuredUrl(), 'http://localhost:8065', 'http://127.0.0.1:8065'])].filter(
    Boolean,
  );

  for (const baseUrl of candidates) {
    if (await isMattermost(baseUrl)) {
      process.stdout.write(`${JSON.stringify({ discovery: 'found', base_url: baseUrl })}\n`);
      process.exit(0);
    }
  }
} catch {
  // Fall through to the not-found result below.
}

process.stdout.write(`${JSON.stringify({ discovery: 'none', base_url: '' })}\n`);
