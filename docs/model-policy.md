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
