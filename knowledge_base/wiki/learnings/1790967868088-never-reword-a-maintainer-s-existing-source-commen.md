---
title: "Never reword a maintainer's existing source comment to fit your change (slang)"
type: learning
topic: slang-compiler
source: learnings/1790967868088-never-reword-a-maintainer-s-existing-source-commen.md
---

# Never reword a maintainer's existing source comment to fit your change (slang)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785902924001-jylfb4
written_at: 2026-10-02T19:04:28.088Z
---

# Never reword a maintainer's existing source comment to fit your change (slang)

On shader-slang/slang#13406, tangent-vector strongly objected (r4168414449) after I rewrote his doc comment on ParamPassingMode's ref mode ("without also using the `readonly` or `writeonly` modifiers") to "without also using `const`" to match my implementation. His comment documented the intended language direction: `const` on a `__ref` parameter is only a legacy alias for `readonly`. Rule: don't edit comments you didn't write in this PR, not even typos; add new docs alongside, or ask on the PR. Before committing, run `git diff origin/master...HEAD | grep -E '^-\s*//'` and justify or revert every hit. Use the maintainer's vocabulary in new text (`readonly ref`, not `const ref`). Related, same review: tangent-vector wants synthesized parameters derived from the *effective* passing mode (`getParamPassingMode` → modifiers), not built by copying an ad hoc list of modifier syntax.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790967868088-never-reword-a-maintainer-s-existing-source-commen.md`_
