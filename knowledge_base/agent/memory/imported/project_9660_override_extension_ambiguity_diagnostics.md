---
name: project_9660_override_extension_ambiguity_diagnostics
description: "slang#9660 inconsistent override/extension member-call precedence — WATCH-ONLY, maintainer-owned, interim draft PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b3a9237-8ec1-4442-af93-580ec484abbd
---

**shader-slang/slang#9660** — "Inconsistent override behavior in extension." Member-call resolution uses different precedence depending on whether the member is accessed via an interface-typed variable vs a concrete object; nested-type static-call cases resolve silently to base instead of erroring.

Author/maintainer **skiminki-nv** (MEMBER), assignee expipiplus1. Labels Dev-Opened + reproduced, Type=Language-Maturity (all human-set).

**State (2026-07-22): WATCH-ONLY / held — maintainer-owned.** skiminki's comment (5044095227) narrows near-term scope to **diagnostics only**: warn the divergent-precedence member cases (`obj.ifaceFunc()` vs `TestClass().memFunc()`), make the silent base-nested-type-wins case (`TestClass.NestedType().getValue()`) an ambiguity error too; `override` keyword explicitly **rejected**. He said "I'll update the description."

Interim **draft PR #11820** VERIFIED OPEN (`Refs #9660`, non-closing, MERGEABLE) — declaration-site symmetric `warning[E41037]`, staged and held for exactly this semantics decision. Note divergence: skiminki's framing is call-site/split-severity; #11820 is declaration-site/symmetric — reconciling needs his updated description.

**No new GitHub post made** (not a comment-required state; #11820 already cited on issue via 2026-06-23 bot triage comment, so not footprint-less).

**2026-07-23 update (slang-fixer, 2 webhooks, both closed):** (1) skiminki-nv asked to "desloppify" the #9660 warning note — fixer rewrote it (emdashes→parens, semicolon→sentence break), docs-only/format-neutral, pushed **#11820 HEAD 8f2439a1b3**, CI dispatched (draft); replied on thread `pull/11820#discussion_r3636711513` (left unresolved — human thread). (2) skiminki-nv **reassigned #9660 to @expipiplus1** as design-decision owner (was tangent-vector) — informational, no code action. #11820 remains a holding diagnostic keeping #9660 open. All within policy (draft push + review-thread reply free; no ready/merge). Did NOT trip the resume trigger — docs nit ≠ new semantics dispatch.

**Resume trigger** (held by slang-triager in `triage-9660.md`): skiminki (or now design-owner **expipiplus1**) updates the description (or says "make a PR") → triager diffs the spec vs #11820's mechanism, **flags Main before any fixer dispatch** (maintainer-owned), then aligns #11820 if it diverges. Chain OPEN. Related: [[reference_slang_maintainer_handles]].
