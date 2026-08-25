---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786989400334-cxstzf
written_at: 2026-08-24T18:40:30.824Z
---

# [approver/confirmed] R1 OPEN_GAP (untested reachable branch) closed by a falsifiable test on re-gate

**Signal.** shader-slang/slang#12574 (prelink supplies imported interfaces). R1 @18236e238316 = ABSTAIN_POLICY/OPEN_GAP: the cross-module `[COM]`-interface decoration-copy branch was reachable but exercised by NO test, AND the head was unreviewed (production Claude review had *failed* on that head). R2 @8bca04ad5479 after synchronize (×3) = WOULD_APPROVE.

**What changed between the two heads (the diff between my read and the shipped state).** The author (jvepsalainen-nv) added exactly the test R1 asked for: `tests/language-feature/dynamic-dispatch/imported-com-interface{,-lib}.slang` — module A owns `[COM("...AB")] public interface IComService`; the main module imports it and implements `class Impl : IComService`, which forces `tryBorrowInterfaceFromOwningModule`'s COM branch; the test compiles `-target cpp` and CHECKs the reproduced GUID. Crucially the test comment records that the author **verified falsifiability**: deleting the decoration reproduction lowers `Impl` as a plain `RefObject` (loses the COM struct / IUnknown / getInterface / query override), so the test genuinely pins the branch — not a success-path test that stays green on regression. Also added generic + obfuscate-fallback cross-module pairs, and hardened the symbol-search loop with `SLANG_RELEASE_ASSERT(interfaceSymbolCount<=1)`.

**Transferable lesson (sharpens Step-0 recall + the abstain calibration).**
1. An OPEN_GAP abstain on "a reachable new branch has no test" is a *high-value* abstain, not a false one: here it routed a concrete, addressable ask to the author and the author closed it in the exact shape requested. When re-gating a synchronize on a PR you previously abstained on, the first challenger question is "did the interval commits close MY prior gap?" — check for a new test that (a) reaches the branch's trigger and (b) is falsifiable (author documents / you verify that reverting the fix fails it). If both hold, the gap clears.
2. "Production Claude review FAILED on this head" is a transient pipeline state, not a property of the PR — on re-gate it often succeeds (it did here, 0 bugs). Don't carry forward an infra caveat as if it were a code concern.
3. Maintainability-flavored 🟡 gaps ("invariant enforced only by prose", "protective scenario untested") **clear** under conservative-lean when the code comment/your own grep shows the current behavior is safe (belt-and-suspenders guard that falls through to a byte-identical path; an invariant you can confirm holds at exactly the documented sites). They are future-regression coverage, not live defects — advisory, not abstain-worthy.
