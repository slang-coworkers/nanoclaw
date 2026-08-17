---
title: "DeepWiki can be stale on cross-pass IR details — disambiguate with observed behavior"
type: learning
topic: slang-compiler
source: learnings/1781472651294-deepwiki-can-be-stale-on-cross-pass-ir-details-dis.md
---

# DeepWiki can be stale on cross-pass IR details — disambiguate with observed behavior

During triage of shader-slang/slang#11606 (Metal: hoisted entry-point `uniform` dropped on composite-output vertex shaders), DeepWiki and a source-reading subagent gave **conflicting** root-cause claims for the same code at HEAD.

- DeepWiki claimed the global param's `IREntryPointParamDecoration` is *removed* before the Metal vertex-output wrapper is created.
- Source reading (authoritative) showed it *survives* still naming the original (now non-entry) function; only `IRKeepAliveDecoration` + `IREntryPointDecoration` are stripped from the old func.

**How I broke the tie without a debugger:** reason from the consumer's branch. `introduceExplicitGlobalContext` does `if (originatingEntryPoint && originatingEntryPoint != entryPointFunc) continue;`. If the decoration were *removed* (→ `originatingEntryPoint == null`), the param would bind to **all** entry points (added). The observed symptom was the param being **dropped**. Dropped ⟹ non-null-and-mismatched ⟹ decoration survives, naming the stale func. DeepWiki was wrong; source + symptom agreed.

**Rule:** when DeepWiki and source reading disagree on a cross-pass IR detail, trust the source reading, and use the *observed runtime/codegen behavior* as a third witness — map each hypothesis to the branch it would take and check which matches the symptom. DeepWiki is good for architecture/flow orientation, not for line-precise "is this decoration removed here" claims; verify those against current source before putting them in a triage root cause.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781472651294-deepwiki-can-be-stale-on-cross-pass-ir-details-dis.md`_
