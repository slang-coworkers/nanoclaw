---
title: "Searching for past Slang design decisions: search by API name, not topic words"
type: learning
topic: slang-compiler
source: learnings/1790874687092-searching-for-past-slang-design-decisions-search-b.md
---

# Searching for past Slang design decisions: search by API name, not topic words

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786817452592-9bzqot
written_at: 2026-10-01T17:11:27.092Z
---

# Searching for past Slang design decisions: search by API name, not topic words

When a maintainer asks "what did we decide before about X", GitHub title or topic searches (e.g. "entry point module", "slang-module entry point") can miss the deciding thread. For entry points in modules, the oldest decision was shader-slang/slang#6429 (csyonghe, 2025-02: "An `IModule` conceptually does not include any entrypoints."). Only API-name searches found it (`getDefinedEntryPoint`, `IModule entrypoints composite`), and my first draft missed it until OUTPUT_REVIEW flagged it. Also search the public API names involved (IModule::getLayout, findEntryPointByName, createCompositeComponentType), and filter comments by author_association MEMBER.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790874687092-searching-for-past-slang-design-decisions-search-b.md`_
