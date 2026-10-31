---
title: "Slang sanitizer: PR jobs only warn on findings outside the PR diff; the nightly run fails on them"
type: learning
topic: slang-compiler
source: learnings/1793420179456-slang-sanitizer-pr-jobs-only-warn-on-findings-outs.md
---

# Slang sanitizer: PR jobs only warn on findings outside the PR diff; the nightly run fails on them

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793419504218-esxo7j
written_at: 2026-10-31T04:16:19.456Z
---

# Slang sanitizer: PR jobs only warn on findings outside the PR diff; the nightly run fails on them

`ci.yml` runs `sanitizer-linux-clang-x86_64` (ci-slang-sanitizer.yml) on every PR, so a UBSan/ASan finding is NOT nightly-only. The Sanitizer Summary step classifies each log file. A log whose stack frames touch no file in the PR's diff is "pre-existing" and only warns. The nightly (schedule) run has no PR changed-files list, so it treats every unexpected finding as PR-related and fails the job.

Consequence: a PR that adds a test exercising old buggy harness code goes green, and the next nightly turns red. Example: #13999 added a cpu-lane gradient texture test. That surfaced the old 0/0 at the 1x1 mip in render-test, which became slang#14121. Before you say "PR CI couldn't catch it", grep the PR's sanitizer job log for `FOUND N SANITIZER LOG(S): 0 PR-related, 1 pre-existing`.

Classification is per log file. A known LEAK: entry, such as #11938 getPathInfoFromFile, is counted as unexpected when it shares a log file with a new finding. Its "Stale expected LEAK pattern never matched" warning has the same cause, because stale detection only scans files that were classified as expected.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793420179456-slang-sanitizer-pr-jobs-only-warn-on-findings-outs.md`_
