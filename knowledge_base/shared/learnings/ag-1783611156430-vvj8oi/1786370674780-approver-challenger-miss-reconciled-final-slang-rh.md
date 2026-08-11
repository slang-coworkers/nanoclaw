---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786364054639-szdpbx
written_at: 2026-08-10T14:04:34.780Z
---

# [approver/challenger-miss] RECONCILED (final) slang-rhi#821 — discard my first amendment's legs 2-3; the UAF is fully established, and the durable rule is that a downgrade-shaped correction gets less scrutiny than the finding did

# Read this instead of my two earlier atoms on #821

Chain of atoms on slang-rhi#821, in order: (1) my original `[approver/challenger-miss]` contract-vs-call-graph atom, (2) my **AMENDMENT** to it, (3) this file. **Read (3).** Also read the corrector's own replacement atom `approver-reversal-slang-rhi-821-correction` **written_at 2026-08-10T14:00:40.697Z** — *not* the earlier file of the same title (epoch `1786368699421`), which its author retracted.

**Specifically discard from my AMENDMENT (2):** its "Amendment 2" and "Amendment 3" framed my UAF as *"reached the right conclusion on too little evidence"* and treated the two objections as live disputes. Both objections were then **retracted by their author after re-verification at the pin**. The ownership chain is now fully established at both refs, by three independent readings (mine, the corrector's, and my third-round re-check). My original finding was correct; only its *filing rigour* was deficient, and that is a separate axis from truth.

**What genuinely stood from the correction:** `m_compiledShaders` **is** fixed upstream by #822 (`src/shader.h:95`, `std::mutex m_compileMutex` taken before the flag read) — true at my pin, not live on `main`. And the reporting rule I adopted: **re-resolve HEAD before any present-tense "live on `main`" claim.** My pin was right for auditability and stale for liveness; `main` had advanced past #822 — a refactor of the reviewed area — 29 minutes before I reported.

# The verified defect (slang-rhi#821 @ `ffa3663180b1`, live at `main` `762652d8`)

Two application threads that both miss the same `PipelineKey` both create a concrete pipeline; the second store destroys the first `RefPtr`; thread A's command struct holds a dangling `ComputePipeline*`. Every link verified at the pin in a fresh worktree:

- Consumer holds it **raw**: `commands::SetComputeState::pipeline` is `IComputePipeline*` (`command-list.h:214`).
- `CommandList::write` retains only the **virtual** pipeline (`command-list.cpp:161`) into `m_trackedObjects`, a `std::set<RefPtr<RefObject>>` (`command-list.h:502`) keyed by pointer value via `retainResource` (`:473`) — so it **cannot** cover the concrete pipeline substituted later.
- `resolvePipelines` overwrites `cmd.pipeline` with the concrete pipeline and **never retains it** (`command-buffer.cpp:962`; out-param is a raw `Pipeline*&`).
- The cache is sole owner (`device.h:132` `RefPtr<Pipeline>`; overwriting `specializedPipelines[key] = value` at `device.cpp:106`; `setConcretePipeline` skipped on the specializable path, with `device.cpp:348` stating *"Pipeline is owned by the cache"*).
- **`getConcretePipeline` holds no lock** across miss (`:292`) → create → store (`:347`) — only the per-accessor mutexes inside `ShaderCache`; `grep -c mutex src/command-buffer.cpp` = **0**. The double-miss is permitted by construction.
- **Window is unbounded on cpu/d3d11/cuda:** the resolve runs in `CommandEncoderImpl::finish` (cuda `:1430`) while the deref happens in `CommandQueueImpl::submit` (`:1221`, execute at `:1272`) — a caller-controlled interval, not a short window.

**Why `OPEN_GAP` and not `BLOCK`:** the ownership chain is proven, but the *precondition* is undocumented — no threading contract for concurrent encoding on one device exists in `docs/`, `README.md`, or `include/` (verified; the only nearby statement is `docs/error-handling.md:63`, about callbacks). `command-list.h:384` states an *intent* to allow parallel encoding without specifying whether one device may be encoded from two threads. So must-fix vs won't-fix is a maintainer's call. My original clearance was wrong for reading that silence as "unreachable"; a BLOCK would have been wrong for reading it as "specified". **Silence in a contract is not evidence for either side — it is the reason a human must decide.**

# The durable rules

1. ⭐⭐⭐ **The rule that actually generalises, and it cuts at me too: a correction that SHRINKS a finding gets less scrutiny than the finding did.** It is cheap to produce — right ⇒ you look rigorous, wrong ⇒ the claim was someone else's. All three corrections aimed at me pointed toward less exposure for their author; **and I have the mirror-image incentive, because every claim that strengthens my finding flatters me.** That is why I re-verified the three *strengthening* claims in a third worktree before adopting them, not just the objections. **Detector: check the SIGN of a batch of independent corrections. Uniform direction is the signal, not the conclusion.**
2. ⭐⭐⭐ **The correction I am least able to leave unchecked is the one that praises me.** The retraction arrived with explicit credit; only I am positioned to refute a claim about my own work, and I alone have no incentive to. Accepting credit uninspected is the same unverified-claim class as accepting blame uninspected.
3. ⭐⭐ **"Not yet argued" and "not true" need different words.** *"Your consumer-side leg is missing — go get it"* is a request; *"unestablished, I would not report this"* is a decision. A decision issued about an argument's incompleteness nearly suppressed a live use-after-free. **Filing rigour and truth are separate axes** — and I owe this in the direction I dismiss, not only the direction I assert.
4. ⭐⭐ **A file's absence does not imply the symbol's absence.** `pipeline-resolver.{h,cpp}` are genuinely absent at the pin — true and irrelevant, because #822 merely *extracted* a method that already existed at `command-buffer.cpp:939`. One `git show <ref>:<file>` settles it.
5. ⭐⭐ **`strong ref dropped` is half a UAF argument;** the other half is the consumer's storage type. Demand it in both directions.
6. ⭐ **Voiding part of a reversal's basis returns you to *unknown*, not to the draft.** The verdict `ABSTAIN_POLICY:OPEN_GAP` correctly never moved across three rounds.
7. **The original rule stands:** for a *library*, the thread population is its **callers** — grepping the implementation for `std::thread` answers the wrong question. `command-list.h:384` was the artifact I should have opened before clearing anything.

# Still open (infra, unchanged)

`mcp__nanoclaw__record_decision` returned `Decision recorded: … = ABSTAIN_POLICY`; the host then denied the append (`no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`). **The success string was false and arrived first.** No `approval_decisions` row exists for #821; `work/821-ffa3663180b1/decision.md` is the record. Operator grant pending — not mine to chase.
