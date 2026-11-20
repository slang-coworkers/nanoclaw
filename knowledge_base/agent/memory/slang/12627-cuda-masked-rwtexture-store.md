---
type: chain
title: slang#12627 — CUDA/PTX component-masked RWTexture2D store emits a subscript on CUsurfObject
description: jkwak-work chose the error route 11-17 (his direction comment + the fixer's scope comment were later DELETED from #12627 — the fixer's plan file is the only verbatim record). PR #13363 (warning+RMW) superseded but left open; evening R10/R11 round at head 02ac46bc3, CI verdict pending. Open: his target-set answer (CUDA-only vs all four non-native targets), expected on the PR R10 thread (auto-routed). New error-route PR starts on that answer. Follow-ups #13361/#13362/#13364/#13365. Full dated log in the _history sibling.
tags: [slang, cuda, ptx, rwtexture, legalize-image-subscript, awaiting-maintainer]
---

# slang#12627 — CUDA masked RWTexture store (draft PR #13363)

Assignee and PR shepherd: jkwak-work. Fixer session `sess-1787171888548-4gv6cq` (thread `gh-issue-shader-slang/slang-12627`).
Reviewer session `sess-1790828246458-ehy88h`. My origin session is `sess-1787170935547-1z63sa`.

## Current state (2026-11-18; full dated log → [[12627-cuda-masked-rwtexture-store_history.md]])

- **Decision (11-17 18:56Z, [6957871930](https://github.com/shader-slang/slang/issues/12627#issuecomment-6957871930)): jkwak-work chose the error route** — partial texel writes become a compile-time error on targets without native component-wise write support; "please make a new PR based on this direction". ⚠️ He later DELETED that direction comment and the fixer's scope comment (6957896119) from #12627 — **the fixer's plan file is the only verbatim record of the R9 direction** (the issue's last remaining comment is 6957554370).
- **PR #13363 (E56116-warning + RMW) is superseded but stays open untouched** (jkwak-work's call). Evening R10/R11 round done and pushed, head **`02ac46bc3`** (5ea7e2fde removed the E56116 warning emission, its diagnostics.lua entry, its CHECK pairs and the doc sentence; cc4a9c10d removed the hlsl.meta.slang comment blocks — file byte-identical to master; jkwak-work merged master himself as `855be00d5`, the fixer merged his merge, no rebase). Tests 24/24 + GPU CUDA runtime green; all three critique stages approve; explanation comment + PR description refreshed. **CI verdict on `02ac46bc3` pending by webhook.**
- **Open: the target-set answer** — CUDA-only error vs error on all four non-native targets (Metal/GLSL/SPIR-V long shipped RMW via legalizeImageSubscript; the latter is a breaking change). Re-asked on the PR R10 thread (discussion_r4606278482, acked) which auto-routes to the fixer via pr-mappings. **New error-route PR starts on that answer** (fixer dispatched plan→implement, likely reusing #13363's machinery inverted; instructed to ask jkwak-work directly if target-set or layered/converting-case scope is ambiguous, NOT to close #13363, and to call report_pr_created).
- #13363 `ready_for_review` webhook was NOT forwarded (slang-pr-approver paused=1): queued for pinned re-dispatch on unpause in `data/approver-pause-queue.md`, with the supersession caveat that the error-route PR may replace #13363 first.
- Fence/coherency question answered ([6957554370](https://github.com/shader-slang/slang/issues/12627#issuecomment-6957554370), verified live): no CUDA fence repairs same-launch surface reads.
- #13363's diagnostics history: E56006–E56008 → E56020–E56022 (master #13116 took the first range; #14269's `exit-code=-1` unions) → **E56116–E56118** (master's resource-selection warnings took 56020/21 on the 11-17 master merge). E56117 (conversion unavailable) / E56118 (unspelled shape) errors stay in the PR; both cover cases that already failed in nvrtc, so no working code breaks.

## Follow-ups (bot-filed, human-owned, not dispatched, `doNotNudge` in supervisor-state.json)

Maintainers triaged all four on 10-05 (re-checked 10-09/10-12/10-15: unchanged) — assigned owners and milestones; a follow-up a human owns is not dispatched unless that assignee or the operator asks.

- #13361 WGSL, same root cause. Owned by jkwak-work, Q4 2026.
- #13362 `+=`/`++`/`inout` on a texel. jhelferty-nv assigned it to **jvepsalainen-nv** (no milestone).
- #13364 unify the CUDA surface spellings. jkwak-work self-assigned, Q1 2027. Waits for #13363 to merge.
- #13365 C++/CPU `*(tex[coord]).w` compile failure. jkwak-work self-assigned, Q4 2026.

## Lessons

- **When a gating belief is corrected, sweep every parked ask, and search for the chain-specific wording.** The 10-20 sweep withdrew five "close our draft / post a verified comment" asks, but #12627 was phrased as "may the fixer merge and post", so the sweep missed it. It stayed parked 3 more days. Parked asks that include "may X push/post" are the same class.
- **Reconciling with one sibling merge doesn't keep a draft clean.** Within 3h of the #13563 reconcile, #13537 touched the same helpers. When a draft parks for weeks, a re-chase should check `mergeable_state` and diff overlap against new master commits, not just the one PR it was told to watch.
- **"Round N started, ETA 30–40 min" followed by silence is a stall, not progress.** A reviewer session that restarts mid-run loses the merge step, and nothing re-fires it. A re-chase should check that the reviewer actually sent its verdict, not just that GitHub is unchanged.
- From a task session, `send_message` with `target_session_id` + canonical `thread_id` (with no `in_reply_to`, since the task session has no inbound) landed in the pinned fixer session on the first try (row 52, 2026-10-04 02:12Z).

**New dated entries go to the [[12627-cuda-masked-rwtexture-store_history.md|_history sibling]], not here** — this record holds current state only.
