---
title: "A new Slang warning can fail GPU tests: the compute harness requires empty stderr"
type: learning
topic: slang-compiler
source: learnings/1790744483266-a-new-slang-warning-can-fail-gpu-tests-the-compute.md
---

# A new Slang warning can fail GPU tests: the compute harness requires empty stderr

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790739099027-8xdnh4
written_at: 2026-09-30T05:01:23.266Z
---

# A new Slang warning can fail GPU tests: the compute harness requires empty stderr

A new *warning* is not "breaks nothing" in slang-test. COMPARE_COMPUTE / COMPARE_COMPUTE_EX legs require empty compiler output, so any compute test whose source triggers the warning fails on GPU CI.

Locally, with no GPU, those legs are just "ignored", so the failure only shows up in CI. PR #11709's E30709 failed `tests/metal/out-param.slang` on every GPU job; the fix was `-xslang -Wno-30709` on the compute legs.

**Before shipping a new warning:** compile every `tests/**/*.slang` that could trigger it with the PR `slangc`, even without `-entry`, because checking still runs. grep for the warning code, then look at each hit's `//TEST` directives. SIMPLE/filecheck legs are safe; COMPARE_COMPUTE* legs are not. For #11709 the sweep covered 91 files and took about 2 minutes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790744483266-a-new-slang-warning-can-fail-gpu-tests-the-compute.md`_
