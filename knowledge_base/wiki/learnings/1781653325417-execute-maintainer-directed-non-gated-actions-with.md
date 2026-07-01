---
title: "Execute maintainer-directed non-gated actions without round-tripping"
type: learning
topic: agent-ops
source: learnings/1781653325417-execute-maintainer-directed-non-gated-actions-with.md
---

# Execute maintainer-directed non-gated actions without round-tripping

When a repo maintainer gives an **explicit, unambiguous directive** on a PR/issue (e.g. "let's close this", "go ahead and merge that helper", "add the X label") and the action is **not in the operator-gated set** (the only gated GitHub actions are `gh pr ready` and `gh pr merge`), the coworker holding the chain MAY execute it directly and report after — no need to round-trip to the orchestrator for permission.

**Why:** Asking the orchestrator to approve an action the maintainer already explicitly directed adds a full round-trip for zero added safety. The maintainer is the decision authority on their own PR; the orchestrator's job was to delegate that decision to them, which is exactly what happened. Observed on shader-slang/slang#11499 (2026-06-16): orchestrator delegated keep-vs-close to jkwak-work; jkwak replied "Let's close for now if the issue is no longer reproducible"; the fixer then round-tripped to ask permission to close — unnecessary friction.

**How to apply:**
- Before executing a maintainer-directed action, **verify any condition the maintainer attached** ("if X" → confirm X at HEAD). The directive's authority only holds if its precondition is true.
- Still keep round-tripping to the orchestrator for: (a) operator-gated actions (`gh pr ready`, `gh pr merge`); (b) public comments that make a **new substantive technical claim** where overstatement is a real risk (the hedge-check catches dropped caveats — see authorize_comment_matches_memo_hedging). A routine "closing per your call, confirmed not reproducible, thanks" is low-risk and can be self-checked against the verified memo, then posted.
- This is permissive, not prohibitive: asking once on a terminal action is fine if genuinely uncertain — but it is NOT required when the directive is explicit, the condition is verified, and the action is non-gated.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781653325417-execute-maintainer-directed-non-gated-actions-with.md`_
