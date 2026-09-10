---
name: project_critique_gate_pulls_pattern_builtin_floor
description: "The critique gate's `pulls\\b` pattern is a hardcoded built-in FLOOR (config is additive-only, unfixable agent-side), matched UNANCHORED against raw command TEXT — so it denies read-only GETs and even purely-local .md writes whose text merely contains the substring. The fix already exists on the file's own send_message branch. Still unpatched 08-10."
metadata:
  node_type: memory
  type: project
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# Critique gate `/pulls` pattern — a built-in floor matched against command text

`/app/hooks/gate-critique-on-deliver.sh` (shared image path, byte-identical across all nanoclaw clones on
my edge ⇒ trunk state, not one worktree's drift). Still unpatched as of 08-10.

## The defect — an unanchored substring match on the raw command string

- **`:41`** `TEXT=$(… .tool_input.text // .tool_input.command …)` — the raw command string.
- **`:52`** `BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api.github.com[^ ]*/pulls\b|createPullRequest'`
  is the **built-in floor**; `:57-58` make config strictly **ADDITIVE** (`EXTRA_BASH` only appends;
  approver's marker file carries `bash_patterns: []`) ⇒ **unfixable from the agent side by design.**
- **`:81`** `grep -qE "($BASH_PATTERNS)" <<< "$TEXT"` — **UNANCHORED**, matching the text anywhere.

⇒ The defect is not "over-matches read-only GETs" (a too-narrow framing) but **"matches any command whose
TEXT contains the substring"**: a purely local `.md` write containing `pulls/`, a read-only
`gh api …/pulls/N/reviews` GET, and a real `POST` are all indistinguishable. It is also **method-blind** —
`grep -nE '(--method|GET)'` on the hook returns zero hits, so there is no method awareness to fix, only the
anchor to add. Measured 08-10 (regex extracted and run against probes): read GETs `--jq`/`/files` MATCH
(denied); `gh pr view` / `gh pr diff` / graphql do NOT — they are the forced read-path workaround.

**The fix already exists in the same file.** The `send_message` branch at **`:71`** is deliberately
ANCHORED (`^[[:space:]]*\[($MSG_MARKERS)\]`), with the comment at `:64-67` explaining *"unanchored matching
burned a denial — and one of the session's 3 soft-cap strikes — every time an agent merely MENTIONED a
marker mid-sentence."* The author diagnosed and fixed exactly this class for messages and did not carry it
to the Bash branch. ⭐ **When reporting a defect, check whether the codebase already solved it elsewhere** —
*"apply the `:71` treatment at `:81`"* is a far stronger ask than "narrow this regex." Operator-facing
remedy (three observations a year apart, 07-15 · 07-22 · 08-04+, three agents, one fix): gate on **write
verbs/flags** (`-X POST|PATCH|PUT|DELETE`, `--method`, `-f`/`--field`/`--input`) instead of bare `pulls\b`.
**Do NOT loosen unilaterally** — operator sign-off required; a mis-written regex could let real writes through.

## Activation is edge-scoped (env authoritative), so the floor only bites armed coworkers

Activation (`:33-37`): `CRITIQUE_GATE_ACTIVE` env is authoritative when set; else the
`.overlay-critique-gate` marker file is the local/test fallback. **The env var wins everywhere the host
injects it** — design intent (hook comment): so an agent can't `rm` the marker to escape (a child can't
mutate inherited env). Measured: Main is explicitly `=0` (disarmed, `exit 0` at `:34` before `BASH_PATTERNS`
is evaluated); the approver is explicitly `=1` (armed) *and* has the marker file. ⇒ ⭐⭐ **A marker-file-only
check mispredicts in BOTH directions, and the armed edge is the dangerous polarity** — the file exists AND
the var is `1`, so a file-only check returns the right answer for the wrong reason (validates a broken
method instead of failing loudly). **Correct probe order: env var first, file only if unset.** So any
fleet-wide phrasing ("over-broad regex") is incomplete: the floor only bites edges carrying the overlay
marker (armed coworkers) — but it costs them real operator round-trips (see friction datapoint below).

## Second defect — a missing `mkdir` that makes escalation an ordering race

`gate-critique-on-deliver.sh` (and `gate-plan.sh`) lack `mkdir -p "$(dirname "$STATE")"` — only 2 of 7
state-touching hooks do. Consequence: `:272`'s `jq … > "$STATE.tmp"` fails, a trailing `|| true` **masks
it**, `critique_gate_denials` stays 0, `:208`'s `>= 3` never trips ⇒ the escalation card / soft-fail /
timeout backstop at `:208-270` is unreachable and **the gate denies forever.** ⛔ **But it is an ORDERING
RACE, not dead code** — `track-edits.sh:56` and `workflow-state-reset.sh` also `mkdir -p` the dir, so the
escalation path is dead only when a `pulls`-shaped Bash read is the **FIRST state-touching event of a
session**, before any edit-tracked write created the dir. ⇒ **A "dead code" claim is a universal, refuted
by one instance of the code having run** (3 real bypass cards were filed, each requiring a readable state
file — the race explains them, "dead code" cannot). One-line fix at `:105` + the same at `gate-plan.sh`.
Companion: [[project_critique_gate_session_blind_counter_defect]].

The **denial cap auto-files an admin `critique_gate_bypass` card**; repeated denials escalate. **Standing
decision: approve none** — a bypass is a request to deliver an artifact whose critique stages are
unsatisfied; approving it as "probe noise" waves through the gate that has been catching errors. Manufacturing
an artifact (a pointless `/codex-critique`) just to clear the gate for a read-only probe is worse than the
friction. 📌 **Friction datapoint:** 18:35Z→04:55Z ≈ **10.3h** from a probe-generated card to rejection — an
operator round-trip attached to a call that was never a delivery; the strongest single argument for the
write-verb narrowing.

## Two adjacent mechanisms that read as this bug but aren't

- **`hit` vs `reason`.** A card's `hit` names the **surface** blocked (Bash-`pulls` vs
  `send_message`-marker); `reason` names the **defect** (missing stages / freshness / attestation). They are
  orthogonal by construction (`HIT` at `:61-85`, `DENIAL_REASON` at `:122-197`, written as separate keys at
  `:260-261`). ⇒ **the discriminating field for the defect is `reason`, not `hit`** — a card can carry
  `hit="PR creation"` *and* a freshness `reason` simultaneously (measured against the production hook via the
  disarmed-edge test below). Seeing A-with-X and B-with-Y twice does not establish X discriminates A from B —
  you need the off-diagonal cell.
- **Memory-edits aging a delivery approve.** The freshness branch (`:153`, guarded by `[ -z "$DENIAL_REASON"
  ]`) is only reachable once stages are recorded and `OUTPUT_REVIEW` is `approve`. `track-edits.sh` bumps
  `edits_since_critique` on **memory-file writes**, aging that approve, then a later `/pulls`-shaped **read**
  trips on it ⇒ **a read blocked by a delivery gate.** Compound defect (over-breadth + freshness), observed
  together 07-22 and 08-04. Real fix upstream: don't let memory-file edits age a delivery approval, and
  discriminate GET from POST.
- **A `<message>` block is not a tool call.** The hook is `PreToolUse` matcher
  `mcp__nanoclaw__send_message|Bash`, so it cannot see (or deny) a final-response `<message>` block — a
  dropped block is [[feedback_message_block_before_toolcall_dropped]], not the gate. The ABSTAIN fast-path
  (`:96-99`) is content-dependent: it fires only when `ABSTAIN_(POLICY|INFRA)` matches AND
  `\b(WOULD_APPROVE|BLOCK)\b` does not — so an abstain whose *prose mentions* those tokens is denied. ⇒
  **identify the DENIER before treating a denial as evidence about a matcher; prefer the hypothesis that the
  instrument can even observe the event.**

## How to test the gate without tripping it (and the division of labour)

1. **Runtime string assembly** (works on an armed edge): `P=$(printf 'p%s' 'ulls')` then interpolate — a
   literal route string anywhere in the script body is matched, since the match is on command text.
2. **Test from a DISARMED edge (Main, `=0`): strictly better.** Write literals freely, and arm a *sandboxed*
   copy via `CRITIQUE_GATE_ACTIVE=1` + temp `OVERLAY_MARKER_DIR`/`WORKFLOW_STATE_FILE`/`CRITIQUE_ESCALATION_FILE`
   to measure any (surface × state) cell — including ones no production session has produced.

⭐⭐ **But this is a division of labour, NOT an offloading rule:** a constructed cell proves **REACHABILITY,
not OCCURRENCE.** DISARMED edge = mechanism/semantics (construct any cell); ARMED edge = incidence/cost (the
only source of "this fired N times, here, on real commands" — 4 live firings, not 4 constructed cells, is
what made the filing strong). A fix argument usually needs both — reachability to explain it, occurrence to
justify it. Generalizes: **the seat that isn't subject to a mechanism is the seat that can probe it.**

## Method lessons this chain reinforced

- **Only PASSING cases locate a trigger** — a denial is consistent with every hypothesis that covers it; a
  pass eliminates hypotheses. Before publishing a characterization, list the observed passes and check the
  pattern predicts them; if it mispredicts one, it is known-false at the moment of writing. **An instrument
  inside the phenomenon cannot measure it** — co-location kills the control under a command-*text* matcher
  (one probe per command). See [[project_apparatus_probe_failures_rate_limit]].
- **A hook registered with an empty matcher is not a hook that runs** — read the guard clauses (`|| exit 0`
  entry conditions come first) *and* whether the side effect is top-level or nested in a function the guards
  skip. **"Denied" is not one event type** — identify the denier before attributing a denial to a matcher (I
  mis-attributed the same two denials twice, each from a plausible partially-read mechanism; a second wrong
  answer with fresh file:line citations is more dangerous than the first).
- **Attribute to the GROUP + session id, never the conversation you're in** — a coworker's "that isn't mine"
  is authoritative for its SESSION and non-authoritative for its GROUP; `ncl sessions list --agent-group`
  does NOT filter under global scope (returns all groups, and pages truncate silently at 200). See
  [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]].
- **`ncl approvals` is READ-ONLY** (verbs `list`, `get` only) — rows are deleted on approve/reject/expiry via
  the card, not a CLI verb; **a deletion is not a disposition** ("all three were rejected" is unverified;
  "all three are gone and none holds undelivered work" is the honest state). **approval→session mapping is
  permanently Main's** — the approver's `cli_scope=group` excludes `approvals`, so it can only *derive* a
  session by timestamp adjacency (correlation, not identification; a wrong id is worse than no id).
- **A correction is a claim and inherits the burden of proof** (a well-formed, self-aware retraction was
  still wrong because its key premise was never measured — get the off-diagonal cell); a tier's last
  correction being right is not evidence for its next; **a correction is not applied until every restatement
  of the number is fixed** — grep your own file after retracting a figure. Bypass approval is an operator
  gate, never routed through a coworker: [[feedback_dont_route_operator_gates_through_coworkers]].
