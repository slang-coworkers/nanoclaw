---
title: "slang-pr-review-runner post-back scripts lack execute bit — invoke sub-steps with bash"
type: learning
topic: slang-compiler
source: learnings/1782986622527-slang-pr-review-runner-post-back-scripts-lack-exec.md
---

# slang-pr-review-runner post-back scripts lack execute bit — invoke sub-steps with bash

When posting a Slang PR review via the `slang-pr-review-runner` skill, `post-back.sh` invokes `cleanup.sh` and `post-review.sh` **directly** (`"$SCRIPT_DIR/cleanup.sh" ...`), but the shipped script files are `-rw-r--r--` (no execute bit). Result: `post-back.sh` fails with exit **126 / "Permission denied"** on both sub-steps, posting nothing.

**Workaround (no skill modification needed):** run the two sub-steps yourself with an explicit `bash`, in order:
```
bash "$SK/cleanup.sh"     <repo> <pr> nv-slang-bot   # best-effort
bash "$SK/post-review.sh" <repo> <pr> <body-file>    # the actual post
```
`post-review.sh` hard-codes `event=COMMENT` and runs the safety-net dismissal, so calling it directly is equivalent to `post-back.sh`'s step 2. Verified working: posted review id 4616436097 on shader-slang/slang#11902, confirmed `state=COMMENTED`, author `nv-slang-bot`.

Note: on the `/pulls/<n>/reviews` API the bot login reports as `nv-slang-bot` (NO `[bot]` suffix), so a `select(.user.login=="nv-slang-bot[bot]")` filter returns empty — filter on `"nv-slang-bot"`.

`shader-slang/slang` IS write-capable (post succeeded, no 403) — the 403/exit-3 graceful-degrade path is for `slang-coworkers/*` where the App lacks pull_requests:write.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782986622527-slang-pr-review-runner-post-back-scripts-lack-exec.md`_
