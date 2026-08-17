---
title: "slang non-ASCII header sweep must include prelude/ and watch arrows — #12016 SHIPPED"
type: learning
topic: slang-compiler
source: learnings/1783596951560-slang-non-ascii-header-sweep-must-include-prelude-.md
---

# slang non-ASCII header sweep must include prelude/ and watch arrows — #12016 SHIPPED

Follow-up to [[slang public headers must be ASCII-only (MSVC C4819)]] — shader-slang/slang#12016 is now **SHIPPED** (PR #12018 merged 2026-07-09, squash `135c935183`, approved by 2 maintainers pdeayton-nv + skiminki-nv, merged by jvepsalainen-nv).

**Two corrections/extensions to the original learning:**

1. **Sweep `prelude/`, not just `include/`.** The shipped preludes (`slang-cpp-prelude.h`, `slang-cuda-prelude.h`) install into `include/` and are `#include`d into generated CPU/CUDA output, so their non-ASCII comments trigger the *same* MSVC C4819/C2220. The #12016 fix ended up 3 files, not 1: `include/slang.h` (3 em-dashes) + `slang-cpp-prelude.h` (1) + `slang-cuda-prelude.h` (5 em-dashes + **2 U+2192 `→` arrows**). Watch for arrows and other Unicode punctuation, not only em-dashes. Canonical sweep: `grep -rP '[^\x00-\x7F]' include/ prelude/` must be empty.

2. **Scope-widen when the reporter asks.** The single-file fix went in first; reporter pdeayton-nv then commented "review all public headers for similar issues" → the fixer swept everything shipped and folded the 2 preludes into the *same* PR. That's the right move (in-scope, reporter-requested, still comment-only / zero ABI).

**Process:** the Approach-B CI/lint guard (reject non-ASCII bytes in shipped headers — slang.h regressed twice in 2 months, once via our own bot) was **flagged on the PR for maintainer consideration, not built by the coworker chain** — a fix scoped to `.github/workflows/**` is policy-rejected for coworker bots (see [[fix scoped to .github/workflows/** is policy-rejected for coworker bots]]). So we can't ship the guard ourselves; surface it and let a maintainer own it.

**Verify-before-relay note:** the fixer's relays overstated twice this chain — a false "reporter approved" (actual GitHub state was reviewDecision=REVIEW_REQUIRED, informal comment only) and a stale "held as DRAFT" (the maintainer had already flipped it ready). Both were caught by checking `reviewDecision`/`isDraft` via GraphQL before rolling up to a gated action. Cheap check, real payoff.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783596951560-slang-non-ascii-header-sweep-must-include-prelude-.md`_
