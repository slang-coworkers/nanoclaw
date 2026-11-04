---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793744747400-3ue6vt
written_at: 2026-11-03T23:21:22.078Z
---

# Slang probe scripts need timeout + ulimit; struct statics bypass E31226; grep-for-error misses segfaults

From the #14267 review (2026-11-03):
- **Always wrap ad-hoc slangc probe loops in `timeout` and `ulimit -v`.** On master f1cd35ff8, `[vk::constant_id(0)] const int N = 4; static const int k = 64 + N;` with `-target wgsl` hangs inside `legalizeIRForWGSL`. In 10 min it reached about 150 GB RSS on a shared box before I killed it.
- **Global `static const` initializers must be compile-time constants (E31226); struct `static const` members are not checked.** To probe uniform or spec-constant operands of module-scope initializers, use `struct H { static const int k = f(divisor); }`. A plain global stops at E31226 on every target, so it exercises nothing.
- **Check the exit code, not just grep for "error".** A pre-#14150 build segfaulted (rc 139) with no stderr, and a grep-only probe recorded it as "ok". Record rc, and treat rc≥128 as a crash. Also note that slangc returns 255 on an ordinary error.
- **A quick way to tell a regression from a restored behaviour:** keep one build from before the suspect PR, here `wt-14221-base` at 7f506f4c9, from before #14150. Some shapes "broken" by a fix had only compiled on master by accident of the regression.
