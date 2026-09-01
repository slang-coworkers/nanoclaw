---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788101780752-bd8ib7
written_at: 2026-08-30T15:11:50.919Z
---

# [approver/clause-gap] synchronize that drops its own tests is an OPEN_GAP, and a stale bot review can't see it

## Symptom
slangpy#1129 "Add hash append utility". A `synchronize` (rebase 18cf8bd→80aebfa4,
diverged ahead1/behind1 off shared base) was routed for an approval decision.
The only bot signal was CodeRabbit's issue-comment summary saying "No actionable
comments 🎉 / Merge Risk Minimal" — which harvest correctly returned as exit 20
(issue comment, not a formal `reviews[]` entry). Head-current Devin ran clean
(exit 0, 0 bugs/flags). Every one of the 6 eligibility clauses passed. On the
surface: a trivial +13/-0 header-only addition, everyone green → looks like a
clean WOULD_APPROVE.

## Root cause (what the surface signals could not see)
The CodeRabbit summary was rendered against commit **18cf8bd**, which touched 3
files including `tests/sgl/core/test_hash.cpp` (+25, single- and multi-value
chaining asserts) and its `tests/CMakeLists.txt` registration. The synchronize
under decision **removed both** — at head 80aebfa4 the test file is 404, the
CMake registration is gone, `hash_append` has 0 callers, and the PR body's
Validation section still advertises `cmake --build … --target sgl_tests`. So the
single defining delta of the revision I was asked to approve was the DELETION of
its own test coverage. CodeRabbit's clean verdict was STALE (blessed the tested
commit); Devin reviews the diff and is structurally SILENT on a test that is
*absent* from head. Neither bot signal can report the regression.

## How to catch it
For any `synchronize`/rebase decision, compare the reviewed-bot commit against
the pinned head with `gh api …/compare/<bot_commit>...<head>` — if `status` is
`diverged`, the bot verdict may be stale. Then diff the FILE SETS of the two
commits (`gh api commits/<sha> --jq '.files[].filename'`), not just line counts:
a synchronize that *removes* files (especially tests for the very code being
added) is a red flag a "no actionable comments" summary cannot represent. Cheap
confirmations: `contents/<testpath>?ref=<head>` → 404, grep `tests/CMakeLists.txt`
at head for the registration, `search/code?q=<symbol>` for callers. Cross-check
the PR body's stated Validation against what the head diff actually contains —
a Validation claim naming a test target that no longer exists is a claim-vs-code
mismatch.

## Fix / rule
A revision whose defining change is "dropped the tests for the new public API it
adds," while the description still claims test validation, is a specific nameable
gap → **ABSTAIN_POLICY:OPEN_GAP**, never round up to WOULD_APPROVE. Extends the
existing [approver/challenger-miss no-ci-gate] shape: "no test doesn't make the
code wrong" answers the wrong question — the maintainer question is "did you mean
to delete your regression coverage?" A green Devin + a clean-but-stale CodeRabbit
summary is a negative-safety observation that carries zero bits about the removed
test (it could not have come out any other way). On the fallback tier this is a
mandatory extra-caution → abstain.
