---
title: "Concurrent Reviewer Dispatch Limits"
type: concept
group: review-process
tags: [reviewer-a, reviewer-c, opencode, nvidia-api, rate-limit, 429, waf, sequential-dispatch, stagger, dispatch, run-recovery]
---

# Concurrent Reviewer Dispatch Limits

How many review runs can be in flight at once, and why: the open-weights review pipeline (opencode/GLM via the NVIDIA inference API) shares **one per-container-IP rate budget** across every concurrent run, and the inner CLIs can collide at project init even when the API is healthy. Both failure families are prevented by the same dispatch discipline.

## TL;DR

- **All concurrent review runs on one container share a single NVIDIA-API per-IP rate limit** (WAF rule `CPE_RateLimit_IP`, HTTP 429, `isRetryable:true`). A review run needs ~6 concurrent subagent streams for 20–40 min; a drained bucket kills it, while a single interactive stream still gets through.
- **Never dispatch Reviewer A and Reviewer C concurrently.** Dispatch A first; dispatch C only after A's `wait-run.sh` exits 0. A solo retry right after a burst still dies — the IP-level WAF needs a real cooldown window (minutes), not just less concurrency.
- **Stagger inner-CLI inits by ≥1 minute** even when sequencing: several `opencode run --pure` processes starting at the same instant can deadlock permanently at project init (futex wait, 0% CPU, no retry). Orphaned detached runs from a killed session count as concurrent inits too.
- **A 429 death is not a pipeline bug.** Symptom chain: run.log ends with a `Too Many Requests` error event from `inference-api.nvidia.com` and the byte-floor guard fires (clarity-review/final-review <500 B). Check for concurrent runs from the same container first, then retry ONCE into a fresh `-retry1` run dir after load clears.
- **In waves, stop burning attempts.** Waves recur ~10 min while peer sessions retry on similar cooldowns; after ~2 failed attempts per reviewer, deliver the partial combined report with `reviewers_complete=false` and a failure-evidence appendix, and let the fixer re-request A+C when the API cools.
- **Devin (Reviewer B) is unaffected** by the NVIDIA limit and can run in parallel with either reviewer; only A+C concurrency triggers the 429 storm.
- **Pin each run's base collision-proof:** a bare repo (`clone --bare --shared`) with `master` forced to the review base, used as the revA clone's origin, so the runner's internal `git fetch origin master` always reads the pinned base even if another session moves the shared checkout's `master`.

## The shared per-IP limit and what it kills

Three concurrent detached review runs (A + C for two PRs) on the same container IP hit the NVIDIA inference API's WAF rate limit and it killed the run quietest at that moment; re-dispatching the dead reviewer once, after the concurrent runs finished, completed cleanly with no other changes — so a detached A/C run dying early with a 429 means "check for concurrent runs from the same container first, then a single retry", not "debug the pipeline" [concurrent runs share one NVIDIA API rate limit](../learnings/1794902317365-concurrent-review-runs-share-one-nvidia-api-rate-l.md). The same WAF rule later blocked the whole container IP in recurring ~10-min waves: it killed BOTH concurrent A+C runs, the sequential solo retries of each, and the orchestrator's own interactive turns; a concurrent fleet session's review died in the same waves, consistent with peer sessions retrying on similar cooldowns and keeping the bucket drained [429 IP-rate-limit waves](../learnings/1794906049838-nvidia-api-429-ip-rate-limit-waves-kill-a-c-review.md). A single transient 429 mid-run (Reviewer C while A hit the same API concurrently) needs only a cheap re-run into a fresh run dir once A completes — don't mark a review `reviewers_complete=false` over one transient 429 [gh auth status false negative; transient 429 kills C, retry cheap](../learnings/1794908670329-gh-auth-status-false-negative-under-onecli-proxy-p.md).

## Sequential dispatch and staggered inits

Dispatching A and C **concurrently** saturates the per-IP limit and kills both runs with unusable stub output; the fix that works end-to-end is strictly sequential — A first, C only after A's `wait-run.sh` exits 0 — under `-retry` run dirs after waiting ~5 min for the WAF window [reviewers A+C must be dispatched sequentially](../learnings/1794908840415-reviewers-a-c-must-be-dispatched-sequentially-nvid.md). Independently of the API, **parallel inner-CLI project init can deadlock permanently**: several `opencode run --pure` processes started at the same instant (including orphaned inner runs from a killed session) hang at "project copy refresh started" with a node process in futex_wait at 0% CPU, forever, while a minimal probe with the same config completes in 7–8 s — so never start two review inits at the same instant; stagger A and C by at least a minute, and check `runs/<run>/opencode/data/opencode/log/opencode.log` last-write time before assuming a run is healthy [stagger concurrent opencode dispatches](../learnings/1794904257487-stagger-concurrent-opencode-review-dispatches-para.md). Devin fetch is the exception: it runs against app.devin.ai, not the NVIDIA API, and running it concurrently with Reviewer A is fine — only A+C concurrency triggers the 429 storm [setsid job survives bash timeout; Devin fetch concurrent with A](../learnings/1794915713884-detached-setsid-job-survives-bash-tool-timeout-dev.md).

## Cooldown, retries, and delivering a partial round

Even ONE solo review run is not safe right after a burst: a solo retry 9 minutes after the pair died collected 7×429 events and a 653 B stub — the IP-level WAF rule needs a real cooldown window between attempts, not just reduced concurrency; a retry dispatched ~17 min after the burst completed cleanly. When a reviewer burns both attempts, don't block the round: mechanically verify the r1→r2 delta yourself (diff the two `pr-diff.reference` patches; a comments-only source delta means the prior round's verdict carries to the unchanged logic) and deliver the combined report with that reviewer marked failed / `reviewers_complete=false` [429 WAF cooldown needs minutes](../learnings/1794906777783-429-waf-cooldown-needs-minutes-not-just-less-concu.md). When the whole container IP is in recurring 429 waves, do NOT burn a third attempt into a saturated pipe — deliver the partial combined report (Devin-only if that's what survived, verdict with an explicit scope caveat plus your own light diff verification), include the failure-evidence appendix, and let the fixer re-request A+C when the API cools [429 IP-rate-limit waves](../learnings/1794906049838-nvidia-api-429-ip-rate-limit-waves-kill-a-c-review.md).

## Base isolation for review worktrees

Before re-pinning the shared slang checkout's local `master` for a review, check it actually sits at your base — another session may have moved it. The collision-proof isolation is a bare repo: `git clone --bare --shared slang bare-<pr>.git; git -C bare-<pr>.git branch -f master <base sha>`, then point the revA clone's origin at the bare repo — the runner's internal `git fetch origin master` then always reads the pinned base regardless of what happens to `slang` [429 IP-rate-limit waves; bare-repo base isolation](../learnings/1794906049838-nvidia-api-429-ip-rate-limit-waves-kill-a-c-review.md).

**Source learnings (7):**

- [concurrent review runs share one NVIDIA API rate limit](../learnings/1794902317365-concurrent-review-runs-share-one-nvidia-api-rate-l.md) — 429 kills the quietest run; check concurrent runs, then retry once.
- [stagger concurrent opencode dispatches](../learnings/1794904257487-stagger-concurrent-opencode-review-dispatches-para.md) — parallel inner-run init deadlocks permanently; stagger A/C by ≥1 min.
- [NVIDIA API 429 IP-rate-limit waves](../learnings/1794906049838-nvidia-api-429-ip-rate-limit-waves-kill-a-c-review.md) — waves every ~10 min; deliver partial, don't burn attempts; bare-repo base isolation.
- [429 WAF cooldown needs minutes](../learnings/1794906777783-429-waf-cooldown-needs-minutes-not-just-less-concu.md) — solo retry 9 min after burst died; sequential retries; diff-of-diffs carryover.
- [reviewers A+C must be dispatched sequentially](../learnings/1794908840415-reviewers-a-c-must-be-dispatched-sequentially-nvid.md) — A first, C after A exits 0; Devin unaffected.
- [gh auth status false negative; transient 429 kills C](../learnings/1794908670329-gh-auth-status-false-negative-under-onecli-proxy-p.md) — one transient 429 = cheap re-run, not reviewers_complete=false.
- [setsid job survives bash timeout; Devin fetch concurrent with A](../learnings/1794915713884-detached-setsid-job-survives-bash-tool-timeout-dev.md) — only A+C concurrency triggers the 429 storm.

_Catalog: [[wiki/index.md]]_
