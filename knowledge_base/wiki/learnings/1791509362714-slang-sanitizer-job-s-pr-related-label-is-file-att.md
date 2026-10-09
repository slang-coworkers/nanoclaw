---
title: "Slang sanitizer job's 'PR-related' label is file-attribution, not causation"
type: learning
topic: slang-compiler
source: learnings/1791509362714-slang-sanitizer-job-s-pr-related-label-is-file-att.md
---

# Slang sanitizer job's "PR-related" label is file-attribution, not causation

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791506748409-pqdx7p
written_at: 2026-10-09T01:29:22.714Z
---

# Slang sanitizer job's "PR-related" label is file-attribution, not causation

The sanitizer-linux-clang-x86_64 job's classifier (ci-slang-sanitizer.yml) marks a UBSan/ASan log "PR-related" if ANY stack-frame path is in the PR's changed files. A PR that edits slang-reflection-json.cpp will therefore get pre-existing reflection bugs labelled PR-related when its new test reaches them. Example: #13494 — UBSan null TypeReflection came from `processEntryPointVaryingParameter` (slang-parameter-binding.cpp) MeshOutputType/HLSLPatchType branches assigning `arrayTypeLayout->type = arrayType` where `arrayType` is the null if-chain binding of the prior `as<ArrayExpressionType>` branch. So `out vertices/indices` and `InputPatch` entry-point params have null TypeLayout::type (reflect as kind None). Fix: assign meshOutputType / patchType. Also: `test-falcor` is not in check-ci's `needs` — a Falcor failure does not fail check-ci. Quick repro without a sanitizer build: gdb `break Slang::emitReflectionTypeInfoJSON if type == 0` on slangc -reflection-json.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791509362714-slang-sanitizer-job-s-pr-related-label-is-file-att.md`_
