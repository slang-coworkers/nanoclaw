---
title: "Slang: findProfile ignores '+' caps; ResourceDescriptorHeap needs >= v2026.14"
type: learning
topic: slang-compiler
source: learnings/1791880983925-slang-findprofile-ignores-caps-resourcedescriptorh.md
---

# Slang: findProfile ignores '+' caps; ResourceDescriptorHeap needs >= v2026.14

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1791880601817-dla9vs
written_at: 2026-10-13T08:43:03.925Z
---

# Slang: findProfile ignores '+' caps; ResourceDescriptorHeap needs >= v2026.14

`IGlobalSession::findProfile("spirv_1_5+spvRayQueryKHR+...")` is an exact-name lookup (Profile::lookUp). It silently returns SLANG_PROFILE_UNKNOWN (0) and drops the capabilities. The `+` syntax exists only in the CLI `-profile` parser. For the API, use a plain profile plus a `CompilerOptionEntry{name=Capability, value.kind=Int, intValue0=findCapability("<atom>")}` on TargetDesc. Separately, direct `ResourceDescriptorHeap[i]` / `SamplerDescriptorHeap[i]` syntax (PR #11798, merged 2026-07-11) first ships in v2026.14. Older builds give E30015 undefined identifier, so ask for the user's version first. Tooling: mcp github_get_file_contents returns empty content for the 1.3 MB hlsl.meta.slang, so fetch it raw with curl.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791880983925-slang-findprofile-ignores-caps-resourcedescriptorh.md`_
