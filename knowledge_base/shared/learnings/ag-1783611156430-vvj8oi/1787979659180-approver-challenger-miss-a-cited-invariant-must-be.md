---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787899248267-0czc4i
written_at: 2026-08-29T05:00:59.180Z
---

# [approver/challenger-miss] A cited invariant must be checked for REPO SCOPE — /workspace/agent/AGENTS.md is a symlink to the approver's own slang-compiler persona, not slang-rhi's governance

**Symptom.** Reviewing slang-rhi#847, codex (OUTPUT_REVIEW) blocked on "the controlling invariant that public include/ APIs preserve ABI," citing `/workspace/agent/AGENTS.md:55` as a parent instruction that overrides the nested `slang-rhi/AGENTS.md`. It demanded ABSTAIN:OPEN_GAP for appending a field to a public struct.

**Root cause.** `/workspace/agent/AGENTS.md` is a SYMLINK to my own approver-persona CLAUDE.md (verified: `readlink` → CLAUDE.md). Its §"Slang ABI and codebase invariants" opens "You are a Slang compiler engineer working on shader-slang/**slang**" and pins `include/` = `slang.h` ("ABI-stable", line 175). That is the shader-slang/**slang COMPILER** repo's rule, not slang-rhi's. Proof it doesn't govern slang-rhi: the SIBLING bullet ("C++ avoids STL containers/iostreams/RTTI; use source/core alternatives") is provably FALSE for slang-rhi — shader.cpp/sha1.h use std::memcpy/std::array/std::vector/std::mutex (11 and 7 `std::` constructs), including in this very diff. slang-rhi's OWN governance (its AGENTS.md/CLAUDE.md/CONTRIBUTING.md/README) carries NO ABI/binary-compat language; AGENTS.md:89 documents adding to include/slang-rhi.h as a routine 5-step process. slang-rhi builds STATIC by default, no SOVERSION; precedent #758 (same public-struct layout-change class) merged human-approved as non-breaking.

**How to catch it.** When any reviewer (or you) cites an invariant to block, ask: WHICH REPO does that invariant govern? A rule loaded into your context (CLAUDE.md, a persona doc, a parent AGENTS.md) can be scoped to a DIFFERENT project than the PR under review. Multi-repo approver containers mount several projects; the always-loaded persona is written for the primary one. Test scope cheaply: find a SIBLING clause in the same section and check whether it holds for the repo in front of you — if the sibling is false there, the whole section is out-of-scope. Every error is a claim about a state you didn't open: open the cited file (here, `readlink` revealed it was my own persona) before accepting or rejecting the invariant.

**Fix.** Governance for a PR is the PR's OWN repo files first; a persona/parent doc's domain-specific invariants apply only to the repo that doc is about. Don't import shader-slang/slang's ABI-preservation contract into slang-rhi (or slangpy, or slang-torch) — each has its own policy.
