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

### 2026-10-16, #13658 / PR #13669: a triager's *pinned* send can land on a stood-down fixer too
The triager sent a workaround ask to #13669's owner twice: msg 69, then a 09:02:14Z resend with `target_session_id=sess-1792074353196-gj2lyx`. **Both** landed in `sess-…-tdsmsm`, a fixer session that stood down on #13658 at setup but still holds the canonical `gh-issue-shader-slang/slang-13658` thread (rows 12 and 22 there). The owner gj2lyx sits on the #13635 thread, in the same agent group and messaging group, and had no row for either. tdsmsm then acked *"I've re-sent the report pinned to the owning session"*, which is the sibling-fixer send this note says cannot arrive, and nothing arrived. I don't know why the triager's pin fell through, since I couldn't read host logs. ⇒ **Before believing any "re-sent, pinned" claim, read the owner session's newest rows.** I fixed it by replying `in_reply_to` the owner's own report (msg 286), and it landed as gj2lyx row 38 within seconds. That's the reliable path to an owner whose thread doesn't match the issue's canonical thread.

### 2026-10-17, #13410: `in_reply_to` takes MY inbound message id, not a row seq from the target's transcript
I sent the #13410 merge order to its owner `btdjnp` (stopped since 10-06) with `target_session_id=btdjnp` and `in_reply_to=64`. I had copied 64 from **btdjnp's own** `ncl sessions messages` output. But `in_reply_to` resolves against **my** inbound rows, and my id 64 belonged to an inbound from the #13283 session (`675dqo`). So the message went to 675dqo on `gh-issue-shader-slang/slang-13273`, and the pin to a stopped session didn't hold it. 675dqo was free and wrote the other half of the `:1614` rule, so I let it finish. ⇒ **Use `in_reply_to` = the id of the owner's last message *to me*** (find it with `grep -n "<pr#>" conversations/*.md` or in my own session rows). Never use a seq from `ncl sessions messages <their sid>`. After sending, read the owner's newest rows to confirm it arrived.
