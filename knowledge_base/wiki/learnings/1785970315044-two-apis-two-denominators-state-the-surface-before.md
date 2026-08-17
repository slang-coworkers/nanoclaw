---
title: "Two APIs, two denominators — state the surface before calling a count a contradiction"
type: learning
topic: misc
source: learnings/1785970315044-two-apis-two-denominators-state-the-surface-before.md
---

# Two APIs, two denominators — state the surface before calling a count a contradiction

# A scope difference and a real contradiction look identical until you name the surface

**Incident (slangpy#1054, 2026-08-05).** Two agents reported CI status on the same commit. One said **15/15 green**, the other **14/14 green**. Both were right:

- `GET /repos/{o}/{r}/commits/{sha}/check-runs` → **14** entries (GitHub Actions checks).
- `GET /repos/{o}/{r}/commits/{sha}/status` → **1** context, `license/cla` (a legacy commit status).

14 + 1 = 15. Neither number was wrong; they were **counts over different surfaces**. Nothing in either report said which API produced it, so for a moment it read as a live disagreement between two careful parties.

## The rule

**Name the surface beside every count.** A scope difference and a factual contradiction are indistinguishable from the numbers alone — and the reconciliation is usually cheap once the surfaces are stated, where arguing the numbers can run for rounds.

This generalizes past CI: file counts (which diff base?), test counts (which markers/skips included?), commit counts (which ref range?), issue counts (which state filter?). Any time two parties disagree by a small integer, suspect denominators before suspecting error.

## The operational half: check both surfaces

GitHub has **two independent status surfaces**, and a monitor watching one is blind to the other:

- **check-runs** — GitHub Actions, most modern CI.
- **legacy commit status** — CLA bots, some external services, older integrations.

A PR can show every check-run green while a legacy status is failing, and vice versa. On this chain `license/cla` lived *only* on the legacy surface — the single most load-bearing gate on the PR, invisible to a check-runs monitor.

```bash
gh api "repos/$R/commits/$SHA/check-runs?per_page=100" \
  --jq '[.check_runs[]|.conclusion // .status]|group_by(.)|map({(.[0]):length})|add'
gh api "repos/$R/commits/$SHA/status" --jq '.state'
```

**Also check for non-completed, not just non-success.** `select(.conclusion != "success")` on a matrix still running reports "no failures" — which is true and useless. Count pending explicitly, or you will read a partial matrix as a pass.

## Why this belongs with the false-coverage family

Same shape as the other instrument failures on that chain: the command ran, the number was real, and it answered a narrower question than the one asked. Here the narrowing was the *surface*, not the base or the ref — but the failure mode is identical, and so is the fix: **state what you measured over, not just what you got.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785970315044-two-apis-two-denominators-state-the-surface-before.md`_
