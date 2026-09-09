---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787091901414-lzbqun
written_at: 2026-08-19T02:11:10.326Z
---

# [approver/safe-shape] COM-interface method deprecation — the ABI-safe pattern and its blocking discriminator

**Context:** slang#12610 "Deprecate IGlobalSession::addBuiltins()" @0a94ae912a15 — a +3/−1 PR that prepends `[[deprecated]]` to a public COM-interface pure-virtual and wraps its one internal caller. Decided WOULD_APPROVE; human (tangent-vector) had already approved. Devin-only tier (harvest exit 20: production review skips bot-authored PRs).

**The safe shape (all four must hold — if so, a deprecation of a public COM/vtable method is ABI+source compatible, `pr: non-breaking`):**
1. The diff ONLY prepends the deprecation attribute — the vtable slot position, method signature, `SLANG_MCALL` decoration, and declaration order are unchanged. A diagnostic attribute is not part of the vtable. (This is the primary risk for `IGlobalSession`/`IModule`/`IComponentType` etc.: a "deprecate" that reorders/removes/inserts/re-signatures corrupts the vtable — see the project CLAUDE.md "Modifying Public Headers → Virtual tables".)
2. Every warning-producing USE inside the tree is suppressed. Key C++ rule: **`-Wdeprecated-declarations` fires on USES, not on override declarations/definitions, and not on taking the address of a *derived* (non-deprecated) override.** So the only site needing a `SLANG_ALLOW_DEPRECATED_BEGIN/END` wrap is a *call through the base interface pointer* (here `session->addBuiltins(...)` in the `spAddBuiltins` C-API forwarder, slang-api.cpp:383). Overrides in proxy/impl/unit-test classes and a `REPLAY_REGISTER`-style `&Derived::method` do NOT warn — don't flag them as missing suppression.
3. There is an existing precedent on the same interface to mirror. Here `IGlobalSession::createCompileRequest()` (the immediately-preceding method, slang.h:4176) was already `[[deprecated]]` with the identical suppression. Matching the sibling is correct; making the new method diverge (e.g. `SLANG_DEPRECATED` when the sibling uses raw `[[deprecated]]`) is worse, not better.
4. Scope matches the PR's stated purpose (phase-1 attribute only; implementation left intact). No gap in the self-declared mechanism.

**Blocking discriminator:** a gap in the PR's *self-declared* mechanism (the warning never fires, the wrap missed a real base-typed call, or the vtable actually moved) is a withhold. An *incidental* pre-existing inconsistency the PR neither introduces nor worsens is ADVISORY/follow-up, not OPEN_GAP. Instance: raw `[[deprecated]]` bypasses the `SLANG_NO_DEPRECATION` opt-out (`SLANG_DEPRECATED` in slang.h:582 respects it) — but that matches the adjacent precedent and is a whole-header normalization job, so it's advisory, not blocking.

**Process near-miss worth repeating:** the CI histogram is a `check-runs` endpoint that TRUNCATES — `per_page=100` still returned a page of a 140-item set, and I reported a wrong "zero failures" then a wrong "48/50/2" before hand-paging (page1+page2, sum==total_count) to the true 51/87/2. Also, the 2 failing check-runs belonged to a **distinct `workflow_dispatch` CI run**, not to an attempt of the PR's `pull_request` CI run (which was green on attempt 2) — always resolve `actions/runs/<id>` `.event` + `.previous_attempt_url` before asserting a rerun relationship. (Both caught by the OUTPUT/DECISION critique gate, not a human.)
