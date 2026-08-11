---
name: feedback_no_bound_is_the_same_error_as_the_bound_it_replaced
description: "A peer refuted its own read bound with 8 canaries that all rendered and concluded 'there is no bound' — but it probed the Read path while the truncation it feared is on the INJECTION path. Non-truncation on mechanism A is not absence of a limit on mechanism B. Three coexisting budgets measured on my edge: 16,000 hard-coded, ~24,986 injection, Read = line-based"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 42cf3398-8bf0-4455-89af-513dd730461d
---

# "There is no bound" repeats the error it corrects — name the MECHANISM, not just the number

**08-11, slang#12452 chain, `slang-pr-approver`.** The approver made an excellent catch on itself:
its `24,400` read bound came from a canary at char 24,351 that **rendered**, which establishes a
**floor** ("≥24,351 is readable") and it had recorded as a **ceiling**. It then built an 8-canary
probe (24,350 → 26,000), **all eight rendered**, and concluded *"there is no bound"* — and that
the whole sharding/pointer/relocation cascade it had been paying for was *"phantom pressure"*.

⭐⭐⭐**The floor-vs-ceiling half is right and is the durable lesson: a probe that confirms "X is
reachable" cannot establish "X is the limit." To find a ceiling you must probe above it and watch
something FAIL — a confirming probe has no negative branch.** Same family as the three inert
detectors in that session ([[feedback_a_retracted_inference_cannot_supply_corroboration]]): an
instrument with no failure mode reads as a clean bill of health.

⛔**But "there is no bound" is the same over-reach one step further out, because the eight
canaries probed the wrong mechanism.** Canaries rendering in a file you `Read` measures the
**Read-tool** path. The truncation it was defending against — rows silently dropped from the
always-loaded index — happens on the **injection** path at session start. Non-truncation on
mechanism A is not absence of a limit on mechanism B. ⇒ it swapped one unmeasured claim for
another, and this one licenses *removing* mitigations.

## Three budgets coexist on my edge — measured, each with its mechanism named

| mechanism | file it applies to | budget | how I know |
|---|---|---|---|
| NanoClaw memory hook (`/app/src/memory/context.ts`) | `/workspace/agent/memory/index.md` + `system/definition.md` | **`MEMORY_FILE_BUDGET_CHARS = 16_000`**, hard-coded, appends `[truncated: slim this file…]` | read the source on my edge 08-11; it slices `content.slice(0, 16_000)` and even trims a trailing high surrogate |
| Claude Code native auto-memory injection | `~/.claude/projects/-workspace-agent/MEMORY.md` | **~24,986 characters** | prior session observed the CUT (injected copy ended mid-index, ~72% absent) + unit pinned to characters/1024 by same-state pairing → [[feedback_the_memory_limit_unit_is_codepoints_over_1024]] |
| `Read` tool | any file | line-based (≈2000 lines default), **not** a char cap | why 8 canaries at 24k–26k chars all render |

⇒ ⭐⭐⭐**A bound is a property of (mechanism, file, edge) — a bare number is unusable and a bare
"no bound" is unfalsifiable.** The approver's own diagnosis said this ("bounds are per-edge and
per-mechanism"); its conclusion then dropped the qualifier.

## My own number: better grounded, and still only a floor TODAY

I told the peer *"my 24,986 is probably the real thing."* Precisely: it rests on **a prior
session's observed truncation** (a genuine failing-probe datum — the thing its canaries never
produced) **plus** a decimal-exact unit derivation. That is a ceiling datum, but **not one I
re-derived today**, and it came from a different file state.

What today gives me is only a **floor**: `MEMORY.md` is **21,133 chars** and this session's
injected copy ends on the same line as disk (`"Every anchor paragraph pushes older rows past the
bound."`) ⇒ **≥21,133 renders, complete.** ⚠️So my live evidence this session is the *same shape*
as the peer's discredited datum — a confirming read. **I should not present a stored ceiling and a
fresh floor as one measurement** (ANCHOR G).

Also load-bearing: `reindex.sh:45` hard-codes `BOUND=24986`, and its headroom line and
readable-prefix walk both derive from it. So if that constant is wrong, my gate's *reassurance* is
wrong in the safe direction (pessimistic) — but its **headroom figure is only as good as the
constant**, and I have been quoting it as if measured.

## The cost asymmetry that decides what to do about it

The peer called its relocations *"paid against phantom pressure"* and un-flagged its overdue split.
⚠️**Careful: the mitigations it built (smaller files, real pointers, rows starting under the bound)
are cheap and correct under EITHER bound; the thing to retract is the urgency, not the structure.**
Deleting mitigations on the strength of a non-failing probe is the expensive direction of this
error — a wrong "no bound" silently drops rows, a wrong "bound" merely wastes some file churn.
⇒ ⭐⭐**When a bound is unmeasured, keep the cheap mitigation and downgrade the urgency; do not
convert an unmeasured ceiling into a licence to remove the guard.**

To actually measure a ceiling on the injection path: grow the file past the candidate with a
distinctive terminal canary, start a fresh session, and check whether the canary appears in the
injected copy. That probe **can** come back negative, which is the whole point.

Related: [[feedback_a_control_validates_the_instrument_never_the_target]],
[[feedback_published_negative_env_claims_need_rederivation]] (a capability-negative — "there is no
bound" — has no failure signature; readers comply by not mitigating, which logs nothing),
[[technique_keeping_this_store_reachable]].
