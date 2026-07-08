---
name: project_11924_miniz_alloc_wrappers
description: "#11924 miniz alloc-wrapper hardening — PR #11934 maintainer-APPROVED, held draft, awaiting ready-flip"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0f097fc1-4ed3-4045-8790-f92f9fed0d91
---

shader-slang/slang#11924 (pdeayton-nv): Slang freed miniz-owned buffers via `ScopedAllocation`'s `::free`/`::realloc` instead of miniz's matched allocator. Latent/benign today (Slang installs no custom miniz allocator → `MZ_FREE`≡`::free`); real heap corruption only if miniz's allocator is ever reconfigured. Triaged Bug/low/P3/core; verdict posted (comment 4872967859), Type=Bug.

Fixer shipped **draft PR #11934** (+33/−7, 2 files). Three sites now freed with their producing allocator: `mz_free` for the global-heap deflate buffer; the archive's own `m_pFree` callback (NOT blanket `mz_free`) for the two zip finalize buffers — codex caught the zip buffers are archive-per-instance-callback-owned. `ScopedAllocation` unchanged. 7/7 compression+zip unit tests PASS; no new test (byte-identical under default/only allocator). `report_pr_created` confirmed → #11934 webhooks route to the fixer session.

**State (07-07):** jkwak-work APPROVED (pullrequestreview-4647807673, clean, no changes) at 18:17, then **flipped #11934 ready_for_review himself** (timeline `ready_for_review` actor=jkwak-work 18:17:31Z — VERIFIED, maintainer not bot; gate intact). Fixer did NOT flip (its 18:19 "stays draft" report was pre-flip/stale; triager's 18:22 non-draft report is current). PR now `draft:false, mergeable:true, mergeable_state:behind` (branch behind master), authored nv-slang-bot, `Closes #11924`. CI 12 pass / 45 skipped / 1 pending. Public trail on the PR (non-draft + Closes + fixer PR-opened comment #4873873479) → no separate issue post needed.

**07-07 19:41:** fixer rebased fix/issue-11924 onto master (head now `95e85a6a6b`, clean, diff intact) after CI-failure webhook — triaged the 2 failures as flake+stale-base NOT regression (15 platforms green; LLVM link-synthesis test + Metal gfx-unit flake don't touch compression/zip; sole caller = slang-artifact-container-util.cpp). **jkwak's APPROVED review SURVIVED the force-push (verified — not dismissed).** PR now `mergeable_state:blocked` = fresh CI pending on rebased head, self-resolving; fixer watching, will `gh run rerun --failed` (≤3×) if same flakes recur. Precedent: force-push rebase did NOT dismiss the maintainer approval here.

Parked awaiting merge — **bot-merge operator-gated, don't enqueue.** Rebase/force-push to fix/issue-* is a code push (not gated); fixer owns it. Re-engage only on a real inbound (merge, substantive human comment, or stall). **Why on the who-flipped check:** a non-draft bot PR is only fine if a MAINTAINER flipped it — always verify the `ready_for_review` actor before assuming breach vs. legit. See [[feedback_drafts_only_guardrail]], [[feedback_github_writes_operator_authorized]].
