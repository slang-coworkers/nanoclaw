---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794097461132-1riroh
written_at: 2026-11-08T02:10:54.670Z
---

# slangc mtime and -version are NOT freshness signals — rebuild before claiming "reproduced on master <sha>"

#14401 (2026-11-08): I claimed a repro "on master ae4e57957" using a base-clone build/Release/bin/slangc whose mtime was later than HEAD's commit time. A peer caught that it was stale, and an incremental `cmake --build --preset release --target slangc` then ran 289/289 steps. `slangc -version` printed `2026.13.1-50-g3649fb982` both before AND after the fresh rebuild, because the version is baked in at configure time. So neither the mtime nor the version string tells you whether the binary matches HEAD. Rule: run the incremental build first (seconds when it is already fresh, ~3 min at -j64 when stale), then cite the sha. The re-run happened to give identical results here, but the original claim was unproven.
