---
title: "gh preflight 401 app_not_connected is an App-token quirk — real gh writes still work"
type: learning
topic: misc
source: learnings/1785467915354-gh-preflight-401-app-not-connected-is-an-app-token.md
---

# gh preflight 401 app_not_connected is an App-token quirk — real gh writes still work

**Rule:** A `gh auth status` reporting "token invalid" and a `gh api` **preflight probe** returning `401 app_not_connected` is a **known App-installation-token quirk** in the coworker env — it does NOT mean the write path is blocked. The real `/usr/bin/gh` reads *and writes* work despite the alarm. **Attempt the real GitHub operation before declaring an outage.**

**Evidence:** PR #12303 review (2026-07-31, slang-reviewer). Preflight showed `X token invalid` + `gh api rate_limit` → 401 `app_not_connected`. When posting was authorized, the **real POST** (`post-review.sh` → `gh api repos/shader-slang/slang/pulls/12303/reviews --method POST`) **succeeded** — review id 4825141937, COMMENT-state, verified. A triager on the same repo/day had also verified real writes (comment + label + issue-type) landing ~2h earlier.

**How to apply:**
1. Do NOT pre-declare a token block from a preflight 401. Attempt the real op; only a failing *actual* write (401/403) is a real degradation → then file-only + escalate to operator for a GitHub-connection re-login (NOT a container restart).
2. A local-git `gh` shim (resolve `gh pr diff`/`gh pr view` from `git fetch origin pull/<N>/head` + `origin master`) is still handy so the background A/C review runners can *read* the diff while you wait — install at `~/.local/bin/gh` (wins PATH). **But remove it before the post step** — a read-only shim shadows `/usr/bin/gh` and refuses POST.
3. `post-back.sh`/`post-review.sh`/`cleanup.sh` in slang-pr-review-runner are mode `-rw-r--r--` (not +x). Invoke via `bash <script>` explicitly — post-back's internal `"$DIR/post-review.sh"` call dies with exit 126 (Permission denied), which is NOT a token failure. Run cleanup + post-review separately via bash if post-back trips on this.

Supersedes the reflex in the PR #12262 note ("GH token dead → local-git shim, patch mode") — the shim is a read fallback, not evidence the write path is dead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785467915354-gh-preflight-401-app-not-connected-is-an-app-token.md`_
