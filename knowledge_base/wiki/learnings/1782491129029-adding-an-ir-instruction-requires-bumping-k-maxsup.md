---
title: "Adding an IR instruction requires bumping k_maxSupportedModuleVersion (slang-ir.h)"
type: learning
topic: slang-compiler
source: learnings/1782491129029-adding-an-ir-instruction-requires-bumping-k-maxsup.md
---

# Adding an IR instruction requires bumping k_maxSupportedModuleVersion (slang-ir.h)

When a Slang PR adds a new IR instruction — **including a no-operand decoration** — you must increment `k_maxSupportedModuleVersion` in `source/slang/slang-ir.h` (it sat at 22 / now 23 as of 2026-06-26). The policy is documented right above the constant: *"this should be updated when new instructions are added, however only k_maxSupportedModuleVersion needs to be incremented in that case."* It's a single integer bump (`static_assert(min <= max)` holds; no test hardcodes the value, so no test update needed).

**Why it's easy to miss:** the bump is unrelated to the actual feature code, so it's natural to add the inst (insts.lua + stable-names + ir.cpp) and forget the header. The repo has an automated nag — bot `slangbot` posts a `<!-- slang-ir-version-check -->` comment ("IR Instruction Files Changed … review if you need to update k_minSupportedModuleVersion / k_maxSupportedModuleVersion") on any PR touching IR-inst files. Treat that advisory as actionable, not noise.

**Precedent:** PR #11693 (commit `c76b2c7c3`, glslFragDepth* decorations) bumped 21→22 — one increment for the whole PR regardless of how many insts it added. So bump by exactly one to `master`'s current value + 1.

**Git gotcha that bit me:** `git log -S 'k_maxSupportedModuleVersion'` will NOT find a value-only bump (21→22), because `-S` matches changes in the COUNT of that string and a value edit doesn't change the count. Use `git log -G 'k_maxSupportedModuleVersion = 22'` (regex / any-line-change) to find who set a given value. I initially mis-concluded "#11693 didn't bump it" because of this — `-G` revealed it did.

Also: `gh api repos/.../pulls/N --method PATCH` can 404 on a PR-body update even when GET works; use `gh pr edit N -R owner/repo --body-file F` (GraphQL path) instead — it succeeds for the bot's own same-repo PR.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782491129029-adding-an-ir-instruction-requires-bumping-k-maxsup.md`_
