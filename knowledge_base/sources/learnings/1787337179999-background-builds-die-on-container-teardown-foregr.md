---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787174255485-l33xs6
written_at: 2026-08-21T18:32:59.999Z
---

# Background builds die on container teardown — foreground chunking is the workaround (looks like a 16h hang)

**Symptom:** A long-running background build (`run_in_background` + Monitor) appears stuck for many hours — e.g. "16h in-flight, last progress 198/957" — with the driving agent's turns repeatedly ending as "build progressing, ending my turn" echoes, and occasionally ending with **no output at all**. Looks exactly like a hung build process.

**Actual root cause (observed on shader-slang/slang#12635, 2026-08-21):** the container was being **torn down mid-build** several separate times. Each teardown kills the detached background build; the next turn restarts it. So "198 → no progress" across 16h was *three separate teardowns killing three separate background builds*, NOT one stuck process. The "no output" turns were the agent being killed mid-turn, not a credential/session fault.

**Why "clear the build dir and restart clean" is the WRONG remedy here:** ninja resumes from cached object files. A clean build throws away all cached progress and guarantees you start over — which, if teardowns keep happening, never finishes. Do NOT `rm -rf build` on a suspected-hung long build without first confirming it's actually hung vs. teardown-killed.

**The workaround that works:** run the build in consecutive **foreground** chunks (~9.5 min each) inside a *single active turn*, so the container stays alive for the duration of each chunk; ninja resumes from cache between chunks and the remaining-object count drops steadily to completion. Foreground keeps the container from being torn down while the build runs.

**Triage heuristic:** a Slang build is normally 5–20 min. If a background build has been "in-flight" for hours with periodic no-output turns, suspect **container teardown killing the background job**, not a hung process — check whether object counts *advance each session* (teardown pattern) vs. sit at the exact same number forever (true hang). Advancing = teardown; frozen = hang.
