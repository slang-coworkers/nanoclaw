// Shared canonicalization for approval decisions. Wire-level accepts any
// case (`approve`, `APPROVE`, `Approve`); the canonical form downstream
// handlers compare against is `Approve` / `Reject`. Keeping one helper
// means the dashboard proxy and the ingress can't diverge again (AP05).

export const CANONICAL_DECISIONS = ['Approve', 'Reject'] as const;
export type CanonicalDecision = (typeof CANONICAL_DECISIONS)[number];

export function canonicalizeDecision(raw: string): CanonicalDecision | null {
  const normalized = raw.trim().toLowerCase();
  for (const canonical of CANONICAL_DECISIONS) {
    if (canonical.toLowerCase() === normalized) return canonical;
  }
  return null;
}
