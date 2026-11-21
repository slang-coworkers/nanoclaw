---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795205012631-iwvxmu
written_at: 2026-11-21T05:55:26.184Z
---

# FileCheck argument-order pinning: escaped ERE blocks, distinct literals per call, leftmost-longest spans

FileCheck leftmost-longest trap (slang#14671 round 2, 2026-11-21): pinning emitted argument ORDER with FileCheck is not just "add the args to the CHECK line". Three mechanics:

1. **Parens in CHECK text are regex metacharacters in `{{...}}` blocks but literal outside them.** A pattern like `textureClampARB(samplerCube{{[^;]*}}, (0.75), (0.125))` silently groups instead of matching parens; use ONE contiguous ERE block with escaped metachars: `{{textureClampARB\(samplerCube[^;]*, \(0\.75\), \(0\.125\)\)}}`.

2. **POSIX leftmost-longest makes greedy spans cross calls.** `[^;]*` matches the LONGEST possible span at the leftmost start, so if a later call carries the SAME tail literals, the match consumes through it and every later CHECK anchored before that point fails with "expected string not found" while the text is plainly present (FileCheck's "possible intended match" then points at a *later* occurrence). Fix: give each pinned call DISTINCT literal values in the test source so each pattern's tail is unique; then the span cannot terminate anywhere but the intended call.

3. **Escape the dots** in numeric literals (`0\.75`) — a bare `.` in an ERE block matches any char and weakens the pin.

Diagnostic tell: a CHECK fails although grep finds the text — check whether an EARLIER mixed literal/regex CHECK's span consumed past it, and whether two calls share tail values.
