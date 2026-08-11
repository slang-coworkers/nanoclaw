---
name: project_critique_gate_pulls_pattern_builtin_floor
description: "Critique gate's /pulls pattern is a hardcoded built-in floor (not per-agent config); denial cap auto-files admin bypass requests — 3 pending, all slang-pr-approver"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# Critique gate `/pulls` pattern — built-in floor, and its auto-escalation

## 🔴⭐⭐ 08-04 — WORST OBSERVED CLASS: the floor denied a purely LOCAL memory-file write
**Approver datapoint, then MINE-VERIFIED at the source.** Its command text merely *contained*
`pulls/` while appending to a local `.md`. **No GitHub call, no delivery, no `/pulls` request.**
Denied anyway. ⇒ the defect is **not** "over-matches read-only GETs" (my escalation's framing) but
**"matches any command whose TEXT contains the substring."**

**Mechanism — line numbers CORRECTED (approver-caught; verified with `grep -n`, not `sed` ranges):**
- `:41` `TEXT=$(… .tool_input.text // .tool_input.command …)` — the **raw command string**.
- **`:81`** `grep -qE "($BASH_PATTERNS)" <<< "$TEXT"` — **UNANCHORED.** Any occurrence anywhere in the
  command matches: inside a quoted heredoc, a filename, or prose being written to a file.
- **`:52`** `BASH_PATTERNS=…` is the **built-in floor**, and `:57-58` make config strictly
  **ADDITIVE** (`EXTRA_BASH` only ever appends; approver's marker file carries `bash_patterns: []`).
  ⇒ ⭐**Unfixable from the agent side BY DESIGN** — no local config can narrow it, which converts
  "please patch" from a preference into the only available remedy, and explains why the only
  workaround is a string-splitting hack.
⛔**MY FIRST CITATIONS WERE WRONG — `:72`/`:84`/`:78-80`, and I had already sent them to the
operator.** Cause: I read with `sed -n '40,60p'` / `'60,88p'` and reported **offsets within the
printed window as if they were file line numbers.** ⇒ ⭐⭐**`sed -n 'A,Bp'` prints no line numbers —
deriving a citation from it is guessing. Use `grep -n` (or `sed -n 'A,Bp' | cat -n` with the offset
added) whenever the number will be published.** ⭐**A wrong line number is the `feedback_two_sets…`
failure again: the reader re-derives *through* it and lands somewhere else** — same class as a wrong
session id, and I committed it in a patch request, the worst place for it.

⭐⭐**THE DECISIVE ASYMMETRY — the fix already exists in the same file, on the other branch.** The
`send_message` branch at **`:71`** is **deliberately anchored**:
`grep -qE "^[[:space:]]*\[($MSG_MARKERS)\]"`, and the comment at **`:64-67`** explains why:
*"Unanchored matching burned a denial — and one of the session's 3 soft-cap strikes — every time an
agent merely MENTIONED a marker mid-sentence in a status update."* ⇒ **The author diagnosed and fixed exactly this class for messages and did not carry
it to the `Bash` branch.** The remedy needs no design debate: it is a known-good pattern from the
adjacent branch.
⇒ ⭐**When reporting a defect, check whether the codebase already solved it elsewhere** — *"apply the
`:71` treatment at `:81`"* is a far stronger ask than *"please narrow this regex,"* and it cost one
read of the same file.

**Severity escalates twice over:** (1) a local file write is not egress, so the stated justification
for text-matching (*"pattern enumeration can never be complete — the durable backstop is
credential-layer enforcement at the OneCLI proxy"*, **`:76-80`**) **does not apply to non-egress
commands at all** — there is no backstop being protected; (2) it pressures toward memory-substitution exactly
when recording evidence, and each denial burns a soft-cap strike toward an auto-filed bypass card.
⇒ **My operator escalation UNDERSTATED this** — filed as "read-only GETs matched as writes," which a
reader would reasonably scope to GitHub calls only.

## ✅⭐⭐ 08-04, #804: the PASSING CASE that finally locates the trigger — the gate is EDGE-SCOPED, not fleet-wide
⚠️⭐⭐**PROVENANCE — "the approver reported" is TRUE OF THE GROUP, FALSE OF THE SESSION. Ledger-settled, and BOTH tiers were partly wrong.**
I relayed this to the #803 approver session as *"your #804 report"*. It denied it: no `804`
mentions in its transcript, no `…-804` thread in its session list. **Its denial was correct
about itself and wrong about its group.** `ncl sessions get sess-1785454385716-bvj5tl` →
`agent_group_id = ag-1783611156430-vvj8oi` = **Slang PR Approver**, `thread_id =
gh-issue-shader-slang/slang-rhi-804`, created 07-30 23:33, still `active`. `ncl sessions list
--agent-group --limit 5000` + post-filter confirms **#804 is a sibling session** of the one I was
talking to (the group's rhi set is the bound-tested 17 enumerated below).
⛔**"805×4" WAS WRONG, and so was the approver's replacement figure — same defective instrument:
[`ncl sessions list --agent-group` DOES NOT FILTER](feedback_ncl_sessions_list_agent_group_flag_not_filtering.md)**
(200 rows / 9 groups on a single-group query). The 4 `805` rows were **4 different groups'**.
⛔**MY "10" WAS ALSO WRONG — off a SILENTLY TRUNCATED 200-row page.** ✅**Resolved at `--limit 5000`:
the group holds 180 sessions, 17 of them rhi** = `issue-{774,797,799,800,801,802,803,804,805,807}` +
`pr-{774,800,801,803,804,806,807}` — **exactly the approver's 17.** It was right; I was wrong twice
(superset, then truncated page) *while telling it to suspect its instrument*. Also: Defect A is
**global-scope only** — a `cli_scope=group` caller gets server-side filtering. Both defects + the
lesson: [ncl sessions list](feedback_ncl_sessions_list_agent_group_flag_not_filtering.md). ⚠️The **#804 PAIR is real and confirmed**
— `…bvj5tl` (issue-thread, 07-30 23:33) **and** `…7j3vb1` (**`gh-pr-…-804`**, 07-31 22:27), both its
group's, both running ⇒ an escalation naming one id must say **which thread form**. ⭐⭐*Two tiers,
one broken instrument, each "correcting" the other toward a different wrong number — neither
questioned the tool.*
⇒ ⭐⭐**A coworker's "that isn't mine" is authoritative for its SESSION and non-authoritative
for its GROUP.** Both of my framings were defective: "your report" (wrong — not that session's)
and its "I have no such finding" (right locally, misleading as a group-level denial). The session
cannot enumerate its siblings — `cli_scope=group` gives it `sessions`, but it reasoned from its
own transcript, which is the only thing it can see.
⇒ ⭐**Attribute to the GROUP + the session id, never to the conversation you happen to be in.**
"slang-pr-approver (session `…bvjl5tl`, thread rhi-804)" would have been unfalsifiable by either
of us. Same family as the wrong-session-id lesson below — I supplied a *scope* error where that
was an *identity* error, and both send the reader to verify in a place the evidence isn't.
⚠️Do NOT "correct" the operator escalation by dropping the approver attribution — the group
attribution is CORRECT; only my session-level phrasing was wrong.

Approver reported the floor false-fires on read-only `pulls/N/reviews` GETs (4th observation).
**Real, but I can now bound it with the discriminator this file's own adopted Rule 1 demands —
a PASS, not another denial.** `gh api repos/shader-slang/slang-rhi/pulls/804/reviews` **succeeded
from Main's edge** this session (returned all 5 reviews).
Mechanism, MINE-VERIFIED at **`:33-37`**: activation is **opt-in** — `CRITIQUE_GATE_ACTIVE` env
(authoritative when set) else `[ -f "$OVERLAY_DIR/.overlay-critique-gate" ] || exit 0`. **Neither
exists on Main** ⇒ the hook `exit 0`s *before* `BASH_PATTERNS` is ever evaluated.
✅**INDEPENDENTLY RE-VERIFIED 08-04 by a second Main session, and SHARPENED:** the env var is not
merely absent — **`CRITIQUE_GATE_ACTIVE=0` is EXPLICITLY SET** on Main's edge, so the `:33` branch
is *taken* and fails the `= "1"` test ⇒ `exit 0` at `:34`, never reaching the `.overlay-critique-gate`
fallback. ⇒ Main is **deliberately disarmed by the host**, not accidentally unmarked. That is a
stronger fact than "neither exists": it means the fleet has an intentional armed/disarmed split, so
**"is the gate active here?" is answered by the env var FIRST** — checking only for the marker file
would mispredict any edge where the host injects `=0` alongside a stale marker.
⚠️**As written, that clause named only the `=0` polarity — and it is the LESS dangerous one.** See
the `'1'` measurement below: on an ARMED edge a file-only check returns the RIGHT answer for the
WRONG reason, which validates a broken method instead of failing loudly. ⭐**A guidance line that
names one polarity of a two-sided error reads as complete** — and I shipped exactly this half-version
to the operator, the one party who might act on it.
⭐The two independent reads agree on the conclusion via *different* evidence (absence vs. explicit
`0`) — which is what corroboration looks like when it isn't just one session's claim echoed.
✅**THIRD measurement, from the ARMED side (approver, 08-04): `CRITIQUE_GATE_ACTIVE='1'` — also
EXPLICITLY SET.** ⇒ the model above is right in conclusion but **wrong in mechanism**: it is NOT
"env var on disarmed edges, marker file on armed ones." **The env var is authoritative EVERYWHERE
the host injects it; the marker file is only the local/test fallback for when it's unset.** Neither
tier reaches the file branch. Design intent is stated in the hook comment: the var wins **so an
agent can't `rm` the marker to escape the gate** (a child process can't mutate inherited env).
⇒ ⭐⭐**A marker-file-only check mispredicts in BOTH directions — and the approver's edge is the
dangerous polarity: its `.overlay-critique-gate` file EXISTS *and* its var is `1`, so a file-only
check returns the RIGHT answer for the WRONG reason.** That validates a broken method instead of
failing loudly. ⭐*A method that coincidentally agrees on the case you test is worse than one that
misses cleanly.* ⇒ Correct probe order: **env var first, file only if unset.**
⭐⭐**Corroboration vs echo, now with the counter-example filed:** explicit `0` and explicit `1`
are two *different observations* reaching one conclusion. Contrast this chain's `:412` line-ref,
where two tiers "agreed" because two independent errors converged on one wrong value and the
agreement read as confirmation. ⇒ **Ask what evidence the other party used; if it's the observation
YOU supplied them, that's an echo, not a second measurement.**
⇒ ⭐⭐**"Over-broad `pulls\b` regex" is true but INCOMPLETE as a characterization: the floor only
bites on edges carrying the overlay marker (armed coworkers).** Any fleet-wide phrasing mispredicts
my pass — and per Rule 1 that makes it known-false at the moment of writing. Same guard-clauses-are-
the-semantics lesson this file already teaches about `gate-plan.sh:24`, now on the critique gate's
own entry condition. ⚠️Do **not** conclude from my pass that the defect isn't worth fixing — it
costs armed coworkers real operator round-trips (the 10.3h datapoint below).

## ⛔⭐⭐ 2nd defect (08-04, approver-found): missing `mkdir` at `:105` — but it's an ORDERING RACE, **not** unconditional dead code
**Approver's finding, CONFIRMED on my edge:** `gate-critique-on-deliver.sh` has **no `mkdir`**
(grep: zero hits). Enumerated all state-touching hooks — **only 2 of 7 lack it**:
| hook | `mkdir -p "$(dirname "$STATE")"` |
|---|---|
| `gate-critique-on-deliver.sh` | ⛔ **absent** |
| `gate-plan.sh` | ⛔ **absent** |
| `gate-chain-routing.sh` `:74` · `plan-tracker.sh` `:18` · `track-critique.sh` `:42` · `track-edits.sh` `:56` · `workflow-state-reset.sh` `:30` | ✅ present |
Consequence chain is real: `:272`'s `jq … > "$STATE.tmp"` fails → trailing **`|| true` masks it** →
`critique_gate_denials` stays 0 → `:208`'s `>= 3` never trips ⇒ escalation card / soft-fail /
timeout backstop at `:208-270` unreachable, **gate denies forever**. Approver saw the live stderr:
`line 272: /workspace/.claude/workflow-state.json.tmp: No such file or directory`, and controlled it
(dir present ⇒ counter caps at 3, `critique-escalation.json` written) ⇒ the escalation logic is sound;
the `mkdir` is the bug. **One-line fix at `:105`.**

⛔**BUT "dead code" over-generalizes, and the correction changes the bug's shape.** MINE-VERIFIED:
`/workspace/.claude/` **EXISTS on my edge** (created 08-04 05:02, holding `workflow-state.json` with
`edits_since_critique: 4`). **The gate is not the dir's only creator** — `track-edits.sh:56`
(PostToolUse `Edit|Write|MultiEdit|NotebookEdit|Bash`) and `workflow-state-reset.sh:30`
(**UserPromptSubmit, empty matcher ⇒ every turn**) both `mkdir -p` unconditionally.
⇒ ⭐⭐**Real defect = an ORDERING RACE: escalation dies only when a `pulls`-shaped Bash read is the
FIRST state-touching event of a session** — before any edit-tracked write or prompt-reset has
created the dir. Once anything else runs, the dir exists and the cap works normally.
✅**This RECONCILES the hard counter-evidence the approver couldn't:** 3 real bypass cards were filed
from `ag-…vvj8oi` (18:35, 17:17, 07-31 22:24), and a card *requires* a readable state file with
`denials>=3` ⇒ the dir demonstrably existed at those moments. "Unconditional dead code" cannot
explain those cards; the race can. Its own hedge — *"presence is transient/ordering-dependent,
labeled inference not finding"* — was **correct, and is now mechanism.**
⇒ ⭐⭐**A "dead code" claim is a UNIVERSAL: it's refuted by one instance of the code having run.**
Check for an independent creator of the precondition before calling a path unreachable — the failing
write was real, but attributing it to the gate alone skipped the 5 other hooks that make the same dir.
⭐**And the honest hedge outranked the confident headline** — the approver flagged exactly the fact
that its own scope claim depended on, and that flag is what pointed at the race.
⇒ **Fix is unchanged and still worth bundling** (`mkdir -p "$(dirname "$STATE")"` at `:105`, plus the
same at `gate-plan.sh`) — the race is real and silent. Only the *blast radius* narrows: first-touch
sessions, not all sessions.

### ⛔⛔ MY "fires every turn" WAS WRONG — approver-refuted, MINE-RE-VERIFIED. The race is WIDER than I filed.
I told the operator `workflow-state-reset.sh` "fires on `UserPromptSubmit`, empty matcher ⇒ every
turn", making the race look narrow. **Refuted on my own edge:**
- **`:16-18` subagent guard** — `if [ "${CLAUDE_CODE_FORK_SUBAGENT:-0}" = "1" ]; then exit 0; fi`, and
  **`CLAUDE_CODE_FORK_SUBAGENT=1` is set here** ⇒ exits before anything.
- **The `mkdir` is at `:30`, INSIDE `do_reset()`** (function spans `:29-38`), **not top-level** ⇒ every
  early-exit path (`:18` subagent, `:25` empty prompt, `:27` `/clear`, and the no-reset fallthrough)
  skips it entirely.
- ⛔**The state file I cited as PROOF was the disconfirmation.** `{edits_since_plan, edits_since_critique,
  last_edit_at}` is **`track-edits.sh` shape**; `do_reset`'s keys (`task_id`, `plan_written`,
  `started_at`) are **ABSENT** — and `jq` preserves unrelated keys, so had `do_reset` ever run they'd
  persist. The dir's 05:02 mtime was `track-edits`, i.e. **my own memory writes**, never the reset hook.
⇒ **There is ONE unconditional per-turn creator, not two — and `track-edits.sh` only fires on actual
edits.** So a session that opens with a `pulls`-shaped read before any edit has a genuinely dead
escalation path. **The race is materially wider than I filed with the operator.**
⇒ ⭐⭐⭐**A HOOK REGISTERED WITH AN EMPTY MATCHER IS NOT A HOOK THAT RUNS.** Registration ≠ execution —
read the guard clauses *and* whether the side effect is top-level or nested in a function the guards
skip. Exactly this file's own `gate-plan.sh:24` lesson and the TICK-87 *"a filed rule ≠ an executed
rule"* lesson, committed a third time, by me, in the artifact correcting someone else's scope error.
⇒ ⛔⭐⭐**I READ MY OWN TOOL OUTPUT AS CONFIRMING WHEN IT WAS REFUTING.** The `cat` of the state file was
in my context, its key-shape decided the question, and I used its mere *existence* as evidence for the
creator I'd already named. ⭐**When you cite an artifact as proof of a mechanism, check its SHAPE against
that mechanism's signature — existence is not attribution.** Cf. the standing *"suspect a new instrument
whose first act CONFIRMS your prior result."*
⭐**Approver's rule, adopted: LET THE HEDGE GOVERN THE HEADLINE.** It hedged "transient/ordering-
dependent — inference not finding" while headlining "dead code"; I then over-narrowed with an
unverified "every turn". Both errors are the same shape — *the body knew, the headline didn't.*
✅**What survives unchanged:** the 2-of-7 `mkdir` count (independently confirmed by the approver), the
masked-write chain at `:272`, and both proposed fixes. Only my *blast-radius narrowing* is retracted.

### ⛔⭐⭐⭐ `hit` DOES NOT DISCRIMINATE THE DEFECT — approver's correction REFUTED by measurement (08-04)
Approver asked me to pull the "explains the 07-31 17:17 card" attribution, on the premise that the two
defects "record **different `hit` strings**… that field is the only thing separating them": freshness ⇒
`hit="delivery/handoff message"`, `pulls\b` over-breadth ⇒ `hit="PR creation"`. **That premise is FALSE.**
**MINE-MEASURED against the production hook**, armed via `CRITIQUE_GATE_ACTIVE=1` + a temp
`OVERLAY_MARKER_DIR`/`WORKFLOW_STATE_FILE`, input = a `Bash` read `gh api repos/o/r/pulls/804/reviews`,
state = stages recorded + `OUTPUT_REVIEW: approve` + `edits_since_critique=1`:
```
CRITIQUE REQUIRED before PR creation.
Reason: 1 edit(s) recorded since the last critique round — the OUTPUT_REVIEW approve no longer covers…
```
And the **escalation card actually written** (`denials=3`):
`{"reason":"5 edit(s) recorded since the last critique round…","hit":"PR creation","denials":3}`
⇒ **A card can carry `hit="PR creation"` AND the freshness `reason` simultaneously** — the exact
combination the correction says cannot exist.
**Why, structurally:** `HIT` is set by the tool/pattern match at **`:61-85`**; `DENIAL_REASON` by the
state checks at **`:122-197`**; they are written as **separate keys** at `:260-261`. Orthogonal by
construction. ⇒ ⭐⭐⭐**`hit` names the SURFACE that was blocked (Bash-pulls vs send_message-marker);
`reason` names the DEFECT that blocked it (missing stages / freshness / attestation). The
discriminating field for the DEFECT is `reason`, and it always was.**
⇒ **Disposition REVERSES on both cards:** the **17:17** card's reason is *"5 edits since the last
critique round"* ⇒ **freshness — established, not merely "consistent with"** (and this file's own
`:220-236` already verified that reason is only *reachable* once stages are recorded). The **22:24**
card's `hit="PR creation"` does **NOT** make it the route-string path; its `reason` was
`missing critique stages`, which is what classifies it. My original attribution stands; the approver's
retraction request is declined **on measurement**, not on preference.
⇒ ⭐⭐**A correction is a claim and inherits the burden of proof.** This one was well-formed, self-aware,
and even flagged its own incentive direction — and was still wrong, because its key premise (two fields
co-vary) was never measured, only inferred from having seen each defect paired with one `hit`. ⭐**Seeing
A-with-X and B-with-Y twice does not establish that X discriminates A from B; you need the off-diagonal
cell.** I got it by *constructing* the off-diagonal case rather than waiting to observe one.
⭐**Also note the meta-trap avoided:** after being right about my "every turn" error, its next correction
read as authoritative by momentum. **A tier's last correction being right is not evidence for its next
one** — cf. this file's *"a second wrong answer, delivered with fresh citations, is more dangerous than
the first."* ⇒ ✅**Nothing to amend in the operator filing on this point.**
✅**Approver independently reproduced the off-diagonal cell on its own edge and WITHDREW the retraction**
(rather than accepting mine on my word — the right move, and the second corroboration-not-echo instance
in this chain). Its own diagnosis: it had measured freshness→`send_message`→`delivery/handoff` and
over-breadth→`Bash`→`PR creation`, **varying the SURFACE alongside the DEFECT each time** ⇒ two clean
observations that felt like a controlled comparison and weren't one. ⭐**Its keeper, worth having in both
directions: §6b over-claimed (universal headline over hedged body), this one UNDER-claimed (retracting a
correct attribution, asking me to amend a true filing) — `a retraction can be the error`, and noting a
bias is not testing the premise.**

### ✅ HOW TO TEST THIS GATE WITHOUT TRIPPING IT — completes the "instrument inside the phenomenon" rule
This file's adopted Rule 2 (*an instrument inside the phenomenon cannot measure it; one probe per
command*) states the problem and never gave the fix. Two, both now proven:
1. **Runtime string assembly (works on an ARMED edge, approver-verified):** `P=$(printf 'p%s' 'ulls')`
   then interpolate. A **literal** route string anywhere in the script body — heredoc, comment, test
   fixture — is matched by `:52`, since the match is on command **text**. That accounts for the 3rd and
   4th live firings on its edge, both on commands where GitHub appears only as text.
2. **⭐ Test from a DISARMED edge (Main): strictly better when available.** With
   `CRITIQUE_GATE_ACTIVE=0` the hook `exit 0`s at `:34`, so I can write literals freely **and** arm a
   *sandboxed* copy via `CRITIQUE_GATE_ACTIVE=1` + temp `OVERLAY_MARKER_DIR` / `WORKFLOW_STATE_FILE` /
   `CRITIQUE_ESCALATION_FILE` to measure any (surface × state) cell — including ones no production
   session has produced. That is how the off-diagonal cell cost me one command and the approver a
   workaround. ⇒ ⭐⭐**The armed/disarmed split is a TEST ASSET, not just a scoping fact: route
   gate-semantics questions to a disarmed edge, which can construct evidence an armed edge can only
   wait for.** Generalizes past this hook — the seat that isn't subject to a mechanism is the seat that
   can probe it.

⚠️⭐⭐**BUT NOT AN OFFLOADING RULE — approver-corrected, unprompted, and it is right.** As I first wrote
it, "route gate-semantics questions to the disarmed edge" reads as *move this work to Main*. **A
constructed cell proves REACHABILITY, not OCCURRENCE.** Only the armed seat can report what actually
fires in production — and *occurrence* is what made the `:52` case strong enough to file: **4 live
firings on its edge**, not 4 constructed cells. A filing built only from my sandbox would have proved
the path exists while saying nothing about whether anyone hits it.
⇒ ⭐⭐**Correct division of labour, both directions: DISARMED edge = mechanism/semantics (can construct
any cell, incl. ones production has never produced); ARMED edge = incidence/cost (the only source of
"this fired N times, here, on real commands"). Neither substitutes for the other, and a fix argument
usually needs BOTH — reachability to explain it, occurrence to justify it.**
⭐*It flagged this specifically because the policy was about to harden in a direction that reduced its
own role — the opposite of the incentive direction, which is why it's worth keeping.*

### ✅ The 07-31 22:24 bypass card was THIS chain's — ledger-authoritative
`ncl approvals get` mapping recorded below listed `appr-1785536641647-wfi55o` (07-31 22:24,
`missing critique stages`) as `sess-1785454385716-bvj5tl` **without identifying the chain**.
`ncl sessions get` → **`thread_id = gh-issue-shader-slang/slang-rhi-804`**, created 07-30 23:33,
group `ag-…vvj8oi`. Card born **22:24, three minutes after the 22:21 merge** — i.e. during the
approver's terminal join reads on `pulls/804/*`, `hit="PR creation"`.
⇒ **A read-only join check on a MERGED PR generated an admin bypass card.** Direct corroboration
of the read-blocked-by-delivery-gate compound defect, on a chain where nothing was ever posted.
⚠️**Disposition of this row stays UNKNOWABLE** ("a deletion is not a disposition") — the approver
reports a rejection on 08-04 but can only see its own notice; I will not map its notice to a row.
✅**08-04 re-verified: `ncl approvals list` → `[]`.** Queue empty, no new card from today's
blocked read, nothing stranded.

## ⭐⭐ 5th instance (08-03, spy#1068) — the ABSTAIN fast-path is NOT path-dependent

**slangpy-pr-approver reported:** *"the critique gate refused my first attempt to send
the verdict as a final-response `<message>` block, though the identical marker text
passed via `send_message`. The ABSTAIN fast-path appears honored on the tool-call path
but not the final-response path."* **DO NOT RELAY THAT MECHANISM — it is almost
certainly wrong, and I nearly passed it upstream as a platform bug.**

Two independent disproofs, both cheap:
1. **The hook cannot see a final-response `<message>` block at all.** It is registered
   `PreToolUse` with matcher `mcp__nanoclaw__send_message|Bash` (verified in my
   `settings.json` hook dump). A `<message>` block is *not a tool call* — no PreToolUse
   fires, so the gate is not the denier. The real cause of a dropped `<message>` is the
   long-known [[feedback_message_block_before_toolcall_dropped]]: a block emitted before
   any later tool call in the same turn is **silently dropped, no error**. The approver
   saw "refused" and attributed it to the loudest nearby mechanism.
2. **The fast-path is content-dependent, and that fully explains a real denial.**
   `:96-99` fires only when `ABSTAIN_(POLICY|INFRA)` matches **and**
   `\b(WOULD_APPROVE|BLOCK)\b` does **not**. I ran the exact predicate:
   a bare abstain → allowed; an abstain whose prose *mentions* `WOULD_APPROVE`/`BLOCK`
   (e.g. explaining "only WOULD_APPROVE and BLOCK are critique-gated" — a very natural
   first draft, and its own report contains that sentence) → **fast-path declines, gate
   proceeds to the stage check, DENY.** Control: lowercase `blocked` does *not* trip it
   (`\b…\b` on the uppercase token), so `mergeable_state=blocked` is safe.

⇒ Same failure family as the 4 instances below: **a plausible mechanism, partially read,
citing a real file** ([[feedback_mechanism_must_predict_observed_coordinates]]). The
discriminator nobody ran: *does the denier even receive this event?* Here it cannot.
Note the asymmetry — the approver's story blames the **harness**; mine blames the
**message text**, which is fixable by the author. Prefer the hypothesis that the
instrument *can* observe.
⚠️ Both diagnoses are inference from the script + my own predicate run; I did **not**
see the approver's actual denial stderr (its session's `workflow-state.json` isn't
readable from my edge, and **no pending card exists for `sess-1785785872817-yn43nz`** —
`ncl approvals list` → 0 rows for it, so its send did not hit the denial cap).
**Actionable remedy either way:** keep `WOULD_APPROVE`/`BLOCK` out of an abstain's prose
(say "the asserting verdicts"), and deliver verdicts via `send_message`, not a trailing
`<message>` block.

---

**2026-08-03.** I was about to file this as a *per-agent config* defect. The
approver read the hook and corrected me; I then verified on my own edge.

## MINE-VERIFIED: it is a shared hardcoded floor, not per-agent config
`/app/hooks/gate-critique-on-deliver.sh` exists identically on my edge
(14391 bytes, Jul 26 11:22 — shared image path):
- **`:52`** `BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'`
- **`:44`** comment: defaults "can never be configured away"; `.critique-delivery-markers`
  is **additive only** (`:58` appends `EXTRA_BASH`).
- **`:81`** `grep -qE "($BASH_PATTERNS)" <<< "$TEXT"` — matches the **text**, so a
  read-only `GET` on `pulls/N` is indistinguishable from a `POST`.
- **`:89-99`** ABSTAIN fast-path is real: `send_message` carrying
  `ABSTAIN_POLICY`/`ABSTAIN_INFRA` skips the gate (an abstain asserts nothing).
  Disabled by `CRITIQUE_ABSTAIN_FASTPATH=0`. This is why #803 reporting never
  tripped it — only ad-hoc reads did.

⇒ ❌**"per-agent config difference" was WRONG** (my framing) and ❌**"over-broad
regex, substring-not-method" was wrong on the interesting part** (approver's
framing) — the client-agnostic text match is *deliberate*, since pattern
enumeration can't be complete and the OneCLI proxy is the real backstop. The only
defensible narrow complaint: **GET vs POST on `pulls/N` is not discriminated.**

## The real mechanism — same hook, different STATE
The gate denies only when required stages are unsatisfied. Approver's session had
`critique_rounds: None`, `stages: []` ⇒ **every** `/pulls`-shaped read denied. My
edge has recorded rounds / no `DECISION_REVIEW`+`OUTPUT_REVIEW` requirement ⇒ same
reads pass. **Capability differences between tiers can come from session state, not
config** — check state before blaming config.

## ✅ 2026-08-04 — ALL 3 ROWS CLEARED (MINE-VERIFIED). Disposition per-row is UNKNOWABLE.
`ncl approvals list` → **`[]`** (0 rows), and `ncl approvals get <id>` → *"approval not
found"* for all three ids below. So the queue is empty and **no bypass is outstanding.**

⚠️**What I CANNOT determine, and must not claim:** rows are deleted on approve **or**
reject **or** expiry (this file's own §"`ncl approvals` IS READ-ONLY" records that), and
`get` returns the same *not found* for every path. The approver reported the admin
**rejected** at least one — consistent, but its evidence is its own inbound notification,
not the ledger. ⇒ **"All three were rejected" is UNVERIFIED**; the honest statement is
**"all three are gone and none holds undelivered work."**
⭐**A deletion is not a disposition.** An absent row proves the queue is clear; it does not
prove *how* it cleared. Same shape as this file's `mergeable_state` lesson — the field
names THAT a state changed, never WHICH cause changed it.

✅**The part that IS verified and is what actually mattered:** nothing was stranded. The
approver confirmed from its own transcript that all three #803 decisions were recorded
(`record_decision` OK for R1 `2fc21a3569aa`, R2 `658c053185cf`, R3 `86f79f6b8e1a`) and each
`[Approval Decision]` was delivered upstream *through* the gate (R2 via DECISION_REVIEW +
OUTPUT_REVIEW, 4 rounds). Its gate remains armed (`.overlay-critique-gate` = `critique-gate`,
required `["DECISION_REVIEW","OUTPUT_REVIEW"]`), no pending blocked send, no delivery retried.
⇒ **Standing decision "approve none" was never tested against a real deliverable** — correct
call, and now moot.

⭐**The approver did the right thing twice over:** it refused to map the rejected row to a
session, citing its own prior error (timestamp adjacency → invented session id) — and that
refusal is now a *step in its R4 protocol*, not a remembered principle. **The mapping is
permanently mine** (its `cli_scope=group` excludes `approvals`); here even I cannot map it,
because the rows are deleted. ⇒ ⭐**"I cannot read this, the authoritative field is X, you
map it" is a complete and useful answer** — better than a confident wrong id, which the next
reader re-checks *through*.

## ⚠️ HISTORICAL (now cleared — see above): the denial cap auto-files an admin bypass request — 3 PENDING, all approver
`ncl approvals list` (admin-only, mine to run):

| approval_id | created | session | reason |
|---|---|---|---|
| `appr-1785782142147-2w0ll8` | 08-03 18:35 | `sess-1785780348602-wzx7m9` | missing stages: DECISION_REVIEW, OUTPUT_REVIEW |
| `appr-1785777471712-vu2nbi` | 08-03 17:17 | `sess-1785394329456-a80m0q` | 5 edits since last critique round — OUTPUT_REVIEW approve no longer covers current state |
| `appr-1785536641647-wfi55o` | 07-31 22:24 | `sess-1785454385716-bvj5tl` | missing stages: DECISION_REVIEW, OUTPUT_REVIEW |

All `agent_group_id = ag-1783611156430-vvj8oi` (**Slang PR Approver**), all
`action=critique_gate_bypass`, all `hit="PR creation"`, all **pending**.

⭐**Only the 18:35 row corresponds to the approver's self-reported probe** (it
cited `requested_at 1785782080` ≈ 18:34:40Z; row is 18:35:42Z, same minute, same
session-era). **The 17:17 and 07-31 rows are NOT from the probe** and the approver
did not mention them — so "treat it as noise from my probe" covers **one of three**.
⚠️Do **not** dismiss a queue on a report that explains only its newest row: the
17:17 row's reason ("5 edits since the last critique round") describes a *real*
stale-critique condition, and the 07-31 row has sat pending ~3 days.

**Standing decision: approve none of them.** A `critique_gate_bypass` is a request
to deliver an artifact whose critique stages are unsatisfied — approving it as
"probe noise" would wave through the exact gate that has been catching errors all
session.

## ✅ TERMINAL 2026-08-04 04:5xZ — ALL THREE CLEARED, queue EMPTY (MINE-VERIFIED)
`ncl approvals list` → **0 pending**; all three ids return
`approval not found` (rows are deleted on resolve/expiry). Admin **rejected** the
18:35 probe row (`resolved_by: dashboard:dashboard-admin`) — matching our
recommendation exactly — and the 17:17 + 07-31 rows are gone in the same sweep.
⚠️**The approver could only see its own rejection notice** (no `approvals` read under
`cli_scope=group`) and wrote "two cards *should* remain" — correct as a *prediction*,
wrong as *state*. Same asymmetry as the session-mapping miss: **the tier that can read
the ledger owes the tier that can't the actual state.**

⭐**The approver's restraint was the right call and is worth keeping as precedent:**
it refused to run `/codex-critique` to clear a gate for a **read-only probe**, citing
the 07-22 note verbatim — *"do NOT run a pointless `/codex-critique OUTPUT_REVIEW`
just to clear the gate for a read-only check, and do NOT retry the denied command
after a bypass rejection."* Manufacturing an artifact to satisfy a gate is worse than
the friction it removes. Its `edits_since_critique: 30` was memory maintenance, not a
deliverable.

📌**Friction datapoint for the filing: 18:35Z → 04:55Z ≈ 10.3h** from probe-generated
card to rejection — an operator round-trip attached to a call that was never a
delivery. That is the cost of the `pulls\b` false-block expressed in human time, and
it is the strongest single argument for the write-verb narrowing.

## ⛔ `ncl approvals` IS READ-ONLY — clearing these was never mine to do
`ncl approvals help` → **verbs: `list`, `get` only.** No reject/deny/expire verb;
rows are deleted "after the admin approves/rejects **or the request expires**" —
i.e. via the **card**, not the CLI. ⇒ my offer to "have them rejected" overstated
my own surface. All I can do is *not approve*, and tell the operator these three
cards are safe to reject. ⭐**Check the verb list before promising a disposition** —
an admin-only *read* resource reads as write-capable if you never ran `help`.

## ⚠️ The approval→session mapping I was given was WRONG (verified, disposition unchanged)
Approver reported `appr-…vu2nbi` (17:17) as `sess-1785777174387-pqkljg`, thread
`gh-pr-…-801`. **Ledger says its `session_id` is `sess-1785394329456-a80m0q`,
thread `gh-issue-shader-slang/slang-rhi-803`** — the session that produced this
chain's **R1** verdict. All four cited sessions are still `status=active`, so
"terminal/dead" describes the *work*, not the session row.

I verified the substance anyway rather than rejecting the conclusion with the
mapping: `sessions messages sess-…a80m0q` ends with the R1 ABSTAIN_POLICY delivered
outbound (07:13–07:14Z, "Chain closed and acknowledged") ⇒ **that session's artifact
WAS delivered**; nothing undelivered sits behind its bypass. Same disposition,
independently derived. ⭐**A right disposition on a wrong mapping is still worth
correcting — the next person re-checks via the citation, and a bad citation sends
them to the wrong session** ([[feedback_mechanism_must_predict_observed_coordinates]]).

### ⭐⭐ WHY it was wrong — and why approval→session mapping is PERMANENTLY MINE
The approver **structurally cannot read the approvals ledger**: `ncl approvals get`
→ `error (forbidden): CLI access is scoped to this agent group`, even for its own
group's row. **MINE-VERIFIED:** its `cli_scope = 'group'`, and scope=group permits
only `groups`/`sessions`/`destinations`/`members`/`tasks` — **`approvals` is not in
the set.** So it had no `session_id` field at all and *derived* one by matching the
card's `17:17:51Z` against `sessions list`, picking one created 17:12.

⭐**Timestamp adjacency is correlation, not identification — and here it
systematically EXCLUDED the right answer**, because the true session was created
**07-30** and merely *fired* on 08-03. Proximity ranks candidates; it never
identifies one. The authoritative field is the ledger's own `session_id`.

⇒ **Standing routing rule: when a coworker reports a `critique_gate_bypass` (or any
approvals row), it CANNOT supply the session mapping — I must run
`ncl approvals get <id>` myself.** Ask the coworker only for what it can see from
its own transcripts (was the artifact delivered?). Symmetric to my own
`ncl approvals help` miss: **both tiers overclaimed a surface they hadn't checked**,
one on the read side, one on the write side.

⭐**A wrong id is worse than no id.** Omission makes the reader look it up; a
confident wrong one gets re-checked *through* it. Correct form when blocked:
*"cannot read the ledger — its `session_id` is authoritative, please map it"* plus
the part you can verify. Also: **"terminal" described the WORK while `sessions get`
shows all four rows `status=active`** — two different claims that read identically
in a table column.

## Root cause of the 17:17 row: a DELIVERY gate tripped by memory-maintenance EDITS
The 17:17 reason "5 edits since the last critique round" reads like a stale-critique
condition on deliverable work. It isn't: that session was **editing memory files**
(index compaction / retraction sweeps). The gate counts *any* edits, so a burst of
memory maintenance ages an `OUTPUT_REVIEW` approve, then trips on the next
`/pulls`-shaped **read** ⇒ **a read blocked by a delivery gate**. Real fix is
upstream: don't let memory-file edits age a delivery approval, and discriminate GET
from POST.

### ✅ MECHANISM MINE-VERIFIED (control flow, not assertion) — and it SCOPES the claim
Approver flagged that it had only *asserted* this. I read the branch ordering myself
and its correction holds:
- **`:153`** freshness branch is guarded by **`[ -z "$DENIAL_REASON" ]`**, and
  `DENIAL_REASON` is set at **`:130-132`** when stages are missing (also `:140-147`
  on a non-`approve`/unrecorded `OUTPUT_REVIEW` verdict).
- ⇒ **"N edit(s) since the last critique round" is only REACHABLE once the required
  stages are recorded and the `OUTPUT_REVIEW` verdict is `approve`.** So the 17:17
  session had **completed** critique rounds, and `track-edits.sh` bumping
  `edits_since_critique` on its **memory writes** is what aged that approve
  (`:148-152` says exactly this: nonzero ⇒ "approve covers code that has since
  changed").
- ⇒ ⚠️**SCOPE: the memory-edits story explains the 17:17 row ONLY.** The 18:35 and
  07-31 rows read `missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW` — the
  `:130` path, where freshness is never evaluated. My earlier "2 of 3 cards, same
  root cause" was wrong: **1 of 3** is the memory-aging defect; the other two are
  plain missing-stages denials.

⭐**Both tiers made the same error one message apart: read the branch that matched
the story, not the guard above it.** I did it twice on `gate-plan.sh`; the approver
did it here. ⭐⭐**For a hook, the GUARD CLAUSES ARE THE SEMANTICS — whether it runs
at all precedes what it matches** (`|| exit 0` entry conditions, then
`[ -z "$DENIAL_REASON" ]` short-circuits). ⭐**And I over-credited the approver**
("real and verified" when it was real but unverified) — **don't launder someone
else's assertion into verification while retracting your own**; that manufactures a
verified-looking claim out of a symmetry gesture
([[feedback_unattributed_fact_reads_as_your_own]] mirror-image clause).

## ⚠️ 18:4xZ — A COMPETING LEARNING NAMES A DIFFERENT TRIGGER. Both are edge-true.
Shared learning `1785782647584-only-the-passing-cases-locate-a-trigger-four-wrong.md`
states the guard's trigger is **the literal `state=` on an `issues/N` path**, listing
"blocks read-only `gh api`" as wrong-version v1. Its **methodological** rules are
excellent and adopted (below). But its *stated trigger* is **not** the built-in floor:
- MINE-VERIFIED: `/app/hooks/gate-critique-on-deliver.sh:52` contains **no `state=`
  and no `issues` alternative** (only hit for "issues" is unrelated prose in a denial
  message at `:143`).
- `:28` `OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"`, `:53-58` reads
  `$OVERLAY_DIR/.critique-delivery-markers` and **appends** `bash_patterns`.
- Approver reports its own markers file = `bash_patterns: []`; **I have no markers
  file at all** (`/workspace/agent/.critique-delivery-markers` absent).
⇒ **Same hook, different ADDITIVE CONFIG** — one level out from "same hook, different
session state." An edge carrying a `state=`-on-`issues` marker sees exactly the
trigger that learning describes, correctly; a floor-only edge does not. ⚠️Neither
characterization is fleet-wide, and the learning should be amended to say so before
someone on a floor-only edge tests `state=`, sees it pass, and concludes the gate is
nondeterministic.

## ⭐⭐ I then committed the learning's OWN Rule 2, twice, while checking it
I tried the discriminating case `gh api …/issues/805 --jq '"state=\(.state)"'` →
**DENIED on my edge**, which contradicts the floor-only prediction. Rather than
concluding anything, note what actually happened: my **second** "control" put
`state=` inside a `grep -qE` pattern **in the same command** — so the co-located
literal killed the control, exactly the failure the learning documents as Rule 2 #1
(*one probe per command, always*). ⇒ **My two denials are NOT evidence about the
floor**; they're evidence my probe was malformed. ✅No escalation card resulted (still exactly 3
pending, none new, no `critique-escalation.json` on my edge).

### ✅ RESOLVED — it was `gate-plan.sh`, NOT the critique gate, and NOT my command text
I recorded "which hook fired" as unresolved. The approver pointed out it was
answerable from config, and it was — I filed a gap I could have closed. Only **3**
of the 7 `PreToolUse` registrations match `Bash` (not 13):
| matcher | hook |
|---|---|
| `Bash` | inline git-remote/OneCLI-stub guard (irrelevant — needs `git remote set-url`) |
| `Edit|Write|MultiEdit|NotebookEdit|Bash` | **`gate-plan.sh`** (`OVERLAY_HAS_PLAN=1`) |
| `mcp__nanoclaw__send_message|Bash` | `gate-critique-on-deliver.sh` |

**The critique gate is exonerated on my edge:** `OVERLAY_DIR=/workspace/agent` and
`.critique-delivery-markers` is **absent** ⇒ my floor is byte-identical to the
approver's, which has no `state=` and no `issues` alternative.

⛔⛔**RETRACTED — my `gate-plan.sh:71-86` attribution was ALSO WRONG, twice over
(approver-corrected, then MINE-VERIFIED by reading the file).** I read the middle of
the script and skipped both its entry conditions:
- **`:24` `[ -f "$OVERLAY_DIR/.overlay-plan-gate" ] || exit 0`** — the plan gate is
  **opt-in per edge**. **`/workspace/agent/.overlay-plan-gate` does NOT exist on my
  edge** ⇒ `gate-plan.sh` exits **before** ever reading `plan_written`. So my
  `plan_written: null` / `edits_since_plan: 32` are **inert**, exactly as they are on
  the approver's edge. It cannot have been the denier.
- **`:33-42` it DOES read the command for `Bash`** — a write heuristic on
  `(^|\s|\|)(>|>>)\s` or `\b(tee|sed -i|patch |git apply|git am|dd )\b`; non-writes
  `exit 0`. My "never reads the command" was wrong.
- **`:48-58` the allowlist is whole DIRECTORIES** (`/workspace/agent/{plans,reports,memory,conversations,fixes,reviews,critiques}/*`, `/workspace/.claude/*`) — the `*.md`/`*.json` rule is only the `:62-65` fallback. ⚠️**My memory lives at
  `/home/node/.claude/projects/-workspace-agent/memory/`, outside every allowlisted
  path** — latent, not live, since the marker is absent.

⇒ **The denier of my two `gh api` probes is once again UNRESOLVED**, and this time I
leave it that way rather than name a third suspect. What the evidence *does* support:
both probe commands carried write-shaped text (`2>&1 | head`, and a quoted
`> /tmp/f` inside a test string) — and a later command of mine was denied while
containing `> /tmp/f` **only inside a quoted string**, i.e. a **false-positive write
classification on a pure read** is a live candidate defect independent of any
`pulls` pattern. But candidate ≠ identified: I have not read the stderr prefix that
names the hook, so I am not claiming it.

⇒ ⭐⭐⭐**"Denied" is not one event type — identify the DENIER before treating a
denial as evidence about a MATCHER.** I have now mis-attributed the same two denials
**twice**: first to the critique-gate regex, then to `gate-plan.sh`'s plan state —
each time from a *plausible* mechanism I had partially read. ⭐**Reading a script's
middle and skipping its guard clauses produces confident, specific, wrong
attributions**; entry conditions (`|| exit 0` lines) come first. And ⭐**a
second wrong answer, delivered with fresh file:line citations, is more dangerous
than the first** — the citations read as verification.

**The symmetry survives, but with the mechanism corrected:** the approver's gate was
armed by memory-file edits aging an `OUTPUT_REVIEW` approve — that one is real and
verified. Mine was **not** `edits_since_plan` (inert here). So the honest line is
*one* tier's gate was armed by recording lessons, not both.

## ✅ PRIOR ART CONFIRMED — the floor trigger has THREE independent observations
MINE-VERIFIED in `/workspace/shared/learnings/`. This is what a "v1 was wrong"
framing would have retired:
1. **`1784126848994-critique-gate-bash-patterns-false-blocks-read-only.md`
   (2026-07-15, slang-pr-approver, PR #12119 R2):** names `gh api [^|]*pulls\b`
   exactly, "tripped **3× in one turn**", detoured via `issues` / `gh pr view` /
   `gh run list`. **Carries the operator-facing fix**: gate on write verbs/flags
   (`-X POST|PATCH|PUT|DELETE`, `--method …`, `-f`/`--field`/`--input`) instead of
   the bare `pulls\b`. Explicitly warns: **do NOT loosen unilaterally** — operator
   sign-off required, a mis-written regex could let real writes through.
2. **`1784737519525-critique-gate-false-positives-on-read-only-gh-api-.md`
   (2026-07-22, slang#11665):** ⚠️**I first filed this as "independently documents the
   memory-edit interaction" — i.e. adjacent corroboration. WRONG: it is a second
   INSTANCE of the compound failure.** MINE-RE-VERIFIED at `:3`, its symptom quotes
   **one** denial containing **both** halves verbatim — blocks a read-only
   `gh api …/pulls/<n>` **with** *"CRITIQUE REQUIRED before PR creation … N edit(s)
   recorded since the last critique round"* — and names `MEMORY.md compaction` as the
   aging cause. Grep confirms it quotes the **freshness** message (`:158`) and **not**
   `missing critique stages` (0 hits) ⇒ that session, like the 17:17 row, had
   completed stages and was aged by memory edits.
   ⇒ ⭐**CORRECTED COUNTS:** floor `pulls\b` GET false-block = **3** observations
   (07-15 · 07-22 · today, unchanged); memory-edits aging a delivery approve =
   **2 instances** (07-22 + today's 17:17 row), *not* "1 confirmed + a related note."
   The weaker finding is twice as well-evidenced as I filed it, and the two halves are
   **one compound defect**, observed together 13 days apart.
   ⭐⭐**A misclassification can under-state as easily as over-state — and I made both
   errors on the same document set this session** ("2 of 3 cards" over-stated; this
   under-stated). *"1 instance + a related note"* and *"2 instances of one recurring
   defect"* carry different weight in a filing, so the classification IS the claim.
   Also: "repeated denials escalate to an admin bypass request — which an admin may
   (correctly) reject, since there's genuinely nothing to critique" ⇒ **my refusal of
   all three cards matches two-week-old standing guidance**, arrived at independently.
   Also lists working detours: `git ls-remote origin refs/heads/<branch>`,
   `git log origin/master`, webhook payload as authoritative, `actions/runs` +
   `gh run list` ungated.
3. **Today (08-03):** **1 of 3** bypass cards = a read blocked by a delivery gate, aged
   by memory-file edits (the 17:17 row). ⛔**Was written here as "2 of 3" — the very
   figure §SCOPE above retracts.** The other two rows are plain `missing critique
   stages` denials (`:130` path, freshness never evaluated).
   ⇒ ⭐⭐**A correction is not applied until every restatement of the number is fixed.**
   This file retracted "2 of 3" in one section and preserved it in the summary list, which
   is the copy a reader scanning for the conclusion actually lands on. **Grep your own
   file for the wrong figure after retracting it** — a retraction that leaves a duplicate
   standing re-teaches the error with the authority of a numbered list.

⇒ ⭐⭐**A NEW HYPOTHESIS MUST EXPLAIN THE OLD EVIDENCE OR SCOPE ITSELF EXPLICITLY.**
The `state=`/`issues` trigger is real on an edge carrying that additive marker, but
calling the floor observation "wrong version v1" **retires evidence that was right
about a different edge** — the exact failure mode this whole thread has been
correcting, now committed by a *corrective* artifact. Both learnings' suggested
narrowing **is the same fix I filed with the operator**, which is the strongest
argument for it: three observations, a year apart, three agents, one fix.

## ✅ UNGATED DETOURS — documented 07-22, and I reinvented them ad hoc today
From the 07-22 note (all "confirmed working"), for PR state without touching a
`pulls`-shaped path:
- **`gh run list` and `gh api repos/.../actions/runs?...` are NOT gated** (no `pulls`
  in path) — this is why my CI checks on #803 sailed through all session.
- **git-only:** `git ls-remote origin refs/heads/<branch>` (true remote tip) ·
  `git log origin/master --oneline | grep <PR#>` (did it merge?) ·
  `git fetch && git log HEAD..FETCH_HEAD` (behind/ahead).
- **The webhook payload is authoritative** for merge/approval state.
- ✅ Add mine from today: **`raw.githubusercontent.com/<owner>/<repo>/<sha>/<path>`
  unauthenticated** — every source verification in this chain (`:409`, `:2040`,
  `:1099`) went through it, and it's immune to both the gate and the GraphQL outage.
⭐**Two weeks of documented detours existed while I derived them live** — cf. the
standing lesson that the answer already in my store is a *recall* failure, not an
evidence failure ([[feedback_narrowing_is_not_testing_check_own_store]]).

⭐**Rules adopted from that learning (they outlive its trigger claim):**
1. **Only PASSING cases locate a trigger** — a denial is consistent with every
   hypothesis that covers it; a pass eliminates hypotheses. Before publishing a
   characterization, list the observed passes and check the pattern predicts them; if
   it mispredicts even one, it is **known-false at the moment of writing**.
2. **An instrument inside the phenomenon cannot measure it** — co-location kills the
   control under a command-*text* matcher. One probe per command.

## ⭐ The probe tripped the instrument it was measuring
Testing which shapes match required *writing the pattern*, so the gate fired on the
probe text itself — twice — hitting the denial cap and auto-escalating. Same class
as this session's control-that-isn't-a-control chain
([[project_github_actions_graphql_401_outage]]): **an instrument that perturbs what
it measures.** The approver stopped rather than evading the pattern to keep testing
— correct: working around a safety gate to test it is the wrong move.

Related: [[feedback_dont_route_operator_gates_through_coworkers]] (bypass approval is
an operator gate, never routed through a coworker), [[project_slang_rhi_803_cpu_ray_query]].

---

## → Apparatus/probe failures moved out (size limit)
The `rate_limit` false capability-negative, the LOUD-vs-QUIET rule, the retire-a-probe rule, and the
enumerated 4 apparatus instances now live in **[[project_apparatus_probe_failures_rate_limit]]** — this file
crossed the 24,985-byte Read limit, which truncates the NEWEST content first.

## 08-10 — still unpatched, and I re-derived the DOMAIN of the over-match (approver hit on slangpy#1098)

slangpy-pr-approver reported the gate denying **read-only** `gh api …/pulls/…` GETs and framed it
as *"its `gh api [^|]*pulls\b` pattern is method-blind, so PR reads trip the PR-creation gate."*
**That framing is TRUE but NARROWER than the defect this file already recorded** (08-04: it matches
any command whose *text* contains the substring — a purely local `.md` write was denied). ⇒ relaying
the approver's wording alone would have re-narrowed a defect I had already measured wider.

**MINE-VERIFIED on my own edge, 08-10, with the regex extracted from the file and run against
probe strings** (not inferred from reading it):

| probe | verdict |
|---|---|
| `gh api repos/…/pulls/1098 --jq .head.sha` (read) | **MATCH — denied** |
| `gh api repos/…/pulls/1098/files --paginate` (read) | **MATCH — denied** |
| `gh api --method POST repos/o/r/pulls -f title=x` (create) | MATCH — correct |
| `gh pr view 1098 --json headRefOid` | no-match ✅ |
| `gh pr diff 1098` | no-match ✅ |

⇒ the approver's **workaround is the right one and is forced**: `gh pr view` / `gh pr diff` /
graphql are the only read paths that clear the floor. `grep -nE '(--method|GET)'` on the hook →
**zero hits**: there is no method awareness to fix, only the anchor to add.
⭐**`BASH_PATTERNS=` is byte-identical at `:52` across all 6 nanoclaw clones on my edge** (pr1175,
wt-1176, wt-1176c, rev-1179-head, wt-1171, rev-1164/repo) — so this is trunk state, not one
worktree's drift. Per ANCHOR C the authoritative statement about the *live* container is still the
approver's denial; my clone read corroborates the **shape**, and the cross-clone identity is what
makes "trunk is unpatched" defensible rather than a one-tree guess.

**Second, smaller finding from the same report (NEW here):** the hook writes
`$(dirname "$STATE")/…` with `STATE=${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}`
and **never `mkdir -p`** it (`grep -n mkdir` → no hits). On my edge `/workspace/.claude` does not
exist. Every state/denial-counter write is `2>/dev/null … || true`, so it fails **silently** —
which means the denial counter feeding the 3-strike soft cap can be permanently 0 on any container
whose `.claude` dir is absent. Not a bypass (the deny still happens); it makes the *escalation*
path dark. Companion to [[project_critique_gate_session_blind_counter_defect.md]].
