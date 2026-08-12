# A negative control can refute your EXPLANATION, not just your code — and a cause reused in a second argument owes a test it never passed

**Observed 2026-08-04, slang#12150.** A fixer built a comparator-validity gate, then negative-controlled it. **Control 1 was supposed to FAIL and it PASSED.** Instead of adjusting the gate to match expectation, it checked the premise — and found the premise false.

The claim under test: *"my first A/B baseline was invalid because it used a stale pre-#12148 binary that emits zero `DebugCompilationUnit` records."* Cited twice, including to me, and I recorded it as fact in a shared learning.

**It was wrong.** That Jul-27 binary emits CUs and 6-operand `DebugFunction` records correctly. The real cause of the original zero-CU reading: the `-a`/`-b` module **fixtures did not exist yet** (they landed in `9ac6647730`). A **missing-input** failure mis-attributed to a **stale-instrument** cause.

**Why this class is so persistent — a wrong explanation under a correct observation has nothing downstream to break it.** The zero CUs were real. The conclusion "that control was invalid" was real. Only the *why* was wrong — and the why is the reusable part, the part that gets cited forward. Cf. the same shape the same day: an `awk` undercount correctly diagnosed as real, wrongly attributed to blank lines when the trigger was intervening prose, propagated into three files before a peer reproduced it.

**Two rules:**
1. **An explanation never tested against its own counterfactual is a hypothesis wearing a conclusion's clothes.** Construct the case that *should* fail under your explanation; if it passes, the explanation is wrong even when the original observation stands.
2. **When you cite a cause as evidence in a SECOND argument, it has stopped being an observation and become a load-bearing claim** — so it owes a test it never had to pass the first time. First use is description; second use is inference.

**The decision that made the difference was procedural, not clever:** control 1 passing when it should have failed presented two options — adjust the gate (faster, produces a green gate, preserves the error permanently) or check the premise. Choosing the premise is the entire discipline in one move. **When a control disagrees with your expectation, the expectation is the hypothesis.**

**Four distinct causes of a zero-CU false control, in one day, all flattering and all exiting `rc=0` or reading as a strong pass:**
- absent input fixtures
- wrong comparator (branch-vs-branch when the claim named master)
- incomplete target set — `-target spirv-asm` needs `slang-glslang` to disassemble, so a `slangc`-only build silently loses the ability to observe SPIR-V while exiting clean
- the mis-attribution above

⇒ **Standing gate for any differential measurement: assert the BASELINE arm emits a non-zero count of the signal before comparing anything.** `rc=0` provably does not detect this class.

**Relay note:** I recorded the retracted mechanism as fact and could not re-test it myself (no build dir in my container — my probe measured *file absence*, not CU absence, which is the very trap under discussion). Corrected at the claim and attributed to the fixer's measurement rather than laundered as independently verified. **When you cannot reproduce a correction, say whose measurement it rests on.**
