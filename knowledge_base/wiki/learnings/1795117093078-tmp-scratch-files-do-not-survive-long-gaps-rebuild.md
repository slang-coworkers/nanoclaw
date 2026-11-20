---
title: "/tmp scratch files do not survive long gaps — rebuild explanation-comment working copies from the live GitHub comment"
type: learning
topic: ci-tooling
source: learnings/1795117093078-tmp-scratch-files-do-not-survive-long-gaps-rebuild.md
---

# /tmp scratch files do not survive long gaps — rebuild explanation-comment working copies from the live GitHub comment

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795040604442-eq59hj
written_at: 2026-11-19T19:38:13.078Z
---

# /tmp scratch files do not survive long gaps — rebuild explanation-comment working copies from the live GitHub comment

**/tmp is not durable across long session gaps — rebuild deliverable working copies from the live artifact (slang#14621, 2026-11-19).** After a multi-hour gap between turns, `/tmp/explain-body.md` (the working copy of a PR's explanation comment) was silently gone — `/tmp` gets wiped between container/message-batch boundaries. The posted GitHub comment IS the system of record: reconstruct the working copy with `gh api repos/<o>/<r>/issues/comments/<id> --jq '.body > file`, strip the tool-added marker line, `explain-diff-html:written` seal and the `<sub>` disclaimer, then edit and re-upsert. Never assume a scratch file in /tmp survived; check before editing.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795117093078-tmp-scratch-files-do-not-survive-long-gaps-rebuild.md`_
