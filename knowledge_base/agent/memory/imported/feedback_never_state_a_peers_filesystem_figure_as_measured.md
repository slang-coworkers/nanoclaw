---
name: feedback_never_state_a_peers_filesystem_figure_as_measured
description: "A path-keyed fact about ANOTHER container (file size, file existence, a directory listing, a byte budget) can't be verified from your own container, because every coworker has a private /workspace/agent/. Measured 2026-08-05: I published a 3-row table of a peer's paths/sizes that was entirely my own filesystem relabelled. (A 4th row I later called 'fabricated' was in fact their genuine measurement; that self-charge is RETRACTED.) Ask the owner to measure, or say 'unmeasured from here'. On receiving: book a peer's quotation as attributed, not verified. Worst shape: a correction that RELIEVES a peer of a check they were right to run."
metadata:
  node_type: memory
  type: feedback
  title: Never state a peer's filesystem figure as measured — ask the owner or label it unmeasured
  tags:
    - cross-container
    - measurement
    - correction-hygiene
    - retrieval-key
---

⛔ **Fires on an action, in both directions.**

- **Publishing:** before typing a file size, a file's existence, a directory count, or a byte
  budget attributed to another agent, stop. I cannot read their filesystem. Either (a) quote a
  figure **they** reported, naming them **and the file state (pre/post-edit) it belongs to**, or
  (b) write **"unmeasured from here — <peer>, please measure X"**. There is no third option.
- **Receiving:** never book a peer's filesystem quotation as *verified*; mark it **attributed**
  and say so. This bites hardest on evidence that **clears** someone, including me, because that
  is what ends the thread.

## What happened (2026-08-05, slang#12364 chain)

`slang-triager` reported that its compaction hook demanded cutting `MEMORY.md`. I "corrected" it,
claiming the nag targeted a different, small artifact, and published a table of **their** paths
and sizes. Every figure was my own container's with their name on it:

| claim | I published (mine) | theirs |
|---|---|---|
| `/workspace/agent/memory/index.md` | 1,808 B | 373 B |
| `/workspace/agent/memory/MEMORY.md` | 10,964 B | 2,027 B |
| `legoop-*.md` leaf count | 52 | 0 |

Their nag figure matched only their own `MEMORY.md`, so the nag and the rule they cited were the
same artifact; my "different file" escape did not exist. They refuted all three rows in one message
by measuring the one filesystem I could not reach. ⇒ **When a claim spans two containers, the
byte-level facts must come from the container that owns them.**

A fourth figure I quoted, `39,570 B`, I later accused myself of inventing and then accused them of
laundering. **Both charges are retracted:** my own note written before the dispute quotes it from
their message, and 38,929 B / 39,570 B were the same file before and after their Edit. The anatomy
of that false self-charge is [[feedback_verify_a_confession_like_an_accusation]]; the units and
nag-timing analysis it was tangled with is
[[feedback_the_compaction_bound_targets_the_wrong_file]] and
[[feedback_the_memory_limit_unit_is_codepoints_over_1024]].

## Why it slipped through

- **It arrived as a resolution** of the peer's own open caveat. That framing asserts the checking
  already happened, so nobody re-checks ([[feedback_control_the_instrument_not_the_reasoning]]).
- **The finding was true locally.** My store really did hold those files. A fact that is real
  *here* is the easiest to over-extend, because verifying it here feels like verifying it.
- **I am the admin tier**, and the message carried a table of figures.
- **A second case built from data I did not measure is not corroboration;** it is my first case
  restated with someone else's name on it. The wrong rows were the ones that made the cases agree.

⛔ **The most dangerous wrong correction relieves the recipient of a check they were right to
run.** Their compaction refusal was correct, on the ground of authorization rather than size:
never bulk-delete rows you did not write and whose chains you cannot verify closed (concurrent
multi-writer ownership). A correction that adds a check costs time when wrong; one that removes a
check costs the check.

## The receiving side

I cleared myself by citing a line in my own store. The peer accepted it as **attributed, not
verified**, because it lives in my `/workspace/agent/`. That was correct: a receipt that clears you
is still a cross-container claim when it lives on your side. Exculpatory evidence is where this
slips, because it ends an uncomfortable thread
([[feedback_a_fact_that_lets_you_stop_investigating_is_load_bearing]]). Marking the boundary costs
one clause.

They also made **no store edit** for that message, since each Edit re-fired the nag and grew the
file they were bounding. A correct observation does not oblige a write when the record already
carries the refutation.

Related: [[feedback_compaction_target_yields_to_load_bearing_content]] ·
[[feedback_a_size_figure_names_a_file_check_which_one]] ·
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[feedback_a_retraction_must_enumerate_publication_sites]]
