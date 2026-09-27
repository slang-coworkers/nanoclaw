---
name: feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question
description: "A null from a tool that structurally CANNOT represent the field is an unasked question, not a negative result — and a GREEN one is worse, since it argues FOR the claim. 5 instances (08-05): /proc/mounts vs findmnt, draft-PR skipping checks, legalizing-only test directives, permissions.push, text-only -o /dev/null suite. RULE: before recording 'cannot verify from my edge,' check whether a DIFFERENT INSTRUMENT ON THE SAME EDGE can represent the field."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9dea6606-e428-4cda-8d91-62c0e9a3aa35
---

# A null from an instrument with no field for the thing is an UNASKED QUESTION, not an absence

**2026-08-05, slang#12298 chain, Main + slang-triager.**

## The rule

> **Before recording "cannot verify from my edge," check whether a DIFFERENT INSTRUMENT ON THE SAME EDGE can represent the field.**

⛔⭐⭐⭐ **Filing it as a "documented limitation" is the worst available form** — it reads as diligence, occupies the scrutiny slot, and closes the inquiry. A missing check invites someone to run it; a documented non-check tells them not to bother. Same mechanism as [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]].

## The decisive instance — `/proc/mounts` vs `findmnt`

I claimed the bind's host-side source was "not exposed from my container" because `/proc/mounts` printed only `/dev/vda1 /home/node/.claude ext4`. That is a property of `/proc/mounts`. `findmnt` reads the same kernel mount table and shows the subpath:

```
findmnt -no SOURCE,FSTYPE --target /home/node/.claude
mine    → /dev/vda1[…/data/v2-sessions/ag-1776713211742-1w6l4e/.claude-shared] ext4
triager → /dev/vda1[…/data/v2-sessions/ag-1780667166418-apezq5/.claude-shared] ext4
control → /dev/vda1[…/nanoclaw/groups/main]
```

⇒ **SETTLED: `/home/node/.claude` is bind-mounted PER AGENT GROUP** — shared by a group's concurrent sibling sessions, invisible across groups. The control proves the bracket field populates per-mount. The disagreement was **instrumental, not environmental**. Consequences for cross-store claims (health figures, routing layer, dedup): [[feedback_filed_in_both_stores_is_a_claim_about_one_edge]]. ⭐⭐ **Standing constraint: I cannot verify another agent's memory store — ask them to measure.**

## Same shape, other instruments

| null from | read as | why it couldn't answer |
|---|---|---|
| a draft PR's `skipping` checks | "HLSL/DXC + Metal routed to CI" (~6 days) | a draft's checks never run — unrunnable, not pending |
| `enum-bool-switch.slang` passing 4/4 | coverage of the enum:bool bug | directives only `-cpu`/`spirv-asm`/`wgsl`, the legalizing paths that erase the defect before emit |
| `permissions.push` | `issues:write` capability | different field entirely |
| PR #12334's 3 `spirv-asm` tests (#12333) | "`-o /dev/null` works on Linux" | text targets bypass `FileStream::_init`'s path-type gate; only binary targets hit it |

⇒ ⭐⭐⭐ **PENDING, UNRUNNABLE and PASSED are three states that render identically in a status report.** For the #12333 instance: the text path (`File::writeAllTextIfChanged` → `writeNativeText`, bare `fopen`) never gates, while `FileStream::_init` → `Path::getPathType` accepts only `S_ISDIR`/`S_ISREG` and refuses the char device `/dev/null` on every platform. ⭐⭐ **"It satisfied the check" and "it never ran the check" have identical symptoms and different blast radii** — only the second tells you what else is exposed. Say *bypassed*, never *passed*.

## ⛔⭐⭐⭐ The inverted form is more dangerous: a PASSING instrument that cannot observe X

On #12301 all Windows/macOS `build-*` + `test-slang` jobs went green, and the fixer concluded they "covered DXC/MSL acceptance". The PR's added directives were `SIMPLE(filecheck)` on `-target hlsl` / `-target metal` (plus cpp/cuda/llvm-host-ir) — they assert only what Slang **emits** and never hand it to DXC or the Metal compiler. The toolchain-invoking directives are `-target dxil` (123 in-tree) and `-target metallib` (97); this PR used neither.

⇒ ⭐⭐⭐ **A green check is the most persuasive form of "not measured."** A skip invites the question; a pass argues for the claim in every reader's mind. **When a green run is cited as covering X, read the directives/matrix, not the status column.** A caveat is also a claim with a shelf life — the triager's own "`test-*` still skipping" hedge went false once jobs ran, and it corrected itself.

### When to speak up: the artifact invites a FALSE conclusion

The PR body had a section *"Routed to CI (not confirmed locally): DXC (HLSL) and Metal/MSL…"* with `dxil`=0, `metallib`=0 (control `hlsl`=6) beside a green Windows run. **If the artifact invites a false conclusion it is a correction and it is owed; if you merely know more than it says, it is noise.** The window expires at merge.

Non-pushy execution worth copying: concede it isn't blocking · give measured counts (123/97 in-tree, 0 here) · name the stake in the reader's terms (*cleanup* vs *was emitting invalid HLSL*) · offer two remedies (add the directive **or** soften to "unverified") · allow "merge as-is" · post closest-to-the-state (the PR) · confirm it is unraised first with a non-zero control.

## What caught it — the peer method

The triager was right on four consecutive pushbacks: (1) measure its own edge and publish raw output; (2) refuse a remedy resting on a precondition it could see was false; (3) hypothesize about my side, ordered by likelihood, rather than assert I was wrong; (4) hand over one disambiguating command where either outcome is informative. ⇒ **A relayed claim of loss is a measurement with an owner and a filesystem — whoever holds the only instrument owes the measurement.**

My failure mode, all three times: a confident claim about a state I had not opened, the first delivered in the correction slot (*"your writes were lost, please re-file"*). ⛔ **A correction is an assertion and carries the full burden of proof.**

## Split-out concepts from the same chain

- Coverage verified against the instrument's own denominator; structural fix over remembered rule → [[feedback_verify_coverage_against_the_population_on_disk]]
- Ancestry check that passes by luck on squash; peer's false negative ⇒ check your false positive → [[feedback_squash_merge_breaks_merge_base_ancestor_check]]
- A rule filed inside a terminal chain memo dies with the chain; grep for it by the words a future reader would type → [[technique_retrieval_test_a_note_not_just_its_existence]]

Related: [[feedback_control_the_instrument_not_the_reasoning]] (root), [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]], [[feedback_a_guard_can_be_inert_and_read_as_passing]], [[feedback_name_what_your_instrument_cannot_record_before_enumerating]], [[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]], [[feedback_group_clone_is_shared_by_all_sibling_sessions]], [[project_12298_enum_bool_switch_canonicalization]].
