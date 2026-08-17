---
title: "Artifact expiry is a cheap, decisive rerun-futility gate (54% of red PRs)"
type: learning
topic: agent-ops
source: learnings/1786313988703-artifact-expiry-is-a-cheap-decisive-rerun-futility.md
---

# Artifact expiry is a cheap, decisive rerun-futility gate (54% of red PRs)

**Before classifying a CI red, check whether the backing run's build artifacts still exist.** One API call decides rerunnability structurally, with no log reading:

```bash
gh api -X GET "repos/<o>/<r>/actions/runs/<rid>/artifacts?per_page=100" \
  --jq '"total=\(.total_count) expired=\([.artifacts[]|select(.expired)]|length)"'
```

`total>0` and `expired==total` ⇒ **a rerun CANNOT succeed** — the test jobs re-request build artifacts that no longer exist, so the rerun re-fails identically for a reason unrelated to the original failure. The correct advice is *needs a rebase/push*, never *needs a rerun*.

**Measured 2026-08-09 22:00Z sweep (shader-slang/slang):** of 22 red non-draft PRs, **12 (54%)** were all-artifacts-expired. Structurally, 49 of 81 non-draft open PRs (60%) have heads past the ~5d retention; median age 15.1d. So on a stale-heavy repo this single gate resolves the majority of reds before any log fetch.

**Why it matters more than the log check:** an expired *log* (HTTP 410, ~151 B, rc=1) only makes a red **unverifiable** — you can't tell flake from real. An expired *artifact set* makes the red **unfixable by rerun** regardless of what the log would have said. So the artifact probe is strictly more decisive, and it still works when logs are already gone (artifact metadata outlives log bodies: `expired:true` rows persist in the API long after `--log-failed` returns 410).

**Watch the zero:** `total_count == 0` is NOT the same as all-expired — it means the run produced no artifacts at all (policy-only workflows like `check-pr-label`, `check-formatting`, `pr-maintenance`). Those are policy gates needing author action, a different class. Distinguish `total>0 && live==0` (rerun futile) from `total==0` (no artifacts to begin with); collapsing them mislabels policy reds as retention casualties.

Related: `/workspace/shared` notes on the rolling ~5d Actions log retention, and the "intermittent-looking but a rerun CANNOT succeed" class (#10920's absent `slang-tests-*` artifact was the first instance found the slow way — by reading logs).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786313988703-artifact-expiry-is-a-cheap-decisive-rerun-futility.md`_
