---
title: "A cost mechanism proven on one branch is not a theory of a whole flake bucket (RPC-drop refutation)"
type: learning
topic: ci-tooling
source: learnings/1786156667938-a-cost-mechanism-proven-on-one-branch-is-not-a-the.md
---

# A cost mechanism proven on one branch is not a theory of a whole flake bucket (RPC-drop refutation)

I proposed that Slang CI's `JSON RPC failure: waitForResult()/hasMessage()` bucket was *caused* by slow jobs — "a slow build starves the test-server connection ⇒ RPC drop ⇒ filed as flake" — generalizing from one PR (#12354) where fossil-validation flags genuinely do make each `slangc` child slow enough to cross the per-request RPC deadline. **The specific claim is true; the generalization is false.** Three independent checks killed it:

**1. Measurement.** Across the RPC-flagged rows for **73 PRs that carry none of those flags**, the failing jobs sit at a **median 11.7 min against an 80-min ceiling — 0 of 13 measured jobs came within 80% of it** (fastest: 2.5 min). If slow jobs caused RPC drops, the drops would cluster near ceilings. They cluster at the *fast* end.

**2. Source.** `tools/slang-test/slang-test-main.cpp:1191` calls `rpcConnection->waitForResult(context->connectionTimeOutInMs)` **per request**, inside per-test dispatch, with the deadline passed fresh each call (default 120 s; 10 min on ARM+debug, 5 min on Windows+debug — `tools/slang-test/test-context.cpp:29-33`, overridable via `SLANG_TEST_RPC_TIMEOUT_MS`). The deadline is **per-request, not cumulative**, so total job duration cannot consume it. A 46-min job still gives every request its full 120 s.

**3. Prior art (which is blunter than my source read).** The RPC surface is the parent `slang-test` harness **losing its test-server child process over the stdio pipe (EOF)** — a *child-crash symptom* with **no RPC/network deadline involved at all**. So "slow job exhausts the deadline" doesn't just lack support, it misidentifies the failure. The surface conflates three root causes: (a) genuine harness flake (CPU concurrency, aarch64), (b) GPU device-loss killing the worker, (c) **the PR's own failing test crashing the worker**. The canonical instance (#11951 "Sig-B", `static-const-matrix-array.slang.3 syn (llvm)`) is **closed** — real cause was a use-after-free in LLVM JIT teardown, fixed by **#12114** (merged 2026-07-15); the earlier AVX-512/SIGILL story was incidental masking, not the fix.

**The sharpest part:** my own 13 "supporting" cases turned out to be bucket (c). All three PRs (#12224, #12373, #12415) had their *own new tests* crashing the test-server — #12224's spirv-val abort was deterministic on 4 platforms including CPU-only, and my own ledger row for #12373 had already written "4 'rpc failed' hits do NOT override the multi-platform tell." They fail *fast* precisely because the child dies early. So the flat duration profile isn't merely "no correlation" — it's the signature of a different bucket. I had merged a **closed harness-flake bucket** with **author-owned crashes**, on the strength of a shared error string.

**Transferable rules:**
- A mechanism verified on one branch (where a code variable is named in the diff and controlled) does **not** license a claim about a whole failure bucket. The generalization is a *separate* hypothesis and needs its own control — mine had none.
- Before merging two buckets, require a shared **code path**, not a shared error string or shared vocabulary ("timeout", "RPC"). Read where the deadline is passed and what scope it covers.
- When a bucket's canonical instance has a **closed root cause with a fix commit**, any new theory of that bucket must explain why the fix didn't apply — or, more likely, you're looking at a different bucket wearing the same error message.
- Check whether your evidence rows post-date the fix boundary, and whether they name the *same test*. Mine named entirely different, PR-owned tests.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786156667938-a-cost-mechanism-proven-on-one-branch-is-not-a-the.md`_
