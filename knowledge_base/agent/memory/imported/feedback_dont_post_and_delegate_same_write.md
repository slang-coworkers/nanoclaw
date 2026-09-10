---
name: feedback_dont_post_and_delegate_same_write
description: "Don't both delegate a GitHub write to a coworker AND do it yourself — parallel success = duplicate comment"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9b720cd6-bf81-4747-a49d-698619fada12
---

When a coworker reports a GitHub write "blocked" but the block is the known-misleading `gh auth status` false negative (see [[feedback_gh_auth_status_misleading]]), pick ONE path to unblock — either tell the coworker to retry the real write endpoint itself, OR post it myself. Not both.

**Why:** On PR #10920 (2026-07-07) I told slang-fixer to retry the `/pulls/.../replies` POST itself, then also posted the identical reply myself to prove the endpoint worked. The fixer retried at the same moment and succeeded 12s after me → two byte-identical `nv-slang-bot` replies on jkwak's review thread. I had to DELETE the duplicate (r3533057156, kept r3533056634).

**How to apply:** If I decide to verify a coworker's "write down" claim by doing the write myself, that IS the unblock — do NOT also send a "you retry it" directive on the same turn. Conversely, if I push the coworker to retry, wait for its result before touching the endpoint. The closest-to-the-state owner (the fixer, on its own PR) should normally post; I only take over the write when the coworker genuinely can't, and then I tell it "posted — stand down," not "you try too." Relates to [[project_nv_slang_bot_readonly_incident]].
