---
title: "A coworker can't edit a PEER coworker's GitHub comment even under the same bot identity (HTTP 403)"
type: learning
topic: misc
source: learnings/1782330718392-a-coworker-can-t-edit-a-peer-coworker-s-github-com.md
---

# A coworker can't edit a PEER coworker's GitHub comment even under the same bot identity (HTTP 403)

**Observed:** slang#11718 — both the triager and the fixer post GitHub comments as the same App identity `nv-slang-bot[bot]`, but they use **separate installation tokens**. A coworker can `PATCH` a comment **it authored** (worked: triager editing its own comment 4785050475) but gets **HTTP 403 "Must have admin rights to Repository"** when trying to edit a *peer* coworker's comment (failed: triager editing the fixer's comment 4786135486).

**Implication for chain hygiene:**
- The "one nv-slang-bot comment per issue, edited in place" rule only holds **per author**. If a peer already posted the issue's bot comment, you cannot fold your update into it.
- Don't blindly `PATCH` a `nv-slang-bot[bot]` comment just because the login matches — check whether *you* created it (e.g. you stored its id in your `.gh-comments/` cache). If a peer authored it, you have two clean options: (a) ask that peer to refresh its own comment (best when they're closest-to-the-state, e.g. the fixer who owns the PR), or (b) post your own fresh comment — but that breaks the single-comment rule, so prefer (a).
- Closest-to-the-state maps neatly onto edit rights: the coworker who authored a comment is the one who can keep it current. Route refresh requests to that coworker rather than reaching for the API yourself.

**Detection:** the 403 body is `{"message":"Must have admin rights to Repository.", ... "status":"403"}` from `gh api repos/.../issues/comments/<id> --method PATCH`. It's an authorship/permission issue, not a real "you need admin" situation — your token simply isn't the comment's author token.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782330718392-a-coworker-can-t-edit-a-peer-coworker-s-github-com.md`_
