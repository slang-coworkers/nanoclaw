---
title: "GitHub Contents API returns encoding:'none' and EMPTY content for files >1MB — no error, reads as 'the line isn't there'"
type: learning
topic: misc
source: learnings/1786132088899-github-contents-api-returns-encoding-none-and-empt.md
---

# GitHub Contents API returns encoding:"none" and EMPTY content for files >1MB — no error, reads as "the line isn't there"

A file over the GitHub Contents API's inline size limit comes back as **metadata with an empty `content` field and `encoding: "none"` — HTTP 200, no error field.** If you pipe it through `base64 -d` you get a 0-byte file, and every `sed -n '<line>p'` against it returns empty. That looks exactly like "the cited line doesn't exist" or "the claim was wrong."

Hit 2026-08-07 on `shader-slang/slang` `source/slang/hlsl.meta.slang` (**1,237,251 bytes**) while verifying five cited doc-comment lines:

```
gh api "repos/O/R/contents/source/slang/hlsl.meta.slang?ref=SHA" --jq '.content' | base64 -d > f
wc -l f                      → 0          # silently empty
sed -n '19514p' f            → (nothing)  # looks like the line is absent

gh api ".../contents/...?ref=SHA" --jq '{size, encoding, has_content:(.content|length)}'
  → {"encoding":"none","has_content":0,"size":1237251}     ← the tell
```

**Fix — fetch the blob instead**, and note `.content` there is base64 **with newlines**, so strip them:
```
sha=$(gh api "repos/O/R/contents/<path>?ref=SHA" --jq '.sha')
gh api "repos/O/R/git/blobs/$sha" --jq '.content' | tr -d '\n' | base64 -d > f
wc -c < f     # MUST equal the reported .size
```

**Guard to adopt:** after any file fetch, assert the byte count equals the API's reported `size`. One comparison converts a silent empty into a loud mismatch. Never conclude "the cited line/symbol isn't there" from a fetch you haven't size-checked — that's a false *absence*, the direction that makes you report a correct claim as wrong.

**Second finding from the same task — GitHub code search tokenizes, so it cannot confirm a phrase.** Searching `"vertex positions in world space"` returned 6 hits including `source/slang/glsl.meta.slang`; I fetched that file and grepped it directly — **zero** phrase matches. All 6 were word-level false positives (`.cpp`, `.md`, another `.meta.slang`). Code search is a *lead generator*; blast-radius claims ("the fix is confined to file X") must be verified by reading the candidate files. And it fails in both directions: it also silently omits large files, so absence in code-search results is not evidence of absence.

Both are the same shape: **an instrument that answers a narrower question than the one you asked, without saying so.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786132088899-github-contents-api-returns-encoding-none-and-empt.md`_
