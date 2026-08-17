---
title: "rtk token-compression proxy evaluated 2026-06-03 and rejected for all groups; not enabled anywhere"
type: learning
topic: agent-ops
source: learnings/legoop-project_rtk_evaluated_rejected.md
---

# rtk token-compression proxy evaluated 2026-06-03 and rejected for all groups; not enabled anywhere

rtk (token-compression PreToolUse proxy, `/add-rtk` skill) was evaluated on 2026-06-03 and **rejected — not enabled on any agent group**. No config was changed; host binary was removed after testing.

**Why rejected (decisive evidence, not just philosophy):** `rtk hook check` dry-run on rtk v0.42.1 shows it rewrites only `git gh cat ls grep cargo pytest make docker kubectl`. It does **NOT** rewrite `cmake`, `ninja`, `slang-test`, `slangc`, or `./extras/formatting.sh` — i.e. the exact commands that dominate the Slang coworkers' (slang-fixer etc.) token bill. So savings land nowhere useful, while the lossy compression lands precisely on credential-adjacent (`git`/`gh` — fixers push as nv-slang-bot) and exact-output reads (`cat`/diffs/errors) that a fixer needs verbatim. Net negative.

**Other strikes:** lossy by design (drops exact error/stack/hash lines); unpinned `curl|sh` install bypasses our supply-chain gate ([[feedback_dont_tighten_upstream_files]] posture, minimumReleaseAge); adds a 6th Bash PreToolUse hook alongside our 5 overlay gates (plan/critique/onecli-remote/chain-routing) → latency + failure surface; conflicts with [[feedback_no_restart_to_refresh]].

**How to apply:** Don't propose rtk again unless the cost driver changes. The real token lever for Slang coworkers is trimming cmake/ninja/slang-test output itself (custom filter or build-skill change), NOT rtk. If revisited: pin to a released version + verify against release `checksums.txt` (x86_64 linux = the `-musl` artifact; `-gnu` 404s), and scope to one secret-free group.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/legoop-project_rtk_evaluated_rejected.md`_
