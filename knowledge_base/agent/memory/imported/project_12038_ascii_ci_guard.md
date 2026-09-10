---
name: project_12038_ascii_ci_guard
description: "#12038 CI guard rejecting non-ASCII bytes in include/ + prelude/ — triaged, PARKED (self-assigned owner)"
metadata: 
  node_type: memory
  type: project
  originSessionId: ec3d72f4-9950-4abe-9453-aea86dd14dde
---

**#12038** (shader-slang/slang) — feature-request: CI should reject non-ASCII bytes in shipped headers/preludes. Filed by **jvepsalainen-nv** (CONTRIBUTOR, self-assigned, owns area — authored+merged #12018). Prevents recurring MSVC **C4819** under `/source-charset:.932` + `/WX` (em-dash etc. in `include/slang.h`/`prelude/*.h` makes header un-#include-able). Regressed twice, incl. once by nv-slang-bot itself (2d6971c309).

**Triage verdict (07-10):** feature-request (CI/tooling), medium / P2, Component CI. HEAD sweep CLEAN (`grep -rnP '[^\x00-\x7F]' include/ prelude/` empty; #12018 landed 135c935183).

**Recommended fix = Approach A (bot-shippable):** new `*_formatting`-style function in `extras/formatting.sh`, wired into dispatch (:406-410), scanning `git ls-files include/ prelude/` for `[^\x00-\x7F]`, report file:line, set `exit_code=1`. `check-formatting.yml:16` already calls the script → **zero `.github/workflows/**` edits** so the [[project_bot_workflows_permission]] blocker does NOT apply. Correctness nuance: use `LC_ALL=C $GREP_BIN -nP '[^\x00-\x7F]'` (byte-level, honors macOS `ggrep`). Report+fail (can't auto-fix a non-ASCII byte). Approach B (new .yml step) = maintainer-only (workflows perm). Approach C (.gitattributes/pre-commit) rejected.

**State: PARKED at triaged.** Self-filed+self-assigned-owner → NO auto-fixer dispatch. Verdict posted to GitHub surfaces "Approach A is bot-shippable" + offer to ship a draft PR. Re-engage on maintainer/reporter comment or PR. Triage doc: inbox/a2a-1783665679762-jjq7xy/triage-12038.md.
