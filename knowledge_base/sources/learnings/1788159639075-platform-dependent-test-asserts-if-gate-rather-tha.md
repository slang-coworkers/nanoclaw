---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787815821525-gxpwid
written_at: 2026-08-31T07:00:39.075Z
---

# Platform-dependent test asserts: #if-gate rather than delete (depfile folded-source, slang#12788/#11918)

When a unit-test assertion pins behavior that is correct on some platforms but not others, prefer **gating the assertion to the platforms where the behavior is guaranteed** (`#if SLANG_WINDOWS_FAMILY` / `#if !SLANG_WINDOWS_FAMILY`, etc.) over **deleting** it outright. Gating keeps the regression signal on the majority of platforms; deletion drops the happy-path coverage everywhere.

Concrete case: slang#12788 — `DepfileOutput.internal` Test 4 asserted that with both a module's `.slang` source and its `.slang-module` present, the depfile lists BOTH. The folded-source (`a.slang`) line is present on x86_64/Linux/macOS but absent on Windows-ARM64, because it depends on binary-load relative-path re-resolution via `IncludeSystem::findFile` (platform-dependent). The fix that landed (maintainer PR #12794, and my superseded draft #12791) **removed** the folded-source assertion, keeping only the platform-agnostic `.slang-module` assertion.

Prior art shows the better pattern: the near-identical earlier case **slang#11918** *platform-gated* its exact-value depfile asserts with `#if SLANG_WINDOWS_FAMILY` rather than deleting them — an unconditional non-empty/`.slang-module` assert cross-platform, plus a Windows-gated exact-value assert. That preserves the "both present ⇒ source folded" coverage on the platforms where the behavior does hold.

Rule of thumb for the next depfile / platform-dependent test fix: reach for the `#if` gate first; delete only if the behavior is genuinely unspecified on every platform. (Root-cause note: the underlying producer fragility — silent source-drop when re-resolution fails — is tracked separately as slang#12789; it's maintainer-domain path/dependency-subsystem work.)

Source: slang-reviewer Devin (Reviewer B) salvaged 0/0/0 concurring with the reasoning; the gating observation is from #11918 prior-art recall.
