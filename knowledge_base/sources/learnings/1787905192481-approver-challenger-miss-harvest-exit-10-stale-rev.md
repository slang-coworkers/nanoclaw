---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787052279959-u9xvw9
written_at: 2026-08-28T08:19:52.481Z
---

# [approver/challenger-miss] Harvest exit 10 (stale review) on a fresh push is a pending-bot SUSPECT even when pending_bot is null — re-harvest before falling to Devin-only

**Symptom.** slang#12601 R3 @ 64ba348a (a `synchronize` that added REAL new content — a macOS install-command rewrite). My harvest returned **exit 10 (CodeRabbit review STALE @ the prior head a86ca0c5) with `pending_bot: null`**. Because nothing said "pending," I fell to Devin-only and wrote "no reviewer caught this." A **head-current CodeRabbit review posted @ 64ba348a at 07:22:42Z — ~6 min AFTER my harvest** — and it rated the exact defect I found via challenger 🟠 **Major / blocking** (it even ran `brew info cpp-linter/tap/clang-format@17` → unavailable). codex OUTPUT_REVIEW caught the contradiction; I re-harvested → exit 0, found, not stale. This is the slang#12064 `harvest_used=0` miss in a new costume.

**Root cause.** The existing note "pending at poll end ≠ absent" keyed on harvest **exit 22 (pending)**. But exit 10 (stale) on a **fresh push** is the SAME hazard with no pending flag: a review that exists only against the PRIOR head means the bot simply has not re-run on the new head YET — it is mid-cycle, not done. `pending_bot: null` does not mean "no bot coming"; it means "no in-flight run detected at this instant," which on a seconds-old push is expected right before the run starts. So exit 10 + a diff the stale review could not have seen = a re-run is imminent, exactly like exit 22.

**How to catch it.** Treat harvest **exit 10 as a pending-bot suspect whenever the pinned head is a fresh push carrying content the stale review could not have covered** (new commits since the reviewed SHA). Do NOT fall straight to Devin-only: re-harvest after a short wait (poll ~30s up to a few min), or at minimum re-run the harvest once before writing the doc. The tell that you're about to repeat this: writing "no reviewer caught this" / "Devin-only" on a PR whose head is only minutes old.

**Fix.** Before committing to Devin-only on exit 10, ask "is this head a fresh push with new content?" If yes, re-harvest for the head-current review first. Bonus: had I re-harvested, the primary 🟠 Major would have driven a clean BLOCK at decision time instead of an ABSTAIN I then couldn't upgrade (append-only ledger). See sibling learning on why the ABSTAIN fast-path records before you can incorporate a late re-harvest.
