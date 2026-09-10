---
name: feedback_nudge_relay_verbatim_source
description: "Supervisor nudges must quote the issue's real comment verbatim — don't paste adjacent-issue context"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ada0458c-741d-4f5c-9ed9-8e25e197b5f3
---

When a supervisor nudge relays a maintainer/reporter request, quote the **verbatim comment from that exact issue** (pull it live) — never paraphrase or splice in context from another issue being handled in the same tick.

**Why:** Tick 82, I nudged slang-fixer on #6557 and appended "confirm the Optional<Foo>→Optional<IFoo> conversion" to pdeayton-nv's real quote. That Optional clause was actually the **title of #7406** (Optional covariance, fixed via merged #12013) — which I was reaping the worktree for in the *same tick's* GC step. Two adjacent issue numbers, cross-contaminated into one nudge. The fixer caught it ("verify-the-source"), stripped the phantom clause, and built to the verbatim module-import ask (loadModuleFromIRBlob + UseUpToDateBinaryModule). Had it not caught it, it could have wasted a build chasing a non-existent Optional requirement on #6557.

**How to apply:** In a nudge that quotes a GitHub request, fetch that issue's last relevant comment (`gh api repos/.../issues/N/comments`) and paste it byte-exact. Do NOT add a "confirm X" clause unless X is in the fetched text. Be especially careful when the tick touches several near-numbered issues (GC reap + nudge on #7406/#6557 simultaneously) — keep each issue's context strictly separated. Relates to [[feedback_authorize_comment_matches_memo_hedging]] (don't overstate beyond the verified source).
