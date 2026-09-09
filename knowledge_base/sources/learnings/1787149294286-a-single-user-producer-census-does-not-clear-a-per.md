---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787146218418-jdhweq
written_at: 2026-08-19T14:21:34.286Z
---

# A single-user-producer census does not clear a per-origin gate

**Context:** design review of shader-slang/slang #12623 — defer user `[ForceInline]` to NVRTC on CUDA by tagging a new `kIROp_UserForceInlineDecoration` at the one user producer and having the inliner skip *that* arm on CUDA. The fixer's safety argument rested on a census: "`kIROp_ForceInlineDecoration` has exactly 1 user producer (`slang-lower-to-ir.cpp:14643`) and ~20 compiler-inserted ones; gate only the user arm, so load-bearing compiler inlines are untouched." The census (exactly-1-user) was TRUE and verified.

**The trap:** a per-origin gate keyed on "this decoration came from the user" is only safe if *provenance ⇒ purpose* — i.e. the user attribute is the SOLE reason that function must inline. That fails when a producer shares one decoration for two purposes via a guard. In Slang, the constexpr-rate-param force-inline (`slang-lower-to-ir.cpp:14698`) is wrapped `if (!isInline)`, and the user `[ForceInline]` branch (:14641) already set `isInline=true`. So for `[ForceInline] void f(constexpr int n)` (legal Slang) the compiler SKIPS adding its own ForceInline — the user's decoration is now silently doing double duty as the compiler's constexpr correctness-inline. Gating "defer when user-marked" then drops a correctness guarantee the census said was safe. Same pattern at the diff-setter site (`:13971`: `if (!decl->findModifier<ForceInlineAttribute>()) addForceInline`).

**The rule:** when a change gates/defers/strips a decoration *by origin*, a "only N producers, we only touch M of them" census is necessary but NOT sufficient. You must additionally check every producer that is SKIPPED/guarded when the target decoration is already present (grep the insertion sites for `if (!isInline)`, `if (!...findModifier<X>())`, `if (!hasDecoration)` guards). Those are exactly the places where one decoration silently absorbs a second, load-bearing reason. The principled fix is producer-side: make the compiler add its OWN decoration for the real reason regardless of the user attribute, so the gate keying on origin can't strip a purpose it doesn't know about.

**Also confirmed reusable:** to check whether adding a NEW IR decoration op can "ride along" onto compiler-built functions invisibly, audit every `for (auto d : inst->getDecorations())` clone loop in autodiff/link/specialize — in slang they are all op-FILTERED (copy a specific whitelist, or a remove-set), none clone-all onto a fresh func, so a new op only propagates where a `case` is explicitly added. Don't assume; grep and read each loop body.
