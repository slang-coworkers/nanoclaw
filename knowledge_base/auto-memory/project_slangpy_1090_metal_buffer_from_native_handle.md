---
name: project_slangpy_1090_metal_buffer_from_native_handle
description: "slangpy#1090 (fknfilewalker) Device::create_buffer_from_native_handle for Metal buffer import — dispatched to slangpy-pr-approver 2026-08-03; RESUME = approver verdict"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5754d86f-28be-4bc7-a9a6-f2d1ad4c313d
---

# slangpy#1090 — `Device::create_buffer_from_native_handle` (Metal buffer import)

- **Repo/PR:** shader-slang/slangpy#1090 · https://github.com/shader-slang/slangpy/pull/1090
- **Author:** `fknfilewalker` (**non-bot human contributor** — not a bot-echo park)
- **Inbound:** `kind: webhook`, `content.event = github.pr_ready_for_review`, `reason = opened` (opened non-draft), 2026-08-03.
- **Routing:** dispatched to **`slangpy-pr-approver`** via `mcp__nanoclaw__send_message`, thread
  `gh-issue-shader-slang/slangpy-1090`, trailer byte-exact
  (`<github-post-authorized />` / `REPO=` / `PR=1090` / `MODE=pr-approve`).
  Per [[feedback_webhook_dispatch_by_event]] a reviewable event goes to the
  `*-pr-approver` ONLY — never a reviewer/fixer. No 👀 posted (no triggering
  comment on a reviewable event); **I did not and must not post on this PR** —
  see [[feedback_approver_never_posts_route_reviewer]] for who carries the
  GitHub footprint if the approver's verdict needs publishing.

## State — verdict in (2026-08-03)

**`ABSTAIN_POLICY` (`OPEN_GAP`)** @ head `5c384a20b11b`, policy
`v0-shadow-relaxed`, mode `live`. Ledger row written; **nothing posted to
GitHub** (correct — [[feedback_approver_never_posts_route_reviewer]]).
Clauses 6/6 pass, **0 🔴 bugs**; CodeRabbit's lone 🟡 cleared as pre-existing.
115 lines / 6 files; bumps `external/slang-rhi` → `11eefdc6` (= slang-rhi#801).

Two gaps, both **approver's findings — I have not read the slangpy diff**:
- **G1** the new `create_buffer_from_native_handle` has **zero executing test
  coverage at any slangpy layer** (none added, none pre-existing); macOS CI only
  **builds** it. Failure mode is GPU memory corruption — i.e. the gap is on
  exactly the property the PR exists to provide.
- **G2** Python-reachable on Vulkan/D3D12, which type-check but never
  size-check. Pre-existing upstream; **first exposed** here.

**MINE-VERIFIED (REST, anonymous, 200):** the prior "test masked to
`D3D12 | Vulkan`, Metal-only code never run on Metal" gap **is** fixed at the
pinned commit — `tests/test-buffer-from-handle.cpp:6` at
`11eefdc6a2c0bb5295fd8f6fde33cd29942f477d` reads
`GPU_TEST_CASE("buffer-from-handle", D3D12 | Vulkan | Metal)`. Commit is
`fknfilewalker`'s own "Implement native Metal buffer import (#801)".
⚠️ **That is REGISTRATION, not EXECUTION** — rhi `ci.yml` at the same commit runs
macos-aarch64 on **`runs-on: macos-latest`** (lines 48-49), the paravirtual
runner, which is precisely the configuration that **skips** Metal GPU tests
(cf. rhi#802's `OPEN_GAP`, [[feedback_green_job_skipped_backend_zero_coverage]]).
So "the mask now includes Metal" does **not** establish Metal coverage upstream,
and G1 stands undiminished. I did **not** open an rhi CI log to confirm the skip.

## Verdict on the verdict

The abstain is **calibrated**, not timid — same shape as rhi#802, where a human
Metal maintainer independently filed CHANGES_REQUESTED from the identical
zero-execution-coverage premise. No action from me on the review itself.

## RESUME triggers

- ✅ Approver verdict received 08-03 → rolled up to operator.
- **Human maintainer reviews G1/G2** — the named next-action. A non-bot review
  or comment is the resume signal.
- A `synchronize` webhook lands → **debounce the re-run, never the inbound
  scan** ([[feedback_debounce_approver_dispatch_deterministic_abstain]]): check
  head SHA moved, `compare/<decided>...<new-head>` file scope, **and** scan
  `pulls/1090/reviews` **plus** `issues/1090/comments` **plus**
  `pulls/1090/comments` for non-bot input
  ([[feedback_inbound_scan_must_cover_issue_comments_not_just_reviews]] — a
  blocking directive can arrive as a plain issue comment and a review-state
  predicate cannot fire on it).
- A non-bot comment on a chain I've closed **re-opens it** — my prior position
  is a position, not a reply.

## Notes / adjacency

- Metal + native-handle import touches the same surface family as the held
  Metal chains ([[project_10842_metal_descriptorhandle_runtime]],
  [[project_11970_metal_bindless_msl]]) and the CI-runner coverage trap: a green
  slangpy job with the Metal backend skipped is **zero** executed coverage
  ([[feedback_green_job_skipped_backend_zero_coverage]]). If the approver
  approves on "CI green", that premise needs the runner checked, not the job
  conclusion.
