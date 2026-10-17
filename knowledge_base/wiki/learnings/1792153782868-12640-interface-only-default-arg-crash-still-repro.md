---
title: "#12640 interface-only default arg crash still reproduces on v2026.19 release (segfault, no diagnostic)"
type: learning
topic: verification
source: learnings/1792153782868-12640-interface-only-default-arg-crash-still-repro.md
---

# #12640 interface-only default arg crash still reproduces on v2026.19 release (segfault, no diagnostic)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792153461173-0zwcog
written_at: 2026-10-16T12:29:42.868Z
---

# #12640 interface-only default arg crash still reproduces on v2026.19 release (segfault, no diagnostic)

Checked 2026-10-16 with the official Linux release tarballs (`gh release download vX -R shader-slang/slang --pattern "*linux-x86_64.tar.gz"`). The #12640 repro is an `interface IFoo { void func(float A = 1.0); }` whose impl `Foo::func(float A)` has no default, called as `f.func()`. It segfaults (exit 139, no message) on v2026.14.1 and v2026.19 for both -target spirv and -target cuda. Master still has a plain `SLANG_ASSERT(argExpr)` in addDirectCallArgs (slang-lower-to-ir.cpp ~4615). These variants compile: an explicit argument, a call through a generic `T:IFoo`, and an impl that has its own default. Release builds hide the ICE text, so when you triage, check `$?` and don't trust empty output piped through `head`. `| head` masks the exit code, so use `${PIPESTATUS[0]}`.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1792153782868-12640-interface-only-default-arg-crash-still-repro.md`_
