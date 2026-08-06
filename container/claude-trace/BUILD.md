# Patched claude-trace (NVIDIA + Bedrock interception)

This is **not** stock `@mariozechner/claude-trace`. The prebuilt `dist/` here is
committed on purpose so a deploy is `git pull` and nothing else — no network, no
node build, and no box that silently lacks the feature.

## Why it is patched

Upstream only intercepts `anthropic.com`. Our coworkers talk to
`inference-api.nvidia.com`, so stock claude-trace records **nothing** — and it
fails by producing an empty trace, not an error. `0001-nvidia-bedrock-interception.patch`
widens the interception:

```js
const TARGET_DOMAINS = ["anthropic.com", "nvidia.com", "aws.com"];
  urlString.includes("/v1/messages") ||  // Anthropic direct
  urlString.includes("/model/")      ||  // AWS Bedrock
  urlString.includes("/llm/");           // NVIDIA API
```

It also adds `@smithy/eventstream-serde-node` + `@smithy/util-utf8` to decode
Bedrock's event-stream responses.

**So the npm package cannot replace this.** `container/cli-tools.json` still
installs stock claude-trace globally for its runtime deps, but the code that
actually runs is `dist/cli.js` from this directory, mounted at
`/opt/claude-trace` (see `resolveClaudeTraceDir()` in `src/container-runner.ts`).

## Rebuilding

Upstream is https://github.com/badlogic/lemmy, package `apps/claude-trace`.

```bash
git clone https://github.com/badlogic/lemmy && cd lemmy
git apply /path/to/0001-nvidia-bedrock-interception.patch
cd apps/claude-trace && npm install && npm run build
# then copy dist/ + frontend/ back over this directory
```

The patch was authored against lemmy at the merge of `richard-weiss/main`
(`4688853`). If it stops applying, reconcile `src/interceptor.ts` by hand — the
change is confined to `TARGET_DOMAINS` / `isTargetAPI()` plus the smithy deps.

## Layout

| path | what |
|---|---|
| `dist/` | built CLI — `dist/cli.js` is the entry the wrapper runs, and its presence is what enables the whole feature |
| `frontend/` | HTML viewer assets used to render the `.html` next to each `.jsonl` |
| `claude-trace-wrapper.sh` | what `CLAUDE_CODE_EXECUTABLE` points at; forwards SDK args to the real binary under the proxy |
| `0001-nvidia-bedrock-interception.patch` | the source of truth for the fork |

## Disk

Traces are big — measured on lego, 21 files were 218 MB and one session was
165 MB. `scripts/claude-trace-gc.py` bounds this (7-day age + a 5 GB LRU cap,
never touching a live session's file). Wire it on any box where tracing is on.
