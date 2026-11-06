---
title: "Stale Pointers and Regression Checks"
type: concept
group: general-misc
tags: [staleness, verification, regression, triage, citations, byte-compare, source-of-truth, git-blame]
source_count: 23
---

# Stale Pointers and Regression Checks

## TL;DR

- For any issue or PR more than a few weeks old, re-verify its claims against current HEAD before scoping — the body describes the state when written; fixes may have landed, or work described as done may not exist yet.
- Treat every relayed pointer — `file:line`, a cited doc/spec path, a static-analysis-bot site — as stale: grep the current source for every symbol/line and confirm the cited branch/function still exists before repeating the claim. Reporters' pointers drift, even from a MEMBER.
- Re-derive the mechanism **and** the site count from source. A relayed finding can be right in direction and wrong in every specific (moved file, one site not two, a branch that no longer exists).
- Staleness runs both directions in time: a follow-up issue can describe work as "already removed" when the trim commit is not pushed yet. Verify the PR's live diff (`gh pr diff`); preserve about-to-be-stripped code/fixtures before the trim.
- A coordinate audit certifies WHERE, never the VERB. A line can pass a symbol grep yet not perform the action the claim attaches to it. Ask of each cite: *what verb did I attach, and does that line do that thing?*
- Scope symbol greps across ALL relevant files. An undercount (7 vs 10 sites) lets a nearby plausible line stand in for the real one; the load-bearing sites are often in the file you didn't grep.
- Fixing a coordinate inside a clause implicitly certifies the clause — re-run the CLAIM against the repro, not just the citation. More precise prose about an unreached branch is more precisely wrong.
- A file-changed / line-added count answers "what did the diff touch," never "what behavior changed." Verify against patch **bodies**; a recount that swaps a coarse-but-right behavioral read for a precise-but-irrelevant structural one lowers accuracy.
- A PR's changed-file list does not prove "not a regression": adjacent lowering/transform changes can alter whether execution reaches an unchanged downstream assert. Trace the data/control path for causal claims; else say "not determinable from the file list — maintainer's call."
- Bisect each sub-shape separately before saying "not a regression": one shape can be old while a sibling regressed, and a correct fix can be what exposed a latent gap. When your own correct consumer fix exposes a producer's wrong bits, keep the consumer correct, disclose the cost precisely, and gate the merge on the producer fix instead of adding a guard.
- Byte-compare / branch-reachability can localize a perf/behaviour regression — but only proves a mechanism when run where the changed branch can *fire* (cross-drive, Windows-only, GPU-only, endianness, locale, filesystem-type). A green byte-compare in the wrong env is a false negative.
- When phase-resolved human data contradicts your single-env repro, trust the measurement and find the reconciling condition.
- Byte-verify a hand-applied patch by post-image blob hash: confirm your base blob == the patch pre-image, apply the exact diff bytes, `git hash-object` the result, compare to the stated post-image. Always re-hash the CURRENT sha — an amend moves the blob, and that movement is the tell.
- Verify control-flow invariants against code at HEAD, not from a triage memo or a reviewer assertion. When two reviewers assert contradictory invariants, read the source and settle it yourself — never encode a claim as a comment on faith.
- A single-point triage "recommended fix" is a hypothesis; prove it with a local RED→GREEN + ablation. If you can't name a test that goes RED without a hunk, you don't understand the fix.
- Don't reflexively concede to a maintainer — re-verify against primary source (spec text, actual code, computed truth table) at claim precision before conceding or defending.
- Verify an accessor→behavior direction against source AND the emitted artifact; a reversed label survives casual review because the surrounding mechanism reads correctly.
- An open PR that mentions an issue is not automatically its fix (accept-now/fix-later splits); a tracking issue's premise ("the prerequisite was already made") can outrun reality — verify the prerequisite PR is actually MERGED, and that a squash merge is on main via its `merge_commit_sha`.
- Don't trust an agentic test-generation reporter's framing: strip the repro to minimum line-by-line, verify "other targets work" independently, and if the IR op in the error is more generic than the title's construct, the IR op is the real story.
- Check shallow-clone traps before citing `git blame` or `git log -S` (`test -f .git/shallow`, `git log --oneline | wc -l`); a shallow clone attributes lines to the oldest commit in its window. Get real file-touch history from `/repos/{o}/{r}/pulls/{n}/files`, or `git fetch --unshallow`.

## Re-verify stale claims against current HEAD before scoping

An issue or PR body describes the world when it was written; after weeks or months it drifts from
HEAD in either direction, and scoping off it wastes effort or diverges from a validated prototype.

For an aging **feature request**, never scope remaining work from the body or maintainer comments
alone: fan out code subagents to map what has landed versus what is missing at HEAD. In one case a
maintainer's design comment described the work as unstarted, yet most of the backend had already
landed and the real gap was far narrower ([Stale feature requests can be half-implemented at HEAD — verify before scoping](../learnings/1782215130307-stale-feature-requests-can-be-half-implemented-at-.md)).

Before implementing a maintainer-requested fix on an **aging PR**, run two cheap checks: (1) compare
the PR's base against current `origin/main` — the patched code may have been refactored away,
making the work moot; (2) confirm whether a referenced `#N` is an Issue or a PR
(`gh api repos/O/R/issues/N --jq '.pull_request'`, non-null = PR) ([Stale PR fix-requests: verify base vs current main, and issue-vs-PR, before implementing](../learnings/1782211781469-stale-pr-fix-requests-verify-base-vs-current-main-.md)).

For an issue with `file:line` claims — **especially bot-authored migration/cleanup trackers** — grep
current `main` for every claim and compare the issue's `createdAt` to HEAD. On slangpy-samples#45,
2 of 3 tracked breakage classes were already fixed by an independent commit `ba1d3106`; trusting the
body would have produced ~10 files of redundant fixes. Method: fresh `git clone --depth 1`, grep each
claimed symbol; for each "still broken" claim that greps clean, `gh api .../commits?path=FILE` finds
the superseding commit; post the delta verdict, not the stale claim ([Bot-filed migration issues go stale — re-verify every file:line against current main before triaging](../learnings/1783523441590-bot-filed-migration-issues-go-stale-re-verify-ever.md)).

⚠️ **Staleness also runs the other way in time:** a bot-filed follow-up can describe not-yet-stripped
work as *already removed* — it captures the plan, not the state. slang#12150 (split out of draft PR
#12148) said the include-defined + multi-compilation-unit tests were "removed", but it was filed 4
minutes after the maintainer merely *agreed to* the split; at the PR head
`findIncludingNonIncludedSourceFile()` (+103 lines) and all 5 `tests/spirv/debug-function-scope-*`
fixtures were still present. A fixer reading "restore the removed tests" literally would rewrite them
from scratch. PRESERVE the about-to-be-stripped code (branch/stash/cherry-pick from the pre-trim
commit), then re-add and extend; check `gh pr diff` before trusting the tense ([Bot-filed follow-up issue may describe not-yet-stripped work as already removed (preserve before trim)](../learnings/1784330297555-bot-filed-follow-up-issue-may-describe-not-yet-str.md)).

The same applies to **doc/spec paths a reporter cites**. On slang#12261 a MEMBER reporter said the
behavior "disagrees with the language reference
(`docs/language-reference/statements-break-and-continue.md`)" — that path does not exist at HEAD,
and the actual `statements.md` is *silent* on the rule. Echoing "the impl contradicts the reference"
would have been a false public claim; "the reference is underspecified" also reframes the fix as a
spec-gap opportunity. Run `[ -f <path> ]` and grep the reference for the rule before repeating it ([verify a reporter's cited doc/spec path before repeating "impl disagrees with the reference"](../learnings/1785320946422-verify-a-reporter-s-cited-doc-spec-path-before-rep.md)).

**Static-analysis-bot pointers** decay the same way, right in direction and wrong in every
specific. slangpy#823 relayed two CodeRabbit sites — an early return "~line 491" and an
`else if (...is_tensorview)` branch "~line 417". At HEAD the file had *moved*
(`src/slangpy_torch/` → `src/slangpy_ext/utils/`), the first site was at **428**, and **the second
branch did not exist** (refactored to one site). "File exists, `is_tensorview` appears, confirmed"
would have handed the fixer a two-site fix for a one-site bug; the cheap catch is
`grep -n '<symbol>' <file>` for *every* occurrence counted against the report, then reading the
cited range (`sed -n '255,410p' | grep tensorview` → zero hits). The clone was **34 commits deep**,
so `git blame` attributed lines to the oldest commit in the window (#1018) instead of the true origin
(#775), and a subagent reported "#775/#781 do not exist in this history" as a *finding* — check
`test -f .git/shallow` and `git log --oneline | wc -l` before citing blame, and get file-touch
history from `/repos/{o}/{r}/pulls/{n}/files`. The summary verb was also wrong in a
severity-changing way: the TensorView path did not "bypass the interop buffer copy" — the buffer is
allocated and copied, then an early return ignores the parameter, and tracing it surfaced a missed
second defect (a writable TensorView silently loses copy-back ⇒ **wrong results**). **Re-derive the
mechanism AND the site count from source** ([issue line-number pointers relayed from a static-analysis bot go stale — verify the branch still exists, not just the file](../learnings/1785828925526-issue-line-number-pointers-relayed-from-a-static-a.md)).

## Citation and coordinate audits: right coordinate, wrong claim

Auditing that citations *resolve* is necessary but not sufficient.

⛔ **A coordinate audit certifies WHERE, never the VERB.** On slang#12443 a public triage comment had
all 12 `file:line` cites verified (`sed -n 'Np'` + expected-symbol grep + a must-fail control) and
**three were still wrong**, because the audit never checked the *predicates*: "X is flushed at :N"
and "X is declared at :N" both pass a symbol grep at :N (the real flush was 350 lines later; a
`:3465` `AddOverloadCandidates` *call* was cited as the diagnose site, the real raise is at
`:3808`). Ask of each cite: *what verb did I attach, and does that line do that thing?* A grep
scoped to `slang-check-expr.cpp` also found "7 sites" of 10 — the 3 in `slang-check-overload.cpp`
were the load-bearing ones, and the undercount let a nearby plausible line stand in ([a right coordinate with a wrong verb survives a coordinate audit](../learnings/1786309524875-a-right-coordinate-with-a-wrong-verb-survives-a-co.md)).

**Fixing a coordinate inside a clause implicitly certifies the clause.** A three-round correction
chain moved the numbers to lines that all resolved, but the clauses "named the right code for the
wrong story": `:3465` is never reached for the repro (the failing branch sets
`typeOverloadChecked=true`, disabling overload resolution), so more precise prose was more precisely
wrong. Re-run the *claim* against the repro ([fixing a coordinate inside a clause implicitly certifies the clause](../learnings/1786310241945-fixing-a-coordinate-inside-a-clause-implicitly-cer.md)).

⚠️ **A file/line count is not a behavior claim.** A subagent reported PR #12116 as "comments only,
no code"; a reviewer saw `+16`/`+6` in two `.cpp` files on `/pulls/12116/files` and "corrected" it to
"real code" — less accurate, because the added lines were themselves comments. A careful recount
that swaps a coarse-but-right behavioral read for a precise-but-irrelevant structural one is the
case where more rigor lowers accuracy; check the patch **bodies** before overturning a behavior claim
with a count ([a file/line count is not a behavior claim — the one shape where a careful recount makes a report WORSE](../learnings/1786312369827-a-file-line-count-is-not-a-behavior-claim-the-one-.md)).

## Byte-verifying a hand-applied patch

"Review the actual source, not a reconstruction" survives an UN-fetchable branch (a
`.github/workflows/*` App-permission wall, a worktree on another coworker's disk): (1) confirm your
base blob equals the patch pre-image (`git rev-parse HEAD:<path>` vs the `index <pre>..<post>`
line) — then your copy IS the fixer's pre-edit file; (2) apply the exact committed diff bytes;
(3) `git hash-object <path>` and compare to the stated post-image. A match is proof. ✅ Always re-hash
the **CURRENT** sha: an amend moves the SHA and blob, and that movement is the tell content changed.
#12062 (`removeRequestedReviewers`; pre-image `a3bfb08f31`, post-image `f46f95ac14`) matched → clean
APPROVE ([byte-verify a hand-apply patch by post-image blob hash](../learnings/1785261494633-byte-verify-a-hand-apply-patch-by-post-image-blob-.md)).

## Regression attribution: the file list is not causal

Do not conclude "not a regression" because a past PR's changed-file list excludes the assert site:
adjacent lowering/transform changes can alter whether execution reaches an unchanged downstream
assert. The file list only proves "the assert site was/wasn't modified"; for causal claims trace the
data/control path, or say "not determinable from the file list — maintainer's call" ([A PR's changed-file list does not prove 'not a regression'](../learnings/1780541174316-a-pr-s-changed-file-list-does-not-prove-not-a-regr.md)).

**"Not a regression" must hold for every sub-shape, and a correct fix can be the trigger.** On
#13805 (WGSL/Metal `ByteAddressBuffer` array loads), top-level arrays never worked, but an array field
at a non-zero struct offset worked in v2026.10.2 and broke in v2026.11 — a correct constant fold
(#11430) removed an accidental fallback and exposed a latent gap. Bisect each sub-shape separately
(top-level vs nested, zero vs non-zero offset); release zips (`gh release download vX -p
'slang-X-linux-x86_64.zip'`) plus GPU-free Tint (`webgpu@0.6.2`, `backend=null`) settle it in
minutes. Mechanism: [WGSL f16 and const-expressions](slang-backends-wgsl-f16-and-const-expressions.md)
([a correct constant-fold fix can expose a latent bug as a regression](../learnings/1792570145283-a-correct-constant-fold-fix-can-expose-a-latent-bu.md)).
It happens to your own PR too: on slang#13985 / PR #13993, trip-count inference started reading
`uint64_t` bounds correctly as unsigned, and constants the front-end had mis-folded (#13954) then gave
worse answers than master's signed misreading, which was right by luck — a false zero-trip that
undersizes the autodiff tape, so `bwd_diff` returns garbage. The PR kept the consumer correct,
declined an expression-shape guard (it misses `~0ull >> 61`), named the real cost in its Risk line
(wrong derivatives, not just a warning), cited #13954 as a merge prerequisite, and stayed draft.
Details: [integer constant folding](slang-language-core-integer-constant-folding.md) ([a correct consumer exposes a producer's wrong bits; disclose, don't guard](../learnings/1793227253947-a-correct-consumer-exposes-a-producer-s-wrong-bits.md)).

A clean bisect of a perf/behaviour regression to a small diff on an LTO build proves WHICH commit,
not the MECHANISM. Step 0: prove cheaply whether the diff changes emitted output — build the culprit
with a stderr marker inside the changed branch and run the real fixture (if it never fires, both
versions return identical values by construction), and byte-compare the artifact by reverting only
the diff with an incremental relink (shared build metadata, confound-free `cmp`/sha256). If the
output is byte-identical, an LTO-bisected regression is almost always a code-LAYOUT artifact
(reorder/inlining shift): re-baseline rather than "optimize" a path the diff doesn't touch ([Perf regression bisected to a fix ≠ the fix's logic is the cost (byte-compare serialized artifacts)](../learnings/1783349482128-perf-regression-bisected-to-a-fix-the-fix-s-logic-.md)).

⛔ **Correction:** that proves a mechanism only where the changed branch can *fire*. On slang#11952
the reverted `getRelativePath` empty-path branch is unreachable on Linux single-filesystem but fires
on the perf runner's cross-drive checkout (`W:` source, `C:` temp) — a green byte-compare in the
wrong env is a false negative. Ask whether the branch is reachable in your env (cross-drive,
Windows-only, GPU-only, big-endian, locale, filesystem-type); when a human's phase-resolved data
(timers putting the cost in SemanticChecking) contradicts your single-env repro, trust it and find
the reconciling condition ([CORRECTION: a byte-compare / branch-reachability test only proves a mechanism when run in the environment where the changed branch can fire](../learnings/1783520640192-correction-a-byte-compare-branch-reachability-test.md)).

On a **shallow clone** (the base slang clone is `--depth 50`), `git log -S'<string>' -- <file>` /
`-L` gives FALSE attribution: it names the earliest commit *in the window* that touched the string.
On #13126 it blamed #10990 (which only modified a nearby line) for the `ByteAddressBufferLoad`
alignment operand; `git show` gave the true history — #4066 added the operand, #8547 added it to
`isElementAccessInst` (creating the two-operand-rebuild drop), #11595's unconditional
`validateExplicitAlignment` deref turned the drop into a SIGSEGV. Find the feature commit by title
(`git log --oneline | grep`, or the PR) and confirm with `git show <sha> -- <file>`, or
`git fetch --unshallow` first ([Shallow-clone git-log -S gives false regression attribution](../learnings/1789577475326-shallow-clone-git-log-s-gives-false-regression-att.md)).

## Verify against primary source, not memos, reviewers, or maintainers

slang#11860 (PR #11871, merged) taught two things. (1) A triage "recommended fix" naming ONE code
point is a hypothesis — prove it with RED→GREEN + ablation. Skipping `markSpaceUsed` at one site left
the bug live because a SECOND space-occupancy consumer also reserved set 0; only an instrumented build
plus an ablation matrix (hunk1-only broken, hunk2-only broken, both fixed) proved both hunks
load-bearing. (2) When reviewers assert CONTRADICTORY invariants, read the source yourself: reviewer A
said VaryingInput/Output/SpecializationConstant DO reach a guarded branch with placeholder space==0,
reviewer C the opposite; `addExplicitParameterBindings_GLSL` showed A right, and committing C's
framing would have shipped a confidently-false invariant comment. Comments and PR-body claims about
control-flow invariants are verified against HEAD, never lifted from a memo or reviewer ([Verify against source before trusting single-point triage OR contradictory reviewer invariants](../learnings/1782935715651-verify-against-source-before-trusting-single-point.md)).

Nor concede reflexively to a maintainer: when one disputes a finding, even confidently ("this is
WRONG", "the emit is incorrect!!!"), re-verify against the *primary source* (spec text, code, a
computed truth table) at claim precision before conceding or defending ([Don't reflexively concede to a maintainer assertion — verify at claim precision](../learnings/1784149362998-don-t-reflexively-concede-to-a-maintainer-assertio.md)).

Verify "accessor X yields spelling/behavior Y" against the accessor's *source* AND the *emitted
artifact*, not by which producer "looked canonical". On slang#11982 an earlier learning had the two
`PathInfo` accessors backwards; the verified mapping (`source/compiler-core/slang-source-loc.cpp`,
confirmed by `-g2` asm) is `getMostUniqueIdentity()` → `uniqueIdentity` = ABSOLUTE path, `getName()`
→ `foundPath` = the as-found (RELATIVE in the repro) spelling. The mechanism — two hoistable
`IRDebugSource` insts for one file differ only in the filename operand, so dedup misses and leaves an
orphaned record; per-module `SharedIRGenContext` merges them only at link time and only on a
byte-identical operand — was right; only the direction was wrong, and it mattered because the fix
(PR #12034) canonicalized BOTH producers onto `getMostUniqueIdentity()`, the *opposite* of the
reversed note's advice. The author caught it only because the requested spelling contradicted the
mapping ([CORRECTION: slang getMostUniqueIdentity()=absolute, getName()=relative](../learnings/1783659293513-correction-slang-getmostuniqueidentity-absolute-ge.md)).

## PR↔issue relationships and agent-filed reports

An open PR that mentions an issue is NOT automatically its fix — sanitizer-burndown work is often
split into accept-now/fix-later PRs (#11938 vs #11937) ([Verify PR-issue relationship before assuming duplicate](../learnings/1783078003012-verify-pr-issue-relationship-before-assuming-dupli.md)).
A tracking issue whose premise is "the prerequisite was already made" can outrun reality — verify the
prerequisite PR is MERGED ([Follow-up/tracking issue premise can outrun its prerequisite PR](../learnings/1783029023011-follow-up-tracking-issue-premise-can-outrun-its-pr.md)).
And **"merged" is not "on main":** a squash merge makes a new base-branch commit, so a fixer's
reported "merged head" reads "diverged" in `compare <head>...main` — expected, not alarming. Get the
real commit with `gh pr view N --json mergeCommit` (or `.merge_commit_sha`), then
`gh api compare/<merge_sha>...main --jq .status` should be `identical`/`ahead`; stronger, read the
changed symbols on `ref=main` via the contents API. slangpy#1162's fixer reported head `2b960f12`
(diverged), while squash commit `97f0f21a` was `identical` to main ([verify a squash-merge landed on main via the merge_commit_sha, not the branch head](../learnings/1789492537461-verify-a-squash-merge-landed-on-main-via-the-merge.md)).

For issues from an **agentic test-generation pipeline**, don't trust the reporter's framing of the
trigger: strip the repro by commenting out lines one at a time to find the one whose removal makes
compilation succeed; re-check "other targets work" (agentic reporters cite sibling tests they did not
re-run); and if the error's IR op is more generic than the title's construct (`castToVoid` vs
"enum-to-int cast"), the IR op is the real story ([Test-Agent-Filed Issues Need Trigger Verification](../learnings/1779958336217-test-agent-filed-issues-need-trigger-verification.md)).

**Source learnings (23):**
- [A correct constant-fold fix can expose a latent bug as a regression — bisect sub-cases separately](../learnings/1792570145283-a-correct-constant-fold-fix-can-expose-a-latent-bu.md) — #13805: offset field regressed in v2026.11 via a correct fold
- [Shallow-clone git-log -S/-L gives false regression attribution — confirm the feature commit with git show, or fetch --unshallow first](../learnings/1789577475326-shallow-clone-git-log-s-gives-false-regression-att.md) — earliest in-window commit is not the origin
- [Test-agent-filed issues need trigger verification](../learnings/1779958336217-test-agent-filed-issues-need-trigger-verification.md) — strip the repro; the generic IR op is the real story
- [A PR's changed-file list does not prove 'not a regression'](../learnings/1780541174316-a-pr-s-changed-file-list-does-not-prove-not-a-regr.md) — file list proves what changed, not causation
- [Stale PR fix-requests: verify base vs current main, and issue-vs-PR](../learnings/1782211781469-stale-pr-fix-requests-verify-base-vs-current-main-.md) — patched code may be refactored away on main
- [Stale feature requests can be half-implemented at HEAD](../learnings/1782215130307-stale-feature-requests-can-be-half-implemented-at-.md) — map landed-vs-missing at HEAD before scoping
- [Verify against source before trusting single-point triage or contradictory reviewer invariants](../learnings/1782935715651-verify-against-source-before-trusting-single-point.md) — RED→GREEN + ablation; read source to settle reviewers
- [Follow-up/tracking issue premise can outrun its prerequisite PR](../learnings/1783029023011-follow-up-tracking-issue-premise-can-outrun-its-pr.md) — verify the prerequisite PR is actually MERGED
- [Verify PR-issue relationship before assuming duplicate](../learnings/1783078003012-verify-pr-issue-relationship-before-assuming-dupli.md) — accept-now/fix-later splits; mention ≠ fix
- [Perf regression bisected to a fix ≠ the fix's logic is the cost](../learnings/1783349482128-perf-regression-bisected-to-a-fix-the-fix-s-logic-.md) — byte-identical LTO diff = code-layout artifact
- [CORRECTION: byte-compare/branch-reachability only proves a mechanism where the branch can fire](../learnings/1783520640192-correction-a-byte-compare-branch-reachability-test.md) — green in the wrong env is a false negative
- [Bot-filed migration issues go stale — re-verify every file:line against current main](../learnings/1783523441590-bot-filed-migration-issues-go-stale-re-verify-ever.md) — grep each claim; find the superseding commit
- [CORRECTION: slang getMostUniqueIdentity()=absolute, getName()=relative](../learnings/1783659293513-correction-slang-getmostuniqueidentity-absolute-ge.md) — verify accessor direction in source AND artifact
- [Don't reflexively concede to a maintainer assertion — verify at claim precision](../learnings/1784149362998-don-t-reflexively-concede-to-a-maintainer-assertio.md) — primary source before conceding or defending
- [Bot-filed follow-up issue may describe not-yet-stripped work as already removed](../learnings/1784330297555-bot-filed-follow-up-issue-may-describe-not-yet-str.md) — check the live diff; preserve code before the trim
- [Byte-verify a hand-apply patch by post-image blob hash](../learnings/1785261494633-byte-verify-a-hand-apply-patch-by-post-image-blob-.md) — base==pre-image, hash-object == post-image; re-hash current sha
- [Verify a reporter's cited doc/spec path before repeating "impl disagrees with the reference"](../learnings/1785320946422-verify-a-reporter-s-cited-doc-spec-path-before-rep.md) — a cited doc path can be missing or silent
- [Issue line-number pointers relayed from a static-analysis bot go stale](../learnings/1785828925526-issue-line-number-pointers-relayed-from-a-static-a.md) — re-derive mechanism AND site count; shallow-blame trap
- [A right coordinate with a wrong verb survives a coordinate audit](../learnings/1786309524875-a-right-coordinate-with-a-wrong-verb-survives-a-co.md) — audit each cite's predicate; grep all files
- [Fixing a coordinate inside a clause implicitly certifies the clause](../learnings/1786310241945-fixing-a-coordinate-inside-a-clause-implicitly-cer.md) — re-run the claim against the repro
- [A file/line count is not a behavior claim](../learnings/1786312369827-a-file-line-count-is-not-a-behavior-claim-the-one-.md) — check patch bodies before overturning with a count
- [Verify a squash-merge landed on main via the merge_commit_sha, not the branch head](../learnings/1789492537461-verify-a-squash-merge-landed-on-main-via-the-merge.md) — reported head "diverges"; compare merge_sha...main
- [A correct consumer exposes a producer's wrong bits; disclose the regression, don't guard it](../learnings/1793227253947-a-correct-consumer-exposes-a-producer-s-wrong-bits.md) — #13993: Risk line, producer fix as merge prerequisite
