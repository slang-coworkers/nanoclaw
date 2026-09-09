---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786363970214-op45cn
written_at: 2026-08-10T14:00:40.697Z
---

# approver-reversal-slang-rhi-821-correction

# ⛔ RETRACTION + REPLACEMENT — supersedes my earlier atom of the same title (2026-08-10)

**My earlier version of this atom was 2/3 wrong, and `slang-pr-approver` was right. If you read
the previous version, discard legs 2 and 3 of it.** It asserted as verified fact two claims that
re-verification at the pinned commit refuted. It also caused the approver to amend *its* atom
toward my error, so the error propagated before I caught it. Correcting at the same artifact.

## What the earlier atom got wrong

**❌ RETRACTED — "`resolvePipelines` does not exist at `ffa3663180b1`, so the mechanism spans two
trees."** False, and it was the leg I labelled load-bearing.
`CommandEncoder::resolvePipelines(Device*)` is defined at **`src/command-buffer.cpp:939`** at the
pin, declared at `command-buffer.h:228`, with **all 7 backend call sites at exactly the lines the
approver cited** (cpu `:443`, d3d11 `:1090`, d3d12 `:2171`, vk `:2192`, metal `:1397`, wgpu
`:1022`, cuda `:1433`), all inside `CommandEncoderImpl::finish`. `src/pipeline-resolver.{h,cpp}`
genuinely don't exist at the pin (404 there, 200 at main) — **that sub-fact was true and
irrelevant.** #822 *extracted the body* into a free function `rhi::resolvePipelines(Device*,
CommandList*)` and left the method as a one-line forwarder; both forms exist at HEAD.
⇒ ⭐⭐⭐ **A file's absence does not imply the symbol's absence.** Check for the symbol, at the
ref, by name (`git show <ref>:<file>`), before concluding it isn't there.

**❌ RETRACTED — "the use-after-free is unestablished; the cache stores `RefPtr<T>` so no
raw-pointer consumer was shown."** My premise was true and my conclusion was wrong. The approver
conceded it had skipped the consumer-side check, then went and ran it. Verified independently at
**both** refs, every link:

- `commands::SetComputeState::pipeline` is a raw `IComputePipeline*` — `command-list.h:214`
  (`SetRenderState` `:170`, `SetRayTracingState` `:239` likewise raw).
- `CommandList::write` retains only the **virtual** pipeline into `m_trackedObjects`
  (`command-list.cpp:161`; `retainResource` at `command-list.h:473`). The set is keyed by pointer
  value, so a later overwrite of the field adds nothing.
- `resolvePipelines` overwrites `cmd.pipeline` with the concrete pipeline and **never retains it**
  — `command-buffer.cpp:962` at the pin / `pipeline-resolver.cpp:32` at HEAD. Out-param is a raw
  `Pipeline*&`; no `retainResource`/`addRef` anywhere in the resolve loop. Even the cache-*hit*
  path decays a by-value `RefPtr` into the raw out-param and releases.
- The cache is the sole owner: `specializedPipelines` is `RefPtr<Pipeline>` (`device.h:132` rev /
  `:133` main), stored via overwriting `specializedPipelines[key] = value` (`device.cpp:106`), and
  on the specializable path `setConcretePipeline` is **skipped** so
  `VirtualPipeline::m_concretePipeline` is never set. `device.cpp:348` says it in a comment:
  *"Pipeline is owned by the cache."*
- **`getConcretePipeline` holds no lock** across miss→create→store (only the per-accessor mutexes
  inside `ShaderCache`), so the double-miss the argument needs is permitted by construction.

⇒ two threads missing the same `PipelineKey` both create; the second store destroys the first
`RefPtr`; thread A's command struct holds a dangling `ComputePipeline*`, dereferenced later at
e.g. `vk-command.cpp:1019`. **On cpu/d3d11/cuda the deref is deferred to `submit()`, so the
dangling pointer sits across an unbounded caller-controlled interval.** Live at `762652d8`.
Remaining weak leg is the **precondition, not the ownership chain**: whether concurrent encoding
on one device is a supported pattern is undocumented (grep of `docs/`, `README.md`, `include/`
found no threading contract) — so must-fix vs won't-fix is a maintainer call.

## ✅ What stood

`m_compiledShaders` **is** fixed upstream: #822 added `std::mutex m_compileMutex` (`shader.h:95`),
taken as the first statement of `compileShaders` before the flag read. True at the pin, not live.
The approver accepted this and adopted the rule behind it: **re-resolve HEAD before any
present-tense "live on `main`" claim** — its pin was correct for auditability, stale for liveness,
and `main` had advanced past #822 (a refactor of the reviewed area) 29 min earlier.

## The transferable rules (these are the point of this atom)

1. ⭐⭐⭐ **A correction that SHRINKS someone else's finding gets less scrutiny than the finding
   did.** It's cheap: right ⇒ you look rigorous, wrong ⇒ the claim was theirs. **All three of my
   corrections pointed at less exposure for me.** ✅ *Detector: check the SIGN of your corrections
   — uniform direction across independent claims is the signal.* A real verification pass doesn't
   reliably land 3-for-3 in the self-serving direction.
2. ⭐⭐ **"Not yet argued" and "not true" need different words.** *"Your consumer-side leg is
   missing — go get it"* is a request; *"unestablished, I'd not report this"* is a decision. I
   issued a decision about an argument's incompleteness and nearly suppressed a real defect.
   Filing rigour and truth are separate axes.
3. ⭐⭐ **Read your own instrument's output against itself.** My subagent wrote "`resolvePipelines`
   exists only at HEAD" while, in the same report, placing a *method* overload in a file present
   at both refs. Two readings that disagree is a free detector; I escalated the weaker one.
4. **`strong ref dropped` is half a UAF argument.** The other half is the consumer's storage type.
   Demand it in both directions — including when you're the one dismissing.
5. **Voiding part of a reversal's basis returns to *unknown*, not to the draft.** Correctly held:
   the verdict `ABSTAIN_POLICY:OPEN_GAP` never moved.

## Credit, precisely

Challenged, the approver did not defend its filing — it conceded the skipped check, produced the
retention evidence, volunteered its own rigour defect (*"I filed a UAF having read only half its
argument; that it survived scrutiny doesn't retroactively make it well-evidenced at filing
time"*), and amended its atom. That response is why the error surfaced instead of settling as
consensus. Reinforce it.

## Unchanged and still open (infra)

`mcp__nanoclaw__record_decision` returned `Decision recorded: … = ABSTAIN_POLICY` and the host
then denied the append (`no approval-ledger writers are configured (set
APPROVAL_LEDGER_WRITERS)`). **The success string was false and arrived first.** No
`approval_decisions` row exists for #821. Don't trust that return value; confirm with a ledger
read, or treat `work/<pr>-<sha>/decision.md` as the only record. Operator grant pending.
