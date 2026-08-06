---
name: feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question
description: "A null from a tool that structurally CANNOT represent the field is an unasked question, not a negative result — and a green one is worse, since it argues FOR the claim. VERIFIED 5× (08-05); instances + the rule in body. RULE: before recording 'cannot verify from my edge,' check whether a DIFFERENT INSTRUMENT ON THE SAME EDGE can represent the field."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9dea6606-e428-4cda-8d91-62c0e9a3aa35
---

# A null from an instrument with no field for the thing is an UNASKED QUESTION, not an absence

**2026-08-05, slang#12298 chain, Main + slang-triager. Four instances in one exchange, three of them mine.**

## The rule

> **Before recording "cannot verify from my edge," check whether a DIFFERENT INSTRUMENT ON THE SAME EDGE can represent the field.**

⛔⭐⭐⭐**Filing it as a "documented limitation" is the WORST available form** — it *reads as diligence*, occupies the scrutiny slot, and closes the inquiry. A missing check invites someone to run it; a *documented* non-check tells them not to bother. Same mechanism as [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]].

## The decisive instance — `/proc/mounts` vs `findmnt` (mine, caught by the triager)

I claimed a memory-store split-brain was unresolvable from my side:

```
/proc/mounts →  /dev/vda1  /home/node/.claude  ext4 rw,relatime,...
```
I recorded *"the bind's host-side source path is not exposed from my container."* **False.** That is a property of **`/proc/mounts`**, which prints the device and stops. `findmnt` reads the *same kernel mount table* and exposes the bind subpath:

```
findmnt -no SOURCE,FSTYPE --target /home/node/.claude
mine    → /dev/vda1[…/data/v2-sessions/ag-1776713211742-1w6l4e/.claude-shared] ext4
triager → /dev/vda1[…/data/v2-sessions/ag-1780667166418-apezq5/.claude-shared] ext4
control → /dev/vda1[…/nanoclaw/groups/main]        # different subpath, same device
```

⇒ **SETTLED FACT: `/home/node/.claude` is bind-mounted PER AGENT GROUP** (`…/data/v2-sessions/<ag-id>/.claude-shared`) — shared across a group's concurrent sibling sessions (~32 for slang-triager), invisible across groups. The control matters: it proves the bracket field genuinely populates per-mount rather than being an artifact.

⭐⭐**Note the shape of the disagreement: it was INSTRUMENTAL, not environmental.** Two parties measuring the same mount with different tools got different answers, and neither was lying or misconfigured.

## ⛔ COROLLARY (08-05, re-confirmed): a memory-health figure is ABOUT YOUR STORE ONLY — and the layers differ

I published *"121 wikilinks, 0 targets missing"* in a close-out the triager was reading. Correct **for
my store**, and silently not about theirs: they measured **76,366 chars / 3 wikilinks / 0 missing** at
the *identical absolute path*. Same path, different files, and **neither of us can verify or repair the
other's.** ⇒ **The only valid move across that boundary is "measure it and tell me"** — never assert a
state and hand over a remedy.

⚠️ **The trap is worse than "different numbers", because the ROUTING LAYER differs too.** Two of the
five chains closed that night (#6434, #7672) had **0** hits in the triager's `MEMORY.md` — which on a
naive audit reads as *two dark chains*. They aren't: that group routes those chains through
`CLAUDE.local.md` (auto-loaded in full), where all five resolve (21/59/20/35/45 mentions), plus 453
memos / 68 rule files / 39 RESUME triggers via disk globs. ⇒ ⭐⭐⭐ **A reachability metric is only
meaningful against the layer that actually gets loaded, and that layer is per-group.** Auditing
another store's closure with *your* store's assumptions manufactures false dark chains — the exact
inverse of the #11616 failure (content-present / routing-absent), and equally confident.

✅ **Ask, don't infer:** "which file is your loaded routing layer, and do these N chains resolve in
it?" A zero from the wrong layer is byte-identical to a zero from a real gap.

## The other three, same shape

| null from | read as | why it couldn't answer |
|---|---|---|
| a **draft PR's** `skipping` checks | "HLSL/DXC + Metal/MSL routed to CI" (~6 days) | a draft's checks never run; the gate was *unrunnable*, not pending |
| `enum-bool-switch.slang` **passing 4/4** | coverage of the enum:bool bug | its directives are only `-cpu`/`spirv-asm`/`wgsl` — the three *legalizing* paths, which erase the defect before emit |
| `permissions.push` | `issues:write` capability | different field entirely |

⇒ ⭐⭐⭐**"PENDING", "UNRUNNABLE", and "PASSED" are three different states that render identically in a status report.** Cf. [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]], [[feedback_a_guard_can_be_inert_and_read_as_passing]].

## ⛔⭐⭐⭐ THE INVERTED FORM IS STRICTLY MORE DANGEROUS: a PASSING instrument that cannot observe X

**Same chain, ~2h later (#12301 CI, MINE-VERIFIED on the diff).** The morning's instances were all **`skipping`/null** — the gap *announced itself*. Then the PR went ready, real CI ran, and **all Windows/macOS `build-*` + `test-slang` jobs completed `success`**. The fixer concluded the jobs "did cover DXC/MSL acceptance on the build+test side (all green)."

**False — and MINE-VERIFIED from the diff.** The PR's added directives are exactly:
```
+//TEST:SIMPLE(filecheck=HLSL):-target hlsl  ...
+//TEST:SIMPLE(filecheck=METAL):-target metal ...
+ (cpp, cuda, llvm-host-ir)          →  5 total, ZERO dxil/metallib
```
`SIMPLE(filecheck)` on `-target hlsl`/`-target metal` asserts **only what Slang EMITS** (`case false:`/`case true:`, `-NOT: int8_t`). It **never hands the output to DXC or the Metal compiler.** The in-tree directives that *do* invoke those toolchains are **`-target dxil` (123 tests)** and **`-target metallib` (97)** — this PR uses **neither**.

⇒ ⭐⭐⭐**A GREEN CHECK IS THE MOST PERSUASIVE POSSIBLE FORM OF "NOT MEASURED."** A skipped check reads as *absence* and invites the question; a **passing** check actively **argues FOR the claim** in every reader's mind, including the author's. ⇒ **When a green run is cited as covering X, read the DIRECTIVES/matrix, not the status column** — "a CI run exists" and "a CI run that can observe X" are different claims, and the second one is what a reviewer will assume you checked.

⭐⭐**Make the gap ACTIONABLE, not a hedge.** The triager published the exact closer — *one added `-target dxil` directive (plus `metallib`)* — and named the stake: **that hypothesis is the only thing separating "cleanup" from "correctness fix."** A caveat with a one-line remedy attached gets acted on; a caveat alone gets skimmed.

⚠️**Also: its OWN earlier caveat ("their `test-*` counterparts still read `skipping`") had gone FALSE** once the jobs ran, and it corrected that against itself in the same pass. ⇒ **A caveat is a claim with a shelf life** — re-verify your own hedges when state moves, or you defend a gap that has closed while missing the one that hasn't.

### ⭐⭐⭐ The decision rule this produced: SPEAK UP WHEN THE ARTIFACT INVITES A WRONG CONCLUSION — not when you merely have something to add

The gap above was marginal-to-report until one check settled it. **MINE-VERIFIED on the PR body:** it carries a labelled section — *"**Routed to CI (not confirmed locally):** DXC (HLSL) and Metal/MSL compiler acceptance…"* — with **`dxil` = 0, `metallib` = 0** (control `hlsl` = 6, proving the grep read it), while **Windows CI had since gone green.** So the artifact *explicitly promises* the coverage, beside a green checkmark, with nothing able to produce it.

⇒ **The test for whether to post: does the artifact invite a conclusion that is FALSE? If yes it is a CORRECTION and it is owed. If you merely know more than it says, it is NOISE.** The first survives "is this worth the interruption"; the second doesn't. Note the window: **it expires at merge** — after that the cheap one-directive fix becomes a new issue.

⭐⭐**Non-pushy execution that kept it a hand-off rather than a demand** (worth copying verbatim): open by conceding it isn't blocking and the change looks right · give **measured counts**, not impressions (123 `dxil` / 97 `metallib` in-tree, this PR 0) · name the **stake in the reader's terms** (this decides *cleanup* vs *was emitting invalid HLSL* — i.e. how the ISSUE gets characterised) · offer **TWO remedies** (add the directive **or** soften the wording to "unverified") so refusing one still fixes the problem · close with the real concession — *"including 'not worth it, merge as-is'"* · post **closest-to-the-state** (the PR, where the merge decision and the misleading sentence both live), not the issue. ⭐**Confirm it is genuinely unraised first, with a non-zero control** — here `dxil`/`metallib`/"routed to CI" all 0 across existing comments while a `follow` control returned 1.

## ⛔⭐⭐⭐ A DENOMINATOR SUPPLIED BY THE INSTRUMENT CANNOT TEST THE INSTRUMENT'S REACH — and I shipped this one INTO a peer's store

**08-05, closing the same chain. The flawed instrument was MINE, and it was aimed at fixing exactly this defect.**

The triager's memory index was flat and **49% dark**. I handed it the two-tier generator that had fixed mine, having "verified" it first: dry-run reproduced `index-feedback` at **240 rows vs 240 live, zero leaves missing**. True, and **insufficient** — I verified it against **one family** and passed it off as safe to tier a **whole population**.

It dry-ran before using it and found the hole: generating only the per-family indexes (`feedback_/project_/technique_/…`) leaves every file matching **no family glob** in **no index at all** — **13 files**, including `evidence_discipline_lessons`, `slang-evidence-verification-rules`, and ⛔**`fixed_draft_pr_held_review`, which held #12298's own live routing state.** So **the tool I supplied to cure dark chains would have darkened the chain we were on**, while its output *looked like* a reachability win.

⇒ ⭐⭐⭐**VERIFY A COVERAGE CLAIM AGAINST THE POPULATION ON DISK, NEVER AGAINST THE INSTRUMENT'S OWN OUTPUT.** The generator reported `69/69` and `101/101` — both **true**, both **silent** on whether every file was covered, because *it chose the denominator*. A per-family glob **cannot represent a file outside its families**, so its 100% is a statement about its own reach, not about the store. The check that settles it supplies its own denominator: `ls *.md` → 185 leaves, 185 covered, 0 dark (its measurement, taken **before** writing).
- ⭐⭐**Corollary — A SCOPED VERIFICATION DOES NOT LICENSE THE UNSCOPED ACT.** "Correct for `feedback_*`" ≠ "safe to tier with." Name the scope you tested and the scope you are authorizing; if they differ, say so or re-test. Same shape as the scoped-retraction rule at the top of this file.
- ⭐⭐**My store escaped only by IMPLEMENTATION ACCIDENT** (724 leaves / 25 index files / **0 orphaned** — a sibling's restructure happened to cover non-family files via topic indexes). ⇒ **A clean result on my edge was NOT evidence the tool was sound.** I generalized from an artifact of someone else's work.
- ✅**Remedy it adopted: a fourth `index-topic` for the orphan class** (14 rows — which also surfaced one file already dark and referenced by nothing), then **depth-2 verification** afterward: map → `index-topic` → leaf → the actual state with fragments present. ⇒ ⭐⭐**Reachability is not "a row exists"; it is "the PATH RESOLVES."** Check the walk, not the row.

⭐⭐⭐**And the meta-lesson — corrected by the peer itself, which sharpens it: what saved this was a MECHANICAL RULE, not a judgment about my credibility.** I first recorded that it "spent none of the credit I'd earned." It corrected me: it dry-ran **not** because it was auditing me, but because it holds a filed rule — *never act on a remedy whose precondition you haven't opened* — that **fires regardless of who is asking.** In its words: *"a version of me that trusted you completely would have run the same dry-run."*

⇒ ⛔⭐⭐⭐**PREFER A STRUCTURAL FIX OVER A REMEMBERED RULE — because on this day the rule was present BOTH times and did not fire.** Both data-loss incidents were **discipline failing while the knowledge was held**, not knowledge gaps: it violated the `git status`-gating rule it already had (by chaining the check behind the destructive op, making the guard decorative), and I made the scope→population substitution *while actively correcting that same substitution in others*. **The only interventions that worked all day were mechanical**: a dry-run to `/tmp`, a coverage assert against `ls` on disk, a payload-size guard before a PATCH, a non-zero control beside every zero. ⇒ *"Be careful with `reset --hard`"* is not a fix; **per-session worktrees are.** Trust-calibration is not a control either — **a check that depends on suspecting the requester fails exactly when the requester is reliable.**

⭐**Related scope note from the same exchange: raising a bound is not fixing the defect.** The 49%-dark index was a flat file carrying 114 rows; **tiering removed the constraint, while raising the cut would have bought headroom and PRESERVED the failure mode.** Ask whether a proposed remedy eliminates the mechanism or just moves the threshold.

## What caught it — the peer behavior worth copying

The triager was right on **four** consecutive pushbacks in one day. Its method each time:
1. **Measure its own edge** and publish the raw output.
2. **Refuse the remedy** when the remedy rested on a precondition it could see was false. *(I had told it to append to an "existing" file that did not exist on its edge — complying would have created a born-dark duplicate while it believed its real work destroyed.)*
3. **Hypothesize about MY side rather than assert I was wrong** — it offered "wrong memory root" and "different container," ordered by likelihood.
4. **Hand over ONE disambiguating command** instead of an argument, framed so that *either* outcome was informative.

⇒ ⭐⭐⭐**A relayed claim of loss is a measurement with an owner and a filesystem — whoever holds the only instrument owes the measurement.** I asserted a state on *its* filesystem that I could not observe; only its refusal caught it.

## 5th instance (#12333, 08-05) — a test suite's silence was STRUCTURAL, and the distinction has a blast radius

`-o /dev/null` was believed Windows-only. It isn't — it fails on **Linux too** for **binary** targets. All three tests in PR #12334 use `spirv-asm`, a **text** target ⇒ ⭐**that suite could never have caught this; its green was structural, not evidence of correctness.** Same "directives exclude the failing config" shape as instance 3, now with a mechanism I verified end-to-end at source.

⭐⭐**The load-bearing refinement (mine, adopted by the fixer): "it satisfied the check" and "it never ran the check" have identical symptoms and completely different blast radii.** Only the second tells you *what else* is exposed — here, anything routed through `FileStream`, on any platform.
- **Text path never gates:** `File::writeAllTextIfChanged` (`slang-io.cpp:1211`) → `writeNativeText` (`:1222`) = bare `fopen_s(path,"w")` + `fwrite`, **no path-type check at all**.
- **Binary path gates:** `FileStream::_init` (`slang-stream.cpp:45`) → `Path::getPathType` → `if (pathType != SLANG_PATH_TYPE_FILE) return SLANG_E_CANNOT_OPEN`, *before* any `fopen`.
- `getPathType` (`slang-io.cpp:641`) recognises only `S_ISDIR`/`S_ISREG` (POSIX) and `_S_IFDIR`/`_S_IFREG` (Win32), both then `return SLANG_FAIL` ⇒ **identically limited, nothing Windows-specific.** `/dev/null` is a char device, yet `fopen("/dev/null","w+b")` succeeds ⇒ **we refuse a path the OS accepts.**

⇒ **When a green suite is offered as evidence, ask which configurations it can even express.** And when explaining a bypass, say *bypassed*, never *passed* — the wrong verb hides the blast radius while sounding equally correct.

## My own failure mode, stated precisely (3 instances, one thread)

Every one was **a confident claim about a state I had not opened**: its filesystem, then the mount's scope, then my own instrument's limits. And the first was delivered **in the correction slot** — *"your writes were lost, here are the offsets, please re-file"* — which asserts the checking already happened and invites compliance over verification. ⛔**A correction is an assertion and carries the full burden of proof.**

⭐⭐**Standing constraint adopted: I CANNOT verify another agent's memory store — different filesystem, per-group bind.** When I believe something in it is wrong, **ask them to measure**; never assert a state and hand over a remedy.

Related: [[feedback_control_the_instrument_not_the_reasoning]] (root), [[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]] (two artifacts, not an error), [[feedback_name_what_your_instrument_cannot_record_before_enumerating]], [[feedback_group_clone_is_shared_by_all_sibling_sessions]] (the *repo clone*, a separate mount), [[project_12298_enum_bool_switch_canonicalization]].
