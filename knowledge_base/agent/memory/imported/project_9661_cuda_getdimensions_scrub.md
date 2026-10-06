---
name: project_9661_cuda_getdimensions_scrub
description: "slang#9661 \"Improve GetDimensions for CUDA\" — assignee-abandonment scrub (08-05) found the per-mipLevel overload silently returns mip-0 dims; contributor 0xivanm (08-18) showed txq.level fixes per-mip w/h. Now maintainer-driven (assignees 0xivanm + kaizhangNV); our tier is done."
metadata: 
  node_type: memory
  type: project
  originSessionId: 3c5837dc-e0c5-436b-8729-2e15e7c98ed4
---

# slang#9661 — Improve `GetDimensions` for CUDA (scrub → maintainer-driven)

**State: OUT OF OUR HANDS (since 2026-08-18).** A maintainer and a contributor own it now. We have
nothing writable to post; a bot comment on their exchange would be noise.

**RESUME on:** `0xivanm` opens a PR (route to `slang-fixer` / review) · he asks the triager for the
exact generator lines (already offered) · a fresh inbound explicitly asks the bot or a coworker to
act. Observe the `kaizhangNV` ↔ `0xivanm` guidance; don't step into it. Thread:
`gh-issue-shader-slang/slang-9661`.

## Timeline

- **2026-01-20** opened by `skallweitNV` (`GoodFirstBug`, `Dev Opened`, `RTR`). Self-assigned by
  `mkeshavaNV` 01-27, no progress after that.
- **2026-08-05 18:40Z** `jkiviluoto-nv` asked the bot to scrub it (assignee departed) → `slang-triager`.
  The first dispatch died on a fleet-wide 429 at 19:08Z. It was redriven at 19:09Z after checking
  that nothing had been posted (see [[feedback_a_timeout_and_a_429_are_different_evidence_about_the_work]]).
- **08-05 19:28Z** verdict posted, cmt
  [`5196363753`](https://github.com/shader-slang/slang/issues/9661#issuecomment-5196363753):
  **still relevant; rescope and find a new owner.** A second 429 at 20:07Z hit a closing-ack turn and
  was deliberately not redriven
  ([[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]]).
- **08-18 17:04Z** `0xivanm` (new contributor) volunteered and posted CUDA 12.6 results that partly
  overturned our premise (below). The triager re-verified at master `9a948c67a` and replied
  (cmt `5331598186`), giving him a slice that doesn't depend on the design call. We escalated the
  design fork to the operator.
- **08-18 21:02Z** `jhelferty-nv` delegated the fork to `kaizhangNV` (cmt `5334019110`). Assignees
  are now **`0xivanm` + `kaizhangNV`**, with `mkeshavaNV` removed. We **retracted** the operator
  escalation because a maintainer already owned the fork.

## The load-bearing scrub trap: body vs thread

The body (Jan 20) asks for `txq`-based mip-count, array-size and per-`mipLevel` overloads, plus a
docs fix. The **author's own comments** the same week say `txq.num_mipmap_levels` doesn't work in a
plain CUDA kernel (OptiX only), *"I don't plan to work on this"*, and change the ask to: **remove the
zero-returning overloads, or warn when one is used.** ⛔ A scrub of the body alone gets the size and
the owner wrong. A scrub of the last comment alone ("won't be supported") wrongly closes it, because
the silent-`0` defect is still live.

## Technical ground truth

Verified at `b0e43d657`. The emit file was last touched `72985f871` (2026-07-24), so it was still
current on 08-18.

- **Silent `0`** at `slang-core-module-textures.cpp:374` (`txq.array_size`), `:389` (`txq.samples`),
  `:403` (`txq.num_mipmap_levels`).
- **The per-`mipLevel` overload already exists and silently discards `mipLevel`.** It returns mip-0
  dims with exit 0. Mechanism: `paramCount` is advanced past the mipLevel slot (`:268-271`), so
  mipLevel owns `$1` and every later CUDA output placeholder is `$2,$3,…`. Metal escapes only through
  a **separate cursor**, `metalMipLevel` (`:260` → `:274`, 8 occurrences vs `cudaMipLevel` = 0).
  ⇒ **The fix needs a Metal-style cursor, not a one-line asm tweak.** Three wrong mechanisms were
  proposed before this one ([[feedback_a_shared_conclusion_stops_the_mechanism_audit]]). None of them
  reached the published comment.
- **A plausible-but-wrong value hides better than a sentinel `0`.** That makes the case for
  remove-or-warn stronger than anything argued in the thread.
- **The doc** `docs/cuda-target.md:330` says *"GetDimensions is not available on any Texture type
  currently."* It dates from 2020-03-21 (`05c9a5c9d`) and predates CUDA `GetDimensions` (#6718), so
  it was always a blanket disclaimer that the code outgrew. Dating it needed the `gh api` bisect,
  because the local clone is shallow
  ([[technique_shallow_clone_git_log_S_returns_graft_boundary]]).
- **Contributor results (08-18, CUDA 12.6):** `txq.width/height` work, and **`txq.level.width/height`
  works** (PTX ISA §9.7.11.5, `sm_30`+), so per-mip w/h *is* fixable. `txq.num_mipmap_levels` and
  `txq.array_size` compile to PTX but the kernel fails to load (`named symbol not found`), so those
  are still unavailable outside OptiX. The triager stated where its GPU-less measurements stop
  instead of asserting the runtime failure itself.
- **Unfiled side ICE:** any `Texture2DMS` at `-target cuda` asserts even when never referenced
  (`slang-emit-cuda.cpp:246-249` `SLANG_FAIL` → `slang-emit-cpp.cpp:133`). It is CUDA-only. The
  triager offered to file it separately and kept it out of this scope.

## Open design fork (now `kaizhangNV`'s)

**A** drop `cuda` from `[require]` (source-breaking) · **B** warn on zero-returning overloads ·
**C** reject only the `mipLevel` overload · **D** docs fix (stands alone, always safe). After
08-18 the question narrowed: the mip-level overload can return correct w/h but not
`numberOfLevels`. Should it be unavailable on CUDA, or available with a warning? The contributor's
slice that doesn't depend on this: (1) the `cuda-target.md:330` docs fix, (2) `txq.level` per-mip
w/h.

⚠️ `GoodFirstBug` is arguably wrong given the breaking-change judgment. All labels are human-set, so
we flagged it and left it alone.

## Related

- [[slang-rhi-backend-chains-index]] — CUDA/backend chain routing.
- [[feedback_an_in_place_edit_notifies_nobody]] — post a new comment; an edit notifies nobody.
- [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]] — the body-vs-thread split.
