---
title: Approver challenger probes — vacuous tests, reachability, and "could this have come out otherwise?"
type: concept
group: misc
tags: [pr-approver, challenger, vacuous-pass, filecheck, sanitizer-lane, reachability, open-gap, revert-drill, could-it-be-otherwise]
source_count: 14
---

## TL;DR

The approver's challenger stage repeatedly missed real defects — or nearly
missed them — because it read framing instead of probing the mechanism. The
unifying probe across every case is **"could this observation (green CI, a
passing test, a bot's clean pass) have come out otherwise?"** If a test/lane/
signal cannot distinguish the states you care about, it carries zero bits.

Concrete probes that turned soft notes into cited defects:

- **Vacuous test-pass.** `filecheck-buffer` substring CHECKs are unanchored:
  `CHECK: 1` matches `10`, `CHECK: 0` passes against a zero-init buffer. An
  INTERPRET/COMPARE test can pass because the CHECK token leaked into the
  compiler's *abort* output. Demand `CHECK-NEXT`/anchored values; run the raw
  tool and read the exit code.
- **Sentinel/lane semantics.** A discriminating fix whose sentinel collides with
  the ambient crash code (exit 1) still ships the bug. `halt_on_error=0` turns
  "stop at first race" into "enumerate all pre-existing races," so "flagged race
  fixed" ≠ "lane green." Re-derive pass/fail from the fresh log every revision.
- **Reachability gates severity.** A "Major functional bug" in provably-dead code
  is a latent trap, not a BLOCK; an untested `catch` branch on a *shared*
  primitive IS an OPEN_GAP. Find the caller before scoring.
- **Discriminating control.** A lifetime/leak-fix test whose pass is a negative
  observation may go green without the fix (a fix-independent free path). A
  "compile-only test dir" and "materialize is pure hygiene" are checkable claims,
  not assumptions.
- **Read the full artifact.** Truncated comment bodies (1000-char cap) hide
  accepted-but-unpushed rewrites. When you disagree with a human + all bots on a
  silent-miscompile claim and the repo has a build — **build it.**

## The vacuous-pass family (test-only PRs)

Two atoms expose how "green" carries zero bits on slang test-only PRs.
[The systemic filecheck-buffer vacuous-pass](../learnings/1786999476846-approver-challenger-miss-filecheck-buffer-vacuous-.md)
(slang#11081): `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK)` matches by
*unanchored substring* — `CHECK: 1` matches `"10"`, and `CHECK: 0` passes for a
slot the shader never writes (zero-init). The transferable probe for any
compute-test PR: for each CHECK, ask "could this pass against a wrong or zero
buffer?" — single/low-digit values and `CHECK: 0` on an unwritten slot are the
hazards; demand `CHECK-NEXT`. [The abort-output vacuous pass](../learnings/1786994992315-a-slang-test-interpret-compare-test-can-vacuously-.md)
is the sibling: an INTERPRET/COMPARE test reported "100% passed" while `slangi`
*aborted* (exit 5), because the CHECK token `3` matched the constructor arg echoed
in the abort's stderr. `slang-test`'s verdict is a filecheck match over combined
stdout+stderr — always run the raw tool and check the exit code.

## Sentinel and lane semantics change what a signal means

[The discriminating-exit-code miss](../learnings/1786983342575-approver-challenger-miss-a-discriminating-exit-cod.md)
(slang#12560): the PR's purpose was to tell a *regression* from an *operational
abort* via `trend.py`'s exit code, but `EXIT_REGRESSION = 1` collides with the
ambient crash code — a crash announces itself as a ">=10% regression," the exact
false alert the PR promised to kill. The Step-0 probe: "when a change's purpose
is *distinguish signal X from failure mode Y by a sentinel*, does the sentinel
COLLIDE with the ambient failure codes?" A self-check that *asserts* the buggy
behavior is worse than none.

Three slangpy#1112 sanitizer-lane atoms compound this. [The halt_on_error miss](../learnings/1787001347127-approver-challenger-miss-a-sanitizer-lane-revision.md):
the R1 commit fixed the flagged race but also flipped `halt_on_error=1`→`0`,
turning "stop at first race" into "enumerate every pre-existing race" — the lane
still fails, now for a broader reason. [The submodule gitlink bump](../learnings/1787003753987-approver-challenger-miss-a-submodule-gitlink-bump-.md):
a dependency bump's blast radius is bounded by its own diff's `#if` guards (the
upstream patch was entirely `#if defined(__APPLE__)`), so it fixed only the macOS
leg — verify provenance from the declared URL, bound effect by the patch's
platform guards, confirm per-leg from fresh logs. Both feed [the red-on-arrival
class](../learnings/1787004204123-approver-human-disagreement-confirmed-no-disagreem.md)
(cross-referenced on the outcome-calibration page): "flagged issue fixed" and
"lane passes" are independent questions.

## Reachability gates severity

[The CodeRabbit "Major functional bug" in dead code](../learnings/1787000629621-approver-clause-gap-a-coderabbit-major-functional-.md)
(slangpy#1112): a TSan-preload bug in `configure_linux_preload()`'s `thread`
branch — but one `grep -rn` showed the only caller never passes `thread`, so the
branch is unreachable on every current path (latent trap, not a live break).
**Reachability gates severity** — find who reaches X before scoring, and record
the latent-trap caveat so it's re-checked when the branch goes live.

The inverse: [an untested exception/catch branch on a shared primitive](../learnings/1787049320318-approver-challenger-calibration-untested-exception.md)
(slangpy#1115) IS OPEN_GAP despite CodeRabbit's "Minor" label — a `catch` is the
trigger-present direction, and if nothing forces the throw, correctness-by-
inspection of an error path carries near-zero bits. `rhi_task_pool` is shared;
blast radius is real. Bot severity is a prior, not the verdict; the fallback tier
(no primary bot) demands extra force — residual doubt abstains, never rounds up.

## Discriminating controls: could it be green without the fix?

[The lifetime-fix false-safe](../learnings/1787045201985-approver-challenger-miss-lifetime-fix-regression-t.md)
(slangpy#1113): the fix is correct, but its one regression test asserts a device
count returned to baseline — a *negative observation* that goes green on `main`
anyway because a prior close()-time invalidation PR already severs the device
path *independent* of the new destructor, and the actually-leaked object
(`refl::Layout`) isn't what `get_created_devices()` measures. Probe: identify the
specific edge the fix removes, enumerate every *other* strong-ref path from the
teardown trigger to the object, and confirm the leaked and asserted-freed objects
are even the same thing. The discriminating test is a revert-drill; inability to
run it read-only is itself the ABSTAIN.

[The "compile-only test dir" checkable claim](../learnings/1787050993868-approver-challenger-miss-compile-only-test-dir-is-.md)
(slang#12597): the whole 🔴→advisory downgrade hung on "the garble test dir is
device-free ⇒ cleanup no-op ⇒ segfault unreachable" — read from an in-source
comment ("~80 small compile-only tests"). But one `tests/preprocessor/*.slang`
is a `COMPARE_COMPUTE` that can populate `DeviceCache` on a GPU host. A "device-
free" claim is a checkable fact (read the actual `//TEST:` directive), and a
summarizing comment describes the *majority*, not every member. When a clearing
rationale rests on one "unreachable" premise, attack that premise first.

[The getSimpleVal materialization miss](../learnings/1787138009047-approver-challenger-miss-getsimpleval-materializat.md)
(slang#12533): a "pure hygiene, no behavior change" `getSimpleVal` on an operand
can add a NEW `E41015` uninitialized-`out`-param warning because the inserted
`load` is a real read the uninit pass flags — and CI is blind because the
regression test uses `inout` (never checked for read-before-write) and the
operand is unread by every emitter (byte-identical codegen). Probe: can this
l-value be a write-only `out`/`inout`, and does the new `load` become a read-
before-write? Verify by building, not statically.

## Read the full artifact; when stuck, measure

[Truncated comment bodies hide accepted rewrites](../learnings/1787079066629-approver-challenger-miss-truncated-comment-bodies-.md)
(slang#12410): `github_get_pull_request_comments` truncates bodies to 1000 chars;
the cut-off half showed the author had accepted a *core reimplementation* they
hadn't pushed — so the head under decision was a soon-obsolete snapshot. Pull the
full body (`gh api …/issues/comments/<id> --jq .body`) before any load-bearing
read; `COMMENTED` state does not make accepted-but-unpushed feedback non-blocking.

[The exhaustive-diag-test resolution](../learnings/1787047812181-approver-challenger-miss-exhaustive-diag-test-exac.md)
(slang#12595) shows the *positive* use of "could it be otherwise": a bot's static
"caret at wrong column" claim is mechanically refuted because slang's `SIMPLE`
harness matches carets by *exact column* and runs *exhaustive*, so a wrong column
would redden the test — and CI was green on the front-end jobs. Green CI carries
real bits here (unlike the substring/non-exhaustive cases above), so don't score
it as a gap. And [when you disagree with a human + all bots on a silent-miscompile
claim, BUILD IT](../learnings/1787149299690-approver-challenger-miss-when-you-disagree-with-a-.md)
(slang#12569): rather than re-argue a third time, apply the guard onto a prebuilt
slangc, run a *transforming* counterexample (`+1` variant) that the pure-forwarding
case everyone tested can't distinguish, and revert — ~15 min converts "I think"
to "I measured." Scope claims to exactly what you tested.

The doctest atom rounds out the "read the loop, don't assume" theme:
[doctest `setOption("--reporters")` appends, not replaces](../learnings/1787070146892-approver-challenger-doctest-setoption-reporters-ap.md)
(slangpy#1116) — the run loop de-dups per *registered reporter*, so the reachable
trigger is "a different registered reporter is selected" (xml/junit/console),
narrower than "any `--reporters` value" but plainly reachable. Price the trigger
from the activation loop's shape, cite the exact branch; "no dedup" is a strong
claim that must be read off the loop, not assumed.

## Source learnings (14):

- [A discriminating-exit-code fix whose sentinel collides with the crash code still ships the bug (slang#12560)](../learnings/1786983342575-approver-challenger-miss-a-discriminating-exit-cod.md) — `EXIT_REGRESSION = 1` == unhandled-exception exit; first probe: does the sentinel collide with the ambient failure codes it must distinguish?
- [filecheck-buffer vacuous-pass is systemic in test-only PRs (slang#11081)](../learnings/1786999476846-approver-challenger-miss-filecheck-buffer-vacuous-.md) — unanchored substring: `CHECK: 1` matches `10`, `CHECK: 0` matches a zero-init slot; demand `CHECK-NEXT`.
- [A slang-test INTERPRET/COMPARE test can vacuously pass on abort output](../learnings/1786994992315-a-slang-test-interpret-compare-test-can-vacuously-.md) — CHECK token leaked into the compiler's abort stderr; run the raw tool and check the exit code.
- [A sanitizer-lane revision can fix the flagged race yet stay red — halt_on_error=0 (slangpy#1112)](../learnings/1787001347127-approver-challenger-miss-a-sanitizer-lane-revision.md) — an option change widens what the lane reports; re-derive pass/fail from the fresh log every revision.
- [A submodule gitlink bump's effect is platform-scoped — read the #if guards (slangpy#1112)](../learnings/1787003753987-approver-challenger-miss-a-submodule-gitlink-bump-.md) — blast radius bounded by the patch's platform guards; verify provenance from the declared URL, confirm per-leg from logs.
- [A CodeRabbit "Major functional bug" can be a defect in dead code (slangpy#1112)](../learnings/1787000629621-approver-clause-gap-a-coderabbit-major-functional-.md) — reachability gates severity; grep the one caller before promoting Major to BLOCK; record the latent-trap caveat.
- [Untested exception/catch branch on a shared primitive is OPEN_GAP, not a nit (slangpy#1115)](../learnings/1787049320318-approver-challenger-calibration-untested-exception.md) — treat a catch as a conditional needing a trigger-present control; correctness-by-inspection of an error path carries near-zero bits.
- [Lifetime-fix regression tests need an independent-free control (slangpy#1113)](../learnings/1787045201985-approver-challenger-miss-lifetime-fix-regression-t.md) — a negative-observation test can go green without the fix via a fix-independent free path; the leaked object may not be the asserted-freed one.
- [\"compile-only test dir\" is a checkable claim, not an assumption (slang#12597)](../learnings/1787050993868-approver-challenger-miss-compile-only-test-dir-is-.md) — read the actual `//TEST:` directive; a summarizing comment covers the majority, not every member; attack the single "unreachable" premise first.
- [getSimpleVal materialization can add spurious out-param uninit warnings; green CI is blind (slang#12533)](../learnings/1787138009047-approver-challenger-miss-getsimpleval-materializat.md) — the inserted `load` is a real read the uninit pass flags; `inout` tests never exercise the `out` shape — build to verify.
- [Truncated comment bodies hide accepted-but-unpushed rewrites (slang#12410)](../learnings/1787079066629-approver-challenger-miss-truncated-comment-bodies-.md) — the 1000-char cap hid an accepted core rewrite; pull the full body; `COMMENTED` state doesn't make accepted-unpushed feedback non-blocking.
- [Exhaustive diag-test + exact-column matcher: green CI refutes a bot's static caret concern (slang#12595)](../learnings/1787047812181-approver-challenger-miss-exhaustive-diag-test-exac.md) — with exact-column + exhaustive matching and green front-end CI, green carries real bits; don't score a static column claim as a gap.
- [When you disagree with a human + all bots on a silent-miscompile claim, BUILD IT (slang#12569)](../learnings/1787149299690-approver-challenger-miss-when-you-disagree-with-a-.md) — apply-measure-revert a transforming counterexample the pure-forwarding case can't distinguish; ~15 min beats a third re-argument.
- [doctest setOption(--reporters) appends, not replaces — verify per-registered-reporter activation (slangpy#1116)](../learnings/1787070146892-approver-challenger-doctest-setoption-reporters-ap.md) — the run loop de-dups per registered reporter; price the trigger from the loop's shape, cite the exact branch.
