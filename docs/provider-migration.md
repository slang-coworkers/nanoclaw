# Switching an agent group between providers

How an operator moves a live agent group between providers, for example Claude
to Codex and back. The switch runs from the host.

## Preconditions

1. Install or reapply the target provider's `/add-<provider>` skill, then
   rebuild the container image. Reapplication matters when core adds a provider
   contract such as a lifecycle hook.
2. Configure the provider's authentication as documented by its skill.
3. If the group still has `.seed.md`, `CLAUDE.local.md`, or unindexed
   legacy `memory/memories/imported-agent-memory.md`, run `/migrate-memory`
   first. This is a one-time upgrade migration, not part of a provider switch.

## Switching

```bash
ncl groups update --id <group-id> --agent-provider codex
ncl groups restart --id <group-id>
```

A spawn takes the first provider it finds, in this order: the session pin
(`sessions.agent_provider`), the group's provider (`agent_groups.agent_provider`,
set by `ncl groups update --agent-provider`), the group's container config
(`container_configs.provider`, set by `ncl groups config update --provider`),
and the install default. Set the group's provider: a container-config change
has no effect on a group that has its own provider.

The install default is OpenCode with open-weights models
(`NANOCLAW_DEFAULT_WEIGHTS`, see [model-policy.md](model-policy.md)). A group
that runs under `weights=open`, by its own setting or by the default, cannot
run Claude; `ncl groups update --agent-provider claude` refuses it. Lift the
rule first:

```bash
ncl groups config update --id <group-id> --weights any
ncl groups update --id <group-id> --agent-provider claude
ncl groups restart --id <group-id>
```

Sessions resolve their provider at container spawn, so existing sessions use
the new provider on their next wake unless the session itself was explicitly
pinned.

## What carries over

| State | How |
|-------|-----|
| Group identity, wiring, members, roles, destinations | Provider-neutral central DB |
| Container config, skills, MCP servers, packages, mounts, CLI scope | Provider-neutral config |
| Standing role and persona | `instructions.prepend.md`, composed into each provider's native project document |
| Durable memory | Shared `memory/` tree; the provider hook loads its index and definition |
| Workspace files and conversation archives | Same group workspace for every provider |

The memory hook runs when a context window is created: `startup`, `clear`, and
`compact`. It does not run on `resume`, because the resumed conversation already
contains the injected memory context.

The shared tree is an Open Knowledge Format (OKF) v0.1 bundle. Durable Markdown
concepts use YAML frontmatter with a `type`, while reserved `index.md` and
`log.md` files do not. Missing metadata does not block recall; the agent repairs
it opportunistically when working with that file. Search remains ordinary
filesystem search (`rg`, `find`, and relative Markdown links).

## What does not carry over

- **In-flight conversation context.** Continuations are provider-specific (a
  Claude SDK session, a Codex thread). The target provider starts a fresh
  context; the old continuation remains available if you switch back.
- **Provider state directories.** `.claude-shared/` and `.codex-shared/` remain
  separate and idle while their provider is not selected.
- **Provider-specific model settings.** Confirm the selected model and effort
  are valid for the target provider.

## Rolling back

Set the group's provider back, with the weights it ran under:

```bash
ncl groups config update --id <group-id> --weights any   # only when going back to Claude
ncl groups update --id <group-id> --agent-provider claude
ncl groups restart --id <group-id>
```

Memory and standing instructions need no reverse migration because both
providers use the same files. The prior provider resumes its own continuation,
subject to its normal transcript rotation policy.

## Pinning one session

A session can run on another provider than its group. The pin is the first
place a spawn looks for the provider:

1. `sessions.agent_provider`: the session pin
2. `agent_groups.agent_provider`: the group's provider
3. `container_configs.provider`: the group's container config
4. the install default

```bash
ncl sessions update --id <session-id> --provider codex             # pin
ncl sessions update --id <session-id> --provider codex --restart   # pin, apply now
ncl sessions update --id <session-id> --provider ''                # clear: follow the group again
```

`ncl sessions get` and `ncl sessions list` show the pin (`agent_provider`), the
provider the session runs on (`effective_provider`) and the step that decided
it (`provider_source`).

The command checks the pin with the model policy that spawn uses, including the
session's privilege. It refuses a provider the host does not register, and a
pin that would make a `weights=open` session call a closed model, for example
`--provider claude` on an open-weights group. It also refuses to clear a pin
when the group's own provider would break the policy.

The pin applies at the session's next spawn. A running container keeps its old
provider: `--restart` stops only this session's container, and the next message
starts it on the new provider. `ncl groups restart --id <group-id>` restarts
every running container of the group instead. From inside a container the
command needs admin approval, like `ncl groups update`.
