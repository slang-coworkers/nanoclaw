---
name: feedback_a_correction_owes_a_different_instrument
description: "When you correct someone on X, re-derive with a DIFFERENT INSTRUMENT, not a better-run version of theirs — my #elif-blind grep 'corrected' the triager's right #if 0/#elif 1 reading into a wrong one (slang#12331). State status AND mechanism so a claim can resist a wrong correction. And distrust 'structurally cannot' in your own output: a wrong premise under a right conclusion (rhi#797 'CPU-signalled fence') is the hardest error to catch."
metadata:
  node_type: memory
  type: feedback
---

# A correction owes a different instrument

Derivation moved out of [[slang-evidence-lessons-derivations]] §1 and §5. Chain context: [[project_12331_spirv_opt_size_preset_Os]].

## The instance — `#if 0` / `#elif 1` (slang#12331, 2026-08-03)

I told the triager its "dead `#else`" reading was inverted. My correction was itself wrong, and the tool I recommended produced my error. Ground truth @ `d9353c090`, `source/slang-glslang/slang-glslang.cpp`, `case SLANG_OPTIMIZATION_LEVEL_DEFAULT`:

```
#if 0    :335   DEAD   —  7 RegisterPass
#elif 1  :344   LIVE   — 14 RegisterPass  ← ships as -O1
#else    :384   DEAD   — 18 active + 15 commented-out
#endif   :447
```

```bash
grep -n '^#if\|^#else\|^#endif'                                          # 335,384,447 ⇒ "#else is live" ✗
grep -nE '^[[:space:]]*#[[:space:]]*(if|ifdef|ifndef|elif|else|endif)'   # 335,344,384,447 ✓
printf 'BEGIN\n#if 0\nA\n#elif 1\nB\n#else\nC\n#endif\nEND\n' | cc -E -P -   # BEGIN B END
```

- The first true arm wins; every other arm is dead. My "21 calls in :336-383" merged two arms across a seam the grep could not see — **a count that spans an invisible boundary looks like corroboration.**
- ⭐⭐ **When you correct someone on X, re-derive with a different instrument**, not a better-run version of theirs. A correction built on the same broken tool reproduces the error with more confidence — mine went into shared learnings with do-not-reintroduce markers pointing the wrong way.
- ⭐ Both readings missed the actual finding, in the live arm's own comment (`:352-356`): the `#else` passes give "smaller SPIR-V" but "can cause serious problem on some drivers". The list was rejected deliberately over driver compatibility. Arguing "which arm?" crowded out "why?" for two tiers.
- ⭐ **State the status AND the mechanism.** The triager's original "the arm is disabled" was right but silent on the reason, so nothing in it could resist my confident wrong correction. Write "dead because `#if 0`/`#elif 1` selects the second arm; rejected there over driver breakage per :352-353". When a claim feels contestable, ask what would make it precise instead of asserting its opposite.

## A wrong premise supporting a right conclusion (#11225, rhi#797)

The hardest error to catch, because the right conclusion prompts no re-check. Distrust "structurally cannot" in my own output, especially when correcting someone.

On rhi#797 I called `m_d3dQueue->Signal` a "CPU-signalled fence". False: it is `ID3D12CommandQueue::Signal` (GPU timeline); a CPU signal would be `fence->Signal`. The nit-class verdict it supported was right, so the false premise got recorded as the strengthened basis. ⇒ **A severity downgrade resting on API timeline semantics requires verifying the receiver and signature of the exact method**, not merely that the call site exists. First instance: [[project_11225_capability_target_incompat_slangpy_break]]. Audit: [[project_approver_endpoint_split_harvest_audit]].
