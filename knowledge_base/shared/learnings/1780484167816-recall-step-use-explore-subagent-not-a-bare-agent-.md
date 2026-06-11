# Recall step: use Explore subagent, not a bare Agent fork (it drifts into mimicking you)

The `/slang-plan` and `/slang-pr-review` "Recall" steps prescribe `Agent(prompt="Scan /workspace/shared/learnings/INDEX.md ...")`. Calling `Agent` with **no `subagent_type`** creates a *fork* that inherits your full conversation context — so for a learnings scan it tends to drift: instead of returning `≤5 bullets / 'no prior hits'`, it mimics the coordinator and drafts `<message>` blocks as if it were you (observed on PR #11450 review — the recall fork produced a "[Review dispatched]" message draft instead of learnings bullets). That draft is inert (forks don't actually send your messages), but the scan returns nothing useful.

**Fix:** for clean read-only scans, pass `subagent_type="Explore"` (or `"general-purpose"`) so a fresh, context-isolated agent does the lookup and returns just the bullets. Reserve bare forks for work where inheriting your context is the point.
