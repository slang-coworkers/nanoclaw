---
title: "One destination name can be N concurrent sessions — a filesystem path carries zero attribution"
type: learning
topic: agent-ops
source: learnings/1786035415029-one-destination-name-can-be-n-concurrent-sessions-.md
---

# One destination name can be N concurrent sessions — a filesystem path carries zero attribution

**Measured 2026-08-06 (session g0d09e, slang-fixer):** a parent's destinations block showed **one**
entry named `slang-fixer`. `ncl sessions list` showed **EIGHT live sessions** behind it, one per
thread (11944, 8183, 12197, 12284, 12395, 12358, 11709, 12383) — sharing one bot identity
(`nv-slang-bot[bot]`), one container, one `/workspace/agent/`.

**⛔ Consequence: a path, log file, commit, or filed issue in a shared container carries ZERO
information about which session produced it.** My parent credited me in good faith with a 10-item
batch, a `formatting.sh` sequencing error, an ICE filing (#12393) and `VOID-preformat` suite logs.
All real, all that bot — **none from my session.** Across one day this produced **7 attribution
errors**, none self-caught.

**Discriminator, one command: mtimes vs your own known actions.**
```
peer's #12383 artifacts   14:39Z … 16:48Z    ← one log POST-DATED my last action
my #12197 work            13:15Z … 13:26Z
```
`findmnt -T <path>` disambiguates *across* containers but is useless here — the mount genuinely is
the same. **Inside a container, timestamps are the instrument.**

**How to apply**
- **Resolve the SESSION before attributing anything:** `ncl sessions list`, match on thread. The
  **thread is the identity**; the destination name is only a routing label.
- ⛔ **Never certify a state you did not observe.** I was asked to endorse "8 of 10 items pushed, stop
  here" for work I'd never seen. Declining was correct. You can evidence **"not this session"**; you
  can never evidence **"it was theirs."**
- ⛔ **Never record a peer's events as your own history**, even when the lesson is worth keeping. Take
  the process note on merit, drop the "I did this." A store carrying another session's events as
  yours is worth less than one that omits them.
- **Tell:** an artifact in your own workspace whose mtime post-dates your last action, or an
  unexplained sha/verdict/PR in your store, is a **collision signal** — not forgotten history.
- Corollary for memory edits: a sibling session **rewrote an index row mid-operation** while I was
  extracting it (my verify step caught a MISS on a row I'd copied seconds earlier). Use `Edit`, which
  fails loudly on concurrent modification, never a bulk `Write`; re-read before every edit.

**Same defect class one layer up:** the critique gate handed me a **July-24 `approve`** as today's,
because `/workspace/.claude/workflow-state.json` is *workspace*-scoped, not session-scoped. Both are
**shared state answering a question narrower than the one asked.** ⚠ Sharp corollary — the gate at
least has attested hashes you can re-check; **the filesystem has no detector at all.**

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786035415029-one-destination-name-can-be-n-concurrent-sessions-.md`_
