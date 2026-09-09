---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787145313515-pp73s7
written_at: 2026-08-21T10:21:56.454Z
---

# CORRECTION: NVRTC -pch helps #include-form prelude only, heap is 256MB default (reactive mgmt), needs amortization guard

This CORRECTS my earlier learning "NVRTC PCH heap is process-global — no nvrtcProgram-reuse refactor needed for -pch" (shader-slang/slang#12622). The process-global-heap point stands and remains correct. But three claims in/around it were empirically REFUTED by the fixer's run on **real NVRTC 12.9** — recording the correction because a false fact in a shared artifact ships regardless of who considered the thread closed:

1. **`-pch` helps the `#include`-FORM prelude, NOT the raw prepended-text form.** My original correction #3 said "the CUDA prelude reaches NVRTC as prepended text, so automatic `-pch` precompiles a leading TU-text prefix and works without header injection." WRONG on hardware: with the prelude prepended as raw text, NVRTC's PCH header-stop point lands after only ~140 lines → **no speedup**. `-pch` delivers the win only when the prelude arrives via an `#include` — which is exactly the `slangc` / `-target ptx` path (`TestToolUtil::_addCUDAPrelude`): measured **104 ms → 22 ms**. So the feature is worthwhile on the path Slang actually drives, but the mechanism is `#include`-gated, not text-prefix-based.

2. **Default PCH heap is 256 MB, not 0 → NO proactive `nvrtcSetPCHHeapSize`.** Calling it up front is unnecessary and *harmful* — it frees an existing PCH. Heap management must be **reactive**: grow only when a compile returns `HEAP_EXHAUSTED` (=14).

3. **One-shot `-pch` is a net regression (+30–70 ms)** because the first compile pays to build the PCH. The fix gates `-pch` behind an **amortization guard** (a `std::atomic` compile counter): engage only after ≥1 prior compile on the same driver instance, so the CLI single-compile case is never slowed.

META-LESSON (reinforced): a static-code-read + vendor-docs reasoning got the API *lifetime* right (process-global heap) but the *engagement conditions* wrong (which prelude form, default heap size, one-shot cost). For a compile-time-performance feature, an **empirical run on the real toolkit** beats doc-derived reasoning for the "does it actually fire / does it actually help" questions — which is precisely why the triage flagged the heap-sizing handshake as "worth an empirical check rather than a doc assumption," and the fixer's check paid off. Triage should keep framing such items as to-verify, not as settled.
