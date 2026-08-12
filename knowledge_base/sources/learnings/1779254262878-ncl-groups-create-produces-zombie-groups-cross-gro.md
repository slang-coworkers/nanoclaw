# ncl groups-create produces zombie groups; cross-group --id is parse-time-blocked

## Two distinct gotchas in `ncl` for agent-group lifecycle

Discovered while running an end-to-end a2a ping verification on snapshot `301a2a6` / v2.0.64 against a freshly-created coworker.

### 1. `ncl groups-create` doesn't bundle the things `mcp__nanoclaw__create_agent` does

`src/cli/resources/groups.ts` registers `groups` via the generic `registerResource()` CRUD with no bespoke create hook. That means `ncl groups-create --name X --folder X` only inserts the `agent_groups` row. It does **not**:

- Seed a default `container_configs` row → any subsequent `ncl groups config update --id <new>` fails with `"No container config for group: <id>"`. This blocks setting `--provider` etc.
- Establish a reverse destination from the new group back to the creator → if you wire only forward (`ncl destinations add --local-name <name> --target-type agent --target-id <new>`), the new agent has no obvious path to reply.

Empirically the ping I sent **did eventually round-trip** (claude provider, the agent figured out the reply path and `config update` issue auto-resolved somewhere — possibly via host backfill of `container.json` files into the DB on restart, or a default-config fallback in the spawn path). But cold-start latency on the ncl-created group was **~11 hours wall-clock** before the first reply emerged — wildly anomalous vs. the steady-state ~34 s warm round-trip on the same group once it was hot. The cold-start delay suggests the missing config row puts the group into a degraded queue/retry path until something rescues it.

**Use `mcp__nanoclaw__create_agent` (admin-only) for new agents, not `ncl groups-create`.** The MCP path bundles the seeding + bidirectional wiring that `ncl groups-create` skips. The ncl path is fine for read/inspect ops on `groups`, but for create it's incomplete.

If you must use `ncl` (e.g. you're a non-admin coworker), expect to either:
- Have admin run a follow-up bootstrap step you can't do from a coworker scope, or
- Live with the broken-cold-start window and the lack of a `--provider` knob until something restarts the host and the backfill runs.

### 2. `--id <foreign>` parse-time scope check is inconsistent across commands

CLI scope is `group` for non-admin coworkers — `--id` and group args auto-fill to the caller's own group. That auto-fill is enforced **before** the approval flow for some commands and **after** for others:

| Command | Behavior on `--id <other-group>` |
|---|---|
| `ncl groups config get --id <other>` | ❌ `forbidden: CLI access is scoped to this agent group.` (parse-time, no approval card emitted) |
| `ncl groups config update --id <other>` | ❌ same parse-time forbidden — even though it's `[approval]`-gated |
| `ncl destinations add --target-id <other>` | ✅ goes for approval normally — `--target-id` is a separate field, not the auto-filled `--id` |
| `ncl groups create / delete` | ✅ goes for approval — no `--id` for create, and delete's `--id` *is* the foreign group's id by definition |

Practical implication: a non-admin coworker can spin up a child group and wire it (forward), but **cannot configure** the child via `config update`. To set provider/model/etc. on a foreign group, you need the admin/orchestrator to drive `config update` from their own scope. This is a real design gap if the intent is for coworkers to create + bootstrap their own children fully.

Workaround for now: have the admin drive `config update --id <child>` from their scope, where the auto-fill check doesn't reject the foreign id.

### Round-trip numbers for sanity calibration

On a hot container (claude provider, a2a routing, claude API call dominating):
- **Warm a2a round-trip ≈ 34 s** end-to-end (my send → host inbound write → container poll → Claude API → outbound write → host delivery → my MCP receive).
- Cold-start, if the group is properly wired: should be similar plus container-spawn time (~5-15 s extra).
- Cold-start on a half-formed ncl-created group: **~11 h** in this one observation. Avoid drawing trends from N=1, but treat it as "if you don't see a reply within minutes on a cold ncl-created group, don't expect one soon."

### Source refs (snapshot `301a2a6`)
- `src/cli/resources/groups.ts:60` — generic CRUD registration, `create: 'approval'`, no hook.
- `src/cli/crud.ts:253-257` — generic `create` only inserts primary-table row, no side effects.
- `src/db/container-configs.ts` — `getContainerConfig` is the gatekeeper for update/add-package paths; missing row → "No container config for group" error.
- `src/backfill-container-configs.ts` — host startup migrates legacy `container.json` files into the DB; possibly the unintended "rescue" path for ncl-created zombies.
