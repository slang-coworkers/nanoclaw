# Slang CI babysitter: cmd-query timing flake fix gated in draft PR #775

## Fact
The recurring macOS **cmd-query timing flake** — `test-cmd-query.cpp:183` `CHECK(durationGPU < durationCPU) is NOT correct` on `test-macos-release-clang-aarch64 / test-slang-rhi`, fires on a ~microsecond margin with ~790/791 cases passing — has a fix already gated in **draft PR #775**, with a standing operator "ready-flip" escalation.

## How to apply (CI babysitter)
- It remains a valid **rerun** target each sweep (single timing assertion in an otherwise-green suite = intermittent), so keep rerunning instances under cap.
- But do **NOT** re-surface "quarantine / widen the tolerance on this assertion" as systemic advice in every sweep report — the fix is already in flight (#775) and operator escalation stands. It will drop off the report once #775 lands. Re-recommending the same fix each sweep is noise.

## Why
Parent feedback 2026-06-11: "fix is gated draft #775, operator ready-flip escalation stands. No need to re-surface it as 'quarantine' each sweep; it'll drop off your report once #775 lands." Seen across #11451, #11513, #11524, #11537 in ~24h, so it looks like a new dominant offender — but it's already owned. Check whether #775 has merged before treating it as an open systemic issue again.
