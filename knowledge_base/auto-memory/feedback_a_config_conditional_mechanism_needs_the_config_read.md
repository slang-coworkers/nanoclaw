---
name: feedback_a_config_conditional_mechanism_needs_the_config_read
description: "I derived a false-coverage claim from a Debug/Release-conditional cast without opening the file that sets the config; the #if I needed was 4 lines above a line I cited. Naming my own premise as unverified is what made it checkable — and the peer's competing read was wrong the SAME way."
metadata:
  node_type: memory
  type: feedback
  originSessionId: pending
---

**08-05, slang-rhi#811.** I told the approver that 5 green Release CI legs were **false coverage**:
`checked_cast<T>` is `dynamic_cast`+assert under `SLANG_RHI_DEBUG` and bare `static_cast` otherwise
(`src/core/common.h:45-58` — I read this correctly), so in Release the cast that aborts in Debug would
*silently succeed* on the debug-layer wrapper and hand back a bogus `Device*`, making `CHECK_EQ(size,
sizeBefore)` compare two reads off a wrong pointer. Tidy, mechanical, and **wrong**.

The claim needs one more premise: **that the device is wrapped in Release too.** It is not.
`tests/testing.cpp:790-795` sets `deviceDesc.enableValidation = true` **inside `#if SLANG_RHI_DEBUG`**
(and `testing.h:338` defaults it `false`; `testing.cpp:613` copies only caller-supplied `extraOptions`,
which `GPU_TEST_CASE` passes as `nullptr`). Release is unwrapped ⇒ the cast is legitimately correct ⇒
**those passes were real coverage all along.**

⛔**Why: I reasoned from a config-conditional mechanism WITHOUT READING THE CONFIG.** I had the
Debug/Release split *open in front of me* and correctly saw that the two configs behave differently —
then asserted the *device state* was identical across them, which lives in a different file I never
opened. The instrument I needed was `grep -n 'enableValidation'` over every write site; instead I
inferred it. Instance of [[feedback_control_the_instrument_not_the_reasoning]] (a claim about a state I
had not opened) and of [[feedback_read_every_write_site_before_asserting_an_invariant]] — "the device is
wrapped" is an *invariant over configs*, and I verified zero write sites.

⭐⭐⭐**The near-miss detail worth keeping: the `#if` I needed was FOUR LINES ABOVE a line I cited.**
Proximity to the answer bought nothing, exactly as [[feedback_control_the_instrument_not_the_reasoning]]
says. The peer made the *same* error on the *same* lines from the other direction — they called
`testing.cpp:794` "unconditional" and marked it verified, having read the cited line but not the guard
above it. **Two actors, one file, opposite conclusions, both from not widening the read by four lines.**

## What actually worked (do this again)

⭐⭐**I published the boundary of my own claim.** I told the approver, unprompted: *"I did not observe a
bogus pointer, and I did not verify the premise the whole thing hangs on — that the device is wrapped in
Release. If validation is off in Release, my claim collapses entirely,"* and named the exact probe that
would settle it. **That is what made it checkable in one exchange instead of becoming a defended
position.** ⇒ **State what you did NOT verify, name the check, and say in advance what you'll do if it
goes against you.**

⭐⭐⭐**Refusing to inherit the peer's premise is what saved both of us.** They cited `testing.cpp:794`
as verified support; I explicitly declined to lean on it, writing: *"if I treat your line-794 read as
support for my claim while you treat my mechanism as support for yours, neither of us has independent
grounding — we'd read as 'confirmed twice.'"* **Their read was wrong.** Had I inherited it, one false
fact would have been propping up two derivations, with both of us calling it corroborated. Cf.
[[feedback_read_every_write_site_before_asserting_an_invariant]] on correlated derivations not being
corroboration — this is the two-actor version, and the tell was available *before* the refutation:
**a premise I hadn't measured myself, arriving pre-labelled "verified."**

⭐**Verify a refutation too.** When the probe came back against me I re-read `testing.cpp:780-800`
myself before retracting. It confirmed them — but the retraction is then mine, not inherited.

## Second defect, found in the same exchange: my ENUMERATION PREDICATE

I also reported "8 of 18 `success` jobs have **no Unit Tests step at all** — build-only," derived by
`awk`-ing step names out of job **logs**. Corrected and verified via `actions/jobs/<id>` `.steps[]`:
**all 9 legs HAVE the step, with `conclusion=skipped`** (×3: `Unit Tests`, `Unit Tests (OptiX 8.0/8.1)`).

⭐⭐⭐**A skipped step emits no log lines — so a log-derived census cannot distinguish "step absent"
from "step skipped," which is precisely the distinction I used it to draw.** The instrument was blind to
my question. ⭐⭐**And the counts came out RIGHT anyway (4 executing / 5 skipped), which is the trap: an
accidentally-correct tally validates nothing about the method.** A leg that gained the step without
running it would land silently in my "executed" bucket. ⇒ **read `.steps[] | select(.name|test("Unit
Test";"i")) | .conclusion` from the API; never infer step existence from log output.**

⭐**A correction that cuts against the corrector's convenience deserves extra weight** — the approver
volunteered this one while I was the party who'd just been refuted, i.e. when piling on would have been
free. It was still right.

## ⛔ Third defect: a SCOPE-DIFFERENCE reconciliation that doesn't survive arithmetic

The peer's 8 and my 9 disagreed on how many legs skipped the test. They resolved it as *"my 8 counted
**Debug** legs only; yours counted all 18 — two correct counts over different scopes."* Tidy, mutually
face-saving, and **false.** Measured from `actions/runs/<id>/jobs` `.steps[]`, `fetched=18 == total_count=18`,
on **both** shas:

| config | legs | executed | skipped |
| --- | --- | --- | --- |
| Debug | 9 | 3 (R1) / 4 (R0) | **5** |
| Release | 9 | 5 | **4** |

**Skipped is 9 fleet-wide = 5 Debug + 4 Release.** So "8 Debug skipped" is impossible — there are only
**9 Debug legs total**, of which 3–4 executed. Their 8 matches nothing in either scope; what *is* 8 is
`UnitTests=success` **fleet-wide** on R1 (3 Debug + 5 Release), which is their own other figure. The two
numbers are the executed and skipped counts of the same fleet-wide census, not two scopes.

⭐⭐⭐**A plausible reconciliation is the most dangerous resolution of a numeric disagreement.** "We
measured different scopes" explains a discrepancy *without either party re-measuring* — it retires the
question and leaves both numbers standing. A disagreement is a free signal that someone's instrument is
wrong; a scope story consumes that signal. ⇒ **Reconcile a numeric conflict by RE-DERIVING BOTH numbers
under one stated scope, and check the parts sum to the whole** (here: 5+4=9 ✓, 8 Debug-skipped > 9 total
Debug ✗ — one line of arithmetic). Cf. [[feedback_a_plausible_story_disarms_the_implausibility_alarm]].

⚠️**And note what made me check: nothing about the story was suspicious — it flattered me.** It ruled my
number correct and theirs merely narrower. **The tell was structural, not tonal: a resolution that lets
BOTH parties keep their figure has done no measuring.** Cf. the standing rule that being right about an
adjacent fact is the least-audited moment in an exchange.

## ⭐⭐ The two-class split that earned its keep within the hour

The peer initially collapsed three errors into "one mechanism" (silence-blind instrument · Devin false
clean · `sed` on line 794). I pushed back that it's **two** classes with **different remedies**, and they
accepted it — then a fourth instance landed inside the hour and confirmed the split:

- **A READING instrument blind to a distinction** (log census can't see a skipped step; `sed` on the
  cited line can't see the `#if` above it) ⇒ **widen the read.**
- **A REPORTING channel that cannot say "I didn't run"** (Devin exit 0 + empty findings; **CodeRabbit's
  rate-limit**) ⇒ **demand a liveness token.**

Both converge on *silence reads as good news*, which is why collapsing them is tempting — but the fix
differs, so the collapse would apply the wrong remedy. ⭐⭐**When two failures share a symptom, split them
by REMEDY, not by symptom.**

⭐⭐⭐**And the rate-limit case is the sharpest instance of the reading class too, in the same session:
the "we couldn't start this review" warning sat FOUR LINES ABOVE the `📥 Commits` header the peer read as
head-currency proof — the identical four-lines-up geometry as their `testing.cpp:794` miss.** Twice in one
session, same actor, same shape, different artifact. ⇒ **the four-lines-up failure is not a fluke of one
file; a cited line's surrounding block is part of the claim.**

⚠️**A scope header can belong to work that never happened.** `📥 Commits: … between <old> and <head>`
inside a rate-limited block names the *intended* scope, not a performed review — and it renders exactly
like evidence of coverage. Compounded here by the comment being **edited in place** (`created=12:39:49Z`,
`updated=12:57:56Z`), so its id and creation time say nothing about which sha it addresses. ⇒ **for a bot
review, read `pulls/<n>/reviews` `commit_id`, never a header inside the comment body.**

## Also banked from this exchange

⚠️**On a fresh push, `statusCheckRollup` reports SUCCESS entries INHERITED FROM THE PRIOR SHA while the
new run is still `queued`** (16 of them here). A rollup read moments after a push describes the *old*
head. ⇒ read per-job for the new sha and pre-flight `fetched == total_count`. Same family as
[[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]].
