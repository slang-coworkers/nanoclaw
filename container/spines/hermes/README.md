# spine-hermes

Hermes Agent project spine under the lego coworker model, for the **meta team that ports NanoClaw coworker capabilities into Hermes as Hermes plugins** (PORT, not bridge). Target: `NousResearch/hermes-agent` at release tag `v2026.8.31` (v0.21.0), mounted read-only at `/workspace/extra/hermes-release`; implementation happens in a fork at `/workspace/agent/hermes-agent` with one git worktree per target.

Provides identity, invariants, context, and coworker types:

| Type | Extends | Role |
|------|---------|------|
| `hermes-common` | `base-common` | identity, `public-api` + `plugin-first` invariants, `layout` + `testbed` context, `vars` (`repo`, `project`, `fixer`, `release_tag`, `release_tree`), DeepWiki (advisory) |
| `hermes-reader` | `hermes-common` | read-only: `hermes-plan` |
| `hermes-writer` | `hermes-common` | `hermes-plan` + `hermes-implement`, `hermes-code-writer`, `hermes-docs` |
| `hermes-architect` | `hermes-reader` | ADR + runnable acceptance test per requirement (`hermes-spec-requirement`); `no-push`; stages `DIAGNOSIS_REVIEW, PLAN_REVIEW, OUTPUT_REVIEW`; novel marker `[Spec handoff]` |
| `hermes-builder` | `hermes-writer` | implements the plugin in the fork worktree, tests + `doctor --ci`, draft PR to the fork, `peer-review` invariant; stages `PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW` |
| `hermes-reviewer` | `hermes-reader` | adversarial re-run of acceptance test + doctor in its own container (`hermes-review`); `no-push` + `code-changes`; stages `CODE_REVIEW, OUTPUT_REVIEW` |

Wiring is architect ↔ builder ↔ reviewer only (`wire_agents`); the orchestrator drives requirement rows to the architect. Overlays (`critique-gate`, `plan-gate`), `cli_scope`, apt packages, and the release mount are per-group settings, not type keys.

## Marker routing (why `[Spec handoff]` goes up, not down)

The always-on chain-routing gate denies any delivery-marker-prefixed send that lacks `in_reply_to`. A fresh delegation to a peer carries `thread_id` and no `in_reply_to`, so it can never be marked. Therefore the architect's gated terminal `[Spec handoff]` is its report **up** to the orchestrator, sent as a reply (`in_reply_to=<the requirement dispatch>`), and the delegation **down** to `hermes-builder` is an **unmarked** fresh message (`to="hermes-builder", thread_id="hermes-<req-id>"`) plus `send_file` of the ADR and acceptance test. Send the gated `[Spec handoff]` first; delegate only after it is accepted.

Spine fragments are not `{{vars.*}}`-substituted (only workflow bodies are), so the fragments spell paths out literally; workflows use `{{vars.release_tree}}` etc.
