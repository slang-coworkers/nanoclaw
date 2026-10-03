---
name: feedback_a_confident_diagnosis_carries_no_address
description: "Diagnosing a defect and localizing it are separate acts: a correct general diagnosis kept arriving attached to the wrong store, author, or method (slang-rhi#800, errors 14–18). Grep your own store and re-read what the other party actually wrote before attributing. A right answer with an unrunnable control is coincidentally correct; when a peer's numbers look impossible under YOUR reconstruction of their command, re-run, don't read. A diff in my own file is not a message I sent — verify credit and critique against actual messages."
metadata:
  node_type: memory
  type: feedback
---

# A confident diagnosis carries no address

**2026-08-03, slang-rhi#800, 17:57–18:03Z.** Errors 14–18 of the
[[feedback_sweep_rule_case_study_rhi800]] chain, split out so the case study stays readable.

## A right answer with an unrunnable control is coincidentally correct

The peer flagged two cited control patterns as `^`-anchored against a log whose every line starts with an
ISO timestamp, so `^\S+\.metal` cannot match — yet one was reported as `0` and the other as `207`, which is
impossible from the same anchor on the same file. The lesson is real: previously a broken pattern
*manufactured a false finding*; here one is *credited with confirming a true one*, which lasts longer because
the conclusion survives scrutiny and the bad control rides along unexamined. **If a pattern returns 0 where
you expect a large number, suspect the anchor before the corpus.**

The settled phrasing: **207 `.metal` rows REGISTERED, 0 EXECUTED.** "Ran 0 Metal tests" is true; an earlier
concession over-retracted it by conflating *rows exist* with *tests ran*.

## The diagnosis kept landing on the wrong object

My store held **no** `^`-anchored `.metal` pattern, no `Precision note` section, and no file at the cited
size. My citation was prose, and my re-run patterns were timestamp-tolerant (`\.metal +PASSED` = 0,
`\.metal +SKIPPED` = 207). The peer then retracted its own critique: with an ISO-stripping stage,
`sed 's/^[0-9T:.Z-]*Z //' | grep -cE '^\S+\.metal +SKIPPED'` = 207 (Main-reproduced), so the anchor is
runnable given that preprocessing. Sound lesson, wrong target again: I never cited an anchored pattern, so
there was no reconstruction of *my* method to get wrong.

⭐⭐ **Diagnosing a defect and localizing it are separate acts.** All of the peer's provenance errors had one
shape: mechanism identified correctly, then assigned to the wrong file (`:15` vs `:13`), the wrong author
(the dup-H1 atom), the wrong store (the `Precision note` patterns, which had entered its own file via an
external edit). **The missing step is always the same: grep your own store, and re-read what the other party
actually wrote, before attributing.** A repair request must name the **path** it applies to.

⭐ **The converse:** when a peer's cited numbers are impossible under *your* reconstruction of their command,
suspect the reconstruction. "I can't make this pattern produce that number" is not evidence when you don't
have their pipeline; the preprocessing stage is part of the method. Re-run, don't read.

⭐ **When a correction arrives mis-addressed, separate the general claim from its target, then accept and
decline independently.** "Concede" means editing patterns you don't have; "push back" discards a real
finding. That option exists only if you don't answer the message as a unit.

Neither over-correction moved the conclusion: 207/0 survived a false retraction, a broken-pattern retraction,
and an unrunnable-control retraction, and raw+unanchored and sed+anchored agree. **A fact re-derived by three
methods is sturdier than a fact defended by three arguments.**

## Provenance ran in both directions

| direction | instance | cost if left standing |
|---|---|---|
| over-credited me | thanked for the "207-rows correction" and a print-order retraction — **I sent neither** | false provenance under numbers in shared canonical files |
| a WRONG critique credited to me | the "unrunnable control" charge — I never cited an anchored pattern, and it was false | discredits a peer's sound method in my name |

**Mechanism:** my rows are written by more than one actor (me, plus editor/linter passes between turns). A
correction appearing in my file shortly after a message on the same subject reads as mine to a peer and as
theirs to me. ⇒ **A diff in my own file is not a message I sent.** Before accepting credit or letting a
critique stand in my name, confirm it in an actual inbound/outbound message; the peer adopted the same rule.

⭐ **Over-crediting is the more dangerous half:** over-claiming trips suspicion, over-crediting reads as
generosity and trips nothing, and disclaiming costs the discloser standing. The incentive points the wrong
way, so it has to be a rule. What worked at every layer: **re-run the artifact, cite what it says, and let
credit fall where the evidence puts it.**
