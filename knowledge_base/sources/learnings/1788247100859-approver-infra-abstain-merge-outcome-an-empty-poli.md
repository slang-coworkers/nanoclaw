---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787680235407-uo2zbl
written_at: 2026-09-01T07:18:20.859Z
---

# [approver/infra-abstain] Merge outcome: an empty policy mount silently converts human-concordant WOULD_APPROVEs into abstains on PRs that merge

**Symptom.** slang PR #12754 was MERGED by a human maintainer (jkwak-work,
2026-09-01) at exactly the commit R4 `8a6d9e85a507` that this approver had
recorded **ABSTAIN_POLICY** for. Merged head == my last decision commit (no
commits in between). Across the revision chain: R1/R2 (`c1eb0c73c3c7`) =
WOULD_APPROVE under the mounted `v0-shadow-wide` policy; R3/R4 = ABSTAIN_POLICY
under the bundled `v0-shadow` default (group policy mount empty).

**Root cause / calibration reading.** The abstains were NOT a signal about the
code — they were a policy-environment artifact: with the mount empty, a
CONTRIBUTOR-bot PR touching `**/CMakeLists.txt` fails `author_trust` +
`no_protected_paths` under the conservative default. The human merge confirms
the FUNCTIONAL read (would-approve, as recorded for R2 under the wider policy)
was correct. So although `ABSTAIN_POLICY` rows are excluded from agreement
scoring, the empty mount had a real, measurable cost: it converted what would
have been human-concordant WOULD_APPROVE rows (under the intended
`v0-shadow-wide`) into abstains on a PR that ultimately merged — i.e. it
suppressed agreement signal rather than producing it.

**Also confirmed.** R4's `build-windows-debug-cl-aarch64 / build` had been
FAILING at my review time, yet the maintainer merged. This vindicates the
recorded note that Windows takes neither of this PR's changed CMake branches
(`if(APPLE)` / `elseif(NOT WIN32)`) — that build failure was on a platform the
change does not touch and was non-blocking. Lesson: for a scoped build-system
change, weigh the CI signal per the platforms the change actually affects
(here: macOS builds, which were green), not the aggregate.

**How to catch / fix.** When a bot/CONTRIBUTOR build-system PR abstains SOLELY on
`author_trust` + `no_protected_paths` under the bundled `v0-shadow` default,
treat it as a strong candidate for "would be WOULD_APPROVE under the intended
mounted policy," and surface the empty/regressed-mount question with urgency —
the cost is now demonstrated (a merged PR whose agreement signal was lost).
Compare `policy_version` across a PR's revisions; a mid-chain change from
`v0-shadow-wide` to `v0-shadow` is the environment moving, not the code. This
merge is the terminal calibration join for #12754.
