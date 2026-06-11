# Issue-chain supervisor — 2026-06-02 06:31Z (06:30 cron fire)

Verified against live GitHub + `ncl sessions list` + `list_tasks` + `df`. Not relayed from prior prose.

## In-flight chains (11 tracked; 8 with live sessions, 3 with aged-out sessions but live issues/PRs)

| repo / issue | last activity (UTC) | state | observability | action |
|---|---|---|---|---|
| slang **#11399** | ~06:35 (building) | IN-PROGRESS — fixer building `wt-slang-11399`/`fix/issue-11399`, ETA ~20m | 2 triage comments live | leave; **dup-watch** (manual `fix/issue-NNNN` pattern) |
| slang **#11339** | 06-01 14:08 (~16h) | AWAITING_HUMAN — @jkiviluoto-nv sign-off (reversal of #11302) | proposal comment live | leave (2 nudges used) |
| slang **#11356** | 06-01 10:30 (~20h) | SHIPPED — PR #11389 (Closes #11356) | PR links issue | leave |
| slang **#11366** | 06-01 13:04 (~17h) | HANDED-OFF — needs org-GHCR-admin (@jkiviluoto-nv, #5077) | handoff comment live | leave |
| slang **#11367** | 06-02 06:11 (~20m, running) | DUP PAIR — #11386 draft / #11394 ready | both link Closes #11367 | escalated 03:37Z (pending) |
| slang **#11370** | 06-02 06:10 (~21m, running) | DUP PAIR — #11371 draft / #11397 ready | #11397 links Fixes #11370 | escalated 03:37Z (pending) |
| slang **#11372** | 06-02 06:13 (~18m, running) | SHIPPED — PR #11373 (Closes #11372) | author ack + PR link | leave (heartbeat) |
| slang **#11374** | 06-02 02:58 | DUP PAIR — #11387 draft / #11377 ready | both link Fixes #11374 | escalated 06:11Z (pending) |
| slang **#11375** | 06-01 13:44 | DUP PAIR (wrinkle) — #11379 draft / #11398 ready | both link #11375 | route to fixer before close |
| slang-rhi **#762** | 05-30 10:26 (~2.9d) | SHIPPED — PR #765 (Fixes #762) | PR links issue | leave |
| nanoclaw **#511** | 06-01 11:07 (~19h) | SHIPPED — PR #522 (Fixes #511) | report_pr_created done | leave |

## Findings

**1. #11399 "disk block" was a FALSE PREMISE (corrected this run).** Earlier `df /workspace` readings (124G / 4.9G free, /dev/vda1) measured the *shared* volume, not the build path. Builds write to `/workspace/agent` → **/dev/vdb, 82G free (66%)**. Fixer is unblocked and building. A disk-recovery guard task I briefly created (`task-1780382432985-p3riyy`) this run was based on the wrong mount and is **cancelled**.

**2. 4 confirmed duplicate PR pairs (DEGRADED driver).** Each: a no-reviewer **draft** `fix/issue-NNNN` shadowing a reviewer-assigned **ready** `dev/slang-fixer/*` (or `fix-NNNN-*`) PR with the same fix. Likely cross-path duplication (manual draft on top of the automated fixer pipeline).
- #11367 → close draft #11386, keep ready #11394 *(clean)*
- #11370 → close draft #11371, keep ready #11397 *(clean)*
- #11374 → close draft #11387, keep ready #11377 *(clean)*
- #11375 → **wrinkle**: draft #11379 carries `desc-handle-4.slang` + `gh-11375.slang` tests that ready #11398 lacks. Route to slang-fixer to port those tests into #11398 **before** closing #11379, or that coverage is lost.

Already escalated to operator (03:37Z for 3 pairs, 06:11Z for #11374). Still pending. **Not re-fired this run** (avoid escalation loop).

**3. 2 `wirings-delete` approvals pending** in operator queue (self-wiring-loop fix): `mga-a2a-1779282325777-xwq2la`, `mga-a2a-1779427209799-0vxodq`.

## Health

0 silent/stuck chains. 0 observability gaps (every human-visible state has a live GitHub comment or a linked PR). 0 nudges needed. 0 new escalations this run.
