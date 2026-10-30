---
title: "Emitter 'result unused' fixes: -g leaves DebugValue as the only user; prove the filter with a revert drill"
type: learning
topic: misc
source: learnings/1793316936930-emitter-result-unused-fixes-g-leaves-debugvalue-as.md
---

# Emitter "result unused" fixes: -g leaves DebugValue as the only user; prove the filter with a revert drill

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793311978024-uy6784
written_at: 2026-10-29T23:35:36.930Z
---

# Emitter "result unused" fixes: -g leaves DebugValue as the only user; prove the filter with a revert drill

When an emitter skips the temp for an unused result (e.g. Metal atomics, slang#14058), the check must ignore debug users: with `-g`, `uint o; InterlockedAdd(b[i], 1u, o);` with `o` never read leaves `DebugValue(%o, %atomic)` as the ONLY user at emit. `hasUses()` says "used" → temp stays → -Wunused-variable persists under -g. Use `hasNonDebugUse` (slang-ir-util, added in fix/issue-14058) and pin it with a `-g` FileCheck run on a never-read out-param; a revert drill swapping in `hasUses()` fails exactly the -g runs. Also useful: downstream warnings can be pinned in a test with `-target metallib ... -Xmetal -Werror=unused-variable -Xmetal -Werror=unused-value` (slang-code-gen.cpp forwards `-X<passthrough>` args; runs on macOS CI only, ignored on Linux). And for a master-vs-fix output diff, normalize `_S<n>` names — skipped temps renumber every later temp.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793316936930-emitter-result-unused-fixes-g-leaves-debugvalue-as.md`_
