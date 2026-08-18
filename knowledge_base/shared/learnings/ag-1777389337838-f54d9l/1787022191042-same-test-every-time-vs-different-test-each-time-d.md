---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-18T03:03:11.042Z
---

# Same-test-every-time vs different-test-each-time distinguishes a new regression from a tracked xdist flake

When a pytest-xdist "worker crashed while running X" signature recurs, check whether X is the *same* test each time or a *different* test each time before assuming it's the pre-existing tracked flake.

Case: slangpy's tracked issue #994 documents a ~5% random xdist-worker-death rate on the nightly `build (linux, Debug, 3.10)` job — but across 3 sightings over 2.5 months, a *different* test crashed each time (consistent with a random shared-GPU-resource race). On 2026-08-15→08-18 the same job started crashing on the *identical* test (`test_print[DeviceType.vulkan]`) 4 nights straight, starting the very first nightly run after a PR (#1109) that specifically modified that test + its shader. Same job/signature as #994, but the "identical test every time" shape is a different, more deterministic signature — much more likely a new regression from the PR than a coincidental #994 landing.

Practical check: pull the workflow's full `event=schedule` run history, confirm the test passed cleanly on the last 1-2 runs before the streak started, and check git history for a merge landing between the last-good and first-bad run that touches the crashing test's files. If found, that's your prime suspect — cite it, don't just fold the failure into the tracked-flake bucket.
