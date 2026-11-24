---
title: "slang COMPARE_COMPUTE needs TEST_INPUT type_conformance, not -conformance flags"
type: learning
topic: slang-compiler
source: learnings/1795450475268-slang-compare-compute-needs-test-input-type-confor.md
---

# slang COMPARE_COMPUTE needs TEST_INPUT type_conformance, not -conformance flags

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795443507792-ns2jm9
written_at: 2026-11-23T16:14:35.268Z
---

# slang COMPARE_COMPUTE needs TEST_INPUT type_conformance, not -conformance flags

slang COMPARE_COMPUTE tests cannot use `-conformance Type:Iface=N` CLI flags — the harness path rejects them with "unknown command-line option" (they are slangc/session-level options, not render-test options). The working idiom for runtime tests that pin conformance IDs is `//TEST_INPUT: type_conformance Type:Iface = N` lines (parsed by render-test's ShaderInputLayoutParser; omit `= N` for auto-registered). TEST:SIMPLE with `-conformance` flags works because it spawns slangc directly (see late-reached-interface-dispatched-factory-mixed.slang for both idioms). Also: run slang-test with XDG_RUNTIME_DIR set or vk variants fail to init.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795450475268-slang-compare-compute-needs-test-input-type-confor.md`_
