---
name: project_9661_cuda_getdimensions_scrub
description: "slang#9661 \"Improve GetDimensions for CUDA\" — assignee-abandonment scrub requested 2026-08-05; dispatched to slang-triager."
metadata: 
  node_type: memory
  type: project
  originSessionId: 3c5837dc-e0c5-436b-8729-2e15e7c98ed4
---

# slang#9661 — Improve `GetDimensions` for CUDA (scrub / reassign / close)

**RESUME TRIGGER:** any `issue_comment` on shader-slang/slang#9661, or slang-triager reporting
its scrub verdict on thread `gh-issue-shader-slang/slang-9661`.

## State (2026-08-05)

- Issue opened 2026-01-20 by `skallweitNV`. Labels: `GoodFirstBug`, `Dev Opened`, `RTR`.
  Assignee: `mkeshavaNV` (self-assigned 2026-01-27, no visible progress since).
- **2026-08-05T18:40Z** — `jkiviluoto-nv` mentioned `@nv-slang-bot`: *"Mukund (mkeshavaNV) won't be
  returning to this work for a while. Please scrub this issue and assess whether it is still
  relevant, needs reassignment, or should be closed."* → an **issue** (`is_pr: false`) ⇒ routed to
  `slang-triager`, thread `gh-issue-shader-slang/slang-9661`.
- ⚠️**First dispatch died on a FLEET-WIDE `429` at 19:08Z** (the same batch minted ~28 sessions in
  4 min; siblings #6518/#10181 took the identical error at the same minute). **Redriven 19:09Z after
  verifying no GitHub side-effect had occurred** (`updated_at` still the maintainer's comment,
  6 comments) ⇒ no double-post risk. ⭐**A 429'd turn leaves the session `active`/`running` with the
  dispatch already CONSUMED — a dropped chain is byte-identical to one still thinking; the error row
  in `ncl sessions messages` is the only tell.**

## ✅ SCRUB COMPLETE 08-05T19:28Z — verdict posted, OUR STEP DONE

**Verdict: still relevant — RESCOPE + NEW OWNER.** Not a close, not a reassign-as-written.
Comment [`5196363753`](https://github.com/shader-slang/slang/issues/9661#issuecomment-5196363753)
(verified: `nv-slang-bot[bot]`, `created_at == updated_at` ⇒ genuinely fresh not an edit, comments
6→7, last prior commenter was the human ⇒ **`jkiviluoto-nv` IS notified**).

**I INDEPENDENTLY VERIFIED every load-bearing claim before relaying** (all at `b0e43d657`):

- ✅Silent-`0` emit real at all three cited sites — `slang-core-module-textures.cpp:374`
  (`txq.array_size not available`), `:389` (`txq.samples`), `:403` (`txq.num_mipmap_levels`).
- ✅Doc claim verbatim at `docs/cuda-target.md:330` — *"GetDimensions is not available on any Texture
  type currently"*. ✅**Its 2020-03-21 date CONFIRMED** — clean ABSENT→PRESENT boundary at `05c9a5c9d`
  (prior `315888efd` 2020-03-17 lacks it) ⇒ the doc predates CUDA `GetDimensions` support (#6718) by
  ~5 years, so it was never *made* wrong, it was **always** a blanket disclaimer that reality outgrew.
- ✅**Conclusion CONFIRMED — the per-`mipLevel` overload the body asks to ADD already exists and
  silently discards `mipLevel`, returning mip-0 dims at exit 0.** ⛔**BUT MY STATED MECHANISM WAS
  WRONG, and so were the triager's first two replacements — see
  [[feedback_a_shared_conclusion_stops_the_mechanism_audit]]. THE REAL ONE:** `paramCount` is advanced
  **past** the mipLevel slot at `:268-271`, so mipLevel owns `$1` and every later cuda output
  placeholder is `$2,$3,…`; **Metal escapes only via a SEPARATE CURSOR** — `metalMipLevel` (`:260`
  init `"0"`, `:274` → `"$1"`), **8 occurrences vs `cudaMipLevel` = 0 (verified)**. No cuda emission
  can ever *name* the slot. ⭐⭐**This sharpens the repair estimate decisively: a one-line asm tweak
  CANNOT fix it — it needs a cursor like Metal's.** (My "cuda references only `$0`, never `$1`" was
  the wrong form: those `$0`s are **input operands inside the C++ string literal**, while output
  placeholders are computed via `String(paramCount)`.) ✅Statement-aware census settling it: cuda 18
  stmts, literal `($0)` in 3, `$1` in **0**; wgsl `$1` in 3; metal literal `($0)` in 0.
- ✅ICE sites real: `slang-emit-cuda.cpp:246-249` `return SLANG_FAIL` on `isMultisample()`, surfacing
  as `SLANG_ASSERT(handle != kNullHandle)` at `slang-emit-cpp.cpp:133`.

⛔**MY OWN INSTRUMENT DEFECT, caught mid-verification:** my `git log -S` on the doc sentence returned
ONE unrelated commit dated **2026-08-03** — which I nearly read as refuting the triager's 2020 date.
Cause: **`/workspace/agent/slang` is a SHALLOW clone (`is-shallow-repository=true`, 11 commits,
oldest 2026-08-03)**, so `-S` bottoms out at the graft boundary and reports it as the origin.
⭐⭐⭐**A shallow clone makes `git log -S`/`--follow`/blame return the GRAFT BOUNDARY, not "not found" —
a false ORIGIN, which is far worse than a false zero because it looks like a real answer with a real
date.** ⇒ **`git rev-parse --is-shallow-repository` BEFORE any history-origin claim; verify dates via
`gh api .../commits?path=<f>` + a PRESENT/ABSENT bisect over `contents?ref=<sha>`, which is immune to
local clone depth.** ⭐⭐**And: a peer's number disagreeing with mine is a prompt to check MY
instrument first — the triager's clone is a different per-group tree, so identical commands there and
here are NOT the same measurement.**

**Two findings the triager produced beyond the brief** (both verified above):

1. ⭐⭐The already-existing-but-`mipLevel`-ignoring overload **inverts the issue's own framing**: the
   discussion fixated on sentinel `0` fields, but a **plausible-but-wrong value hides better than a
   sentinel** ⇒ this is a *stronger* argument for remove-or-warn than anything in the thread.
2. ⭐**Unfiled ICE, deliberately NOT folded in:** any `Texture2DMS` at `-target cuda` asserts **even
   when never referenced** — the unused-declaration case is what proves the **type** fails to lower
   rather than `GetDimensions` being at fault. CUDA-only (cpp/hlsl/spirv fine). Triager offered to
   file separately rather than opening an issue uninvited. **Correct instinct — kept scope clean.**

**Next action is a MAINTAINER DESIGN CALL** (deliberately not made by us — it's a
source-breaking-vs-warning tradeoff): **A** drop `cuda` from `[require]` (source-breaking) ·
**B** warn on zero-returning overloads · **C** narrow slice — reject only the `mipLevel` overload ·
**D** the docs fix is free-standing and lands safely alone. **Ownership gap is the real blocker:**
`skallweitNV` holds the design opinion but explicitly declined the work.

⚠️`GoodFirstBug` is now **arguably wrong** given the breaking-change judgment involved. Labels left
untouched (all human-set) — flagged, not changed.

✅**Published artifact SWEPT by the triager — nothing false escaped: cmt `5196363753` greps 0 for
`cannot discriminate`/`literal $1`/`copy-paste`/`paramCount`/`metalMipLevel`/`$0`, non-zero control
`mipLevel`=1. It carries the CORRECT structural claim citing `:274`.** ⇒ no second comment, no edit
(churn on an accurate artifact isn't diligence). **All four wrong mechanisms stayed on the a2a thread.**
Repro held at the triager's `/workspace/agent/scratch-9661/`; discriminator = cell `f` (declared,
never referenced) with cuda 255 / cpp 0 / hlsl 0 / spirv 0.

⚠️**A 2nd `429` hit the triager at 20:07Z — DELIBERATELY NOT REDRIVEN, and that is the right call.**
The errored turn was answering my **closing acknowledgment** on an already-terminal chain: nothing was
pending, no work was lost, and the GitHub artifact is intact and untouched (cmt `5196363753` still
`created_at == updated_at`, 6039 chars; issue `updated_at` still 19:28:41Z, 7 comments).
⭐⭐⭐**A 429 on a CLOSING turn is not the same event as a 429 on a WORKING turn — classify the LOST
TURN'S PURPOSE before deciding to redrive. Redriving a courtesy ack costs a session and adds load to a
saturated resource to recover nothing.** Fleet census at 20:08Z: **2–6 `429` rows per sibling scrub
session** (5 sampled), still firing ⇒ the burst is sustained, not the single 19:08Z spike I first
reported. Consistent with [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]] —
sample siblings, don't retry.

**RESUME:** maintainer picks A/B/C/D ⇒ dispatch fixer (D alone is safe/trivial and needs no design
call) · `jkiviluoto-nv` replies ⇒ act on it, don't re-scrub · someone asks for the `Texture2DMS` ICE
⇒ triager has the repro and offered to file · assignee cleared / reassigned ⇒ note it here.

## The load-bearing wrinkle a scrub must not miss

The issue's **body ask and its comment thread disagree**, and the body is the stale one:

- Body (Jan 20): implement `txq`-based `GetDimensions` — mip-level count, array size, per-`mipLevel`
  overloads; also fix docs that wrongly say CUDA has no `GetDimensions`. References #6718 as the
  initial support.
- Comment 1, same day, **by the author**: `txq` on CUDA only supports `txq.width/height/depth`.
  `txq.num_mipmap_levels` **does not compile** in a CUDA kernel — it works from an **OptiX** pipeline
  only. ⇒ the body's primary ask is **not implementable on CUDA as scoped**.
- Comments 3-4 (Jan 22, author): *"This won't be supported in CUDA for the time being… I don't plan
  to work on this."* Replacement ask: **remove the unsupported `GetDimensions` overloads instead of
  silently returning `0`**, *or* **emit a warning** when a zero-returning overload is used.

⇒ ⛔ **Do not triage the title/body.** The live ask is a small, well-scoped diagnostics/API-surface
change (remove-or-warn on zero-returning CUDA overloads), which is genuinely `GoodFirstBug`-sized —
whereas the body's ask is blocked by a CUDA platform limitation. A scrub that reads only the body
will conclude "still relevant, needs a CUDA expert" and get both the size and the owner wrong.
A scrub that reads only the last comment (*"won't be supported"*) may conclude "close" — also wrong,
because the silent-`0` behavior is still live and still a defect.

**Open question for the triager to verify at master (not to assume):** does today's CUDA emit path
still return `0` for the unsupported `GetDimensions` fields, and are the docs still claiming CUDA
has no `GetDimensions` at all? Both were true in January; either may have been fixed since by
unrelated work. The verdict (relevant / reassign / close) hinges on measuring these, not on the
comment thread.

## Related

- [[slang-rhi-backend-chains-index]] — CUDA/backend chain routing.
- [[feedback_an_in_place_edit_notifies_nobody]] — if the triager posts, a *new* comment notifies;
  editing an existing one does not.
- [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]] — the body-vs-thread split here
  is exactly the "which artifact does this sentence make a claim about" trap.
