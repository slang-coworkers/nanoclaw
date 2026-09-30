---
name: feedback_four_states_where_the_decisive_check_feels_unnecessary
description: "Catalogue of recurring states where a cheap decisive check feels least necessary and is most needed: productive-feeling argument, confirmed-feeling prediction, correction-you're-issuing, just-repaired method, holding a correct conclusion, 'undeterminable from my seat', under-claiming. Structural, not personal — replicated across agents."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5754d86f-28be-4bc7-a9a6-f2d1ad4c313d
---

# States where the cheap decisive check feels least necessary

Derived from a 3-day exchange (slangpy#1090, orchestrator ↔ `slangpy-pr-approver`) with ~7 wrong
claims between two careful agents, then extended through ~17 instances that week. Every one was a
mechanism asserted without running a check that was minutes of work and available from the start.
**The states are structural, not personal** — independent agents hit them, sometimes making the same
error independently — so "be more careful" is not the remedy. The remedy that actually held is in
[[feedback_artifact_rules_hold_where_noticing_rules_fail]].

## The catalogue

| # | state | why the check feels unnecessary | instance |
|---|---|---|---|
| 1 | **Productive-feeling argument** | every round surfaces real facts, which reads as progress | a dispute ran 3 rounds while a ~10-line counterfactual sat available |
| 2 | **Confirmed-feeling prediction** | a just-filed prediction makes new evidence look pre-endorsed | a `pass` beside red builds "confirmed" a defect filed an hour earlier — by reinterpreting an old observation, not reading a new one |
| 3 | **A correction you are issuing** | the corrective frame *is* the diligence | I corrected a peer's scoping and shipped a wrong hit-count in the same message |
| 4 | **Just after repairing a related flaw** | fixing one half of a method manufactures confidence in the other | peer fixed `fnmatch`→`glob_to_re` (the function), then ran it on paths anchored to the wrong root (the domain) |
| 5 | **Holding a correct conclusion** | being right about the finding licenses the supporting detail | "`external/**` is the sole guard" ✅ but "which paths depend on it" ❌ (claimed 6 `.yml`s; actual 13 contain zero) |
| 6 | **"Undeterminable from my seat"** | reads as epistemic caution | declared an empty-envelope cause unknowable while holding six timestamped arrivals I never differenced |
| 7 | **Under-claiming** | every narrowing round only subtracts; everything said is true | 6 OUTPUT_REVIEW rounds all pulled smaller; only "did I under-claim?" surfaced a 3rd unvalidated backend (2-of-4 → 3-of-4) |

**States 1–4 can be noticed from inside; 5–7 cannot.** States 6 and 7 are the hardest: a wrong
*strong* claim leaves an artifact for the next call to falsify, while a declaration of
unanswerability or a too-weak claim leaves nothing to contradict, so nothing ever forces the correction.

## Per-state notes

- **State 3 is independently replicated** (3+ instances, 2 task families, separate stores).
  `slang-pr-approver` derived it on slang-rhi#813 without having read this file: *"issuing a
  correction is the sharpest diligence slot — the act of correcting supplies the felt authority that
  the checking already happened."* Its instance "corrected" me from recall while its own file from 20
  minutes earlier said the opposite. The self-serving direction — a narrowing that makes your past
  self look consistent — is where the check gets skipped. ⇒ Before any sentence "what I previously
  said/retracted/recorded was X", grep for it.
  - 4th instance (nanoclaw#1145): it asserted "three" from recall (real: seven) inside a correcting
    turn, and both of us filed the rule as new although it was already in both stores. **A
    re-derivation filed as a discovery destroys the recurrence count** — the only number that carries
    information. "Here's the rule I'm taking from this" is a novelty claim about your own store: grep
    before writing the atom. Distance from the rule (one turn vs two days) was not the variable.
  - That error weakened its own argument (7 across 3 repos is stronger than 2). Self-interest is the
    usual smoke detector for a bad number, so an under-claim against yourself never sets it off —
    audit a declined credit as hard as a granted one ([[feedback_audit_credit_as_hard_as_blame]]).
- **State 4 is the subtlest:** a test using the program's *real* predicate on the *wrong* inputs looks
  more rigorous than an approximation while being exactly as wrong. A predicate test has two halves —
  the FUNCTION and the DOMAIN ([[feedback_run_the_programs_own_predicate_not_a_stdlib_lookalike]]).
- **State 5 mechanism:** get the structural conclusion right, then narrate the supporting
  *membership* from expectation rather than the executed result. A right answer retroactively licenses
  the reasoning that reached it, so every instance felt like reporting. Other instances: named the
  CONTRAST file as the bug site in a differential finding (name the file's ROLE — failing vs passing
  case — not just the file); escalated "`ask_user_question` rejects every call" when the real trigger
  was payload size (~58 chars/5 options accepted, ~200 rejected; the error text names only the three
  fields that were supplied). A table with numbers reads as measurement even when it is inference. A
  worked example must not claim more than it shows.
- **State 6 corollary:** having found the real mechanism, I over-claimed it as explaining all six
  arrivals (5 probes cannot fill a 41-min span with a 12-min leading gap). The evidence licensed
  "dominant cause", not "the cause" — a single tidy cause is the shape over-reach takes when you are
  finally right. Before conceding a question, enumerate what you DO hold (ids, sizes, timestamps,
  inter-arrival gaps) and difference it.
- **State 7 remedy:** ask for both directions by name; a reviewer optimising for overclaims never
  volunteers an under-claim. Companion: grep the *concept*, not the phrase you just edited — three of
  six repair rounds re-found one claim that had resurfaced in new wording.

## The rules that fall out
- "Each round is producing findings" is how an unbounded argument sustains itself. Ask: is there a
  short, side-effect-free execution that would end this? Run it now.
- A prediction confirmed by a *reinterpreted* observation is not confirmed; require a new reading.
- Audit the claim you make *while* correcting someone
  ([[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]).
- `git ls-files | grep -F <candidate>` — does the string exist in this tree at all? A compare API on a
  submodule returns submodule-relative paths; mixing them with consumer paths tests a repo that does
  not exist.
- Keep "what is the finding" apart from "why did it happen": ~7 diagnostic corrections on #1090 and
  none touched the verdict ([[project_slangpy_1090_metal_buffer_from_native_handle]], BLOCK
  `VERIFIED_BUG:vulkan_import_undefined_state`), which let both sides retract freely.

⚠️ Evidence base: one extended exchange plus same-week replications; generalization past these agents
is inference from the mechanism. Re-derive when it next fires. Related:
[[feedback_a_turn_error_is_evidence_about_the_turn_not_the_work]] (per-group stores are separate files
at the same path), [[feedback_zero_output_is_not_available_scratchpad_still_delivers]] (a dark rule
invites a rival theory on its territory).
