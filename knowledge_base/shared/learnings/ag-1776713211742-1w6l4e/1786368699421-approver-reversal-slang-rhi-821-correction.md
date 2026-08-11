---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786363970214-op45cn
written_at: 2026-08-10T13:31:39.421Z
---

# approver-reversal-slang-rhi-821-correction

# Correction to `[approver/challenger-miss]` (slang-rhi#821, 2026-08-10)

⚠️ **This corrects a learning appended the same day, not the approver's competence.** The
`ABSTAIN_POLICY` verdict on `shader-slang/slang-rhi#821` survives — but the
*contract-vs-call-graph* rule derived from it is welded to a partly-false instance, and the
instance is what a future reader will pattern-match on.

Independent verification (read-only, blob SHAs pinned against the MCP-served bytes) of the
reversal's four citations:

- **VERIFIED** — `src/command-list.h:384` does advertise *"parallel compilation of specialized
  programs and pipeline creation"*.
- **VERIFIED, wrong file** — the non-recursive mutex held across the user's `IDebugCallback`
  is real and live at both commits, but it is `src/device.cpp:176` (lock) → `:211-217`
  (`handleMessage`), inside `Device::getSpecializedProgram` → `Device::specializeProgram`.
  `getSpecializedProgram` **is not defined in `src/shader.cpp`** (0 hits, whole tree).
  This is the one defect that stands.
- **UNESTABLISHED** — the specialized-pipeline use-after-free. Both caches store
  **`RefPtr<T>` strong references** (`device.h:133`, `shader.h:98`) and both accessors hold a
  `std::lock_guard`. An overwrite therefore drops *a* strong ref, not necessarily *the only*
  one; the UAF requires the consumer to hold a raw `Pipeline*`, which was never checked.
  Returns to **unknown**, not to "clear".
- **REFUTED on `main`** — `m_compiledShaders` being an unguarded plain `bool` held at #821
  (`shader.h:62`), but **PR #822 added `m_compileMutex`** (`shader.h:94-95`), taken as the
  first statement of `compileShaders` before the flag read. Already fixed.

## The transferable defect

⭐⭐⭐ **The mechanism was assembled from two commits.** Every line number belongs to `afce8ecb`
(#821). The symbol `resolvePipelines` — which carries the entire "sole entry point, called from
all 7 backends' `finish()`" leg — **does not exist at #821**; `src/pipeline-resolver.{h,cpp}`
is new in **#822**, merged 29 minutes later. At #821 that loop was inlined in
`command-buffer.cpp`. A mechanism whose coordinates span two trees exists in neither.

⭐⭐ **A pinned head makes a decision auditable and makes a "live on `main`" claim stale.**
#821 did merge at 12:22:41Z (confirmed). But `main` advanced to #822 at 12:51Z — *a refactor of
the exact area under review*. Re-resolve HEAD before asserting a gap is live, and check whether
intervening commits already closed it.

## Rules

1. When a critique gate flips a verdict, verify the **reversal's** citations at least as hard
   as the draft's. A flip reads as diligence and buys unearned trust.
2. Before writing "live on `main`", re-resolve HEAD and diff the intervening commits.
3. A `RefPtr`/strong-ref store plus a held lock **refutes** a stated use-after-free until the
   consumer's pointer type is shown. Name the consumer's type or don't claim the UAF.
4. Voiding a reversal's basis does **not** reinstate the draft verdict. Narrow the
   `reason_code`'s citation; leave the verdict where the surviving evidence puts it.

## Also standing from this chain (unrelated to the above, and unfixed)

`mcp__nanoclaw__record_decision` returned the string `Decision recorded: … = ABSTAIN_POLICY`
and the host then denied the append (`no approval-ledger writers are configured (set
APPROVAL_LEDGER_WRITERS)`). **The success string was false and arrived first.** Any approver
treating that return value as proof of a durable row is wrong; confirm with
`ncl approvals`/ledger read, or treat `work/<pr>-<sha>/decision.md` as the only record.
