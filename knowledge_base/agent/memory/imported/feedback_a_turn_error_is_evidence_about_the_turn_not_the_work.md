---
name: feedback_a_turn_error_is_evidence_about_the_turn_not_the_work
description: "A 429/turn-level error says nothing about which side of the crash the work finished on — grep the emission row before re-dispatching; and the artifact-existence check must target the artifact THAT TIER produces"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2c2eaaca-ec7e-4a3e-82be-97a328d7d0e0
---

# A turn-level error is evidence about the TURN, never about the WORK

✅⭐⭐⭐ **EVIDENCE BASE UPGRADED — the discriminator has now produced BOTH answers on ONE chain, which
is what a single case could never show** (slang#12367, 2026-08-05). Two turn errors, same tier, same
session, **opposite correct actions, and the error text was useless both times**:

| | 429 @ 14:02 | timeout @ 15:24 |
|---|---|---|
| artifact check | `issues/12367/comments` → **0** ⇒ work absent | comment `5193130734` + 3 labels present ⇒ work intact |
| correct action | **RE-DRIVE** (pinned via `target_session_id` to keep the dispatch context) | **DO NOTHING** — the dead turn was an *echo* of my close-out, not work |

⭐⭐⭐ **This is the case that proves the check DISCRIMINATES rather than rubber-stamping.** A rule
whose verification always returns "fine, proceed" is indistinguishable from no rule at all — the
false-coverage shape. Here the same probe returned *absent* once and *present* once, hours apart, and
the action inverted accordingly. ⇒ **The probe has demonstrated power; the ERROR TEXT has demonstrated
none** (429 and timeout carried identical information: zero).

⭐⭐ **Cheap corroborating signal: WHERE in the exchange the dead turn sat.** Session tail showed the
timeout landed *after* both substantive replies (their seq 27 → my seq 24 → dead seq 29), i.e. on an
acknowledgment. **A turn that dies while echoing has nothing to re-drive.** Use as a secondary read
only — the artifact is still the decider, since "looks like an ack" is a guess about content.

2026-08-05, slang-rhi#813. Dispatched the approver; its turn returned
`API Error: Request rejected (429) · status code (no body)`. I armed a 5-min backoff, then before
re-dispatching ran `GET pulls/813` → `head.sha` / `state` / `merged` / `updated_at`, saw the PR still
open and unmerged, and re-dispatched saying **"nothing was reviewed and no decision was recorded."**

**Wrong.** The approver had recorded `ABSTAIN_POLICY (OPEN_GAP)` at **13:37:37Z, ~25 min BEFORE the
429 at 14:02.** Verified from my own seat, not inherited:
`ncl sessions messages sess-1785934493861-1axszw --include-system` → `seq 7 | out | system |
[system: record_decision]` @ 13:37. The 429 landed mid-*correction* (it was reversing its own earlier
WOULD_APPROVE), not mid-decision.

**Why:** `GET pulls/{n}` answers *"is this the same revision?"* It says nothing about *"did the work
complete?"* I used the revision instrument to answer the completion question — and because I'm the
dispatcher, the conclusion travelled downstream as a directive
([[feedback_debounce_approver_dispatch_deterministic_abstain]]: a dispatcher's guess arrives as an
instruction). A re-run would have burned a full harvest+Devin+challenger cycle to reproduce an
existing row, and worse: the approver's own memory file still said WOULD_APPROVE, so a retry
trusting it would have re-derived toward *approve* on a PR already abstained on.

**How to apply:**
- ⛔**On any turn-level error (429, timeout, crash), grep for the WORK'S EMISSION before
  re-dispatching:** `ncl sessions messages <recipient-session> --include-system | grep record_decision`
  (or the relevant action name). This probe is in the dispatcher's scope — see
  [[feedback_broader_read_access_is_not_higher_authority]] for why that makes it mine to run.
- ⛔**An error is a fact about the transport, not the payload.** It cannot locate itself relative to
  the work — "died before starting" and "died after finishing, mid-followup" produce byte-identical
  error text. Another instance of the store's root pattern: a state that cannot say *"I couldn't
  verify"* ([[feedback_control_the_instrument_not_the_reasoning]]).
- ⭐⭐⭐**The artifact-existence check must target the artifact THAT TIER produces.** My stored recipe
  ([[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]]) was
  `gh api .../comments --jq '.[].user.login'` — "is my output on the PR?" **That is a FALSE ZERO for
  a read-only tier by construction.** The approver never posts to GitHub, so zero bot comments is its
  *correct* steady state; the recipe would read "undelivered" after every failed turn, inverting
  duplicate-suppression into re-run-forever. Reviewer ⇒ GitHub comment. Approver ⇒ ledger emission
  row. **Name the tier's artifact before reaching for the check.**
- ⭐⭐**The stale artifact points the rounded-up way.** A crash between ledger-append and memory-write
  leaves the store asserting the verdict just reversed — because a reversal is *by construction* the
  later write. So a resumed decision must let the ledger/`work/<pr>-<sha>/decision.md` outrank the
  agent's own memory. Corollary of [[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]].
- ✅**What went right:** I verified the approver's rebuttal via my own `ncl` probe instead of
  inheriting its "recorded" claim. Inheriting would have made one unverified fact read as "confirmed
  twice" — cf. [[feedback_a_config_conditional_mechanism_needs_the_config_read]].

## The working probe is one documented flag — and the approver got this wrong in the other direction

⛔**`ncl sessions messages <sid> --include-system | grep record_decision` IS the instrument.** Measured
both variants against the same session: without the flag → **0 hits**; with it → **1 hit**,
`seq 7 | out | system | [system: record_decision]` @ 13:37. `ncl sessions help messages` documents it:
*"System-kind rows are filtered by default; pass `--include-system` to include them."*

The approver hit the same false zero, and diagnosed it as *"that view renders only `kind=chat` rows
and never emits tool calls at all"*, concluding the only working probe is parsing the raw session
`.jsonl`. **That is a false capability-negative** — the shape
[[reference_shared_learnings_correction_is_two_actor]] and the shared learning
*"find/grep enumerate a MOUNT not a CAPABILITY — read `--help` before claiming you cannot reach X"*
already name. Its cost: it points future-readers away from a documented one-flag read available at
both tiers, toward transcript parsing whose census **inflates with the observer's own logged `ncl`
reads**.

⭐⭐⭐**A positive control establishes that an instrument is BROKEN, never HOW.** Their control
correctly flagged the zero as untrustworthy; they then filled the causal gap with an untested
mechanism and generalized from it. Symmetric to my own error — a real finding extended past its
evidence. **When a control invalidates a result, the next step is to vary the instrument (run both
variants), not to theorize about it.** What `--include-system` yields is *emission + timing*, which
is exactly what a crash-resume needs; the payload remains unreadable (synthesized `text`, five keys)
per [[reference_shared_learnings_correction_is_two_actor]].

## ⛔ The probe proves EMISSION, never ACCEPTANCE — I overstated its reach in the same breath

I told the approver `--include-system` gives *"emission and timing, which is exactly what a
crash-resume needs."* First half right, second half too generous. **Measured:**
`--kind system --include-system --full | grep -c` for the sha / verdict / reason-code / policy →
**0 / 0 / 0 / 0**. The string `"Decision recorded: …"` appears **once** in that transcript — inside the
agent's own chat prose, because it quoted the host's return in a message. And the pairing
discriminates: `cli_request` → `cli_response` **pair**, while `record_decision` has **no inbound
partner row**.

⇒ ⭐⭐**THREE TIERS, not two:** (1) **emission** — `--include-system`, cheap, cross-session, both
tiers; (2) **host-confirmed acceptance** — the raw session `.jsonl` `tool_result` block, which is
`role=user` **harness-injected and therefore not authorable by the agent**, so its provenance is
structural; (3) **the committed `approval_decisions` row** — *impossible in-container*, host-owned
([[reference_shared_learnings_correction_is_two_actor]]). Name the tier you're claiming; I asserted
tier 1's reach as if it covered tier 2, and the approver asserted tier 2 while I read it as tier 1.

⛔**And my refutation-of-their-refutation: "two views of one object" ≠ "two objects."** They explained
my contrary read as *two sessions* (my grep hit session B, the emission sat in session A). Measured:
**both rows are in the SAME session** — `seq 7 out system 13:37 [system: record_decision]` and
`seq 25 out chat 14:20` (the row containing my grep hit). The divergence was **two VIEWS of one
session**: `.jsonl` renders `tool_result` blocks, `ncl sessions messages` never does at any flag
(`--kind system --include-system --full | grep -c "Decision recorded"` → **0**; the string survives in
that view only inside authored chat prose). ⇒ ⭐⭐⭐**"Two artifacts, not one error" is the right shape
applied to the wrong AXIS — when two VIEWS of the same object disagree, don't reach for two objects.**
The axis is what a reader acts on.

⚠️**What I could NOT verify, stated as a limit:** their session `.jsonl` is absent from my edge (`ls`
confirms; per-agent-group mount, below). I verified the mechanism's *type* (a `tool_result` is
harness-injected) and the *view* boundary, **not** their 122/122 block counts or 1-occurrence figure —
those are relayed, never confirmed. Refusing to inherit them keeps one unverified fact from reading as
"confirmed twice" ([[feedback_a_config_conditional_mechanism_needs_the_config_read]]).

⭐⭐⭐**I made the mirror of the error I was correcting.** I caught the approver narrowing a probe's
reach on an untested mechanism, then in the same message widened one on an untested mechanism.
**Asserting a probe's REACH needs the same measurement as asserting its LIMIT** — both are claims
about an instrument, and the store's rule only ever fires on the pessimistic direction, so the
optimistic one passes unchallenged (cf. *direction predicts consequence, never correctness*,
[[feedback_control_the_instrument_not_the_reasoning]]).

⭐⭐⭐**The mechanism behind that asymmetry, and the transferable half of this whole exchange: an
untested LIMIT produces a suspicious zero — something to notice; an untested REACH produces NOTHING
TO NOTICE.** A too-narrow claim manufactures a zero-hit result that a positive control trips over
within one turn (the approver's did). A too-wide claim just… works, on every case inside the range you
happened to test, and emits no signal at all. That is why their over-narrowing was caught immediately
while my over-widening sat unchallenged **in both stores** until they measured it. ⇒ **a probe's reach
gets the measurement, not the benefit of the doubt.** Corollary of the store's root pattern: a state
that cannot say *"I couldn't verify"* ([[feedback_control_the_instrument_not_the_reasoning]]) — an
overstated reach is exactly such a state.

## ⛔ `/home/node/.claude` is PER-AGENT-GROUP — closure numbers are not portable

`findmnt -T /home/node/.claude` →
`/dev/vda1[…/data/v2-sessions/<agent-group-id>/.claude-shared]`. My `MEMORY.md` was 112,232 B while
the approver's was 18,446 B — **same path, different files.** So a closure/orphan census describes
only the measurer's store; neither tier can inherit the other's. Third resolution-by-*two-artifacts*
in one exchange, cf. [[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]].

## ⛔⭐⭐⭐ A RULE WITH AN UNVISITED HALF — audited on my own store, 3 of 4 one-directional

The approver found it held *"a passive rule will not fire — write rules with an **ADDRESSEE**"* (outbound:
*name who must act*) and had **never written the mirror** (inbound: *read who was asked*). Same variable,
built in one direction; `grep -in addressee` over its store → one hit, outbound only. It then answered a
go/no-go I had addressed to the operator. ⇒ **not a missing rule, and not an unapplied one, but a rule
with an UNVISITED HALF** — a third failure class, and the one a re-read cannot surface, because the
half you wrote reads complete.

**I predicted my `forward pointer` rule had the same defect and it did.** Audited four
variable-pairs:

| rule (variable) | outbound | inbound | verdict |
|---|---|---|---|
| forward pointer | 1 | 0 | **OUTBOUND-ONLY** — I had *"the tier with write access owes the pointer"*, never *"if you're blocked, ASK for one and name the false clause"* |
| addressee / who-was-asked | 7 | 0 | **OUTBOUND-ONLY** — 7 files say name who acts; none say check you're the one asked |
| hunch relay | 2 | 1 | BOTH (see below) |
| tier owes the field it can read | 3 | 3 | BOTH |

⚠️**The `hunch relay` row started as a fourth OUTBOUND-ONLY and the zero was a MATCHER ARTIFACT.** My
phrase list missed it; a looser probe found the inbound mirror in
[[feedback_debounce_approver_dispatch_deterministic_abstain]] — *"it correctly treated my framing as a
claim, not a fact."* ⇒ **the directional audit is subject to the same false-zero as every other phrase
grep today (4th instance across both stores): re-probe every inbound=0 with a second wording before
recording it.** I nearly published 4-of-4.

⭐⭐⭐**Construction check, not a disposition:** *when writing a rule about a variable — an addressee, a
pointer, a claim's trust level — ask whether the MIRROR DIRECTION also needs stating.* Outbound rules
(what I must emit) come naturally because I am the actor; inbound rules (what I must read before
acting) do not, and their absence is invisible from inside the rule.

## ⛔ FOUR OVER-CLAIM DIRECTIONS — and only ONE self-announces

Complete taxonomy from this chain (the approver's table, adopted). All four are claims about an
instrument or a store; only the first emits a signal you can trip over:

| direction | the claim | how it got caught |
|---|---|---|
| **LIMIT** | "the tool can't do X" | **suspicious zero** → a positive control tripped it within one turn |
| **REACH** | "the tool proves Y" | plausible hits → survived two days *inside a cited atom* |
| **SELF-CONVICTION** | "I was even more wrong than you said" | felt like rigour — **nobody audits a confession** |
| **NOVELTY** | "here's the rule I'm taking from this" | flatters → never checked |

⭐⭐⭐**Three of the four surfaced in one afternoon and all three silent ones fall to the same
`grep` of your own store.** A LIMIT manufactures a zero-hit result that looks wrong; the other three
produce output that looks like verification.

⛔**My NOVELTY instance:** I wrote *"the rule I'm taking from this: the tier with write access owes the
forward pointer"* — that rule had been in `/workspace/shared/learnings/1785753815343` since **08-03**,
both halves, and **I had already executed it once on 08-04 in my own hand.** Right action, false
novelty, asserted from recall inside a corrective message. ⇒ ⭐⭐⭐**"Here's the rule I'm taking from
this" is a load-bearing PAST-TENSE claim about your own store's contents — grep before sending.** It
never triggers the check because *"a rule I derived"* flatters more than *"a rule I wrote down and
didn't apply."*

⭐⭐⭐**A PASSIVE RULE WILL NOT FIRE.** The 08-03 text said *"name the file so someone who can will"* —
satisfiable by a mention into the void, which is exactly what happened, **by its own author.** If
compliance can be satisfied without naming who acts next, it will be. **Name the tier, the artifact,
and the clause: limitation *recorded* vs. limitation *delegated*.** Applied to my store — swept for
`someone should`/`whoever can`, 3 hits, **only 1 a genuine passive rule** (amended in
[[feedback_two_nv_slang_bot_identities_cla_gate]]); the other two name a role or are narration.
⇒ **a phrase grep finds the WORDING, not the DEFECT — read each hit before counting it.**

⚠️**EVIDENCE BASE: ONE incident** (my error, the approver caught it; then their instrument claim,
which I caught; then my reach overstatement, which they caught; then my novelty claim, which I caught
and they traced to their own authorship). The false-zero half is structural and readable — a read-only tier cannot produce a
GitHub artifact, so the check is *provably* non-diagnostic for it — but per this store's single-case
rule, re-derive rather than execute as a recipe. ✅**The both-variants measurement, by contrast, is
directly reproducible: run the two commands.**

Related: [[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]] (the rule this bounds),
[[feedback_debounce_approver_dispatch_deterministic_abstain]] (dispatcher-tier duplicate check),
[[reference_shared_learnings_correction_is_two_actor]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]].
