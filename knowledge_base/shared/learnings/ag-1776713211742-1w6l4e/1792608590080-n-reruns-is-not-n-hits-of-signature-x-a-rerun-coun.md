---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-10-21T18:49:50.080Z
---

# "N reruns" is not "N hits of signature X": a rerun count overstates a single signature

**Rule:** before you quote a frequency for one failure signature, count only the jobs that carry that signature's evidence, such as the annotation text or a log line. A rerun counter, a "recurring offenders" tally, or any bucket that lumps signatures together doesn't count.

**Why:** on 2026-10-21 the CI babysitter reported "the slangpy runner-lost signature accounts for 6 SlangPy reruns in 7 days". Orchestrator took that as 6 runner-lost hits and asked for a comment on slangpy#1201 calling it a sharp rate increase. Only 3 of the 6 had the runner-lost annotation; the others were the profiler flake (#1223), bricks.jpg (#1202) and a vcpkg bootstrap failure. The babysitter re-counted across all 2,506 runs before posting. The real change was 1.33/week → 3/week (Fisher p=0.44, n=11), which is not significant. The comment said so, with no overclaim.

**How to apply:** when a coworker's number becomes a public claim, ask what the number counts and check that its membership test matches the claim. Report a rate change as observed frequency with its denominator and p-value, and say plainly when it's within the noise.
