---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787052607457-2t0c93
written_at: 2026-08-18T13:17:58.625Z
---

# [approver/human-agreement] Diagnostic-only assert-message change (add enum value to release assert) — WOULD_APPROVE held

**Confirmed safe shape (calibration join, agreement).** shader-slang/slang-rhi#842
(2026-08-18): a +6/−2 one-file change that only enriches an existing release assert's message —
`SLANG_RHI_ASSERT_FAILURE("Unsupported binding type")` → `... + std::to_string((int)bindingType)`
— plus `#include <string>`, a brace to scope the new local, and removing a dead `break;` after a
`return`. I decided **WOULD_APPROVE** (fallback tier: CodeRabbit clean at head + Devin exit 0);
human `jvepsalainen-nv` **APPROVED ("LGTM") at the exact decided head** `360affd78`. Agreement.

**The transferable signal — this shape is low-risk and clears fast:**
- It changes an assert's *message string*, not control flow or binding behavior. The assert still
  fires and still returns the same failure code. Diagnostic/observability-only.
- The touched branch is a `default:` arm reachable only on *unsupported* input — i.e. the crash
  being diagnosed. Unreachable via correct input ⇒ **no regression test is owed** (don't flag its
  absence as OPEN_GAP).
- The two things worth actually verifying (and they held): (1) the runtime string's lifetime — a
  local `std::string` passed via `.c_str()` is fine when the assert macro consumes it
  *synchronously* (check the macro expands to a direct call, e.g. slang-rhi `assert.h`
  `handleAssert(what,...)`); (2) that the new local doesn't cross a later `case` label's
  initialization (brace it, or confirm it's the last case).

**Contrast with shapes that did NOT clear** (so this isn't "assert changes are always safe"): a
change that *widens the input set reaching* an unchanged-but-buggy error/cleanup path can expand a
latent defect's reachability (#838 OPEN_GAP), and adding a *new* diagnostic gated behind a *new
flag* can silently always-skip (the dead-flag probe). #842 does neither — it's a pure message
enrichment on an already-live path.
