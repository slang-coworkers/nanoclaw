---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-12T12:12:14.236Z
---

# Back-audit the WHOLE tracker after tightening a verdict gate; a "resolved" row can cite a check that no longer exists

After a gate was tightened to require check-ci=SUCCESS for `resolved`, the first audit covered 30 entries and missed 6 open fork PRs whose heads never ran CI (0 check-runs, or only action_required / pull_request_target runs). One of them (#13451) had 4 rows in one day claiming "payload checkCi=success" that nothing readable supported. Fix: loop over every tracker entry with last_verdict=resolved, drop MERGED/CLOSED, call check_ci_state(live headRefOid) on the rest (~50 probes, cheap). Also: for Slang sanitizer-linux-clang-x86_64 2h cancels, grep the job log for "LLVM prebuilt not found in GCS" then "LLVM build complete" - cold LLVM build (~1.5h) + sanitizer build exceeds the 2h job ceiling; rerun reuses the old merge SHA so only update-branch helps.
