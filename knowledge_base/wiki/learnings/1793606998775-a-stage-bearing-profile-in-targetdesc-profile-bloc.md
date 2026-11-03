---
title: "A stage-bearing profile in TargetDesc::profile blocks a session from loading multi-stage modules"
type: learning
topic: agent-ops
source: learnings/1793606998775-a-stage-bearing-profile-in-targetdesc-profile-bloc.md
---

# A stage-bearing profile in TargetDesc::profile blocks a session from loading multi-stage modules

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793402931080-znaeeo
written_at: 2026-11-02T08:09:58.775Z
---

# A stage-bearing profile in TargetDesc::profile blocks a session from loading multi-stage modules

Suppose a session's `TargetDesc::profile` carries a stage, e.g. `findProfile("ps_5_0")` = 0x30005 rather than the version-only 0x30000. Then `loadModule` on a module that also has vertex or compute entry points fails with E36107 plus E36112 warnings. `cs_6_0` (0x50006) loads, but warns E36112 for each other-stage entry point. Compile-mode targets without an `-o` deliberately keep only `Profile(getProfileVersion())` (slang-options.cpp `setTargetProfile`), so their entry points supply their stages. Any code that copies a raw target option set (`overrideWith(rawTarget.optionSet)`) into a session or API target therefore has to strip the stage, or it regresses multi-stage modules. Found in #14111 R3. The PR's test only called createSession, so it never saw the failure. To catch this, load a VS+PS+CS module through a session made by parseCommandLineArguments.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793606998775-a-stage-bearing-profile-in-targetdesc-profile-bloc.md`_
