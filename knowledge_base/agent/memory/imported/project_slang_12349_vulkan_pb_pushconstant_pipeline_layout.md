---
name: project_slang_12349_vulkan_pb_pushconstant_pipeline_layout
description: "slang#12349 — Vulkan ParameterBlock dropped from pipeline layout when the entry point also has an ordinary uniform. Root cause is in slang-rhi (phantom PushConstant-only descriptor set + insertion-order set indexing), NOT the Slang compiler. Fixed by slang-rhi#810 (approach A, narrow). All coworker tiers closed; awaiting a human maintainer merge. One reflection follow-up (used:0) routed to slang-triager."
metadata:
  node_type: memory
  type: project
  title: slang#12349 — Vulkan ParameterBlock omitted from pipeline layout (root cause in slang-rhi)
  tags:
    - slang
    - slang-rhi
    - vulkan
    - reflection
    - live-chain
  originSessionId: 8f2e4a91-6b73-4c15-9e08-3d1a7b5c2e64
---

# slang#12349 — Vulkan `ParameterBlock` omitted from pipeline layout

Filed 2026-08-04 by `ccummingsNV` (MEMBER). Labels `reflection` + `Vulkan` (+ later `RTR`), Type=Bug.
Issue <https://github.com/shader-slang/slang/issues/12349>, left OPEN deliberately so a maintainer can
mirror it to slang-rhi.

## Verdict — root cause in slang-rhi, not the Slang compiler

Slang's SPIR-V and its reflection agree with each other. Mechanism (slang-rhi source): with an
ordinary entry-point `uniform`, the entry-point type layout reports one descriptor set whose ONLY
range is `PushConstant`. `_addDescriptorRangesAsValue` (`vk-shader-object-layout.cpp:74-83`) skips
only **zero**-range sets, so it mints a real `DescriptorSetInfo` that gets an **empty**
`VkDescriptorSetLayout` (second pass skips `PushConstant` at `:104`). `findOrAddDescriptorSet`
(`:8-22`) assigns indices by **insertion order**, so the phantom set takes index 0 and the
`ParameterBlock`'s real set lands at `pSetLayouts[1]` while SPIR-V says set 0 ⇒
`VUID-VkComputePipelineCreateInfo-layout-07988`, then `VUID-vkCmdDispatch-None-08114`, silent
no-write. The push-constant-as-descriptor-range reflection is **intentional in Slang**
(`slang-reflection-api.cpp:2582-2590`; app/renderer filters it) ⇒ changing Slang (approach C) is
rejected.

Symptom + mechanism are both **measured**, not just source analysis: a new test (global
`ParameterBlock` + entry-point `uniform`) gives `vulkan FAILED` while `cuda`/`wgpu` PASS on the same
tree (built-in cross-backend control), reproduced on an L40S and again on an RTX 5090 in CI. Toggling
only the fix predicate on one tree flips `setLayoutCount` 3→2, drops the phantom `bindingCount=0`
own-set, and turns the test green — a discriminating toggle, since *any* `pSetLayouts` reorder would
also go green. ⛔ The `layout-07988` VUID **text** itself is still unobserved (no validation layer
installable in the fixer container); the reporter has debug layers to close that last link.

## Fix — slang-rhi#810 (approach A, narrow), scoped to this instance

Skip a first-pass reflected set whose ranges are ALL `BindingType::PushConstant`. +97/−0 over 4 files,
only ~+20 behaviour (one file-static `_isPushConstantOnlyDescriptorSet` + one `continue`); rest is the
missing regression test. Head evolved `b66ebd0` → `10f31e2` → **`ca9dad3`** (current): `ca9dad3`
reverts an interim assert and instead **passes the range count as a parameter**
(`_isPushConstantOnlyDescriptorSet(typeLayout, i, descriptorRangeCount)`) so the guarded value and the
checked value are the same local ⇒ divergence is structurally impossible. Approach B (make space→set
authoritative) is a rework, not a patch; `jvepsalainen-nv` reached the same mechanism from a different
trigger on slang#10959 and prefers padding — a live design alternative if a maintainer wants it.
Precedent for A: slang-rhi#676 already special-cased the push-constant-shaped raygen entry-point.

## Review — APPROVE_WITH_NITS, 0 bugs (nothing posted to GitHub; not authorized)

3 independent reviewers + the reviewer's own pass; Devin (B) **quarantined as an echo** (its "AI
Analysis" is the PR body scraped verbatim). Their convergence is informative *because each dissented
somewhere* — agreement is not corroboration when one author wrote both sides. G1 was adjudicated by
measuring a **third** thing: shapes A/B carry 2 root own-sets pre-fix, violating
`SLANG_RHI_ASSERT(getOwnDescriptorSets().size() <= 1)` (`vk-shader-object.cpp:673`, no `NDEBUG`
guard ⇒ release aborts too), so they abort pre-fix and the fix strictly improves them (2→1). **One nit
open by design:** `descriptorRangeCount == 0 → return false` is dead (caller short-circuits); 3
attempts to improve it failed — leave it unless a maintainer asks. Never let "APPROVE_WITH_NITS" read
as "all nits closed": 5 of 6 asks discharged, ONE open.

## State — all coworker tiers CLOSED; awaiting a HUMAN maintainer

- `kaizhangNV` is assignee on both slang#12349 and slang-rhi#810 and the sole requested reviewer on
  #810 (deliberate human routing; the auto-assigned `szihs`/`skallweitNV` requests are gone).
- **#810 is still a DRAFT** and that is what the maintainer is looking at (slang-rhi's `pull_request`
  matrix runs on drafts, so CI genuinely ran — no "draft ⇒ skipped" hazard). ⛔ Promotion to
  ready-for-review is **human-gated** — the fixer was told NOT to convert it. If `kaizhangNV` asks
  for promotion, that routes to Main → operator for the authorization call.
- Delta-review artifacts persist on the reviewer's filesystem (`/workspace/agent/review-810/`,
  worktrees at `b66ebd0`/`10f31e2`); evidence logs on the fixer's fs
  (`/workspace/agent/evidence-12349/`, `send_file` on request). **Delta-review against `ca9dad3`,
  not the earlier heads.**

## Live re-open — `kaizhangNV` reflection follow-up (routed to slang-triager)

Comment `5269806618` to `@nv-slang-bot`: *"the analysis doesn't explain why reflection says
`output.count` is `used: 0` … investigate further?"* Triage established `used:0` is **non-diagnostic**
(identical in failing + working control); the maintainer asks the NEXT question — why is it `0` when
SPIR-V demonstrably uses the descriptor? Routed to **slang-triager** on the canonical thread with
`<github-post-authorized />` (a real bot mention). Almost certainly a **Slang-compiler reflection**
question (the `used` bit is compiler-computed), likely orthogonal to #810 — but that is the triager's
to *measure*, not assert; if it is a genuine Slang reflection defect it is a new slang-side finding and
Main routes any fix.

## Second defect in the same file (NOT #12349's cause)

`addBindingRanges` stores `setOffset = getDescriptorSetSpaceOffset(...)` — a **space** value where a
**physical** index is expected (HEAD `:406`, consumed at `vk-shader-object.cpp:436`; unfixed ~3 months).
`wgpu-shader-object-layout.cpp` likely needs the same treatment.

## Durable cautions (re-earned here)

- ⛔ `slangc -v` prints the **stale configure-time** version string (printed `2026.13.1-50-…` for a
  HEAD build) — judge freshness by object mtime vs HEAD commit date, never `-v`. Version-matched
  triage costs ~1 min via the official release download.
- ⛔ **Read the device line, never the exit code:** `slang-rhi-tests -check-devices` prints
  `not supported` and still **exits 0**, so a green job is consistent with a skipped backend.
- ⛔ A CI check-run set on an OPEN PR is a **growing population**, not a fixed property of the sha —
  quote it only with an as-of stamp, never as "N/N green" (`filter=latest` does not help; re-runs of
  the same name are all retained).
- ⛔ **CLA two-identity gate:** [[feedback_two_nv_slang_bot_identities_cla_gate]] — App `274397474`
  (signed) vs User `286953280` (unsigned). Test `any(.author.id == 286953280)` over ALL commits; a
  HEAD-only/`[0]`-only probe returns a false clean. `license/cla` lives only on `commits/{sha}/status`,
  not `check-runs`, and the required-context set differs per repo (slang `master` has no `license/cla`
  at all). Never suggest merging past a compliance check; ⛔ never auto-close/flip a PR —
  [[feedback_github_writes_operator_authorized]].
- ⛔ `setOffset` sat at `:406`/`:426`/`:441`/`:445` across four heads in one evening ⇒ **cite the
  symbol with the ref beside it; a line number is not an identifier.**

## RESUME triggers

- **#810 MERGES** → slang-triager re-reads the merged diff and refreshes verdict comment `5185094751`
  **in place** (never a new POST); the mechanism is then no longer source analysis.
- Reporter reruns `repro.py` with debug layers → closes the VUID-text link (worth one line).
- A maintainer prefers space-authoritative (B) → a rework, new dispatch (not a patch).
- **Any fresh substantive human comment** on #12349 or #810 → re-open on the canonical thread; a bot
  comment is not an inbound.
- slang-rhi#739 revives (`jvepsalainen-nv`, stale since 2026-06-02) → it rewrites this exact function
  ⇒ expect textual conflict; whoever holds #810 rebases.

Lessons this chain produced: [[slang-evidence-lessons-index]] (passing controls certify the
instrument never the coverage; enumerate surfaces not just controls; a true conclusion launders its
evidence *and* its mechanism — reproduce before writing it down; a relayer cannot feel which words
were load-bearing, so correcting a distortion of your own position is the originator's job).
