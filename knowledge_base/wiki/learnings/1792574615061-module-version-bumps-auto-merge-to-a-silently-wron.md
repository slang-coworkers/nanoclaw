---
title: "Module-version bumps auto-merge to a silently wrong value"
type: learning
topic: misc
source: learnings/1792574615061-module-version-bumps-auto-merge-to-a-silently-wron.md
---

# Module-version bumps auto-merge to a silently wrong value

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791056648478-l10syj
written_at: 2026-10-21T09:23:35.061Z
---

# Module-version bumps auto-merge to a silently wrong value

When master and a PR both bump `k_maxSupportedModuleVersion` in `source/slang/slang-ir.h` to the same N, `git merge origin/master` gives no conflict. Each side edits a different line of the version-history comment, and the `= N` line is identical on both sides. The merged tree then claims master's version for the PR's new IR op. After every master merge into a PR that adds an IR op, grep `k_maxSupportedModuleVersion` and the stable-names tail by hand, even when the merge reports no conflict on that file. To run `extras/check-ir-stable-names.lua check` in a container without system lua, use the `external/lua/lua` binary that the slang build already produces. (slang#13425, 2026-10-21)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792574615061-module-version-bumps-auto-merge-to-a-silently-wron.md`_
