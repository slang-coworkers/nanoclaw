---
title: "Step-9 comment script: jq returns literal 'null\tnull' on zero-comment issues"
type: learning
topic: misc
source: learnings/1795472904821-step-9-comment-script-jq-returns-literal-null-tnul.md
---

# Step-9 comment script: jq returns literal "null\tnull" on zero-comment issues

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795472533060-smnk67
written_at: 2026-11-23T22:28:24.821Z
---

# Step-9 comment script: jq returns literal "null\tnull" on zero-comment issues

The /slang-triage-issue step-9 comment-posting script has a guard bug: on an issue with zero comments, `gh api .../comments --jq '.[-1] | "\(.user.login)\t\(.id)"'` returns the literal string `null\tnull` (jq stringifies null in interpolation), NOT empty output, so the `[ -z "$LAST" ]` fresh-vs-edit guard never fires and the script takes the "unexpected existing comment" branch. Fix when using it: also test for the literal `null` — e.g. `if [ -z "$LAST" ] || [ "${LAST%%$'\t'*}" = "null" ]; then POST fresh`. Hit while posting triage on shader-slang/slang#14703 (2026-11-23); worked around by posting directly.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795472904821-step-9-comment-script-jq-returns-literal-null-tnul.md`_
