# Critique gate — boundaries, markers, and where they live

The critique gate refuses to let a coworker deliver work until an independent
review (codex) has run and approved it. Two questions cause most of the
confusion when reading the code:

1. **What counts as "a delivery" that must be gated?** — there isn't one
   answer; there are three *kinds* of traffic, and only two of them are
   deliveries.
2. **Where do the markers live?** — the vocabulary is defined in more than
   one place (built-in defaults in code + optional per-role extensions in
   YAML), and separately the agent *emits* markers in its own output.

This note answers both, then scopes two follow-up hardening steps.

---

## 1. The three tiers of traffic

| Tier | What it is | Example | Crosses a boundary? | Gated? |
|------|-----------|---------|---------------------|--------|
| **1 — internal signal** | The doer talking to its own reviewer, inside its turn. This is how a review gets *recorded*, not something to block. | `STAGE: OUTPUT_REVIEW` in a `mcp__codex__codex` prompt | No — stays inside the doer's own turn | **Never** (correct) |
| **2 — peer handoff** | A message handed to another coworker (peer or parent). Crosses the doer's boundary, but stays *inside* the system. | `[handoff]`, `[Resolution]`, `[Triage Resolution]`, `[Review Verdict]` via `send_message` | Yes — doer → another agent | **Yes** |
| **3 — external egress** | Work that genuinely leaves to the outside world — a human or an external service. | `[Fix Report]` to the origin human; `gh pr create` / GraphQL / curl to GitHub | Yes — system → outside | **Yes** |

Tier 1 is the *evidence* the gate checks; tiers 2 and 3 are the *actions* the
gate guards. All three are handled today.

---

## 2. Where the markers live

There are three different marker vocabularies, and each lives in a different
place. This table is the answer to "where do the markers live?":

| Signal | Who **emits** it | Where the **definition** lives | Who **reads** it |
|--------|------------------|-------------------------------|------------------|
| **`STAGE:` markers** (Tier 1) — `DIAGNOSIS_REVIEW`, `PLAN_REVIEW`, `CODE_REVIEW`, `OUTPUT_REVIEW` | the doer, in the codex prompt (per the `codex-critique` skill template — `container/skills/codex-critique/SKILL.md`) | the enum is documented in the skill; parsed by pattern in `container/hooks/track-critique.sh` (`grep -oE 'STAGE:[[:space:]]*[A-Z_]+'`) | `track-critique.sh` — to record *which* review happened into `workflow-state.json` |
| **Delivery markers** (Tier 2/3) — built-in floor `[Resolution]`, `[handoff]` (general chain primitives); standard role names `[Fix Report]`, `[Fix Review Request]`, `[Review Verdict]`, `[Triage Resolution]`, `[Triage handoff]` inherited from `base-common` | the doer, as a **line prefix** in `send_message` text | **built-in floor** = general primitives only, in `container/hooks/gate-critique-on-deliver.sh` (`MSG_MARKERS=`) + `container/agent-runner/src/poll-loop.ts` (`DEFAULT_DELIVERY_MARKERS`). **Standard role names** = declared ONCE on `base-common` (`container/spines/base/coworker-types.yaml` `delivery_markers:`), inherited by every type via `extends:`, materialized to `<groupDir>/.critique-delivery-markers`, unioned with the floor at runtime by **all three** gates (critique + routing + poll-loop). Project spines add `delivery_markers` only for novel markers. `[Report]` is deliberately absent (status channel, ungated). | `gate-critique-on-deliver.sh`, `gate-chain-routing.sh`, and `checkCritiqueGate`/`checkRoutingGate` in `poll-loop.ts` |
| **PR / egress patterns** (Tier 3) — `gh pr create`, `gh api …/pulls`, `createPullRequest` | the doer, as a Bash command | **built-in defaults** in `gate-critique-on-deliver.sh` (`BASH_PATTERNS=`). **Optional extensions** via `pr_command_patterns:` in `coworker-types.yaml` → same `.critique-delivery-markers` file. | `gate-critique-on-deliver.sh` (the Bash matcher) |

### The short version

- **The floor lives in code, and is general only** — the built-in vocabulary
  is the two general chain primitives `[Resolution]` and `[handoff]`, hardcoded
  in the bash hook and the poll-loop mirror (they must agree; keep in sync).
  `[Report]` is deliberately not gated — it's the status channel.
- **The standard chain-role vocabulary lives ONCE on `base-common`** —
  `[Fix Report]`, `[Fix Review Request]`, `[Review Verdict]`,
  `[Triage Resolution]`, `[Triage handoff]` are declared in
  `container/spines/base/coworker-types.yaml` under `delivery_markers` and
  inherited by **every** coworker type via `extends:` (the composer unions
  `delivery_markers` across the chain into
  `<groupDir>/.critique-delivery-markers`; all three gates union that file
  with the floor). No per-project duplication — a future project's
  fixer/reviewer/triager inherits the standard set automatically. Locked by
  a contract test in `src/overlay-markers.test.ts`.
- **Project spines declare only NOVEL markers** — a role adds
  `delivery_markers` only for a marker of its own invention (see R3).
  Extensions are **additive only**: neither the floor nor the inherited base
  set can be configured (or tampered) away, and labels are sanitized to a
  regex-metachar-free charset before use.
- **The agent emits markers, it does not define them.** The doer writes
  `[Fix Report]` in its message; whether that *counts* is decided by the floor
  + its role's composed vocabulary, which the agent cannot weaken.

### Why markers at all (and not "gate every message")

Two reasons, both real:

1. **Zero false positives on chatter.** A fixer sends many status/ack messages
   per session. Gating *every* `send_message` would block all of them. Markers
   cheaply separate "a deliverable" from "an ack."
2. **The marker is load-bearing in routing.** The orchestrator only *routes*
   marked messages — an unmarked "fix" lands nowhere useful. So an agent can't
   dodge the gate by dropping the marker: its work then isn't delivered anyway.

### Why the vocabulary was reorganized (historical: the pre-refactor drift)

**No code branches on the specific marker name** — all three enforcement
points (`gate-critique-on-deliver.sh`, `gate-chain-routing.sh`,
`poll-loop.ts`) test the *same* alternation and treat any match identically.
The names are for human/routing readability, not machine dispatch.

Before the refactor, the built-in set was `Fix Report | Resolution | Triage
Resolution | Review Verdict | handoff` — a mix of general primitives and
role names that had drifted from what workflows actually emitted: the
most-emitted primitive (`[Report]`) was correctly absent (status channel),
but the real triage handoff (`[Triage handoff]`) and the fixer→reviewer
handoff (`[Fix Review Request]`, emitted by **both** slang and slangpy
fixers) weren't recognized by any gate, while `Review Verdict` sat in the
list on behalf of exactly one role per project. The protocol spine
(`container/spines/base/context/chain-reporting.md`) defines only two
general primitives — `[Report]` (status up one tier) and `[Resolution]`
(close every chain) — with everything else being a role specialization.

The reorganization (landed via the routing-gate vocabulary union + the
floor slim + the `base-common` declaration) restored that layering: floor =
general primitives, `base-common` = the standard role vocabulary, project
YAML = novel markers only — and closed the `[Triage handoff]` /
`[Fix Review Request]` recognition gaps in the process.

### The one real semantic hiding in the names: status vs terminal

The specialized names aren't pure redundancy — they encode a gate/no-gate
line. **`[Report]` = status (intentionally NOT gated)** — you don't want to
force a critique on every "still working…" ping (the tier-2 false-positive
trap). **`[Fix Report]` / `[Resolution]` = terminal deliverable (gated).** The
distinction between "status up" and "deliverable out" is carried by one word,
which is subtle and fragile: a role that closes with bare `[Report]` instead of
its gated terminal marker would slip the critique gate. Making that line
explicit (rather than implied by naming) is encoded explicitly in the landed model below.

### The landed model: floor (code) + standard vocabulary (base-common) + novel markers (project YAML)

**Built-in = general routing semantics mapped to tiers; `base-common` = the
standard chain-role vocabulary, declared once and inherited; project YAML =
novel markers only** (via `delivery_markers`, see R3):

| Tier | General primitive (built-in floor) | Gated? | Standard role vocabulary → inherited from `base-common` |
|------|-------------------------------------|--------|---------------------------------------------------------|
| 1 internal | `STAGE:` (not a delivery marker) | — | — |
| 2 status | `[Report]` | no (status, not a deliverable) | — |
| 2 lateral | `[handoff]` | yes (routing) | `Triage handoff`, `Fix Review Request` |
| 2 terminal / 3 external | `[Resolution]` | **yes** | `Fix Report`, `Triage Resolution`, `Review Verdict` |

Tier 3 (external egress) isn't a distinct marker — it's a `[Resolution]`/
deliverable whose *destination* is a human/PR, plus the `gh pr create` egress
commands.

> **How the migration was sequenced (historical).** The always-on routing
> gate originally read only the static built-in regex, so moving a role
> marker out of the floor would have silently regressed routing for every
> role. The landed order was: (1) teach all three enforcement points to
> union the composed `.critique-delivery-markers` vocabulary, then (2) slim
> the floor to the general primitives and declare the standard role
> vocabulary once on `base-common` — atomically, so no marker was ever
> unrecognized in between. A contract test keeps the `base-common` set from
> being silently narrowed.

---

## 3. Extending the gate — recipes

The two axes that change per coworker are **which internal reviews must run**
(`required_critique_stages`) and **what counts as a delivery**
(`delivery_markers` / `pr_command_patterns`) — both are *data* in
`coworker-types.yaml`, no code change. **Turning the gate on for a role** is a
DB change (`agent_groups.overlays`), *never* the type YAML (see the note at the
end of this section). Only the built-in default vocabulary and a brand-new
review *mechanism* need code.

| # | Goal | Change type | Where |
|---|------|-------------|-------|
| R1 | Turn the gate on for a role | DB (`ncl` / dashboard) | `agent_groups.overlays` |
| R2 | Change which review stages a role requires | data · YAML | `required_critique_stages:` |
| R3 | Gate a new delivery message shape | data · YAML | `delivery_markers:` |
| R4 | Gate a new PR/egress command shape | data · YAML | `pr_command_patterns:` |
| R5 | Stand up a whole new gated role | data · YAML + DB | a coworker type + `overlays` |
| R6 | Change the built-in **default** vocabulary | **code (2 files, keep in sync)** | the hook + poll-loop |
| R7 | Roll out / disable a check without code | env flag | container env |

None of R1–R5 or R7 require a container rebuild — the composer re-materializes
the per-group files on the next spawn, and the gates read them fresh.

### R1 — turn the gate on for a role

Activation is the `critique-gate` overlay in `agent_groups.overlays`. This is
the *only* activation path.

```bash
# host: enable the gate for one agent group
ncl groups update --id ag-1780667166439-vmjrwe --overlays '["critique-gate"]'
# turn it back off
ncl groups update --id ag-1780667166439-vmjrwe --overlays '[]'
```

Nothing else in R2–R4 has any effect until the overlay is active — the composer
skips (and removes) the materialized `.critique-*` files when `critique-gate`
isn't in the applied overlays.

### R2 — change a role's required review stages

Edit the coworker type in `container/spines/<spine>/coworker-types.yaml`. The
stage set is unioned across the `extends:` chain, so a project subtype only
declares what it *adds*.

```yaml
# container/spines/slang/coworker-types.yaml
slang-fixer:
  extends: slang-base
  description: "Fixes issues on a branch, opens a PR."
  required_critique_stages: [PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW]   # ← this line
```

Stage names must be `UPPER_SNAKE` (others are dropped at parse). `OUTPUT_REVIEW`
is special: it carries the verdict / freshness / attested-hash checks. Empty or
unset = legacy "any one critique round" mode.

### R3 — gate a new delivery message shape

Say a `weekly-reporter` role delivers with `[Weekly Report]`. Add it — the
built-in five are always present, so you only list the *new* one.

```yaml
# container/spines/<spine>/coworker-types.yaml
weekly-reporter:
  extends: base-common
  required_critique_stages: [OUTPUT_REVIEW]
  delivery_markers: [Weekly Report]        # ← additive; built-ins still gate
```

Labels are sanitized to `[A-Za-z0-9 _-]` (a `.*` or `[x]` is dropped, so it
can't blow up the gate's regex). The agent then delivers with the marker as a
**line prefix**: `[Weekly Report] Q3 numbers …`.

### R4 — gate a new PR/egress command shape

For a role that ships via GitLab instead of GitHub, recognize its CLI:

```yaml
# container/spines/<spine>/coworker-types.yaml
gitlab-fixer:
  extends: base-common
  required_critique_stages: [PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW]
  pr_command_patterns: ['glab mr create']   # ← POSIX ERE fragment, additive
```

`pr_command_patterns` entries are regex fragments (operator-authored, same trust
as the YAML) OR'd into the Bash matcher alongside the built-ins
(`gh pr create`, `…/pulls`, `createPullRequest`).

### R5 — stand up a whole new gated role

Two edits, both data: declare the type (YAML), then activate the overlay on the
group (DB).

```yaml
# 1. container/spines/docs/coworker-types.yaml — the type
docs-writer:
  extends: base-common
  description: "Drafts and publishes docs."
  required_critique_stages: [DRAFT_REVIEW, OUTPUT_REVIEW]
  delivery_markers: [Doc Published]
```

```bash
# 2. host — create/point the group at that type and turn the gate on
ncl groups update --id <group-id> --coworker-type docs-writer --overlays '["critique-gate"]'
```

(A genuinely new *review type* like `DRAFT_REVIEW` also needs a matching stage
in the reviewer skill — see R6-adjacent note; adding an existing stage does not.)

### R6 — change the built-in floor (needs code, 3 files)

The floor is the **general** chain primitives only (`Resolution`, `handoff`) —
changing it is a protocol change (these tokens drive routing too). It lives in
**three** matchers that must stay in sync:

```bash
# container/hooks/gate-critique-on-deliver.sh  AND  container/hooks/gate-chain-routing.sh
MSG_MARKERS='Resolution|handoff'
```

```ts
// container/agent-runner/src/poll-loop.ts  (feeds both checkCritiqueGate and checkRoutingGate)
const DEFAULT_DELIVERY_MARKERS = ['Resolution', 'handoff'];
```

For a *role-specific* marker, do NOT touch the floor — declare it in that
role's `delivery_markers` (R3). Adding to the floor is only for a new
project-agnostic primitive every coworker would use. (Collapsing these three
matchers into a single source of truth is a natural follow-up.)

### R7 — roll out or disable a check without code

Every check has a kill switch (default-on; `=0` disables), set as container env:

```bash
CRITIQUE_VERDICT_STRICT=0      # allow delivery when a required verdict is unrecorded
CRITIQUE_FRESHNESS=0           # allow delivery after edits since the last review
CRITIQUE_ATTEST=0              # skip attested-hash re-check
CRITIQUE_PIN_INSTRUCTIONS=0    # record reviews even with non-canonical instructions
CRITIQUE_ESCALATION=0          # revert the denial cap to silent fail-open
```

Use for a cautious rollout (start with the two strictest — `VERDICT_STRICT`,
`PIN_INSTRUCTIONS` — off, watch the fixers, then flip on) or to unblock a role
in an emergency.

> **Why R1 is DB, not YAML.** `getAppliedOverlayNames` (`src/claude-composer/resolve.ts`)
> resolves the `critique-gate` overlay **only** from `agent_groups.overlays`
> (operator selection), because that overlay has empty `applies-to` and never
> anchor-splices. Declaring `overlays: [critique-gate]` in a coworker type does
> **not** activate it. The type YAML holds *what to gate on*; the DB holds
> *whether the role is gated*.

---

## 4. The enforcement chokepoints (what "put the checkpoint" means)

There is no single "exit door" — each tier that leaves has its own natural
chokepoint:

- **Tier 2 (peer handoff) and human messages** are gated at the
  **message-dispatch point**: the `gate-critique-on-deliver.sh` PreToolUse hook
  on `send_message`, plus the in-process mirror `checkCritiqueGate` in
  `poll-loop.ts` for the plain-text `<message>` emission path. This chokepoint
  already sees the *destination* (`in_reply_to`), not just the text.
- **Tier 3 (external egress)** is gated today by the Bash pattern in the hook.
  The *true* door is the credential-injection proxy (OneCLI): a network call
  physically cannot reach GitHub without a credential, and the proxy is where
  that credential is granted.

The reason both matter: a bad fix handed to a peer (tier 2) is a problem, and
a bad PR shipped to GitHub (tier 3) is a bigger, externally-visible one. The
gate covers both.

---

## 5. Follow-up hardening (not yet done)

Two scoped improvements make each boundary stronger. They are independent and
each sits behind its own flag.

### 5a. Tier 2 — destination-aware predicate (small, low-risk)

Today the message check keys on *text* ("does it match a delivery marker?").
The cleaner predicate is *"is this crossing to a non-origin destination **and**
is the work unreviewed?"* — with markers demoted from *defining* the gate to
*refining* it (distinguishing a deliverable from an ack among peer messages).
The dispatch chokepoint already has the destination, so this is a
self-contained change. Care: the destination model must not re-block ordinary
acks to the origin chat (the false-positive trap markers currently avoid).

### 5b. Tier 3 — proxy-enforced egress (the durable, tamper-proof version)

Move the real lock to the OneCLI credential proxy: hold a PR-creating call
(`POST …/pulls`, `createPullRequest`) unless a critique receipt exists for the
session, or route it to human approval. This is the only design where "the
agent delivers in a shape we didn't pattern-match" has *no* hole, because the
agent cannot obtain a credential to talk to GitHub without clearing the check.
Bigger: needs proxy rule support (configured via the OneCLI web UI today; see
`CLAUDE.md` §"Requiring approval for credential use").

---

## 6. File map

| Concern | File |
|---------|------|
| Delivery gate (PreToolUse hook) | `container/hooks/gate-critique-on-deliver.sh` |
| Review recorder (PostToolUse hook) | `container/hooks/track-critique.sh` |
| Text-dispatch gate mirror + routing gate | `container/agent-runner/src/poll-loop.ts` (`checkCritiqueGate`, `checkRoutingGate`) |
| Reviewer skill (emits `STAGE:` + structured verdict + `### Attested`) | `container/skills/codex-critique/SKILL.md` |
| Vocabulary YAML keys (`delivery_markers`, `pr_command_patterns`, `required_critique_stages`) | `container/spines/<spine>/coworker-types.yaml`, parsed in `src/claude-composer/registry.ts` |
| Materialization (`.critique-delivery-markers`, `.critique-required-stages`, `.overlay-critique-gate`) | `src/claude-composer/resolve.ts` |
| Host-injected activation (`CRITIQUE_GATE_ACTIVE`, `CRITIQUE_REQUIRED_STAGES`) | `src/container-runner.ts` |
| Graduated escalation (deny ×3 → human approval) | `src/modules/critique-escalation/`, wired in `src/host-sweep.ts` |

### Runtime flags (all default-on; `=0` disables)

`CRITIQUE_GATE_ACTIVE` · `CRITIQUE_REQUIRED_STAGES` · `CRITIQUE_VERDICT_STRICT`
· `CRITIQUE_FRESHNESS` · `CRITIQUE_ATTEST` (+ `CRITIQUE_ATTEST_ROOT`) ·
`CRITIQUE_PIN_INSTRUCTIONS` · `CRITIQUE_ESCALATION` (+
`CRITIQUE_ESCALATION_TIMEOUT_SECS`).
