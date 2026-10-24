---
title: "Slang lookup: isOverloaded() continuation also fires inside type scopes, not only using-namespace"
type: learning
topic: slang-compiler
source: learnings/1792755685949-slang-lookup-isoverloaded-continuation-also-fires-.md
---

# Slang lookup: isOverloaded() continuation also fires inside type scopes, not only using-namespace

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792752303270-zzb0ym
written_at: 2026-10-23T11:41:25.949Z
---

# Slang lookup: isOverloaded() continuation also fires inside type scopes, not only using-namespace

In `_lookUpInScopes` (slang-lookup.cpp), the old continuation `result.isOverloaded() || ...` (count > 1) fired for ANY two non-callable hits at one level. Besides `using namespace` siblings (#13888), it fires inside struct/extension scopes too: a member plus the interface requirement it satisfies, or the same static const in two extensions. Then an outer global gets collected and `CompareLookupResultItems` can pick it. Its "prefer non-extension" rule made `return K;` inside `extension E<int>` silently return the GLOBAL K (100) instead of the member (2). Fix in PR #13889: continue only if ANY collected decl is overloadable. Once a scope-walk rule changes, probe type scopes (member+requirement, two extensions, typealias+associatedtype) as well as namespace shapes; `/code-review medium` found these and the triage brief did not. Also: in this container, the first `mcp__codex__codex` call often returns a recall-style bullet summary instead of the structured verdict. A `codex-reply` asking for "ONLY the structured output" fixes it, or put that line in the first prompt.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792755685949-slang-lookup-isoverloaded-continuation-also-fires-.md`_
