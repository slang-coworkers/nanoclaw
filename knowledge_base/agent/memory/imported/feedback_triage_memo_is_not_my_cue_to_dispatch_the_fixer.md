---
name: feedback_triage_memo_is_not_my_cue_to_dispatch_the_fixer
description: When a triager reports a triage memo, Main must NOT dispatch to the fixer — the triager owns the fixer handoff (direct-edges-only). Read the triager's full rollup first; it states whether it already forwarded.
metadata:
  type: feedback
---

**Rule:** In the chain `orchestrator → triager → fixer`, the triager (my direct child)
owns the handoff to the fixer (my grandchild). When the triager reports back with a
triage memo, I do NOT dispatch to the fixer myself. Doing so skips a tier and creates a
**duplicate fixer session** on my own Main→fixer edge, distinct from the real session on
the triager→fixer edge.

**Why:** GitHub webhook routing sends an *issue* to `{triager}`, full stop. The triager
triages AND routes to the fixer if ready-for-fix. My job ended at the initial forward.

**Measured 2026-08-11, issue #12487 (Metal ref-accessor abort):** The triager sent msg 6
("memo attached; rollup in the thread") and I read the attached memo and immediately
`send_file`'d it to `slang-fixer` on the canonical thread — before reading the FULL rollup
(msgs 8/12) which said "ready-for-fix → forwarded to slang-fixer on this thread." The
triager had already dispatched (real session `sess-...-01b3wv` on edge `epsn3s`, 21:36). My
direct dispatch would mint a phantom 12487 session on the Main→fixer edge (different
messaging group, same thread_id) → duplicate branch/PR risk. Detector (`ncl sessions list
| grep <fixer-ag> | grep <issue>`) showed one session at check time because my send was
fire-and-forget/queued. Contained by sending a stand-down over MY edge (same thread) so the
phantom no-ops; flagged the triager in case a stray artifact appeared.

**How to apply:**
- A triage memo from the triager is a REPORT, not a cue for me to hand off to the fixer.
- Read the triager's *rollup/routing* line before acting — it states "forwarded to fixer"
  vs "awaiting your decision." Only act if it explicitly asks me to route.
- If I must reach the fixer, route THROUGH the triager (`ask my child to forward`), never
  a direct Main→fixer dispatch on a chain the triager already owns.
- The tell for this mistake: two running sessions in one fixer agent group for one issue,
  on two different messaging groups. Stand down the one on MY edge.

Related: [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]] (ANCHOR E — attribution across N sessions behind one name is a key problem).

### 2026-10-16, #13687: the rollup can say "handed to fixer" before the handoff happens
The triager's 07:10Z `[Triage]` listed the labels, the issue post and "handed to slang-fixer" as done. At 07:15Z GitHub showed 0 comments, no labels, no Type, and the fixer group had no 13687 session. I sent the gap back to the triager on its own edge, without dispatching the fixer. All three then landed by 07:22Z, and the fixer session sat on the triager's edge (`epsn3s`). ⇒ **Treat "forwarded to fixer" as a claim. Check it with `ncl sessions list | grep <fixer-ag> | grep <issue>` and the issue's `comments`/`labels`, and route any gap back through the triager.** The triager can't run this check itself: its `ncl sessions list` is group-scoped, so it asks me to.
