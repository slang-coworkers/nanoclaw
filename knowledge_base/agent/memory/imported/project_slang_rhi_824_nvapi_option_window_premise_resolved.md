---
name: project_slang_rhi_824_nvapi_option_window_premise_resolved
description: "rhi#824 merged 13:59:27Z; approver's ABSTAIN_POLICY:OPEN_GAP rested on ONE unresolvable premise (does SetCreatePipelineStateOptions affect graphics/compute PSOs?). I resolved it from two public nvapi.h mirrors + NVRHI as behavioural oracle: raytracing-only ⇒ the flagged gap EVAPORATES. Verdict was right at decision time; the gap is not live."
metadata: 
  node_type: memory
  type: project
  originSessionId: cb2a528c-5b0e-41ed-90d5-a0dd9b3bbc06
---

# rhi#824 — the NVAPI premise the approver could not resolve, resolved. **Gap evaporates.**

**Chain:** `shader-slang/slang-rhi#824` "Create supported backend pipelines in parallel",
author skallweitNV. **MERGED 2026-08-10T13:59:27Z**, self-merged at exactly the approver's
pinned head `6e60945d03f1` (merge commit `8f1e51b240fa`) — MINE-VERIFIED via
`gh api pulls/824`. Approver decision: **`ABSTAIN_POLICY` / `OPEN_GAP`**, mode `live`,
policy `v0-shadow-wide`, clauses 6/6 pass, tier Devin-only (0 Bugs / 2 Flags).

## The finding, and the single premise it hung on

The PR added a process-wide mutex (`d3d12-pipeline.cpp:24-26`, `:703`) around the
device-scoped `NvAPI_D3D12_SetCreatePipelineStateOptions` window in
`createRayTracingPipeline2` **only** — while the same PR opted *every* pipeline type into
concurrency (`d3d12-device.h:34-38`: `canCreatePipelineOnTaskPool` returns `true` with
`SLANG_UNUSED(pipeline)`). All three citations MINE-VERIFIED at the merge commit.
Claimed blast radius: a graphics/compute PSO silently created with LSS/Spheres/Clusters
flags it never requested.

**Decisive premise, unresolvable in the approver's container:** does that option affect
graphics/compute PSO creation, or only ray-tracing?

## ✅ RESOLVED — raytracing-only. The graphics/compute blast radius does not exist.

Vendor header, **two independent public mirrors** (`MMadmer/Dead-Air-Refined`
1,369,243 B; `fallahn/crogine` 1,355,625 B). Shape invariant checked before trusting
either: the flag block **`diff`s IDENTICAL** across mirrors, and **no `_V2` struct exists
in either** ⇒ not a stale-mirror artifact.

Three levels of the header, general → specific:

| level | text (verbatim) |
|---|---|
| function `DESCRIPTION` | *"Globally change the state affecting pipeline creations. This affects all pipelines created after this call…"* |
| struct field `flags` | *"A bitwise OR of one or more #NVAPI_D3D12_PIPELINE_CREATION_STATE_FLAGS flags **for raytracing pipeline creation**."* |
| **every one of the 5 flags** | *"Change whether **raytracing pipelines** are created with support for OMM / DMM / Clustered BLAS / Spheres / LSS."* |

⭐ **The general sentence is what makes this trap look real; the specific ones settle it.**
`ENABLE_*_SUPPORT` are all raytracing-primitive features — there is no graphics/compute
PSO concept they could alter.

**Independent behavioural oracle — NVIDIA's own RHI.** `NVIDIA-RTX/NVRHI`
`src/d3d12/d3d12-device.cpp:432-446`: sets these flags **once in the device constructor**,
`grep -c` = **1 call in the file**, **never reset**, **no mutex anywhere near it**
(only `m_Resources.asListMutex` at `:176`, unrelated). ⇒ under NVRHI every graphics and
compute PSO in the process is created with the flags permanently set. **If that were
harmful, NVIDIA's reference implementation would be broken by construction.**

Corroborating from the diff itself: the graphics/compute paths (`:414-436`, `:511-533`)
carry **no** global state — they pass `NVAPI_D3D12_PSO_SET_SHADER_EXTENSION_SLOT_DESC`
**explicitly as a parameter** to `CreateGraphicsPipelineState`/`CreateComputePipelineState`.
The only global-state calls in the file are inside the mutex, and the thread-local one
(`…SetNvShaderExtnSlotSpaceLocalThread`) is set+reset on the same worker thread.

⇒ **Nothing is live on `main`.** Had the premise been resolvable at decision time, the
correct verdict was `WOULD_APPROVE`.

## 🔴 SCORING — joined a **FALSE ABSTAIN / LOSS**, and my own framing was struck

I told the approver *"your verdict was right at decision time."* **It declined that framing,
correctly**: an abstain is scored against its falsifiable reading — *"material enough not to
merge as-is"* — which a resolved premise refutes. Process sound, outcome wrong; **only the
outcome feeds accuracy.** My framing was true and **exculpatory**, and taking it would have
destroyed the calibration signal. ⭐⭐⭐**A self-directed LOSS is the one score with no
incentive behind it — the credible direction. My exculpatory offer is the one to distrust,
because it cost me nothing to make.** Cf.
[[feedback_a_downgrading_correction_gets_less_scrutiny_than_the_claim_it_cuts]].

⛔**BUT ONE LEG OF THAT LOSS IS VOID, AND IT IS THE LEG THAT WOULD INSTALL DRIFT.**
The approver rested the loss partly on *"a clean self-merge … refutes it."* **A self-merge here
carries ZERO bits about the finding.** MINE-VERIFIED timeline: PR opened 13:45:37Z →
CodeRabbit rate-limit notice 13:46:01Z → **merged 13:59:27Z, 13m50s later, by the author** —
while `reviews[] = 0`, zero `nv-slang-bot` presence on the PR (**the approver never posts, by
design**), and its own session only started 13:47:16Z with the decision landing 14:05Z, **six
minutes AFTER the merge.** The author **could not have seen the finding**; `jhelferty-nv`
removed their own review request at 13:45:51Z. ⇒ the merge is **not** a human verdict on this
gap — it is the absence of one. The loss stands **entirely on the resolved premise**, which is
sufficient. ⭐⭐⭐**Same shape as
[[feedback_merged_does_not_mean_the_flagged_gap_was_closed]], inverted: there a merge was
wrongly read as CLOSING a gap; here as REFUTING a finding. Both times `merged: true` was
credited with information it cannot carry** — and here the error direction is *self-punishing*,
which is why nobody would challenge it. **A wrong leg under a right verdict still teaches the
next score wrong: it says "merges adjudicate findings", which will vindicate a bad approve
later.**

**Approver's root cause, its own words, and the reusable half:** *scope-layering inside one doc
block* — it distrusted the in-tree comment, but that comment paraphrased only the **general**
level, so when the vendor contract proved unreachable it let the general reading stand as the
live hypothesis instead of reaching for a **behavioural** oracle. Two rules it filed: **an
upstream vendor's reference implementation is an oracle for that vendor's API contract — reach
for it before escalating an unresolvable premise**, and **quote the narrowest doc level that
mentions your case, never the first.**

⚠️**Asymmetric verification, worth keeping:** it **confirmed the NVRHI leg from source itself**
(1 call, ctor, no reset, no mutex) and **reproduced my 401** — but **could not open the header
leg**: every `nvapi.h` it can reach predates these flags (newest ~Jul 2024, "STRING NOT
PRESENT"), and **my two mirrors 404 through its fetch path**. So it accepted the conclusion on
the leg it opened, and said so. ⇒ **the doc quotes above rest on MY edge alone**; the
cross-verified basis is the NVRHI oracle. My working route, reproducible twice:
`curl https://raw.githubusercontent.com/MMadmer/Dead-Air-Refined/main/sdk/include/nvapi/nvapi.h`
(200, 1,369,243 B, flag at `:19640`).

## Honest limits of my own resolution

- **Documentation + reference-implementation evidence, NOT execution.** Nobody in this
  fleet can execute the NVAPI path: the CI runner compiles it and reports
  `SKIPPED (Device does not support NVAPI)`. I did not close this by test.
- ⚠️ **`gh api repos/NVIDIA/nvapi` returned 401 `Bad credentials` on my edge** while
  `gh api repos/shader-slang/slang-rhi` succeeded **in the same shell** and
  `search/code` against `repo:NVIDIA/nvapi` worked (`total_count 1`). Asymmetric per-repo
  credential/visibility fact, 3 retries. **This is why I used third-party mirrors** —
  so the mirror-equality check above is load-bearing, not decorative.

## The approver's process was right, and one part beat my own standard

**It did not round an unresolved premise up to approve.** It named the premise, the four
tools that failed on it, and abstained. That is the behaviour to reinforce — and the
reason a 20-minute header fetch could finish the job.

⭐⭐ It also reported that **its own standing gate from #821 fired and it found the gate
SATISFIED by a mechanism it had not prescribed** (per-device resolution mutex from #823 +
pre-dispatch key dedup + serial publication), judging the guard by purpose rather than
letter. Holding an author to my own wording would have manufactured a false gap.
Same axis as [[feedback_a_downgrading_correction_gets_less_scrutiny_than_the_claim_it_cuts]],
opposite polarity: that leaf is my downgrades being too cheap; this is a peer declining a
free upgrade to its own finding.

## Confirmed independently: CodeRabbit **green status with zero reviews**

MINE-VERIFIED: `pulls/824/reviews` → **`count=0`**;
`commits/6e60945d/status` → `state: success` with contexts `license/cla` + **`CodeRabbit`**;
the only issue comment (coderabbitai[bot], 13:46:01Z) is *"Review limit reached … you've
reached your PR review limit, so we couldn't start this review."* ⇒ **a rate-limited bot
publishes a SUCCESS commit status and lives only in `issues/comments`, never in
`reviews[]`** — so any harvest keyed on review rows scores it as absent while a
green check implies it passed. The approver caught this and let none of that green into
its derivation. Family: [[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]]
(combined status fails in BOTH directions).

## 🔴 Ledger: 4th+ consecutive denial — MY outstanding operator action

`record_decision` returned `"Decision recorded: … ABSTAIN_POLICY"`; the host then denied it
(`no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`). **No
`approval_decisions` row exists for #824** — nor for rhi#821, rhi#822, spy#925 (a BLOCK),
spy#1068.

⛔**#824 NEEDS TWO BACKFILL ROWS, NOT ONE — and replaying only the first is WORSE THAN
REPLAYING NOTHING.** Both appends were denied: (1) decision 14:05Z `ABSTAIN_POLICY:OPEN_GAP`;
(2) join 15:07Z `POST_DECISION_JOIN` — false abstain, human verdict MERGED, **scored a LOSS**.
An unjoined abstain **reads as an open hold when it is actually a recorded loss**, which biases
the accuracy loop in the flattering direction — it makes the abstain column look *untested*
rather than *wrong*. ⇒ the operator fix is **"replay decision + join, per PR"**, never "replay
N decision rows". Both payloads verbatim in the approver's
`work/824-6e60945d03f1/decision.md`. ⭐**The second denial was only observable because the
approver was watching for it** — under the "emitted, never recorded" rule it adopted. Had it
written *"recorded"* at 15:07Z, the loss would have silently become an open hold. `ncl approvals list` → `[]` on my edge (that surface is pending-cards, not the
ledger). Durable record is the approver's `work/824-6e60945d03f1/`. Mechanism, the
three denial branches, and the fix (set to the approver group folders; **no restart
needed**): [[feedback_record_decision_ok_proves_emission_not_persistence]].
