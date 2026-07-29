---
name: project-12062-board-sync-422-reviewer-node
description: "shader-slang/slang#12062 — pr-board-sync.yml 422 on unresolvable reviewer node; fix ready as hand-apply diff, awaiting jhelferty"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2274fdfe-5c4d-41ba-a835-be68e2bb5d9a
---

# #12062 — board-sync 422 on unresolvable reviewer node (`BOT_kgDOCnlnWA`)

**Bug:** `.github/workflows/pr-board-sync.yml` step "Unrequest ignored reviewers" (~L1376–1401) ends in a bare unguarded `await github.rest.pulls.removeRequestedReviewers(...)` (~L1395). When GitHub returns a phantom server-side reviewer node (e.g. `BOT_kgDOCnlnWA`, not in our YAML), the call throws `Could not resolve to User node` → 422 → `##[error]Unhandled error`, aborting the step. jhelferty's 07-16 restructure (#11847, `5c30d437f`) touched the file but didn't wrap the call. Empirical repro: run 30165480921 (2026-07-25, PR #12228).

**Timeline (07-28):**
- Re-triage: STILL REPRODUCES at HEAD `15863db48` (slang-triager). Verdict posted issue-comment `5098780490`.
- jhelferty (maintainer) asked bot to "prepare a PR." 
- **Fix:** scoped `try/catch` + `core.warning(…${error.status})` around the call, verbatim match to the file's co-assign (L1126) / requestReviewers (L1156) idioms; success `console.log` inside try. Commit `7c98fa3326` (+16/−7) on `fix/issue-12062`, base master `dd6e011e56`.
- Reviewer (slang-reviewer): **APPROVE** — 0 bugs, `git apply --check` clean, no pre-image drift, prettier + node --check pass.

**Twin hardening (07-28, maintainer-authorized cmt 5107596183):** jhelferty said "harden the other one too." Fixer wrapped the twin `removeRequestedReviewers` at ~L1143 (`onboardPr` path) in the same compact try/catch + `core.warning`. Amended to DROP an initial 2-line comment (DRY — rationale lives once at L1400 site; matches L1156 sibling density). Final HEAD **`4147d58fb2`** (supersedes `6bc865967c`), combined **+25/−11**, post-image blob `f46f95ac14`. Reviewer **clean APPROVE, byte-match confirmed by hash** (blob reconstruction == `f46f95ac14e61cafbef87a10fdd930f8bf4e04c6`).

**Terminal state:** bot **cannot push `.github/workflows/*`** (App `workflows`-permission wall — see [[project_bot_workflows_permission]], same wall as #11988 PIECE#2). So **no PR** — ready-to-apply combined diff (both call sites: "Unrequest ignored reviewers" L1400 + `onboardPr` L1143) posted for jhelferty hand-apply on #12062. **Awaiting maintainer hand-apply + merge — nothing blocks on the bot.**
