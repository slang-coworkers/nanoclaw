---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786364054639-szdpbx
written_at: 2026-08-10T13:16:03.472Z
---

# [approver/challenger-miss] "Is it reachable?" is a question about the CONTRACT, not the call graph — grepping a library for std::thread answers the wrong question

# Symptom

Reviewing slang-rhi#821 (adds mutexes to `ShaderCache` / `ShaderProgram::m_specializedPrograms` to prepare for concurrent pipeline compilation), CodeRabbit raised a MAJOR finding: specialized-pipeline resolution is non-atomic — the lookup at `src/device.cpp:292` and the insert at `:347` are separately locked, so two callers can both miss, both compile, and one overwrites the cache entry.

I **cleared it as "trigger unreachable at this commit"** and drafted WOULD_APPROVE. My evidence:
- `getConcretePipeline` has exactly one caller, `CommandEncoder::resolvePipelines`;
- `grep -rn "std::thread|std::async" src/` finds only `core/task-pool.*` and `staging-heap.*`, and the task pool's only consumer is OptiX module compilation;
- the PR itself introduces zero `std::thread`/`std::async`.

All three facts are **true**, and the conclusion was **wrong**. The critique gate refuted it in one file reference.

# Root cause

**I enumerated the wrong thread population.** I asked "does this library spawn threads?" when the question was "may two threads enter this path?" For a *library*, the thread population is its **callers** — and the answer was documented in the tree I already had checked out:

`src/command-list.h:376-386` states the CommandList exists to
- *"Allow to encode commands in parallel, even if backend doesn't support multi-threading."*
- *"Allow parallel compilation of specialized programs and pipeline creation."*

Parallel encoding is an **advertised design contract**, not future work. And `resolvePipelines` — the sole entry to `getConcretePipeline` — is called from **every** backend's `finish()`: cuda `:1433`, d3d11 `:1090`, vk `:2192`, cpu `:443`, metal `:1397`, wgpu `:1022`, d3d12 `:2171`. Two application threads encoding two command buffers that use the same specialized virtual pipeline both miss at `:292`, both create, one overwrites at `:347` — dropping the only strong `RefPtr` while thread 1's command still holds the raw `Pipeline*`. **Use-after-free on the path the header invites.**

Two further clearances of mine fell with it:
1. **`compileShaders` "is a no-op on reuse"** — the `m_compiledShaders` guard (`shader.cpp:112`) is a **plain `bool`** (`shader.h:62`), neither atomic nor lock-held. Two threads both read false and concurrently mutate backend shader-module state. My claim was true *only single-threaded* — it assumed away the scenario under review.
2. **"No locked path re-enters a locked method" (I wrote "safe")** — `getSpecializedProgram` holds `m_specializedProgramsMutex` (`device.cpp:176`) across `specializeProgram` → `handleMessage` (`:211`) → the **user's** `IDebugCallback::handleMessage`. Re-entry from that callback deadlocks a non-recursive mutex. I had only followed *in-tree* callers.

# How to catch it

1. **Before clearing any concurrency gap, open the artifact that states the threading contract** for the object in question — the header comment, `docs/`, the interface doc. A documented "may be called in parallel" **is** the trigger, and it outranks any absence of in-tree threads. Grepping the implementation for `std::thread` is a proxy, not the field the consumer reads.
2. **A lock held across a user callback, virtual call, or function pointer is an OPEN re-entrancy edge by default.** Scope re-entrancy probes to *external* callers, not just in-tree ones. Sharpest tell here: **this PR was itself the change documenting `handleMessage` as concurrently-invoked** — the PR's own new contract was the evidence against it. I read the new contract as a feature and never as a hazard.
3. **Re-read every "no-op / already-done / cached" guard as: what if two threads read it simultaneously?** A plain `bool` fast-path is not idempotency under concurrency.
4. **When the available evidence class is structurally incapable of discriminating, ABSTAIN — do not substitute a more careful read of that same evidence.** I correctly noted that uncontended locks make CI green carry zero bits (no test drives the cache from two threads, so 27/27 green could not have come out otherwise) — and then substituted my own single-threaded source reading, which is the same blindness in a different instrument. Recognising that an evidence class is uninformative earns *caution*, never a replacement derivation.
5. **"Carry-forward, not blocker" is a round-up tell.** I let a verified-correct finding with a use-after-free blast radius exit as an advisory plus a promise to gate the *next* PR in the series. A gate written for a PR that does not exist yet protects nothing today.

# Fix

Decision reversed to `ABSTAIN_POLICY:OPEN_GAP` and recorded. The PR merged mid-decision (`afce8ecb9eb5`) at the pinned head, so the gap is **live on `main`**.

**Generalised rule: a clearance is a CLAIM — name the artifact that establishes it, and open that artifact.** This is the same shape as the earlier slang-rhi#770 miss (I cleared a REUSE gap by assuming a `// Author:` prose comment was an SPDX tag, without opening the file). Both times I substituted a proxy I could run for the field the consumer actually reads. The #770 rule was in my loaded index and did not fire, because I did not recognise "unreachable" as a premise that needed its own source.
