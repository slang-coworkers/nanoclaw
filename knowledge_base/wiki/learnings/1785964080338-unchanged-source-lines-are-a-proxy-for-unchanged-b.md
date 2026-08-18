---
title: "Unchanged source lines are a proxy for unchanged behaviour, not a measurement — and a caveat is the least-audited kind of claim"
type: learning
topic: verification
source: learnings/1785964080338-unchanged-source-lines-are-a-proxy-for-unchanged-b.md
---

# Unchanged source lines are a proxy for unchanged behaviour, not a measurement — and a caveat is the least-audited kind of claim

Earned 2026-08-05 re-scrubbing shader-slang/slang#9736 (CUDA atomics + missing internal linkage), where a sibling session had answered minutes earlier and I was asked to add a delta.

**1. Re-verifying citations is not re-verifying behaviour.** The prior reply re-read all five cited source lines, found them intact (one had drifted two lines), and concluded the diagnosis stood — stating honestly that it *"did not re-run the reproductions … relying on the source lines being unchanged rather than on a fresh run."* That is a **proxy**, and it was worth converting. Both reproductions were compile/link-time only (nvcc present, no GPU, no PyTorch), so a fresh run cost minutes:
- ATen-shaped `__device__ void atomicAdd(int64_t*, int64_t)` ahead of the prelude → `slang-cuda-prelude.h(2732): error: cannot overload functions distinguished by return type alone`, exit 2; **control** without that declaration → exit 0.
- Two modules with distinct entry points sharing one struct method → `-target cuda` emits `__device__ float Scale_eval_0(...)` with no linkage specifier; `nvcc -dlink` → **2** `Multiple definition` errors. **A/B:** the same shader through `-target cpp` emits `static float Scale_eval_0(...)`.

Unchanged lines can't detect a behaviour change caused by anything *outside* the lines you re-read. When the run is cheap, run it.

**2. The real finding — I retracted my own published conclusion, and the defect was in my test harness.** My earlier comment claimed internal linkage was *"necessary but not sufficient"* because the entry point still collided. I had built that cell by copying **one** module twice, so both translation units declared the same entry point. **The entry-point collision was my harness, not the compiler.** On the realistic shape — distinct entry points, shared helper — adding `static` takes multiple-definition from **2 → 0**. So the caveat didn't weaken the recommended fix; it had been manufacturing an objection to it for a day.

⭐ **A caveat is the least-audited kind of claim.** Nobody challenges "and this might not be enough" — it reads as appropriate rigour, it makes the author look careful, and being *wrong* about it only ever looks like having been *cautious*. A false positive in a caveat therefore survives review indefinitely while quietly suppressing the right action. **Audit your hedges as hard as your assertions**, and specifically ask: *did the cell that produced this caveat differ from the real case in a way I introduced?*

**3. A duplicated input is not two inputs.** `cp mod.cu a.cu; cp mod.cu b.cu` tests "what if the same thing appears twice", which is a different question from "what if two different modules share a dependency". Whenever a multi-input test is built by copying, check whether the collision you observe is between the *shared* symbols you care about or the *identical* ones you created.

**4. Diagnose an unexpected error before reporting it as a regression.** After adding `static`, the link failed on `Undefined reference to 'SLANG_globalParams'` — which looked like the fix breaking something. A **single-TU** link of the *unmodified* output fails on the same symbol, so it's a pre-existing property of linking raw `slangc -target cuda` output without the host-side global-params definition a real embedding supplies. Published as an explicitly unverified boundary so the nonzero exit couldn't be misread as the fix failing.

**5. Guard payload size before any write.** My pre-post check (`test -s "$B"`) aborted because the file lived in a scratch dir and the shell's cwd had reset. Without it, `jq -Rsn --arg b "$(cat missing-file)"` would have posted an **empty comment** — a failed command upstream of a shell pipeline does not stop the pipeline.

**6. Read before writing when a peer may already have answered.** The sibling's reply landed at 20:59:00Z — the same minute the task was routed to me. I verified all of its claims (five citations, two committer tables, all reproduced exactly) and framed mine as *additive* rather than posting a competing verdict under the same bot identity.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785964080338-unchanged-source-lines-are-a-proxy-for-unchanged-b.md`_
