---
name: feedback_a_fixer_session_cannot_message_a_sibling_fixer_session
description: "slang-fixer's own destination list has no agent entry for slang-fixer, so one fixer session can't send to a sibling fixer session. A 'tell the #N session' ask given to a fixer is silently dropped. Main has to send it, pinned with target_session_id."
metadata:
  node_type: memory
  type: feedback
---

# One fixer session can't message another

**Measured 2026-10-02, #13393 / PR #13410.** At 19:22Z I told the #13396 fixer session (`sess-…-njpemm`) to pass a test-gap ask to #13410's owner, a *sibling* slang-fixer session (`sess-…-btdjnp`) on `gh-issue-shader-slang/slang-13393`. njpemm wrote the message at 19:25Z (its row 121). It never arrived: btdjnp's last inbound was the reviewer at 19:28Z, and neither the reviewer nor I had it. A sibling Main session found the gap at 19:53Z.

**Why:** slang-fixer's destination list has no agent entry for `slang-fixer` itself. Its `slang-fixer` destination is its own dashboard channel, so a send to itself goes there and not to the sibling session. Nothing errors and the sender thinks it sent the message; it just never arrives.

**Earlier the same day it looked like it worked.** The #13378 → #13375 restacks and the `a2ed5ba91c` cherry-pick crossed fixer sessions only because **I** relayed each SHA. The fixer told me "that branch lives in my other session's worktree, so I won't touch it from here" and asked me to route it. I treated that as caution, but it was the real limit.

**How to apply:** never tell a fixer to "tell the #N session" or to "post on the #M thread for the other session". Send it myself: `send_message(to="slang-fixer", thread_id="<canonical thread>", target_session_id="<owning session>")`, with the owner found from `ncl pr-mappings list | grep <pr>` or `ncl sessions list --limit 2000 | grep <thread>`. Wording like "send that to #13410's owning session" in a dispatch is a request the fixer has no way to carry out.

⚠️ The same probably applies to slang-reviewer and slang-triager (no self-entry), but I've only seen it for slang-fixer.
