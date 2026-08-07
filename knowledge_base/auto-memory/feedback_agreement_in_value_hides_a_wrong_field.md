---
name: feedback_agreement_in_value_hides_a_wrong_field
description: "I wrote 'our bot commented on #12115' into an armed guard. Two accounts share the login stem (nv-slang-bot type=User id=286953280 vs nv-slang-bot[bot] type=Bot id=274397474) — both COMMENTED, so the value agreed and the attribution was false. Match on id/type, never login."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1dd5892a-bf52-4274-8dd1-46df09e77581
---

# Two claims agreeing in value is how a wrong field survives an audit

**2026-08-06, slang#12371.** I verified a repo precedent and wrote it into an **armed guard**: *"our
bot appears on #12115 only as `COMMENTED` reviews, never `APPROVE`."* The peer caught that the
reviewer isn't us.

| | login | type | id |
|---|---|---|---|
| #12115's `COMMENTED` reviewer | `nv-slang-bot` | **User** | 286953280 |
| **us** (verified on our own cmt 5197829621) | `nv-slang-bot[bot]` | **Bot** | 274397474 |

⇒ **Match on `id`/`type`. `login` alone does not identify an account** when a human account and an
App share a stem.

⭐⭐⭐ **Why it survived my own audit: both accounts' review state is `COMMENTED`.** The conclusion I
drew was *true* and the attribution supporting it was *false*, and because nothing in the **value**
disagreed there was no signal to investigate. An audit that checks "is the claim right?" passes; only
one that checks "is this the entity I think it is?" fails it. The true version of the claim is that
our `[bot]` identity is COMMENT-only on **#12353 / #12306** — different PRs entirely.

## The correction went the other way too: n=1 read exactly like n=12

I had rested the guard's prohibition on **one** precedent. The peer enumerated the population instead
— `is:pr author:app/nv-slang-bot` = **312** (167 merged + 59 open + 86 closed-unmerged), then the 12
most-recently-updated merged PRs: `ready_for_review` **12/12 human**, `merged_by` **12/12 human,
bot-as-merger 0/12**, sole `APPROVED` human every time.

⭐⭐ **A guard resting on n=1 and one resting on n=12 read identically until someone enumerates** — and
the population was one paced loop away. Same family as [[feedback_a_risk_does_not_license_a_mechanism]]:
the instrument was fine, the scope was one instance.

## Scope-narrower-than-the-class reads as permission

Earlier the same guard prohibited only the draft→ready flip. Once the precedent showed a human
performed **all three** publication acts (ready / approve / merge), the one-act prohibition was
revealed as leaving the other two available **by omission**. ⇒ **A prohibition scoped narrower than
the class it protects reads as permission for the rest.** Now: *never flip ready, never approve, never
merge; post COMMENT-state only.*

Companion defect in the same guard, caught by the peer: **item 4 contradicted item 1** — "honour the
operator's answer over the draft-hold default" authorised exactly what item 1 forbade. ⛔ **A
self-contradictory guard is worse than no guard, because it fires with authority.**

## Two false zeros, same signature, different causes

- Peer's: grepped `spirv-headers/.../spir-v.xml` — directory exists, file doesn't ⇒ wrong-file zero.
- **Mine:** `gh api KhronosGroup/SPIRV-Tools/...` returned **empty**. It was `Bad credentials` — a
  JSON error body my `grep`/`sed` pipeline **silently discarded**, leaving a clean empty result.

⭐⭐ **A wrong-file zero at least leaves the file absent as a clue; an auth-failure zero leaves a
well-formed empty answer with no trace.** ⇒ **When the answer is "nothing", read the RAW response,
not the filtered one — filtering is what converts an error into a null.** Related: the peer's
zero-control `author:app/zzqq-not-a-bot` returned **HTTP 422**, not 0 — *a probe that errors is not a
probe that measured zero.*

Resolved by reading the tree the build actually compiles:
`external/spirv-tools/source/spirv_constant.h:87` `SPV_GENERATOR_KHRONOS_LINKER = 17`, set at
`source/link/linker.cpp:239`, packed by `SPV_GENERATOR_WORD(TOOL,MISC)` at `:94-95` (so `>>16`
recovers TOOL by construction). Enum runs 0–8 then jumps to 17 ⇒ a registry allocation, not a
sequence position, so a reviewer cannot eyeball it. ⚠️ But `spirv_constant.h` is **internal** —
`include/spirv-tools/` has no such constant and no Slang source includes it, so "cite the constant,
not the literal" would push a fix into another project's private headers. Keep the literal, carry the
provenance in a comment.
