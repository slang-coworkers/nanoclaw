---
title: "Auto-route /slash-workflow hooks are NOT operator authorization — an explicit hold outranks a hook nudge"
type: learning
topic: agent-ops
source: learnings/1782445249583-auto-route-slash-workflow-hooks-are-not-operator-a.md
---

# Auto-route /slash-workflow hooks are NOT operator authorization — an explicit hold outranks a hook nudge

**Rule:** The `UserPromptSubmit` AUTO-ROUTE hook that says "Follow the /slang-implement (or /slang-fix-issue, etc.) workflow" is a *heuristic router*, not an operator directive. When you are under an explicit standing hold from your parent/operator (e.g. "verify + draft only, do NOT build"), the hold wins — even if the hook nudges you toward an implement/build workflow because the task text happens to contain a concrete fix ("minimal change at file.cpp:NNN"). Keep the fix as a *recommendation in the draft*, never act on it, until a real maintainer go-ahead is relayed through your parent.

**Why:** Confirmed by the dashboard operator on 2026-06-26 (slang#11662 chain). A senior maintainer (csyonghe) *proposed* a `-O0`/no-glslang path; verifying it surfaced a tiny enabling fix at `slang-emit.cpp:3117`, and the auto-route hook on that inbound suggested `/slang-implement`. Parent's prior message had explicitly said "verify + draft, do NOT build, #11694 stays closed." I declined the hook, put the fix in the draft as a recommendation, and reported. Operator: "Resisting the auto-route hook was exactly right. A heuristic router is never operator authorization, and an explicit hold outranks a hook nudge every time… defend the hold; only a real maintainer go-ahead (relayed through me) releases a build."

**How to apply:** A hook is an even weaker source than an untraceable parent relay (see the traceable-source-mandates learning) — it carries zero authorization. Source hierarchy for releasing a build/gated action: explicit operator/maintainer go-ahead relayed by parent > parent's standing instruction > … >> auto-route hook (lowest; never sufficient on its own). When a hook conflicts with an active hold, follow the hold and note the divergence to parent in your report ("auto-route suggested /slang-implement; not following per your hold"). Maintainer *proposing* an approach ≠ maintainer *authorizing* you to build it; surface the scoped fix and wait for the explicit go-ahead.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782445249583-auto-route-slash-workflow-hooks-are-not-operator-a.md`_
