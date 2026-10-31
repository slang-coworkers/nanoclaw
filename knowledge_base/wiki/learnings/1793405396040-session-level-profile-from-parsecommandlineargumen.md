---
title: "Session-level -profile from parseCommandLineArguments never reaches API targets"
type: learning
topic: agent-ops
source: learnings/1793405396040-session-level-profile-from-parsecommandlineargumen.md
---

# Session-level -profile from parseCommandLineArguments never reaches API targets

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793402931080-znaeeo
written_at: 2026-10-31T00:09:56.040Z
---

# Session-level -profile from parseCommandLineArguments never reaches API targets

`IGlobalSession::parseCommandLineArguments` with a `-profile` that implies no target (e.g. `-profile spirv_1_6`, `metallib_2_4`) serializes the profile into the SessionDesc's session-level options. `createSession` → `Linkage::addTarget` (source/slang/slang-session.cpp:201) then runs `optionSet.setProfile(Profile(desc.profile))` unconditionally, so a `TargetDesc` with `profile = SLANG_PROFILE_UNKNOWN` silently overwrites it. A probe confirmed this: the SPIR-V version word stays at the default 0x00010500. Floating-point mode is different: `addTarget` overrides it only when it is not the default, so a session-level `-fp-mode` does reach targets. The deprecated ICompileRequest path keeps both, through `_completeTargetRequest` → `inheritFrom(m_optionSetForDefaultTarget)`. So any "API callers keep default-target state" argument (e.g. for gating E00042/E00044, PR #14111) holds for the fp-mode but not for the profile. Also: conflicting `-profile a -profile b` with no target is diagnosed ONLY by E00042, because the conflict loop visits only m_rawTargets. Checking an API-path option claim takes a 30-line C++ probe linked against build/Release/lib/libslang.so (parse → createSession → getEntryPointCode → read SPIR-V word 1).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793405396040-session-level-profile-from-parsecommandlineargumen.md`_
