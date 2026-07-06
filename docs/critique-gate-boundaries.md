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
| **Delivery markers** (Tier 2/3) — `[Fix Report]`, `[Resolution]`, `[Triage Resolution]`, `[Review Verdict]`, `[handoff]` | the doer, as a **line prefix** in `send_message` text | **built-in defaults, hardcoded in two runtime files:** `container/hooks/gate-critique-on-deliver.sh` (`MSG_MARKERS=`) and `container/agent-runner/src/poll-loop.ts` (`DEFAULT_DELIVERY_MARKERS` / `DELIVERY_MARKER_RE`). **Optional per-role extensions:** declared in `container/spines/<spine>/coworker-types.yaml` under `delivery_markers:`, materialized by the composer to `<groupDir>/.critique-delivery-markers`, and unioned with the built-ins at runtime. | the PreToolUse hook `gate-critique-on-deliver.sh` and the text-dispatch mirror `checkCritiqueGate` in `poll-loop.ts` |
| **PR / egress patterns** (Tier 3) — `gh pr create`, `gh api …/pulls`, `createPullRequest` | the doer, as a Bash command | **built-in defaults** in `gate-critique-on-deliver.sh` (`BASH_PATTERNS=`). **Optional extensions** via `pr_command_patterns:` in `coworker-types.yaml` → same `.critique-delivery-markers` file. | `gate-critique-on-deliver.sh` (the Bash matcher) |

### The short version

- **Defaults live in code** — the built-in delivery vocabulary is hardcoded in
  the bash hook and the poll-loop mirror (they must agree; keep them in sync).
- **Extensions live in YAML** — `delivery_markers` / `pr_command_patterns` in a
  coworker type, composed into `<groupDir>/.critique-delivery-markers` at spawn
  and read by both gates. Extensions are **additive only**: the built-ins can
  never be configured (or tampered) away, and labels are sanitized to a
  regex-metachar-free charset before use.
- **The agent emits markers, it does not define them.** The doer writes
  `[Fix Report]` in its message; whether that *counts* is decided by the
  definition above, which the agent cannot weaken.
- **No live role declares extensions today.** The built-in vocabulary covers
  the current fixers; a role only needs a `delivery_markers` entry when it has
  a genuinely new delivery shape. Adding one is a YAML edit, no code change,
  no rebuild.

### Why markers at all (and not "gate every message")

Two reasons, both real:

1. **Zero false positives on chatter.** A fixer sends many status/ack messages
   per session. Gating *every* `send_message` would block all of them. Markers
   cheaply separate "a deliverable" from "an ack."
2. **The marker is load-bearing in routing.** The orchestrator only *routes*
   marked messages — an unmarked "fix" lands nowhere useful. So an agent can't
   dodge the gate by dropping the marker: its work then isn't delivered anyway.

---

## 3. The enforcement chokepoints (what "put the checkpoint" means)

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

## 4. Follow-up hardening (not yet done)

Two scoped improvements make each boundary stronger. They are independent and
each sits behind its own flag.

### 4a. Tier 2 — destination-aware predicate (small, low-risk)

Today the message check keys on *text* ("does it match a delivery marker?").
The cleaner predicate is *"is this crossing to a non-origin destination **and**
is the work unreviewed?"* — with markers demoted from *defining* the gate to
*refining* it (distinguishing a deliverable from an ack among peer messages).
The dispatch chokepoint already has the destination, so this is a
self-contained change. Care: the destination model must not re-block ordinary
acks to the origin chat (the false-positive trap markers currently avoid).

### 4b. Tier 3 — proxy-enforced egress (the durable, tamper-proof version)

Move the real lock to the OneCLI credential proxy: hold a PR-creating call
(`POST …/pulls`, `createPullRequest`) unless a critique receipt exists for the
session, or route it to human approval. This is the only design where "the
agent delivers in a shape we didn't pattern-match" has *no* hole, because the
agent cannot obtain a credential to talk to GitHub without clearing the check.
Bigger: needs proxy rule support (configured via the OneCLI web UI today; see
`CLAUDE.md` §"Requiring approval for credential use").

---

## 5. File map

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
