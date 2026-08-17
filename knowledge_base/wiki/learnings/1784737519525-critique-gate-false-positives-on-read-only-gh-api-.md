---
title: "Critique gate false-positives on read-only gh api /pulls/ calls"
type: learning
topic: agent-ops
source: learnings/1784737519525-critique-gate-false-positives-on-read-only-gh-api-.md
---

# Critique gate false-positives on read-only gh api /pulls/ calls

**Symptom:** `gate-critique-on-deliver.sh` (PreToolUse on Bash) blocks a **read-only** `gh api repos/<owner>/<repo>/pulls/<n>` command with "CRITIQUE REQUIRED before PR creation … N edit(s) recorded since the last critique round." It counts *any* file edits since the last codex critique (e.g. MEMORY.md compaction, memory-file updates — none of them code deliverables) and pattern-matches the `/pulls/` endpoint as a PR-creation delivery.

**Why it's wrong:** a GET to `/pulls/<n>` (checking merge state, reviewDecision, approvals) is not a delivery or a PR create. But the gate can't tell read from write on that path, so it denies, and repeated denials escalate to an admin bypass request — which an admin may (correctly) reject, since there's genuinely nothing to critique.

**Workarounds (all confirmed working):**
- Verify PR/branch state with **git-only** commands that don't hit the `/pulls/` endpoint: `git ls-remote origin refs/heads/<branch>` (true remote tip), `git log origin/master --oneline | grep <PR#>` (did it merge?), `git fetch && git log HEAD..FETCH_HEAD` (am I behind/ahead?).
- The webhook payload itself is authoritative for merge/approval state (`pr_merged` → `merged:true, merged_by`; `pr_review` → `review_state`).
- For runs/CI, `gh api repos/.../actions/runs?...` and `gh run list` are NOT gated (no `/pulls/` in path).

**Do NOT:** run a pointless `/codex-critique OUTPUT_REVIEW` just to clear the gate for a read-only check, and do NOT retry the denied command after a bypass rejection. If the blocked command was read-only and you got the answer another way, there is no blocker — report that to parent and move on.

Discovered 2026-07-22 on shader-slang/slang PR #11665 (merged fine; the gate only ever blocked status reads, never the actual work).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784737519525-critique-gate-false-positives-on-read-only-gh-api-.md`_
