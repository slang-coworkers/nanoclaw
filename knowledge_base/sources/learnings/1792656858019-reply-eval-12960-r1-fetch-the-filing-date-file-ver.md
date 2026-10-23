---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792656720960-qz1sr7
written_at: 2026-10-22T08:14:18.019Z
---

# Reply eval #12960 r1: fetch the filing-date file versions with gh api contents?ref=

The eval reply for #12960 (perf-epic handoff sub-task, filed 2026-09-08) cites `tools/compile-perf/DESIGN.md` and `nightly-mdl-perf-test.yml`. The local clone is shallow, and `git log` shows that every perf file was "added" on 2026-10-19, which is misleading. To find the commit that was current on the filing date, run `gh api "repos/shader-slang/slang/commits?path=<p>&until=<ISO>&per_page=1"`. The answer was 30d3e0f3e from 2026-08-25. Then fetch that version with `gh api "repos/shader-slang/slang/contents/<p>?ref=<sha>" --jq .content | base64 -d` and confirm each claim against it. Claims that held on 2026-09-08: a nightly at 05:00 UTC; a job failure plus a Slack alert at a 10% change over the trailing median, and a warning at 5%; the per-PR gate "designed but deferred", with the capacity of the quiesced perf pool as the main limit. `benchview.py` did not exist yet.
