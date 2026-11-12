import fs from 'fs';

import type { AllowlistResult, GateActor } from './types.js';

/** GitHub lookups Check 1 needs; injected so tests never touch the network. */
export interface GitHubLookups {
  /** `repos/{repo}/collaborators/{login}/permission` → admin | maintain | write | triage | read | none. */
  repoPermission(repo: string, login: string): Promise<string>;
  /** Is `login` a member (public or private) of `org`? */
  orgMember(org: string, login: string): Promise<boolean>;
}

export interface RosterEntry {
  github_id: number;
  login?: string;
}

const WRITE_OR_ABOVE = new Set(['admin', 'maintain', 'write']);
/** Associations worth an API lookup. Anything else is external without one. */
const LOOKUP_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

/**
 * Read the maintainer roster: a JSON array of `{ "github_id": <number> }`
 * entries. Keyed on the numeric id because logins can be renamed or reused.
 * A missing or unreadable file is an empty roster, never an error.
 */
export function loadRoster(rosterPath: string): Set<number> {
  try {
    const parsed = JSON.parse(fs.readFileSync(rosterPath, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .map((e) => (e && typeof e === 'object' ? (e as RosterEntry).github_id : undefined))
        .filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0),
    );
    // eslint-disable-next-line no-catch-all/no-catch-all -- a missing or malformed roster is an empty roster
  } catch {
    return new Set();
  }
}

/**
 * True when write permission on `repo` counts for Check 1. With `repos` set
 * (NANOCLAW_INPUT_GATE_REPOS), only those repos count; otherwise every repo the
 * org owns counts. Consider a user who installs the App on their own repo
 * `alice/slang`: alice is admin there, and without this rule a mention on that
 * repo would put alice on the allowlist. Write permission proves trust only on
 * a repo the maintainers control.
 */
export function isProtectedRepo(repo: string, org: string, repos: readonly string[] | null): boolean {
  const name = repo.toLowerCase();
  if (repos) return repos.some((r) => r.toLowerCase() === name);
  return name.startsWith(`${org.toLowerCase()}/`);
}

/**
 * Check 1 (threat model): is this GitHub account on the allowlist?
 *
 * Order: the roster by numeric id; then repo permission write or above (on a
 * protected repo only, see isProtectedRepo), then org membership. A `Bot`
 * account is allowlisted by its roster id only: repo permission and org
 * membership describe people, and GitHub's user APIs do not answer for App
 * accounts. With `prefilter` (the default), the lookups run only when
 * `author_association` says the account has a relationship to the repo, or the
 * event carries none. A mention turns it off: GitHub may report a private org
 * member as CONTRIBUTOR or NONE, and a mention is where the answer matters. A
 * failed lookup counts as not allowlisted and is recorded, so an API outage
 * shows up in the log instead of silently admitting people.
 */
export async function checkAllowlist(
  actor: GateActor,
  ctx: {
    repo: string;
    org: string;
    roster: Set<number>;
    lookups: GitHubLookups;
    prefilter?: boolean;
    /** NANOCLAW_INPUT_GATE_REPOS; null means every repo of the org. */
    repos?: readonly string[] | null;
  },
): Promise<AllowlistResult> {
  const evidence: AllowlistResult['evidence'] = {
    association: actor.association,
    rosterHit: actor.id !== null && ctx.roster.has(actor.id),
  };
  if (evidence.rosterHit) return { allowlisted: true, via: 'roster', evidence };
  if (actor.type === 'Bot') return { allowlisted: false, via: null, evidence };

  if ((ctx.prefilter ?? true) && actor.association !== null && !LOOKUP_ASSOCIATIONS.has(actor.association)) {
    return { allowlisted: false, via: null, evidence };
  }

  evidence.repoProtected = isProtectedRepo(ctx.repo, ctx.org, ctx.repos ?? null);
  if (evidence.repoProtected) {
    try {
      evidence.permission = await ctx.lookups.repoPermission(ctx.repo, actor.login);
      // eslint-disable-next-line no-catch-all/no-catch-all -- a failed lookup is recorded and never admits
    } catch {
      evidence.lookupError = 'permission';
    }
  }
  if (evidence.permission && WRITE_OR_ABOVE.has(evidence.permission)) {
    return { allowlisted: true, via: 'permission', evidence };
  }

  try {
    evidence.orgMember = await ctx.lookups.orgMember(ctx.org, actor.login);
    // eslint-disable-next-line no-catch-all/no-catch-all -- a failed lookup is recorded and never admits
  } catch {
    evidence.lookupError = evidence.lookupError ?? 'org';
  }
  if (evidence.orgMember) return { allowlisted: true, via: 'org_member', evidence };

  return { allowlisted: false, via: null, evidence };
}
