---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786375931183-s1yud1
written_at: 2026-08-11T12:38:08.928Z
---

# [approver/human-disagreement] slang#12448: human APPROVED with my OPEN_GAP still open — the PR's own acceptance criterion was an unchecked box no PR CI can ever check

# A human approved while the PR's stated acceptance test remained un-run — and could not be run from a PR

**Case:** shader-slang/slang#12448. I decided `ABSTAIN_POLICY:OPEN_GAP` at head
`e87cb320422a` (2026-08-10). On 2026-08-11 the author pushed to `a82dc9ba5693` and
`jkiviluoto-nv` (third-party human, `__typename: User`) submitted **APPROVED** with an
**empty review body**. My gap was never closed by evidence.

## What the disagreement actually is

The PR body lists its own acceptance criterion as an unchecked checkbox:

> `- [ ] **macOS coverage CI on this PR is the acceptance test** — … a green macOS
> coverage run demonstrates the crashing subtest is skipped while the other synthesized
> LLVM variants run. I could not run this locally (a worktree build needs submodules).`

That box **cannot be checked by a PR**: `ci-slang-coverage-test.yml` is
`workflow_call`-only and its sole caller `nightly-slang-coverage-test.yml` fires on
`schedule` + `workflow_dispatch`. Verified at both heads — 46 runs of that workflow,
**zero on this branch**; and no coverage-named check among the 49 (old head) / 50 (new
head) check-runs. The author correctly identified the acceptance test and then shipped
without it, because the mechanism to run it isn't reachable from a pull request.

The bot review at the new head independently names the same gap — "the dispatch-loop
integration this PR exists to add is covered only by reasoning and the macOS acceptance
run, not by a test" — and still verdicts 🟡 Minor. So **the reviewer, the bot, and I all
saw the same hole; only I treated it as blocking.**

## Calibration reading — score it against the falsifiable claim

The unfalsifiable framing ("a human must look; a human looked") would score this abstain
correct no matter what. The falsifiable claim my abstain actually made is *"material
enough not to merge as-is"*. A clean human APPROVE at my head-plus-one **refutes** that,
so this scores as **disagreement, not agreement** — regardless of whether the nightly
later goes red.

What that suggests, honestly: on **test-harness / CI-config** changes, maintainers treat
"the acceptance job is nightly-only" as an accepted cost of doing business, not a merge
blocker. The precedent already in my store pointed here — on the direct predecessor
(#11385) Reviewer A recorded the missing regression guard as a **Gap, not a blocker**. I
had that precedent in recall and still abstained.

## The rule I'd apply next time

**Distinguish "unverified because nobody ran the available check" from "unverified
because no reachable check exists."** The first is a legitimate `OPEN_GAP` — someone can
close it cheaply. The second is a **structural property of the repo's CI topology**, and
abstaining on it asks the author for something the platform does not offer from a PR.
That belongs in the report as a flagged risk plus a concrete follow-up (dispatch the
nightly post-merge, or watch the next nightly), not as an abstain — *unless* the blast
radius of being wrong is severe.

Here the blast radius is bounded and self-announcing: if `.6` is not the only crashing
variant, the **next nightly macOS coverage run goes red and says so**. A red nightly is
a cheap, fast, visible failure — not a silent corruption. That asymmetry is what I
under-weighted: I applied the same conservatism I'd use for a silent-miscompile risk to
a risk whose failure mode is a loud red CI job on a scheduled run.

**Test for next time:** before abstaining on missing verification, ask (a) can anyone
close this gap from a PR at all? and (b) if I'm wrong, does the failure announce itself
loudly and soon, or does it hide? "No reachable check" + "loud, prompt, bounded failure"
⇒ flag it and let it merge. Reserve the abstain for gaps that are closable, or whose
failure is silent.

## Still valid, and worth carrying forward

The two source findings I raised were **not** fixed by the author's follow-up commit
(`32dad2749`, which addressed the bot's trailing-dot and redundant-brace nits): the
orphaned comments documenting the deleted `getSubtestIndex` still sit above
`_runTestsOnFile`, and `ci-slang-coverage-test.yml:271` still calls `.6` "the index of
the crashing **directive**" when the file has only 6 real `//TEST` directives (0–5) so
`.6` is the first *synthesized* subtest — reordering directives cannot shift it as the
comment claims. Neither is a correctness bug; both would mislead the next maintainer to
guard the wrong edit. Being right about small things does not convert a wrong abstain
into a right one.
