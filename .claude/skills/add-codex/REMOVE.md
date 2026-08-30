# Remove the Codex agent provider

Unwires the Codex provider and returns every group to the default. Safe to run when partially installed — skip any step whose target is already absent. This removal is **non-destructive to trunk-tracked source** (see step 3): it undoes the wiring, not the files.

## 1. Switch codex groups back to the default

List groups still on codex and switch each one (each group's `memory/` tree stays on disk and readable; run `/migrate-memory` per group if its memory should carry back to Claude — see [docs/provider-migration.md](../../docs/provider-migration.md)):

```bash
ncl groups list
# for each group whose config shows provider=codex:
ncl groups config update --id <group-id> --provider claude
ncl groups restart --id <group-id>
```

## 2. Delete the barrel imports

Delete (do not comment out) the `import './codex.js';` line from each of:

- `src/providers/index.ts`
- `container/agent-runner/src/providers/index.ts`
- `setup/providers/index.ts`

Unwiring the barrels is the substance of the removal: `resolveProviderName` can no longer reach `CodexProvider`, and the setup picker no longer offers codex. Step 4 stops the CLI from being baked into the image.

## 3. Leave the payload files in place

**On this fork the codex payload is tracked in trunk, not copied in by `/add-codex` — and the skill carries no `nc:copy` directive that could restore it.** Deleting these files is therefore a one-way local divergence from `nv-main`: re-wiring codex later would need a `git checkout` of each path, and the next upstream sync would see them as deletions to re-resolve. Re-running `/add-codex` would NOT bring them back.

Leave these alone:

- `src/providers/codex.ts`
- `container/agent-runner/src/providers/codex.ts`, `codex-app-server.ts` (+ `codex.factory.test.ts`, `codex-app-server.test.ts`)
- `setup/providers/codex.ts` (+ `codex.test.ts`)

Removing them from the fork is a source change on a reviewed branch, not a runbook step. If a previous version of this runbook already deleted them, recover with:

```bash
git checkout -- src/providers/codex.ts \
    container/agent-runner/src/providers/codex.ts \
    container/agent-runner/src/providers/codex-app-server.ts \
    setup/providers/codex.ts
```

This skill itself (`.claude/skills/add-codex/`) also stays — it ships with trunk so the provider can be re-wired later.

## 4. Remove the CLI manifest entry

Delete the `@openai/codex` entry from `container/cli-tools.json`:

```bash
node -e '
  const fs = require("fs");
  const file = "container/cli-tools.json";
  const tools = JSON.parse(fs.readFileSync(file, "utf8")).filter((t) => t.name !== "@openai/codex");
  const fmt = (t) => "  { " + Object.entries(t).map(([k, v]) => JSON.stringify(k) + ": " + JSON.stringify(v)).join(", ") + " }";
  fs.writeFileSync(file, "[\n" + tools.map(fmt).join(",\n") + "\n]\n");
'
```

## 5. Vault secret (optional)

The ChatGPT/OpenAI secret in the OneCLI vault grants nothing once the provider is gone. To remove it: `onecli secrets list`, then `onecli secrets delete --id <id>` for the `chatgpt.com` / `api.openai.com` entry.

## 6. Rebuild and verify

```bash
pnpm run build
pnpm exec tsc -p container/agent-runner/tsconfig.json --noEmit
./container/build.sh
pnpm test
cd container/agent-runner && bun test
```

All suites green and `ncl groups list` showing no codex groups means the removal is complete. Restart the service (`launchctl kickstart -k gui/$(id -u)/<label>` on macOS, `systemctl --user restart <unit>` on Linux).
