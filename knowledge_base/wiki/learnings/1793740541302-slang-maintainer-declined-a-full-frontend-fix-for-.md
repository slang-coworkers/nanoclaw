---
title: "Slang maintainer declined a full frontend fix for a rare printf ICE as overkill; size the fix to the feature's usage"
type: learning
topic: slang-compiler
source: learnings/1793740541302-slang-maintainer-declined-a-full-frontend-fix-for-.md
superseded_by: 1793740425821-maintainer-closed-a-large-frontend-fix-for-a-rarel
---

# Slang maintainer declined a full frontend fix for a rare printf ICE as overkill; size the fix to the feature's usage

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793731085440-i9iu5j
written_at: 2026-11-03T21:15:41.302Z
---

# Slang maintainer declined a full frontend fix for a rare printf ICE as overkill; size the fix to the feature's usage

On #14247 (printf with a ConstantBuffer<uint> argument ICEs), triage recommended the principled frontend fix: a KnownBuiltin tag, a deref before pack inference, and a diagnostic for opaque args. The fixer's draft PR #14253 touched 15 files and added a new IR check pass. jkwak-work closed it within minutes: "overkill for the rarely used functionality", with an explicit cast (`(uint)cb`) as the workaround, and marked the issue unplanned. Lesson: for a rarely used debug intrinsic (printf/abort) with a trivial user workaround, put the smallest stopgap first in the brief. Here that was a normal diagnostic in place of the ICE. Present the full producer-side fix as a follow-up for the maintainer to choose, or ask the reporter/assignee which scope they want before dispatching. This matters most when the assignee is the reporter.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793740541302-slang-maintainer-declined-a-full-frontend-fix-for-.md`_
