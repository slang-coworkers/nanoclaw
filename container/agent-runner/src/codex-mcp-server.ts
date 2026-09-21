/**
 * The `codex` MCP child — `codex mcp-server` run as a stdio subprocess so the
 * codex-critique skill can hand it /workspace/agent paths to review. Routing
 * and auth come from `-c` overrides built from container env vars; no
 * ~/.codex/config.toml is needed for them.
 *
 * Two mechanisms get variables to the child:
 *   1. `env` — literal key=value pairs. Under the Claude provider they are the
 *      child's spawn env verbatim; under the Codex provider they are serialized
 *      into `[mcp_servers.codex.env]` in ~/.codex/config.toml. Used ONLY for
 *      non-secret values (HOME, PATH, the git guard below).
 *   2. `envInherit` — names-only allowlist, serialized as `env_vars = [...]`.
 *      codex-cli resolves each name from its own process env at spawn time, so
 *      values never reach disk. Used for anything derived from OneCLI/secrets
 *      (proxy token in the HTTPS_PROXY authority, NVIDIA_API_KEY).
 *
 * Why NVIDIA_API_KEY has to be forwarded at all — even though OneCLI handles
 * auth transparently: OneCLI's HTTPS proxy swaps secrets at the TLS layer (the
 * value in container env is usually `onecli-placeholder`), BUT codex-cli
 * validates `model_providers.<p>.env_key` at SESSION START, before any HTTP
 * call. An undefined var errors `Missing environment variable: NVIDIA_API_KEY`
 * and the subprocess exits before OneCLI gets a chance to inject. Verified
 * 2026-05-07 via `codex exec` A/B: without the var codex errors at startup;
 * with `onecli-placeholder` the request reaches nvinference and succeeds.
 * OPENAI_API_KEY is intentionally NOT forwarded — codex is routed through
 * nvinference per the deployment's credential policy.
 *
 * GIT WRITE GUARD
 *
 * Codex runs with sandbox `danger-full-access` (bwrap cannot create namespaces
 * inside Docker — see container/hooks/force-codex-sandbox.sh) and cwd
 * /workspace/agent, the role's group folder holding its git worktrees. Three
 * times on 2026-09-19 a "read-only" critique wrote instead: twice it amended an
 * ADR, once it committed on the builder's worktree and force-pushed the PR
 * branch, orphaning the legitimate head. So the child's git is pinned
 * read-only through config that lives in ITS env only — the Claude session's
 * own git is untouched. Three layers; each covers what the one before cannot:
 *
 *   1. `core.hooksPath` → /app/hooks/codex-git-guard, whose pre-commit,
 *      pre-merge-commit, pre-rebase, pre-push and reference-transaction hooks
 *      all refuse. reference-transaction is the one that matters: every ref
 *      write is a transaction, so it also catches `commit --no-verify`,
 *      `update-ref`, `branch -f`, `reset --hard`, `checkout -B`, `tag`,
 *      `stash`, `fetch` and `merge` (ORIG_HEAD).
 *   2. No transport at all. `url.disabled://.pushInsteadOf` for https://,
 *      http://, git@, ssh://, file://, `/` and `.` rewrites a push URL taken
 *      from a remote's fetch URL, or given explicitly, to a scheme nothing
 *      serves — and `protocol.allow=never` + `protocol.file.allow=never`
 *      refuse every transport type outright. The protocol policy is what
 *      actually closes pushes: pushInsteadOf is ignored for a remote with an
 *      explicit pushurl (`git remote set-url --push`, a .git/config write no
 *      hook sees), for scp-style `user@host:` with a non-`git` user, and for a
 *      short URL expanded by an `insteadOf` alias; the protocol check is on
 *      the transport type, so all of those die client-side (`fatal: transport
 *      'https' not allowed`), `--no-verify` or not. protocol.file.allow must
 *      be explicit — a per-protocol key beats the `protocol.allow` fallback at
 *      any scope, and a global `protocol.file.allow=always` is common.
 *   3. `GIT_CONFIG_SYSTEM` → /app/hooks/codex-git-guard/gitconfig: the same
 *      table at system scope. GIT_CONFIG_COUNT/KEY/VALUE and `-c`
 *      (GIT_CONFIG_PARAMETERS) are stripped from the receive-pack git spawns
 *      for a local-path push (`local_repo_env`); GIT_CONFIG_SYSTEM is not, so
 *      even `git -c protocol.file.allow=always -c core.hooksPath=/dev/null
 *      push --no-verify ../clone` is refused on the remote side by ITS
 *      reference-transaction hook. System, not global: GIT_CONFIG_GLOBAL would
 *      replace ~/.gitconfig and drop the OneCLI placeholder insteadOf that
 *      container-runner writes there.
 *
 * Layers 1–2 travel as GIT_CONFIG_COUNT / GIT_CONFIG_KEY_n / GIT_CONFIG_VALUE_n,
 * read at command scope (above repo, worktree and global config, so a
 * worktree's own core.hooksPath cannot undo them).
 *
 * The child's process env is not what codex hands the shell commands it runs:
 * that env is derived through `shell_environment_policy`, which
 * ~/.codex/config.toml — a writable group-state mount — can narrow. So the
 * pairs are also forced from the command line, where `-c` beats config.toml:
 * `shell_environment_policy.include_only=[]` (an include_only in config.toml
 * is applied AFTER `set` and would drop every GIT_CONFIG_* silently — git would
 * then run unguarded with no error anywhere) and
 * `shell_environment_policy.set.<NAME>="<value>"` per pair (applied after
 * `exclude`; without it `ignore_default_excludes=false` strips GIT_CONFIG_KEY_n
 * alone through the `*KEY*` default exclude and every git command dies on the
 * dangling COUNT). Load-bearing, not belt-and-braces. `set` values MUST be
 * TOML strings — an unquoted integer is a hard "invalid type" error at codex
 * start. Verified with `codex sandbox /usr/bin/env` on 0.151.0 and the pinned
 * 0.146.0.
 *
 * Holes, stated plainly: plain file writes (codex can still edit a worktree —
 * re-hash any artifact you hand it); pushes that never touch git (a token +
 * api.github.com); same-scope overrides on the NETWORK side (`git -c
 * protocol.https.allow=always -c core.hooksPath=/dev/null push …`,
 * `--config-env`, a hand-set GIT_CONFIG_PARAMETERS — `-c` is parsed after the
 * env pairs at the same scope; only local-path pushes have the
 * GIT_CONFIG_SYSTEM backstop, and a target repo whose own config sets
 * core.hooksPath beats even that); `env -u GIT_CONFIG_COUNT -u
 * GIT_CONFIG_SYSTEM git …`; and, on the image's git (Debian bookworm 2.39),
 * HEAD symref writes — `checkout <branch>`, `switch`, `symbolic-ref` — which
 * are not transactions there and are expected to go through (they move a
 * worktree's HEAD, they rewrite no history; refused on git ≥ 2.50). This
 * guards a confused reviewer, not an adversary. Proof:
 * scripts/prove-codex-git-guard.sh; docs/mcp-allowlist.md has the long form.
 */
import { createCodexConfigOverrides, tomlBasicString } from './providers/codex-app-server.js';
import type { McpServerConfig } from './providers/types.js';

/** Container path of the refusing hooks (container/hooks is bind-mounted at /app/hooks). */
export const CODEX_GIT_GUARD_HOOKS_PATH = '/app/hooks/codex-git-guard';

/** The system-scope gitconfig (same table, gitconfig syntax) that rides the same mount. */
export const CODEX_GIT_GUARD_GITCONFIG_PATH = `${CODEX_GIT_GUARD_HOOKS_PATH}/gitconfig`;

/**
 * The git config the codex child runs under, in GIT_CONFIG_KEY_n order.
 * `url.<base>.pushInsteadOf` is multi-valued: one entry per prefix. The last
 * three prefixes catch local paths (`file://…`, `/abs`, `./rel` and `../rel`,
 * and `.` itself — `git push . HEAD:main` is a real way to rewrite a sibling
 * branch). The two `protocol.*` entries refuse every transport type, which is
 * what stops the push shapes the rewrite cannot see (explicit pushurl,
 * scp-style with a non-`git` user, `insteadOf` aliases, bare relative names).
 */
export const CODEX_GIT_GUARD_CONFIG: ReadonlyArray<readonly [key: string, value: string]> = [
  ['core.hooksPath', CODEX_GIT_GUARD_HOOKS_PATH],
  ['url.disabled://.pushInsteadOf', 'https://'],
  ['url.disabled://.pushInsteadOf', 'http://'],
  ['url.disabled://.pushInsteadOf', 'git@'],
  ['url.disabled://.pushInsteadOf', 'ssh://'],
  ['url.disabled://.pushInsteadOf', 'file://'],
  ['url.disabled://.pushInsteadOf', '/'],
  ['url.disabled://.pushInsteadOf', '.'],
  ['protocol.allow', 'never'],
  ['protocol.file.allow', 'never'],
];

/**
 * GIT_CONFIG_COUNT + GIT_CONFIG_KEY_n / GIT_CONFIG_VALUE_n for the table above,
 * plus GIT_CONFIG_SYSTEM pointing at the same table as a file.
 */
export function codexGitGuardEnv(): Record<string, string> {
  const env: Record<string, string> = {
    GIT_CONFIG_COUNT: String(CODEX_GIT_GUARD_CONFIG.length),
    GIT_CONFIG_SYSTEM: CODEX_GIT_GUARD_GITCONFIG_PATH,
  };
  CODEX_GIT_GUARD_CONFIG.forEach(([key, value], i) => {
    env[`GIT_CONFIG_KEY_${i}`] = key;
    env[`GIT_CONFIG_VALUE_${i}`] = value;
  });
  return env;
}

/**
 * CODEX_GIT_GUARD_CONFIG in gitconfig syntax — the exact content of
 * container/hooks/codex-git-guard/gitconfig. The table is the single source of
 * truth; the test asserts the committed file equals this render. Git's key
 * grammar: first dot ends the section, last dot starts the variable, anything
 * between is the (case-sensitive, quoted) subsection.
 */
export function renderCodexGitGuardGitconfig(): string {
  const lines = [
    '# codex-git-guard: the codex critique child runs git with GIT_CONFIG_SYSTEM',
    '# pointed here. Same table as CODEX_GIT_GUARD_CONFIG in',
    '# container/agent-runner/src/codex-mcp-server.ts, which renders this file;',
    '# the test asserts they match. System scope so the receive-pack git spawns',
    '# for a local-path push (it gets no GIT_CONFIG_COUNT/KEY/VALUE and no -c)',
    '# still runs the refusing hooks.',
  ];
  let section: string | undefined;
  for (const [key, value] of CODEX_GIT_GUARD_CONFIG) {
    const first = key.indexOf('.');
    const last = key.lastIndexOf('.');
    const name = key.slice(0, first);
    const variable = key.slice(last + 1);
    const subsection = last > first ? key.slice(first + 1, last) : undefined;
    const header =
      subsection === undefined
        ? `[${name}]`
        : `[${name} "${subsection.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
    if (header !== section) {
      lines.push(header);
      section = header;
    }
    lines.push(`\t${variable} = ${value}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * `-c` override that stops a config.toml `include_only` from filtering the
 * `set` entries below out of codex's shell env (an empty list means no filter).
 */
export const CODEX_SHELL_ENV_INCLUDE_ONLY_OVERRIDE = 'shell_environment_policy.include_only=[]';

/**
 * The shell-environment-policy overrides that force codexGitGuardEnv() into
 * the env of every shell command codex runs, whatever ~/.codex/config.toml
 * says: include_only=[] first, then one TOML-string `set` per pair.
 */
export function codexGitGuardShellPolicyOverrides(): string[] {
  return [
    CODEX_SHELL_ENV_INCLUDE_ONLY_OVERRIDE,
    ...Object.entries(codexGitGuardEnv()).map(
      ([name, value]) => `shell_environment_policy.set.${name}=${tomlBasicString(value)}`,
    ),
  ];
}

/** Names forwarded to the child by NAME only — never as literals. */
export const CODEX_MCP_ENV_INHERIT: readonly string[] = [
  'NVIDIA_API_KEY',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS',
];

export function buildCodexMcpServer(processEnv: NodeJS.ProcessEnv = process.env): McpServerConfig {
  const args: string[] = [];
  for (const override of [...createCodexConfigOverrides(), ...codexGitGuardShellPolicyOverrides()]) {
    args.push('-c', override);
  }
  args.push('mcp-server');
  return {
    command: 'codex',
    args,
    env: {
      HOME: processEnv.HOME ?? '/home/node',
      PATH: processEnv.PATH ?? '',
      ...codexGitGuardEnv(),
    },
    envInherit: [...CODEX_MCP_ENV_INHERIT],
  };
}
