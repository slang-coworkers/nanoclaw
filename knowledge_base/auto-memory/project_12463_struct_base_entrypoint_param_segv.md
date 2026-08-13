---
name: project_12463_struct_base_entrypoint_param_segv
description: "slang#12463 — struct with a concrete base as an entry-point param SIGSEGVs (spirv/glsl/metal/wgsl). Triaged, NOT dispatched: A-vs-B is a maintainer call and fix A is measured insufficient. Gate i12463-disposition-gate-e238."
metadata: 
  node_type: memory
  type: project
  originSessionId: 8f2095bd-c297-4f41-a002-7ec21cfebfcc
---

# slang#12463 — `struct Derived : Base` as an entry-point parameter segfaults slangc

Opened 2026-08-10 by **zest-zero** (human, external). Triaged 2026-08-11 by `slang-triager` on my
dispatch; triage comment **issuecomment-5248002132** (5-bullet, nv-slang-bot[bot] = our own artifact).
Labels: `bug`, `reproduced`, `SPIR-V`, `Metal`, `WebGPU`; Type=Bug.

```slang
struct Base { float a; };
struct Derived : Base { float b; };
[shader("fragment")] float4 fragmentMain(Derived i) : SV_Target { return float4(i.b); }
```

## Root cause — a field-count mismatch, not a null deref

Two producers disagree on how many fields `Derived` has:

- **IR: 2.** `slang-lower-to-ir.cpp:12561-12580` prepends a member for the direct base type
  (`-dump-ir`: `struct %Derived { field(%base,%Base) field(%b,Float) }`).
- **Varying layout: 1.** `slang-parameter-binding.cpp:2791` walks only
  `getFields(..., MemberFilterStyle::Instance)` — **no `InheritanceDecl` loop**
  (`-reflection-json`: one field, `b`).
- **The asymmetry:** the **uniform** path already does the base walk at
  `slang-type-layout.cpp:5816-5825` ("Add all base fields first."). The varying path never got it.

Consumers index field layouts by **IR field ordinal**, so index 1 reads past a one-entry list.
Reporter's `IRInst::getAllAttrs()` frame is real but is where damage *surfaces*.

**Two independent consumer crash sites** — a fix in only the first leaves Metal/WGSL crashing:
1. `slang-ir-glsl-legalize.cpp:2199-2207` → `findOffsetAttr` → `getOffsetAttrs()` →
   `findAttrs<IRVarOffsetAttr>()` → `getAllAttrs()`. The `SLANG_ASSERT(structTypeLayout)` at `:2166`
   is `SLANG_ASSUME` in Release (`slang-common.h:371`) ⇒ it *licenses* the bad read.
2. `hoistEntryPointParameterFromStruct` at `slang-ir-legalize-varying-params.cpp:2962` →
   `IRStructTypeLayout::getFieldLayout` → `IRStructFieldLayoutAttr::getLayout` → `IRInst::getOperand`
   (`slang-ir.h:711`), `si_addr=0x3000002d7` (addr2line on a real backtrace).

Per-target exits: **spirv/glsl/metal/wgsl 139**, cuda 255 (clean `E99999`), **hlsl 0** (emits the
struct verbatim, never indexes the varying layout by ordinal). Control: base struct alone ⇒ exit 0.

## ⭐ Why this was NOT dispatched to a fixer

1. **The disposition is a maintainer call.** (A) add the base walk to the varying layout path, or
   (B) reject inherited structs as entry-point params on legacy versions too — a **source-compat
   break on code that compiles today**. A and B are patches in *different files*; building either
   before the call risks a wasted PR.
2. **Fix A is measured insufficient.** `slang-triager` built it: all four targets **139 → 0**, but
   with both members used the emitted GLSL gives `i_base_a_0` and `i_b_0` **both `location = 0`**,
   where flat and explicitly-nested equivalents correctly get `0` and `1`. The base entry must also
   advance the varying-slot/semantic state. ⇒ a regression test must assert the base member's
   **location**, not a clean exit. See
   [[feedback_a_closure_citing_feature_removal_is_version_scoped]] companion section.
3. **The reporter volunteered** and now holds the file:line, the model to copy, the
   `isDeclRefTypeOf<InterfaceDecl>` gotcha (`isInterfaceType` is declared in `slang-check-impl.h`,
   **not visible in that TU**), and the known residual.

## ⭐ Dedup — #4451 is the same defect, and its closure is version-scoped

**#4451** (chaoticbob, 2024-06-21) quotes the same assert at the same site. Closed **2025-07-31 by
csyonghe: "Closing as we removed struct inheritance from the language."** I verified that comment
against the live API myself rather than relaying it — it is the load-bearing claim of the dedup.

That closure is true **for Slang 2026+ only**. `slang-check-decl.cpp:11884-11899` hard-errors
`BaseOfStructMustBeInterface` only when `isSlang2026OrLater`; legacy warns (E30816) and proceeds:

| flag | exit | diagnostic |
|---|---|---|
| `-std 2026` | 255 | `error[E30811]`, no crash |
| `-std 2025` / `-std 2018` / **default** | **139** | warning E30816 |

⇒ **the removal moved the crash onto the default path rather than removing it.** Generalized to
[[feedback_a_closure_citing_feature_removal_is_version_scoped]].

## Test coverage gap

No in-tree test uses a struct with a concrete base as an entry-point parameter. A regression test
must cover **`-target spirv` AND `-target metal`** (different crash sites) and assert the base
member's location.

## UPDATE 2026-08-12 — maintainers took ownership, leaning B

`jhelferty-nv` (MEMBER) commented (**5271300475**): *"Per Tess, it sounds like struct inheriting
from another struct should be a diagnostic? @skiminki-nv … language deprecation aspect … arguably
not a deprecation but more of a 'this needs to be an error'?"* — a near-verbatim restatement of our
bot's **disposition B**. Issue now **assigned skiminki-nv + zangold-nv**, milestone **Q3 2026 (Summer)**.
⇒ the maintainer team is acting on our A/B framing; the decision (B, and whether "error" vs
"deprecation") is now **theirs, pending skiminki-nv**. Routed to `slang-triager` on the canonical
thread. Chain state: **handed off — awaiting maintainer confirmation**, NOT closed.

Gate note: the original series `i12463-disposition-gate-e238` was **swept** (gone by 08-12, along with
the whole per-issue gate fleet — confirmed by explicit `--group` query, not a scope artifact).
Re-armed as **`i12463-disposition-gate-4a1c`** with comment-id dedup seeded to 5271300475
(`/workspace/agent/gates/i12463-seen-nonbot.id`), so it won't re-route jhelferty's comment.

## RESUME — gate `i12463-disposition-gate-4a1c` (was `-e238`, swept)

`0 */6 * * *`, script `/workspace/agent/gates/i12463-disposition-gate.sh`. Fires on
**non-bot comment**, **cross-reference** (a PR naming the issue — the reporter said they'd try the
fix, and a PR need not comment here), **closed**, or **any probe/parse failure** (never readable as
"no change"). Baseline at arm time: state=open, comments=1 (all bot), nonbot=0, crossref=0.

**All four legs armed by control, not inferred:** `HUMAN_REPLY` (vs #12440), `CROSS_REFERENCED`
(#12440 with nonbot forced to 0 → crossref=4 — the positive control short-circuited on HUMAN_REPLY
and never reached this leg, so it needed its own), `PROBE_FAILED`, `TIMELINE_PROBE_FAILED`.
Cross-ref detection positive-controlled against #12440=4, #12371=6, #11963=1 ⇒ the 0 is a true zero.

On `CROSS_REFERENCED` by the reporter/a maintainer: **do not dispatch a fixer** — route
`slang-reviewer` and raise the `location = 0` residual + the missing-test gap against their PR.
Escalate to the operator at ~30 days with no reply and no cross-reference: the default `-std` path
segfaults on code the compiler still accepts with only a warning.

Tree left clean at `1ca1aa50e`; `slang-triager` restored the binary and verified **behaviourally**
(repro segfaults again) rather than by build log.
