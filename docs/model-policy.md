# Model policy for each group

Each coworker uses up to four models. You can set each one for one group, and you can limit a group to open-weights models.

| Role | What it does | Install setting it falls back to |
|---|---|---|
| `main` | The agent itself (the doer) | `ANTHROPIC_MODEL`, `CODEX_MODEL`, `OPENCODE_MODEL` or `PI_MODEL` |
| `small` | Titles, subagents and light work | `ANTHROPIC_DEFAULT_HAIKU_MODEL` or `OPENCODE_SMALL_MODEL` |
| `router` | The intent router, once for each user message | `INTENT_ROUTER_OPENAI_MODEL` (default `openai/openai/gpt-6-luna`) |
| `critic` | The codex reviewer that `/codex-critique` and the critique gate call | `CODEX_MODEL` |

A Claude group uses one setting for its small model and its router.

## Commands

```bash
# See the model of each role, and whether each one is open-weights
ncl groups config get --id <group-id>

# Set one role for one group ("" clears it back to the install setting)
ncl groups config update --id <group-id> --critic-model nvidia/moonshotai/kimi-k3

# Use open-weights models only
ncl groups update --id <group-id> --agent-provider opencode
ncl groups config update --id <group-id> --weights open
ncl groups restart --id <group-id>
```

`--weights open` gives each unset role an open default:

| Role | Default | Install setting that replaces it |
|---|---|---|
| `main` | `nvidia/zai-org/glm-5.3` | `NANOCLAW_OPEN_MODEL` |
| `small` | `nvidia/zai-org/glm-5.3-flash` | `NANOCLAW_OPEN_SMALL_MODEL` |
| `router` | `nvidia/zai-org/glm-5.3-flash` | `NANOCLAW_OPEN_ROUTER_MODEL` |
| `critic` | `nvidia/moonshotai/kimi-k3` | `NANOCLAW_OPEN_CRITIC_MODEL` |

## Rules

- A model is open-weights when its id starts with an open family prefix, for example `nvidia/zai-org/`. Set `NANOCLAW_OPEN_WEIGHTS_PREFIXES` (comma-separated) to change the list. A model that matches no prefix counts as closed.
- A group with `--weights open` must resolve each role to an open-weights model. The command refuses a closed model, and the host does not start such a group. The error names each closed role.
- A Claude group cannot use `--weights open`, because its SDK and its router call Claude models. Switch it to OpenCode first.
- OpenCode needs its provider prefix on model ids (`openai/nvidia/zai-org/glm-5.3`). The policy adds the prefix to a bare id.
- Changes take effect at the next container start (`ncl groups restart`).

## Moving every coworker to open weights

`scripts/open-weights-plan.ts` prints the plan that moves every group of one install to open-weights models. It reads; it changes nothing. Run it from the install's root, so it reads that install's `.env` and database:

```bash
pnpm exec tsx scripts/open-weights-plan.ts
```

For each group the plan:

- switches a Claude group to OpenCode, which runs open models and Claude models through the gateway. Codex, OpenCode and Pi groups keep their provider;
- sets `--weights open`;
- clears a role whose own model is closed, so the open default applies;
- keeps a role that already runs an open model. `--weights open` alone would replace a model that comes from the install setting (for example Kimi through `CODEX_MODEL`) with the open default, so the plan sets the role to its current model;
- names an active session that pins another provider as a blocker. The pin outranks the group, so that session would not start after the move;
- rebuilds the image of a group that pins one this install derived for it (`<image base>:<group id>`, built when the group installed packages). That image can predate the new provider's runtime: an image built before OpenCode has no `opencode` binary, and the container fails at start with `Executable not found in $PATH: "opencode"`. The restart of such a group carries `--rebuild`. A pin on any other image blocks a provider change, because nothing here builds it.

It prints the `ncl` commands for each group, ending with `ncl groups restart`.
