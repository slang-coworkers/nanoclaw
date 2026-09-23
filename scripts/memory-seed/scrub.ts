/**
 * Best-effort secret redaction for coworker memory seeds.
 *
 * A learning can quote a token, key, or private-key block it saw. Before memory
 * leaves its origin box as an internal "seed", values that look like credentials
 * are redacted to a typed placeholder — the seed carries the lesson, not the
 * secret.
 *
 * This is REGEX best-effort, NOT a guarantee (regexes miss novel/unlabelled
 * shapes and high-entropy blobs). The seed pipeline treats it as one layer:
 * export/import run it, the manifest hashes what shipped, and a human reviews the
 * redaction report + a second independent scanner (e.g. gitleaks) runs over the
 * transport repo before the seed is trusted. Run on export AND again on import.
 */

export interface Redaction {
  type: string;
  count: number;
}

// Assignment values that only *look* like secrets — env references, templating
// sigils, obvious dummies. Never redact these (avoids corrupting docs). The
// assignment value regex stops at `}`, so a `${VAR}` value arrives here as
// `${VAR` — hence the sigils are matched as PREFIXES, not full brackets.
function isPlaceholderValue(val: string): boolean {
  if (/^(\$\{|\$[A-Za-z_]|<|\{\{|%[A-Za-z]|\[REDACTED)/i.test(val)) return true;
  return /^(x{3,}|\.{3,}|changeme|example|sample|dummy|placeholder|todo|null|none|true|false|your[-_].+)$/i.test(val);
}

const PATTERNS: Array<{ type: string; re: RegExp }> = [
  // PEM blocks — backreference the exact label so BEGIN/END must match (no runaway span).
  { type: 'private-key', re: /-----BEGIN ([A-Z0-9 ]*)PRIVATE KEY-----[\s\S]*?-----END \1PRIVATE KEY-----/g },
  { type: 'pgp-private-key', re: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----/g },
  { type: 'gitlab-pat', re: /\bglpat-[A-Za-z0-9_-]{20,}\b/g },
  { type: 'gitlab-oauth', re: /\bgloas-[A-Za-z0-9_-]{20,}\b/g },
  { type: 'github-pat', re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g },
  { type: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { type: 'slack-app-token', re: /\bxapp-\d-[A-Za-z0-9-]+\b/g },
  { type: 'slack-token', re: /\bxox[baprse]-[A-Za-z0-9-]{10,}\b/g },
  { type: 'slack-webhook', re: /\bhttps:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g },
  { type: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { type: 'openai-key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { type: 'nvidia-api-key', re: /\bnvapi-[A-Za-z0-9_-]{20,}\b/g },
  // AWS long-term + temporary access-key IDs.
  { type: 'aws-access-key', re: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA)[0-9A-Z]{16}\b/g },
  { type: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { type: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  // URL userinfo credentials: scheme://user:pass@host — keep the scheme, drop creds.
  { type: 'basic-auth-url', re: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi },
  { type: 'bearer', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/g },
];

// KEY = value / KEY: value / "KEY": "value" where the key name smells like a
// credential. Handled apart so we can exempt placeholders and preserve quotes.
const ASSIGN =
  /(["']?)([A-Za-z0-9_.-]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET|AUTH))\1(\s*[:=]\s*)(["']?)([^\s"',}]{6,})\4/gi;

export function scrubSecrets(input: string): { text: string; redactions: Redaction[] } {
  let text = input;
  const redactions: Redaction[] = [];
  const bump = (type: string, n: number): void => {
    if (n) redactions.push({ type, count: n });
  };

  for (const { type, re } of PATTERNS) {
    let count = 0;
    text = text.replace(re, (_m, ...g) => {
      count++;
      if (type === 'basic-auth-url') return `${g[0] as string}[REDACTED:credentials]@`;
      return `[REDACTED:${type}]`;
    });
    bump(type, count);
  }

  let assignCount = 0;
  text = text.replace(ASSIGN, (m: string, kq: string, key: string, sep: string, vq: string, val: string) => {
    if (isPlaceholderValue(val) || /^\d+$/.test(val)) return m; // env ref / dummy / pure number → keep
    assignCount++;
    return `${kq}${key}${kq}${sep}${vq}[REDACTED:secret]${vq}`;
  });
  bump('assignment-secret', assignCount);

  return { text, redactions };
}

/** Total redactions across a list, for summaries. */
export function totalRedactions(redactions: Redaction[]): number {
  return redactions.reduce((n, r) => n + r.count, 0);
}
