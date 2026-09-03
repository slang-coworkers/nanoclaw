# Stop using the Codex agent provider

Returns every group to Claude and stops new groups defaulting to Codex.

**On this fork, "remove" means unconfigure, not unwire.** Codex ships in trunk here: `src/providers/codex.ts`, `container/agent-runner/src/providers/codex.ts` + `codex-app-server.ts`, `setup/providers/codex.ts`, and the `@openai/codex` entry in `container/cli-tools.json` are all tracked files, and `/add-codex` carries no `nc:copy` directive that could restore them. Deleting them — or deleting the three barrel imports — is a local divergence from `nv-main` that re-running this skill will NOT undo, and it turns the test suite red: codex is asserted across ~20 host and ~16 container test files (`src/providers/barrel-registration.test.ts`, `container/…/providers/factory.test.ts`, `setup/provider-contract.test.ts`, `setup/providers/*`, the cost and mcp-policy suites, …). Those failures are the suite correctly reporting a half-removed trunk feature.

Everything above the divider is the whole runbook. The section after it is only for a fork that has decided to drop codex from trunk for good.

## 1. Switch codex groups back to Claude

**The provider resolves through three tiers, highest first** (`resolveProviderName`, `src/container-runner.ts`):

```
sessions.agent_provider → agent_groups.agent_provider → container_configs.provider → "claude"
```

`ncl groups config update --provider` writes only the LOWEST tier. If a group also carries `agent_groups.agent_provider = 'codex'` — what `ncl groups get` reports as `agent_provider`, and what the dashboard's provider picker sets — that value still wins and the group comes back on codex after a restart. Clear the higher tier too:

```bash
ncl groups list
ncl groups get --id <group-id>          # check the agent_provider field

# clear the group-level override, then set the base. An empty value is stored as
# an empty string, which resolveProviderName treats as unset and falls through.
ncl groups update --id <group-id> --agent-provider ''
ncl groups config update --id <group-id> --provider claude
ncl groups restart --id <group-id>

ncl groups get --id <group-id>          # agent_provider now empty
```

The session tier (`sessions.agent_provider`) is written NULL at creation and nothing in this fork sets it, so there is normally nothing to clear there; `ncl sessions get <id>` shows it if you want to confirm.

Each group's `memory/` tree stays on disk and readable; run `/migrate-memory` per group if its memory should carry back to Claude — see [docs/provider-migration.md](../../docs/provider-migration.md).

## 2. Reset the instance default

If `/add-codex`'s optional last step set `DEFAULT_AGENT_PROVIDER=codex`, every group created afterwards is stamped codex at creation. Leaving it set is the one way this removal silently undoes itself.

```bash
grep '^DEFAULT_AGENT_PROVIDER=' .env || echo '(unset — nothing to do)'
pnpm exec tsx setup/index.ts --step set-env -- --key DEFAULT_AGENT_PROVIDER --value claude
```

Then restart the host so it re-reads `.env` (`launchctl kickstart -k gui/$(id -u)/com.nanoclaw` on macOS, `systemctl --user restart nanoclaw` on Linux).

## 3. Vault secret (optional)

The ChatGPT/OpenAI secret in the OneCLI vault grants nothing once no group uses codex. To remove it: `onecli secrets list`, then `onecli secrets delete --id <id>` for the `chatgpt.com` / `api.openai.com` entry.

## 4. Verify

```bash
ncl groups list          # no group shows provider=codex
grep '^DEFAULT_AGENT_PROVIDER=' .env
pnpm exec vitest run     # still green — trunk wiring is untouched
```

Codex remains offered in the setup picker and re-selectable per group with `ncl groups config update --provider codex`; only the vault secret needs re-adding. That is the intended end state: the provider is available and unused.

---

## Dropping codex from trunk (a source change, not a runbook)

Only for a fork that wants the payload gone. This is a reviewed branch with its own PR, because it deletes tracked files and the tests that assert them:

1. Delete the `import './codex.js';` line from `src/providers/index.ts`, `container/agent-runner/src/providers/index.ts`, and `setup/providers/index.ts`.
2. Delete `src/providers/codex.ts`, `container/agent-runner/src/providers/codex.ts`, `codex-app-server.ts`, `codex.factory.test.ts`, `codex-app-server.test.ts`, `setup/providers/codex.ts`, `setup/providers/codex.test.ts`, `setup/providers/barrel-registration.test.ts`, and this skill directory.
3. Remove `@openai/codex` from `container/cli-tools.json`.
4. Update every remaining test that asserts codex (see the list above) — including `INSTALLABLE_PROVIDERS` in `setup/auto.ts`, which otherwise still offers codex in the picker.
5. `pnpm run build && pnpm exec vitest run && npm run validate:templates && ./container/build.sh`, then `cd container/agent-runner && bun test`.

If a previous version of this runbook already deleted the payload files, recover them before doing anything else:

```bash
git checkout -- src/providers/codex.ts \
    container/agent-runner/src/providers/codex.ts \
    container/agent-runner/src/providers/codex-app-server.ts \
    container/agent-runner/src/providers/codex.factory.test.ts \
    container/agent-runner/src/providers/codex-app-server.test.ts \
    setup/providers/codex.ts \
    setup/providers/codex.test.ts \
    setup/providers/barrel-registration.test.ts \
    setup/providers/index.ts \
    src/providers/index.ts \
    container/agent-runner/src/providers/index.ts \
    container/cli-tools.json
```
