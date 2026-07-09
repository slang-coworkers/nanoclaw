---
name: project_7878_optional_opaque_none_ice
description: "#7878 Optional<opaque> none ICE — draft PR #12005 held; new IR diag E41037; maintainer-gated"
metadata: 
  node_type: memory
  type: project
  originSessionId: b8bdda04-ca21-4f66-a138-a5f247fc238c
---

**#7878** — returning `none` from a generic *member* accessor whose `Optional<T>` payload binds to an opaque/resource type (e.g. `Optional<Texture2D>`) ICEs at SPIR-V emit (`Unhandled local inst … defaultConstruct`). Labeled *Missing Diagnostic* — maintainers want a clean error, not codegen.

**Root cause (verified @ `bfe6a7f14`):** E30902 (`OptionalCannotWrapResourceType`) exists but the three front-end guards gate on `typeTransitivelyContainsOpaqueHandle` at AST-check while `T` is abstract; concrete `Optional<Texture2D>` only appears post-specialization and is never re-checked. Discriminator proven: generic free-fn + non-generic both emit clean E30902; only the generic *member* ICEs.

**Fix (Approach A):** draft PR **#12005** (branch `fix/issue-7878`, base master, `pr: non-breaking`, `Closes #7878`, assignee expipiplus1). Extends IR pass `checkForOptionalNoneUsage` (runs post-specialization, pre-`lowerOptionalType`, already has a sink) to emit a **new IR-layer diagnostic E41037** (`optional-cannot-wrap-resource-type-ir`) for `MakeOptionalNone` of an opaque payload. New code (not reused E30902) because E30902's struct is AST-typed and the untyped emit renders classic-style; E41037 mirrors sibling **E41027** so it renders rich. **Maintainer-flagged point:** code-number choice (E41037 vs reuse 30902) — two-line revert if they prefer single code.

**DescriptorHandle path (#9932 / PR #10064) unaffected** — lowers to integer handle, `isOpaqueType` skips it, so Approach A excludes it for free (sidesteps the Approach-B caveat).

**State:** DRAFT-held, maintainer-gated (review → ready → merge; bot drafts-only, ready/merge operator-gated). Issue carries nv-slang-bot resolution comment ([issue #7878](https://github.com/shader-slang/slang/issues/7878), [PR #12005](https://github.com/shader-slang/slang/pull/12005)).

**Maintainer review 07-08 (pdeayton-nv, multi-round; through round-4) — fixer iterating (UNVERIFIED, re-push pending):** strip lua comment (1), inline helper, **rename** pass→`checkForInvalidOptionalUsage` + file→`slang-ir-check-optional-usage`, line-pin diagnostic tests. **Item 3 was a REAL bug** (not deferred as first thought): Optional inside a struct field slipped the linear peel loop → fix = added `IROptionalType` arm to shared `isOpaqueTypeImpl` (opacity composes through Optional at any depth), deleted the peel loop; blast-radius-checked (other callers run post-`lowerOptionalType`). **Item 2:** made pass unconditional with a bool gating only the always-none check + error-return before `lowerOptionalType` (per `diagnoseCircularConformances`). Added `Optional<Struct{Optional<Texture2D>}>` test case. Rebuild(debug) running → verify + re-push. NOTE: fixer reports directly to Main (tier-skip past triager); do NOT message fixer to correct (would mint competing parent edge) — triager owns the peer-wire edge and rolls up. Not relaying per-round beats upstream; relay only verified re-push / ready-flip / merge / blocker. Review/CI follow-up on #12005 is webhook-driven → routes to slang-fixer session (**`report_pr_created` CONFIRMED** 07-08 — mapping in place, no orphaning risk). Chain owned by slang-triager (peer-wired to fixer); fully closed at triager tier. Substantive new human comment re-opens per standing rule.
