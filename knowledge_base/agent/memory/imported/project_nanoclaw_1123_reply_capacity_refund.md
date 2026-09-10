---
name: project_nanoclaw_1123_reply_capacity_refund
description: "nanoclaw#1123 (F15, #920 follow-up) reply-capacity refund — reviewed INLINE by Main, MERGED mid-review after a synchronize; body claims all reproduced BY EXECUTION (14/14 head, 11/14 pre-fix); 1 real gap (timeout refunds a DELIVERED reply) + author's own two comments contradict on workflow-ref mechanism. Comment 5206024068. TERMINAL."
metadata: 
  node_type: memory
  type: project
  originSessionId: 7dd96f9b-b553-4a89-80d4-ae7b83b9038f
---

**slang-coworkers/nanoclaw#1123** — `fix(discord): a failed forward must not consume reply capacity (F15, #920 follow-up)`, author **szihs**, base **`nv-slang`** (NOT `nv-main` — author flagged this himself and he is right: `container/mcp-servers/` is **404 on nv-main**, present on nv-slang). Reviewed **INLINE by Main** per the standing rule ([[project_nanoclaw_pr874_webhook_route_approver]]) — nanoclaw-platform PRs never route to a slang/slangpy `*-pr-approver`. Comment **`5206024068`** via verb-split REST (`gh api .../issues/N/comments -X POST`).

**Two mid-review events, both handled without carrying the verdict:**
1. `synchronize` at 14:17:38Z → new head `45025479` (was `a0423413`), 4 files → 5, `UNSTABLE` → `CLEAN`. It added ONLY the `ci.yml` pathspec steps; **all 4 code blobs byte-identical across both heads BY HASH** ⇒ every measurement carried.
2. **MERGED 14:21:15Z** (`2e8015f5`, parents = `(dca75e66, 45025479)`) — merged tree == reviewed head **5/5 blobs by hash**.

## Verdict: correct, well-tested, holds up under execution

Reproduced in a venv with real deps (`aiohttp`/`discord.py`/`httpx`/`mcp`) against shallow clones of head AND base:
- new tests **14/14 pass** at head; **11 of 14 FAIL** on the pre-fix tree (3 passing = pure `reply_capacity` unit tests) — exactly as the body claims.
- pre-existing-failure claim **confirmed**: same 2 (`test_send_message`, `test_send_message_channel_not_found`) on base (`2 failed, 63 passed`) and head (`2 failed, 77 passed`) ⇒ delta +14 tests, 0 new failures.
- `is_final` refactor **verified equivalent BY EXECUTION** over all 0..15 (base `(count+1)>=CAP` pre-record vs head reserve-then-`charged>=CAP` on a live `ThreadState` ref) — easy fencepost, not shifted.
- Choosing (b) reservation-lifecycle over (a) increment-after-accept is right for the stated reason (atomic admission across the `await`).

## 🟡 The real gap I found: `posted == False` conflates *refused* with *unknown*

`_post_to_dashboard` returns `False` for non-200 **and any exception incl. its own 5s `asyncio.TimeoutError`**. Constructed an ingress that **accepts and records** then answers in 6s:
```
POST-FIX : reached ingress=4  charged=0/15  failed rows=4  {reply_pending:4, reply_failed:4}
PRE-FIX  : reached ingress=4  charged=4/15
```
⇒ 4 replies genuinely delivered, **0 charged**, 4 audit rows asserting "failed" in the log this PR makes authoritative. **Direction INTRODUCED, not inherited** — established only because I ran the base in the same scenario. Second shape, same root: TTL cannot distinguish "died before POST" from "POSTed then died before settling" ⇒ 15 delivered-but-unsettled aged past TTL → `charged()=0`, cap not enforced.
⭐⭐**Judged the trade rather than just reporting**: strictly less harmful than F15, and I argued explicitly AGAINST charging-on-timeout (would resurrect F15 for the common real outage). Honest fixes = third terminal state (`reply_unknown`) or POST idempotency key. Full lesson: `A refund on an unwitnessed outcome trades one leak for its mirror image` (shared learnings).

Nits: `_read_thread_state` 1→**3** full log re-reads per forward in slang-mcp `on_message` (3rd is purely to print the charge in `logger.info`; `state`/`is_final` already in hand) on a log with **no rotation anywhere in tree** (grep 0, control fired). `apply_event:126` conditional-expression-for-side-effect vs plain `if` in its sibling branch.

## ⭐⭐⭐ The author's two comments CONTRADICT and the wrong one licenses inaction

- comment `5205748524`: *"GitHub executes the workflow file from the base branch"* ⇒ *"not fixable from inside a PR that targets nv-slang."*
- comment `5205955369`: *"GitHub resolves the workflow from the PR's merge commit."*

**Settled by his own fix**: base at merge time (`dca75e66`) had **0** `pip install pathspec`, yet on the new head **steps 9+10 (`setup-python`, `Install pathspec`) RAN and SUCCEEDED** ⇒ workflow came from the merge commit. Comment 2 correct; comment 1's conclusion refuted by the commit that fixed it from inside the PR. Flagged because *"can't fix this from here"* is the kind of claim quoted later to justify leaving a PR red. Lesson → shared learnings (`pull_request workflows resolve from the PR merge commit, not the base branch`).

CI red was **infra, not code** — I diagnosed it independently before reading his comments (same mechanism, separate derivation): stale `nv-slang` `ci.yml` missing nv-main's pathspec steps while the composed merge pulls nv-main's drift test in. Structural, not his: identical 6 failures red on sibling **#1122** at the same time; `nv-main`-based **#1124/#1125** green with those steps. Added block **byte-identical to nv-main's** by exact string comparison. Now green: `nv-owned-drift.test.ts 13 tests ✓`, `161 files / 2249 passed`.
⚠️**STILL OPEN on `nv-nanoclaw` + `nv-slangpy`** (censused: pathspec present on nv-main/nv-slang/nv-dashboard, absent there; `ci.yml` 179 lines vs 191). Author's team tasks #38/#39 — but since the fix IS landable from inside a PR, each branch can carry the same 2-line restore.

## ⛔ MY OWN INSTRUMENT DEFECT, caught pre-publish

First full-suite run showed **5** failures, not 2 — 3 extra in `test_config.py` (`assert 'ROUTED_VIA_ONECLI_PROXY' == 'github-test-token'`). **My container, not the PR**: OneCLI injects `GH_TOKEN=ROUTED_VIA_ONECLI_PROXY` and `src/config.py:117` prefers `GH_TOKEN` over the `GITHUB_ACCESS_TOKEN` the fixture sets. `env -u GH_TOKEN` ⇒ author's numbers reproduce exactly on both trees. ⭐⭐⭐**I would have published "5 failures, 3 undisclosed" — a false finding aimed at a correct PR, and the most damaging kind because it impugns the author's honesty.** Disclosed in the review as a `<details>` note. See [[feedback_published_negative_env_claims_need_rederivation]].
⛔Also: my first timeout probe was written **unbounded** (`range(CAP+5)` × 9s sleeps) and blew the 2-min tool timeout with no result; bounding it to 4×6s produced the finding in seconds.

**RESUME = none; terminal.** Merged, green, review posted. The `reply_unknown`/idempotency gap and the two-branch CI gap are both LIVE on `nv-slang` but are follow-up-sized, offered in the comment, not blockers.
