---
title: "[approver/human-agreement] mimalloc allocator-centralization PR (#12105) MERGED at exact decision head with advisory nits shipped — WOULD_APPROVE on '0 bugs / doc-comment-test-effectiveness gaps only' vindicated"
type: learning
topic: review-approval
source: learnings/1784334832215-approver-human-agreement-mimalloc-allocator-centra.md
---

# [approver/human-agreement] mimalloc allocator-centralization PR (#12105) MERGED at exact decision head with advisory nits shipped — WOULD_APPROVE on "0 bugs / doc-comment-test-effectiveness gaps only" vindicated

**Outcome:** slang #12105 "Use mimalloc for Slang-owned malloc/free on Windows" (pdeayton-nv) MERGED by jkwak-work at head `126161354dfa` — byte-identical to my final decision row (row 4). Merge = squash onto master (`aaa07fe2`, parent `99b8019`). jkwak-work also posted an explicit APPROVED @ that exact head before merging. My verdict across all 4 revisions was WOULD_APPROVE (CLEAN); this is a clean agreement, vindicated by both the explicit approval and the merge at the identical SHA.

**The calibration signal worth transferring:** every primary review across the revisions verdicted "🟡 Minor/Has-issues — N gaps, **0 correctness bugs**", where the gaps were consistently **doc-accuracy / stale-comment / test-effectiveness / clarity** items — NOT logic defects. I dispositioned all of them advisory and returned WOULD_APPROVE. The merge confirms this was right: **all 7 advisory findings on the final head shipped UNADDRESSED** (the merged head == my decision head, no follow-up commits fixing them). The maintainer approved and merged with the nits intact.

**Rule / how to apply next time:** For an allocator/infrastructure-refactor PR where the production review's verdict line is explicitly "0 bugs" and every itemized finding is a doc/comment/test-coverage/clarity nit (no 🔴, no reachable logic defect), WOULD_APPROVE is the calibrated call — do NOT withhold to ABSTAIN over advisory nits. Maintainers routinely merge such PRs with those nits open. The bar for ABSTAIN(OPEN_GAP) remains a *plausible real trigger / real blast radius* (per the skill's conservative-lean bar), which pure doc/comment/test-effectiveness gaps do not meet.

**Specific safety facts that held (for the next mimalloc/allocator PR):** the #8419 mixed-allocator hazard class was closed correctly by (a) per-site `::malloc/::free`→`StandardAllocator` conversion with alloc+free swapped together, (b) foreign buffers (miniz `mz_free`, POSIX `realpath` `::free`) keeping their own free, (c) the ZIP zero-copy `attach` guarded by `SLANG_RELEASE_ASSERT` on callback identity — and the final primary review added a positive proof that `mz_zip_writer_finalize_heap_archive` transfers ownership + NULLs miniz's internal buffer so the following `mz_zip_writer_end` does not double-free. A later revision's `tools/CMakeLists.txt` `LINK_WITH_PRIVATE core` change (make the unit test actually link core→mimalloc) is the principled fix for the recurring "mi_check_owned assertions only fire on the Windows-default-ON lane" test-effectiveness gap — but even that gap shipping open did not block the merge.

**Process note (multi-revision PR):** #12105 fired 5 times (opened + 4 synchronizes/ready). Rows 2-4 recorded WOULD_APPROVE; row 1 (opened head 2c8907bdefec) was never recorded (superseded mid-critique). Reconciliation rule that held up: on a re-fire, diff the PR-owned files per-SHA — pure rebases (byte-identical, same diff_hash) still get a fresh row but you know the outcome shape; a real diff change (here 17→19 files, new diff_hash) gets a full clean re-run. Every head advance's primary review posted ~26-31min after the push (the "Claude Code Assistant" check = skipped is a red herring) — waiting for it each time avoided a fallback-tier miss.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784334832215-approver-human-agreement-mimalloc-allocator-centra.md`_
