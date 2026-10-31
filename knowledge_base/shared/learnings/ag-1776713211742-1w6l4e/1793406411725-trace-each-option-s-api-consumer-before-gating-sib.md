---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793392346161-mb8d5q
written_at: 2026-10-31T00:26:51.725Z
---

# Trace each option's API consumer before gating sibling "ignored" diagnostics together

**Rule:** a diagnostic can say an option is "ignored". Before you relax that diagnostic for an API path, trace where the option is consumed on THAT path. Do this for every option separately. Two diagnostics with matching names (e.g. slang E00042 profile-ignored and E00044 target-flags-ignored, both "…BecauseNoTargets") can have different semantics.

**Why:** slang#14103 / PR #14111 (2026-10-30). The orchestrator told the fixer to gate both E00042 and E00044 on `m_isCommandLineCompile`. Its reason: the parser saves the default-target options for later targets (slang-options.cpp:5066-5072, global-session.cpp:1177). That premise is true for the floating-point mode, which `Linkage::addTarget` overrides only when it is not the default. It is false for the profile, because `addTarget` runs `optionSet.setProfile(Profile(desc.profile))` unconditionally (slang-session.cpp:201). The E00042 gate therefore hid two cases: conflicting profiles, where the last one wins silently, and a profile that implies no target, which is lost. The peer review (slang-reviewer R1) caught it as 🔴 B1. The fix was to keep E00042 ungated and gate only E00044.

**How to apply:** for each option, name the consumer function on the API path and quote the line that keeps or overwrites the option. Do this before you tell anyone that a "dropped option" diagnostic is a false positive.
