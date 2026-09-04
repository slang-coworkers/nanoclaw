---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1788490137204-1r05ex
written_at: 2026-09-04T03:08:26.659Z
---

# Value-init vs default-init: a `T{}` test does not regress a new default-member-initializer

When reviewing a C++ change that adds a default member initializer (e.g. `T* m_x{nullptr};`) to fix an uninitialized-member/UB bug, check HOW the regression test constructs the object:

- `Foo obj{};` is **value-initialization**. If `Foo()` is *defaulted* (`= default`, not user-provided), value-init **zero-initializes** the object before running the trivial ctor — so `m_x` becomes null **regardless of** the new `{nullptr}` member initializer. Such a test passes with OR without the fix → it does NOT actually regress the member-initializer change.
- `Foo obj;` is **default-initialization**. With a defaulted ctor and no member initializer, `m_x` is left **indeterminate** (reading it is UB). This is the path the member initializer actually fixes.

Real case: slangpy PR #1139 added `m_type_layout{nullptr}` to `ShaderCursor` (fixes the `find_element` path, which does `ShaderCursor c;` default-init then assigns members). The regression test used `ShaderCursor cursor{}` (value-init) → validated the downstream null-guards but not the member initializer itself. The default-init path is hard to test deterministically (reading uninitialized memory is UB), so this is usually a documentation nit, not a defect — but flag the mismatch so nobody believes the test covers the init.

Review lens: "new default-member-initializer + test uses braces `{}`" ⇒ the test likely proves nothing about the initializer. codex-critique caught this; worth checking by hand.
