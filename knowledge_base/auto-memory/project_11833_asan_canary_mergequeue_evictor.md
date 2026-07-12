---
name: project_11833_asan_canary_mergequeue_evictor
description: "#11833 sanitizer ASan-canary merge-group flake — dominant merge-queue evictor; by 20:00Z #12043/#11910 in-queue UNMERGEABLE 4-7h (throughput STALL, not clean self-recover); jkwak-work owns; NO bot fixer; escalation next-sweep-armed"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

**#11833** — CI flaky: the **sanitizer merge-group job** evicts green PRs on ASan-runtime-environment failures (`ASan runtime does not come first in initial library list` → link-order/LD_PRELOAD ordering, also OOM, canary). Fingerprint: `failed(pending retry)` on cpu-program tests; the PR's own head-checks are green + APPROVED — eviction is purely the merge-group ASan setup step, not the PR's code. Tracked Infra issue, labels `Dev Reviewed`/`CI`/`Infra`, **assigned to jkwak-work** (maintainer, 07-08 17:25Z; previously szihs). **Zero issue comments** as of 07-10 — babysitter had not been occurrence-posting here (contrast [[project_11951_testserver_jsonrpc_pathlevel_flake]] which has 7).

**07-10 18:18Z — babysitter posted first occurrence comment** ([#11833 comment 4938268604](https://github.com/shader-slang/slang/issues/11833#issuecomment-4938268604)): clustering table + fingerprint + LD_PRELOAD/link-order pointer, notifying jkwak-work. Public comment is CLEAN (states enqueue-block fact in plain language, does NOT cite a wrong issue number — see #11675 caveat below).

**07-10 20:00Z — REFRAMED to throughput STALL (Main-verified, corrects the 18:14Z "self-recovers" framing):** 5 evictions today across 2 PRs (#12043 ×3, #11910 ×2). Verified via GraphQL `mergeQueueEntry.state`: both APPROVED PRs are sitting **IN the merge queue at pos 1/2 with `state=UNMERGEABLE`, heads stale 13:07Z/15:58Z = 4-7h not landing.** So NOT "dropped-and-cleanly-re-requeued" — they're stuck in-queue, re-evicted faster than the queue clears. Key precision: **read `mergeQueueEntry.state` — `UNMERGEABLE` ≠ `null`-strand ≠ clean AWAITING_CHECKS recovery.** Bot cannot `enqueuePullRequest` (token lacks push to queue branch) so bot can't manually re-drive; left for GitHub-auto each cycle.

**⚠️ #11675 data-integrity caveat (provenance only — NEVER write as a blocker):** earlier sweeps cited "#11675" as the bot-enqueue-perms blocker. `#11675` is a MERGED, unrelated float-matrix PR — the citation is WRONG. The underlying FACT (bot token can't push to the merge-queue branch → can't enqueue) is real and lives in [[project_nv_slang_bot_readonly_incident]]. When describing the blocker, say "bot enqueue not authorized (token lacks push to queue branch)", never a bare "#11675".

**Disposition (07-10) — parallel to #11951:**
- **NO bot fixer chain.** Deep CI-infra (ASan LD_PRELOAD/canary preload ordering in the merge-group setup step), `Dev Reviewed`, maintainer-assigned → jkwak-work drives. Do NOT auto-dispatch a fixer. Even the operator can't LAND the fix — only lever is nudging the maintainer.
- **NOT escalated to operator yet (as of 20:00Z):** jkwak-work notified only ~2h ago (18:18Z) and hasn't engaged — within normal maintainer response budget. Escalating now = premature "noisy rubber-stamp."

**Escalation threshold (was ARMED):** escalate to operator **only if** BOTH — (a) #12043 AND #11910 still `UNMERGEABLE`, AND (b) jkwak-work STILL hasn't engaged. 

**✅ ESCALATION STOOD DOWN (07-11 04:10Z, Main-verified):** conjunct (b) is now FALSE — **jkwak-work opened [PR #12060 "Fix ASan merge queue failures"](https://github.com/shader-slang/slang/pull/12060)** (non-draft, head b0097167e9), body references #11833 ×2 + LD_PRELOAD/link-order, and **cross-referenced it from #11833 at 07-11 00:44Z**. Maintainer has ENGAGED with an active fix PR → this is now jkwak's fix-in-flight, exactly the maintainer-owned path we held for. **No operator escalation.** The 52-leak LeakSanitizer teardown churn babysitter saw on #12060 (07-11 04:10Z) is jkwak iterating on his OWN fix PR (canary PASSED — NOT the #11833 signature) — expected WIP noise, do not treat as a new signature. Chain now = watch #12060 land; #11833 closes when it merges. No further orchestrator action unless #12060 stalls AND queue-stall worsens.
