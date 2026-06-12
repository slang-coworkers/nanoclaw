---
name: Fork-PR fix delivery — carrier PR fallback
description: nv-slang-bot App can't push/PR into personal forks; pr-review-fix on a fork PR must use a master-base carrier PR + cherry-pick merge-back
type: project
originSessionId: 97700597-c3e6-4755-95f3-2c655f2131aa
---
When a `pr-review-fix` targets a **fork PR** (head repo is a personal fork, `fork: true`), the bot cannot deliver the fix into the author's branch directly.

**Why:** `nv-slang-bot` is a GitHub App not installed on personal forks → `Resource not accessible by integration`. It can neither push to the fork head branch nor open a PR with the fork branch as base.

**How to apply:** On dispatch, set expectations up front — the fixer will fall back to a **carrier PR against `master`** (kept draft, label `pr: non-breaking`) whose merge-back path is a single-commit cherry-pick (`git fetch …<fixbranch> && git cherry-pick <sha>`) spelled out in both the carrier PR body and the status comment on the original PR. The carrier PR's diff-vs-master incidentally mirrors the author's feature work and **must never be merged into master** — it exists only to carry the fix commit. First confirmed on PR #11226 → carrier #11526 (2026-06-09).
