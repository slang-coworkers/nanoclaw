---
title: "[approver/challenger-miss] I named metal-buffer.cpp as the bug site when it is the CONTRAST case — the Vulkan defect is pre-existing and merely newly reached, and #1090 is not an instance of a gitlink hiding a bug"
type: learning
topic: review-approval
source: learnings/1785939319520-approver-challenger-miss-i-named-metal-buffer-cpp-.md
---

# [approver/challenger-miss] I named metal-buffer.cpp as the bug site when it is the CONTRAST case — the Vulkan defect is pre-existing and merely newly reached, and #1090 is not an instance of a gitlink hiding a bug

## Correction

Amends a detail I volunteered onto
`[approver/clause-gap] CORRECTION: the 13 paths external/** uniquely protects contain
zero .yml…`. The membership facts there are verified. The embellishment was wrong, and
wrong in the direction that inverts the causal story.

I wrote that `src/metal/metal-buffer.cpp` — one of the 13 paths uniquely protected by
`external/**` — is "the file the BLOCK's own `fixupBufferDesc` evidence was read from,"
offering it as a direct demonstration of D3's compiled-source exposure.

## Ground truth

The differential evidence lives in **two files with opposite roles**:

| file | role | in the bump? |
|---|---|---|
| `src/vulkan/vk-buffer.cpp:441-456` — **missing** `fixupBufferDesc` | **the bug** | **NO** |
| `src/vulkan/vk-utils.cpp:419` — `SLANG_RHI_ASSERT(src)` that aborts | **the crash** | **NO** |
| `src/metal/metal-buffer.cpp:141` — **has** `fixupBufferDesc` | **the contrast** (why Metal passes) | yes |

Verified: `src/vulkan/**` contributes **zero** files to the `1a976874 → 11eefdc6` bump.
And `createBufferFromNativeHandle` is present in `src/vulkan/vk-buffer.cpp` at the **old**
sha as well as the new one.

So the Vulkan defect is **pre-existing in slang-rhi and newly *reached***, not introduced
by this bump — slangpy newly exposed `create_buffer_from_native_handle` to Python, which
made an existing gap reachable. `metal-buffer.cpp` appears in the bump precisely *because*
it is the backend that calls `fixupBufferDesc`, i.e. the reason Metal passes.

I picked the file that proves the opposite of what I claimed it proved.

## Cost to the worked example — be strict about this

D3's compiled-source exposure remains real: 5 `src/metal/*` + 5 `tests/*` files genuinely
compile into slangpy and were reviewed under a "220 lines / 7 files" tally against 608
real lines. **But #1090 is NOT an instance of "a gitlink hid the bug."** The bug was in
source readable directly at either sha, found by reading it. **D3 stands on the
size/attention undercount alone.**

This matters because a worked example that claims concealment it doesn't demonstrate is
exactly what a re-tightening owner would lean on and then find hollow. Overstating the
example damages the real finding.

## Mechanism — state 5, on the conclusion I'd have most trusted

This is the pattern from the prior note firing again: **structural conclusion right,
supporting membership narrated from expectation rather than the executed result.** Four
tabulated instances now — sole-guard/which-paths, blindness/which-glob,
asymmetry/which-file, and this one, exposure/which-role.

The specific hazard here: when a differential finding's evidence spans a *failing* case and
a *passing* case, "the file the evidence came from" is ambiguous between them, and choosing
wrong inverts cause and control. `metal-buffer.cpp` was in my working memory as central to
the analysis — true — and I converted centrality into *bug site* without checking which
side of the differential it sat on.

Generalizable: **name the role, not just the file.** In any differential/contrast argument,
label each cited path `bug | crash | contrast | control` before asserting anything about it.

## How to catch it

```bash
# is the suspect file even in the change under review?
gh api repos/<sub>/compare/<old>...<new> --jq '[.files[].filename]' | grep -F <path>
# did the allegedly-new code exist at the old ref?
gh api repos/<sub>/contents/<path>?ref=<old> --jq '.content' | base64 -d | grep -c <symbol>
```

Two cheap queries settle "introduced vs merely reached," and that distinction decides
whether a finding is a regression in the diff or a pre-existing gap the diff exposes — a
materially different thing to tell an author.

Remedy unchanged and now four-for-four: **print the per-item result, never describe it.**
Being right about the finding is not a warning sign; it is the license.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785939319520-approver-challenger-miss-i-named-metal-buffer-cpp-.md`_
