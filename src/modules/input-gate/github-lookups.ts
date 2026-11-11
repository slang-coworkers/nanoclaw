import { execFile } from 'child_process';
import { promisify } from 'util';

import type { GitHubLookups } from './allowlist.js';

const execFileAsync = promisify(execFile);
const CACHE_MS = 10 * 60 * 1000;

export function permissionArgs(repo: string, login: string): string[] {
  return ['api', `repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`, '--jq', '.permission'];
}

export function orgMemberArgs(org: string, login: string): string[] {
  return [
    'api',
    'graphql',
    '-f',
    'query=query($login:String!,$org:String!){user(login:$login){organization(login:$org){login}}}',
    '-f',
    `login=${login}`,
    '-f',
    `org=${org}`,
    '--jq',
    '.data.user.organization.login // ""',
  ];
}

/**
 * GitHub lookups through the `gh` CLI, the same way the CI gate probes check
 * runs (modules/pending-reviewable/ci-check.ts): GH_TOKEN / GITHUB_TOKEN are
 * stripped so `gh` uses its cron-refreshed hosts.yml login rather than the
 * process env token that expires within the hour. GraphQL is used for org
 * membership; it sees private members only when the host login can (an org
 * member, or an App with members:read) — otherwise they read as non-members. Results are cached for
 * ten minutes per login so a busy thread costs one lookup, not one per comment.
 */
export function ghLookups(run: (args: string[]) => Promise<string> = runGh): GitHubLookups {
  // The promise is cached, not the value, so a burst of deliveries from one
  // login shares one gh run; a failure is dropped so the next call retries.
  const cache = new Map<string, { at: number; value: Promise<string> }>();
  const cached = (key: string, args: string[]): Promise<string> => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    if (cache.size > 1000) {
      for (const [k, v] of cache) if (Date.now() - v.at >= CACHE_MS) cache.delete(k);
    }
    const value = run(args).then((out) => out.trim());
    cache.set(key, { at: Date.now(), value });
    value.catch(() => {
      if (cache.get(key)?.value === value) cache.delete(key);
    });
    return value;
  };
  return {
    repoPermission: (repo, login) => cached(`perm:${repo}:${login.toLowerCase()}`, permissionArgs(repo, login)),
    orgMember: async (org, login) =>
      (await cached(`org:${org}:${login.toLowerCase()}`, orgMemberArgs(org, login))).length > 0,
  };
}

async function runGh(args: string[]): Promise<string> {
  const { GH_TOKEN: _gh, GITHUB_TOKEN: _gt, ...env } = process.env;
  const { stdout } = await execFileAsync('gh', args, { timeout: 15_000, maxBuffer: 1024 * 1024, env });
  return stdout;
}
