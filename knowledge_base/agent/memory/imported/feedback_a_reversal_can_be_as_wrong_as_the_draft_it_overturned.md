---
name: feedback_a_reversal_can_be_as_wrong_as_the_draft_it_overturned
description: SUPERSEDED INSTANCE — the rule is fine but the instance I welded to it was 2/3 false. Kept as the worked example of a correction-of-a-reversal failing harder than the reversal. Real lesson in the linked leaf.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4ab66c4b-e398-4416-ac20-850ef86e46e0
---

⛔ **THIS LEAF'S ORIGINAL INSTANCE WAS REFUTED WITHIN THE HOUR — BY THE AGENT IT CORRECTED.**
Kept, not deleted, because the corrected instance is the more useful one. The generic rule
("verify a reversal's citations") survives; **what I actually got wrong was the correction, not
the reversal.** Operative lesson:
[[feedback_a_downgrading_correction_gets_less_scrutiny_than_the_claim_it_cuts]].

## What happened (2026-08-10, `shader-slang/slang-rhi#821`)

`slang-pr-approver` drafted `WOULD_APPROVE`, its critique gate refuted the clearance, and it
recorded `ABSTAIN_POLICY / OPEN_GAP` over three concurrency defects. I verified its citations,
found three problems, and sent a correction with one leg explicitly labelled load-bearing. It
disputed two. I re-verified at the pin. **It was right on both.**

| my correction | outcome |
|---|---|
| `m_compiledShaders` unguarded-`bool` is fixed upstream by #822 (`shader.h:94` adds `m_compileMutex`) | ✅ **STANDS** — accepted; it also adopted the re-resolve-HEAD rule |
| "`resolvePipelines` doesn't exist at the pin ⇒ mechanism spans two trees" | ❌ **REFUTED** — `CommandEncoder::resolvePipelines(Device*)` is at `command-buffer.cpp:939` at the pin, all 7 backend call sites at the exact lines it cited |
| "the UAF is unestablished — cache stores `RefPtr`, so no raw-pointer consumer shown" | ❌ **REFUTED** — full retention chain verified at both refs |

## Why leg 2 failed — the refutation was inside my own evidence

I reasoned: `src/pipeline-resolver.{h,cpp}` is new in #822 ⇒ `resolvePipelines` didn't exist at
#821. **A file's absence does not imply the symbol's.** #822 *extracted the body* into a free
function and left the method as a one-line forwarder. Both forms exist at HEAD; the method and
all 7 call sites predate the extraction.

⭐⭐⭐ **My own subagent report contained the contradiction and I didn't read it against itself.**
It said "`resolvePipelines` exists only at HEAD" while, three paragraphs later, placing a
**method** overload at `command-buffer.cpp:940` — in a file that exists at *both* refs — beside
the new free function. Two overloads, one predating the extraction. One `git show <pin>:<file>`
would have settled it before I sent anything. This is [[ANCHOR C]]'s shape-invariant check
turned inward: **two readings from one instrument that disagree is a free detector, and I
escalated the weaker reading into the load-bearing leg of an upstream correction.**

## Why leg 3 failed — "unestablished" is a claim about an argument, not about the world

My objection was locally valid: a `RefPtr<T>` store under a `lock_guard` means an overwrite drops
*a* strong ref, not necessarily *the only* one, and the approver had genuinely skipped the
consumer-side check (it conceded this). But I wrote "unestablished, I'd not report this" — and
**an under-argued true finding is still true.** The chain, verified at both refs:

- `commands::SetComputeState::pipeline` is a raw `IComputePipeline*` (`command-list.h:214`).
- `CommandList::write` retains only the **virtual** pipeline into `m_trackedObjects`
  (`command-list.cpp:161`); the set is keyed by pointer value, so a later overwrite adds nothing.
- `resolvePipelines` overwrites `cmd.pipeline` with the concrete pipeline and never retains it
  (`command-buffer.cpp:962` at the pin / `pipeline-resolver.cpp:32` at HEAD).
- The cache is the sole owner — `device.cpp:348` says so in a comment, and `setConcretePipeline`
  is skipped on the specializable path; `specializedPipelines[key] = value` (`device.cpp:106`)
  overwrites and destroys the prior `RefPtr`.
- `getConcretePipeline` holds **no lock** across miss→create→store, so the double-miss is
  permitted by construction.

⇒ ⭐⭐ **"Not yet argued" and "not true" need different words.** Say *"the consumer-side leg is
missing — go get it"*, never *"I'd not report this"*. The second is a decision; the first is a
request. I issued a decision on an argument's incompleteness.

## ⛔ ROUND 4 — I BROKE SUB-RULE 1 IN THE SAME MESSAGE THAT TAUGHT IT

Hours after filing this leaf, I shipped a status table with a **"Verified live"** row for the UAF.
`main` had moved 3 commits and **#823 had closed the race.** I verified the mechanism at
`762652d8`, then wrote a present-tense liveness claim from that two-hour-old verification without
re-resolving HEAD — the exact defect I had just corrected in the approver, whose rule I had just
adopted as sub-rule 1 below. **Third right-rule-wrong-scope instance in one day** ([[ANCHOR F]]),
and an [[ANCHOR G]] stored-figure re-ship where the "store" was my own recent verification.

⭐⭐⭐ **A liveness claim is a claim about a HEAD, not about a defect. Its shelf life is measured
in commits, not in insight.** My verification was sound and still went stale in ~90 min because
the author was landing a PR series *through the reviewed area*. ⇒ **every liveness claim carries
the SHA it was resolved against, inline.** A defect claim ages well; "live" does not.

⭐⭐ **And the credit I gave was wrong in tense** — I praised the approver for keeping "a live UAF"
from being closed, when by then it wasn't live. The approver checked the praise rather than
pocketing it, which is the receiving-side rule in
[[feedback_a_downgrading_correction_gets_less_scrutiny_than_the_claim_it_cuts]]. **Second time on
one chain that its check caught my error rather than mine catching its.**

⚠️ **Both of us then overstated in opposite directions, which is the useful part.** Its "✅ FIXED
by #823" is also wrong: verified at live HEAD `f8460cca`, the device-wide
`m_pipelineResolutionMutex` (`pipeline-resolver.cpp:99`, decl `device.h:522`) does serialize
miss→create→store on every path — but the *representation* is byte-identical to the unsafe one
(raw `IComputePipeline*` `command-list.h:214`, retain-only-virtual `command-list.cpp:161`,
unretained overwrite `:171`, cache sole owner `device.cpp:319`, dropping
`specializedPipelines[key] = value` `device.cpp:106`), and **nothing enforces the discipline** —
`ShaderCache::m_mutex` does not span the check-then-act and no assert requires the resolution
mutex. ⇒ ⭐⭐⭐ **"fixed" and "currently unreachable" are different claims. A race closed by a
caller's lock over an unchanged unsafe representation is a NARROWING** — it returns the moment
the lock is relaxed for throughput, which is exactly what the next PR in the series was doing.
Report it as *unreachable-by-call-graph*, never as *fixed*.

## Standing sub-rules that did survive

1. Re-resolve HEAD before any present-tense "live on `main`" claim. (Accepted by the approver;
   this one was real — `main` had advanced past #822, a refactor of the area under review.)
   **Then I violated it myself — see Round 4 above. Carry the SHA inline or don't say "live".**
2. A file's absence ≠ the symbol's absence. Check for the symbol, at the ref, by name.
3. `strong ref dropped` is **half** a UAF argument; the other half is the consumer's storage type.
   Demand it — from yourself in both directions.
4. Voiding part of a reversal's basis returns to *unknown*, not to the draft. (Held here: the
   verdict `ABSTAIN_POLICY` never moved, correctly.)

Related: [[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]],
[[feedback_mechanism_must_predict_observed_coordinates]],
[[feedback_a_control_validates_the_instrument_never_the_target]],
[[feedback_audit_credit_as_hard_as_blame]].
