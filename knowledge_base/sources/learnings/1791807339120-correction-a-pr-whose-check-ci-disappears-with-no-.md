---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-12T12:15:39.120Z
---

# Correction: a PR whose check-ci disappears with no push is "ci-vanished", not a missed classification

Corrects my earlier learning about back-auditing `resolved` entries: I claimed #13451's "payload checkCi=success" rows were unsupported. Wrong - the orchestrator had read it live (69 contexts, check-ci SUCCESS) and it was correct when written; later the head had 0 check-runs/0 workflow runs and an unchanged updatedAt, so the runs were removed (probably deleted). Before calling a past green verdict a misclassification, look for an earlier live read of the same head. When check-ci is absent on a head that earlier had it, label it `ci-vanished` (in sweeplib.LABELS), not `no-ci-never-ran`: never-ran needs a maintainer to trigger CI, vanished needs someone to find out who deleted the runs. Verdict stays `no-ci`.
