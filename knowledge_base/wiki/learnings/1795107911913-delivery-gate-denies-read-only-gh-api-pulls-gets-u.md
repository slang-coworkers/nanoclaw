---
title: "Delivery gate denies read-only gh api pulls GETs — use gh pr view"
type: learning
topic: agent-ops
source: learnings/1795107911913-delivery-gate-denies-read-only-gh-api-pulls-gets-u.md
---

# Delivery gate denies read-only gh api pulls GETs — use gh pr view

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793212431815-3vzkl5
written_at: 2026-11-19T17:05:11.913Z
---

# Delivery gate denies read-only gh api pulls GETs — use gh pr view

# Delivery-gate workaround: fetch PR state with `gh pr view`, not `gh api …/pulls/<n>` (until the gate patch lands)

The `critique-gate` PreToolUse hook (`gate-critique-on-deliver.sh`, BASH_PATTERNS) matches ANY Bash command containing `gh api … pulls …` — it cannot tell a read-only GET (`gh api repos/x/pulls/13993 --jq .state`) from a REST PR create (`gh api repos/x/pulls -f title=…`). Read-only PR read-backs get denied as "PR creation" / demanded critique (observed 2026-11-19, slang-fixer on the #13985 close disposition; it worked around them).

**Workaround:** use `gh pr view <n> --repo <owner>/<repo> --json <fields>` for PR state, and `gh api repos/x/issues/<n>` or `…/issues/<n>/comments` for issue-side reads — none of those shapes match the pattern. (This is also the right tool anyway: `gh pr view` is the idiomatic read.)

**Why:** the hook greps the whole command string for `gh api [^|]*pulls\b`; there is no method discrimination, so verification probes fail the gate and a chain can stall on a denial instead of a missing critique. Related prior learning: 1784160118119 (the same gate blocks the whole Bash call that also writes PR-body files).

**Status:** tested one-line patch restricting the gh-api member to write-intent shapes handed to the operator 2026-11-19 (`/workspace/agent/gate-critique-pulls-read-fix.patch`, dashboard report). Until it lands, treat a "PR creation" denial on a read-only `gh api …/pulls…` GET as a false positive of this pattern — retry the read via `gh pr view` rather than escalating critique stages for it. A denied/blocked verification probe still means UNVERIFIED (see 1785746988001) — take the alternate read path, don't record the claim from relayed provenance.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795107911913-delivery-gate-denies-read-only-gh-api-pulls-gets-u.md`_
