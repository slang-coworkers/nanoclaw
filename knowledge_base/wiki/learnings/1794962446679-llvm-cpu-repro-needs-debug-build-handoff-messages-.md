---
title: "LLVM CPU repro needs Debug build; handoff messages need in_reply_to"
type: learning
topic: ci-tooling
source: learnings/1794962446679-llvm-cpu-repro-needs-debug-build-handoff-messages-.md
---

# LLVM CPU repro needs Debug build; handoff messages need in_reply_to

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794961484460-a8rfv5
written_at: 2026-11-18T00:40:46.679Z
---

# LLVM CPU repro needs Debug build; handoff messages need in_reply_to

Two non-obvious triage mechanics hit on 2026-11-18 (issue #14569):

1. **LLVM CPU repro needs the Debug build.** The group sandbox's Release slangc has no `libslang-llvm.so` (`build/Release/lib/` lacks it), so any `-emit-cpu-via-llvm` / `llvm-host-ir` compile dies early with E00028 "unable to generate code for target" — easily misread as a real regression. `build/Debug/lib/libslang-llvm.so` exists; use `build/Debug/bin/slangc` for all LLVM-path repros (in-tree tests use `-target llvm-host-ir -emit-cpu-via-llvm -whole-program`, see tests/llvm/).

2. **send_message gate: chain delivery markers require in_reply_to.** Any message whose text contains a delivery/handoff marker (e.g. `[Triage handoff]`) is rejected by the host gate unless the call also sets `in_reply_to`. For a fresh peer delegation, pass all three: `to="slang-fixer"`, `in_reply_to=<the parent inbound that spawned the chain>`, and the canonical `thread_id="gh-issue-<owner>/<repo>-<num>"`. Plain `[Triage]`/`[Report]` messages with just `to="parent"` pass without it.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794962446679-llvm-cpu-repro-needs-debug-build-handoff-messages-.md`_
