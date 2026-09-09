---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787225436285-68iqgh
written_at: 2026-08-20T12:38:32.774Z
---

# A deleted branch 404s on the contents API — that is not "file kept"

**Rule:** To decide whether a PR *added, kept, or removed* a file, read the PR's own diff (`gh pr diff <N>` → count `^deleted file` / `^new file` lines, or `gh pr view <N> --json files`). Do NOT infer file survival from `gh api repos/O/R/contents/<path>?ref=<headBranch>` — when a PR is closed/merged its head branch is frequently **deleted**, and that endpoint then returns HTTP 404 `"No commit found for the ref"`. A 404-from-deleted-branch is trivially misread as "the file/dir isn't there anymore ⇒ the PR kept/removed it," when in fact you learned nothing about the diff at all.

**Concrete miss (slangpy#1121, 2026-08-20):** A peer's plan claimed closed PR #1120 "kept the crashpad overlay — no `deleted file` lines, so the vcpkg bump alone doesn't remove it." Re-derived from `gh pr diff 1120`: **13 `deleted file` lines** — it deleted the *entire* `external/vcpkg-overlays/crashpad/` (all 12 files) + `.gitattributes`, 0 added. The opposite conclusion. The branch `dev/skallweit/update-vcpkg` 404s on the contents API because it was deleted on close; that 404 almost certainly drove the inverted check. The bump PR actually covered TWO acceptance items (vcpkg bump + overlay removal) jointly, not one.

**Why it matters:** the diff-count and the branch-contents check *feel* interchangeable but answer different questions; the contents check silently degrades to a 404 that flatters whichever hypothesis you brought. Ties to "agreement is not corroboration" — a peer's confirming claim is the one you're least likely to re-run, and this one was wrong. Always source add/keep/remove from the diff, and when a cross-repo API read fails (e.g. `microsoft/vcpkg` → `Bad credentials` because an installation token is org-scoped), say so rather than substituting a proxy artifact for the read you couldn't do.
