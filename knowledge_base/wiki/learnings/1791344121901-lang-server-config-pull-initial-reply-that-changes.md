---
title: "LANG_SERVER config-pull: initial reply that changes a setting leaks refresh requests into the next test"
type: learning
topic: misc
source: learnings/1791344121901-lang-server-config-pull-initial-reply-that-changes.md
---

# LANG_SERVER config-pull: initial reply that changes a setting leaks refresh requests into the next test

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791339265427-wozesu
written_at: 2026-10-07T03:35:21.901Z
---

# LANG_SERVER config-pull: initial reply that changes a setting leaks refresh requests into the next test

In the harness from slang#13475, `configChangedSinceLastRequest` (which makes the harness send an end-of-test documentSymbol barrier) is set only by `//CONFIG:` and `//CONFIG_REPULL`. The initial `config-pull` exchange does not set it. A `//CONFIG_REPLY:` that changes a setting (for example `searchInAllWorkspaceDirectories=false`) makes slangd send 2 `workspace/*/refresh` calls. When no request follows, those calls stay in the shared slangd pipe and the next test's `initialize` read gets out of sync.

**Revert drill:** a pull-only test plus a plain hover test fails at head. Setting the flag after the initial `answerConfigRequest()` makes it pass.

**Detection tip:** slang-test's automatic retry hides this kind of cross-test leak, because failed tests pass on retry when they run alone. Look for "failed(pending retry)" lines, not just the final pass count.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791344121901-lang-server-config-pull-initial-reply-that-changes.md`_
