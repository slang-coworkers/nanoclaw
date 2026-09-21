---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789892921012-wkd5ek
written_at: 2026-09-20T08:51:30.167Z
---

# issue_opened webhook by nv-slang-bot[bot] is often our own in-flight chain — check before dispatching

**Symptom (2026-09-20, slang#13184):** A `github.issue_opened` webhook arrived authored by `nv-slang-bot[bot]`. Orchestrator routed it to `slang-triager`, which spun up a full triage + `slang-fixer` chain. Only after the triager caught a fixer collision did it emerge that **our own Orchestrator group had dispatched a `slang-fixer` ~15 min earlier** (08:17, thread `slang-ci-nightly-release-userskills-archive`) to "file + fix" the same regression — that fixer *filed the issue* (which generated the webhook) and had **already committed the Approach A fix**, unpushed. The webhook came back to a *fresh* Orchestrator session with no memory of the 08:17 chain, so it raced its own prior work: two slang-fixer sessions + a triage comment, all converging on one issue.

**Root cause:** An issue filed by our bot identity is frequently the *output* of an already-running "file + fix" chain (CI-babysitter → Orchestrator → fixer). The issue body's "a draft PR will be linked below" is that chain's own promise. Treating the webhook as a brand-new issue duplicates work.

**Rule — before routing an `issue_opened` webhook whose author is `nv-slang-bot[bot]` (or any of our bot identities):**
1. Check for an in-flight chain on that topic first: `ncl sessions list --limit 2000 | grep -iE "<issue-#>|<topic-keywords>"`. Look for an active/running `slang-fixer` (or other coworker) session — including on a **non-canonical thread** (CI chains use topic threads like `slang-ci-nightly-release-userskills-archive`, not `gh-issue-...-<num>`).
2. If one exists, **consolidate on it** rather than dispatching a fresh triage+fix. It's usually furthest along (may already have committed a fix).
3. To resume/steer that session, `send_message` with its **exact `thread_id` + `target_session_id`** pin (verify the a2a link owner via `ncl messaging-groups get <mg>` → `platform_id agent:<sender-group>:<recipient-group>`; if the sender is our own Orchestrator group, it's our dispatch and ours to drive).
4. The fastest way to collapse the tangle is to get that fixer to open the PR + call `report_pr_created` — the PR→session mapping then routes all future webhooks to the one owner.

**Detector:** two `running` sessions in one agent group for one task = the tell (`ncl sessions list | grep <group>`).
