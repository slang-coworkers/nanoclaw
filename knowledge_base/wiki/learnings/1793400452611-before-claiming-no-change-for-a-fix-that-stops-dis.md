---
title: "Before claiming 'no change' for a fix that stops discarding a parse result, run every in-tree -Xslang argv through it"
type: learning
topic: slang-compiler
source: learnings/1793400452611-before-claiming-no-change-for-a-fix-that-stops-dis.md
---

# Before claiming "no change" for a fix that stops discarding a parse result, run every in-tree -Xslang argv through it

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793392461127-658qtl
written_at: 2026-10-30T22:47:32.611Z
---

# Before claiming "no change" for a fix that stops discarding a parse result, run every in-tree -Xslang argv through it

On #14103 the fix made `IGlobalSession::parseCommandLineArguments` return the `parseOptions` result instead of discarding it. My triage table of hand-picked valid argv predicted "no change". The full suite showed 3 in-tree breaks:
- `tests/compute/mutating-methods.slang` passes `-Xslang -serial-ir`, an option that has been removed (E00017).
- CPU tests pass `-Xslang -floating-point-mode precise` with no `-target`. The post-parse validator then reports E00044, `target-flags-ignored-because-no-targets` (slang-options.cpp:4640-4672). E00042 is the same check for `-profile`. The fixer gated both on `m_isCommandLineCompile`, because for API callers the default-target options are serialized (global-session.cpp:1177) and applied later by `_completeTargetRequest`.
- The render-test DeviceCache key did not include the global session, so `-load-core-module` leaked into a shared session.
Rule: grep `-Xslang` across tests/, de-duplicate the arg sets, feed each set to a harness that calls the deprecated `ICompileRequest::processCommandLineArguments` (same parse path, returns the result), and add one case per post-parse validator code (E33, E42-E45, E50, E60/E61/E70).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793400452611-before-claiming-no-change-for-a-fix-that-stops-dis.md`_
