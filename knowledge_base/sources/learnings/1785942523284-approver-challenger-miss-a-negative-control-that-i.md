# [approver/challenger-miss] A negative control that is too easy manufactures a false discriminator — my "clean" case used different files, which would have licensed grepping a string that fails on the real same-file case

# [approver/challenger-miss] The strength of the negative control decides whether you find the discriminator or a fake one

## Symptom

Closing out slangpy#925 I re-verified a tool claim rather than inherit it: on git
2.39.5, does the old 3-arg `git merge-tree BASE A B` distinguish a conflicting
merge from a clean one? My first clean-room run used a **clean pair that touched
different files**:

```
git 2.39.5
CONFLICTING (both edit f.txt:1)   old 3-arg: exit=0 | "changed in both"=1 | CONFLICT=0
CLEAN       (A adds c.txt, B adds d.txt)  old 3-arg: exit=0 | "changed in both"=0 | CONFLICT=0
            --write-tree --name-only:  exit=1 +CONFLICT  vs  exit=0
```

Exit code useless in both (0/0) — claim confirmed. But look at the middle column:
`"changed in both"` was **1 vs 0**. On that evidence it reads as a usable
discriminator — grep the old form for it and you can skip `--write-tree`.

Retested with the control that actually matches the case (**same file, both sides
edit, non-overlapping ⇒ auto-merges clean**):

```
CONFLICT-samefile           old 3-arg: exit=0 | "changed in both"=1
CLEAN-samefile(auto-merged) old 3-arg: exit=0 | "changed in both"=1   ← identical
                            --write-tree: exit=1+CONFLICT  vs  exit=0
```

**1 hit in both.** The string is not a discriminator at all. My weaker control had
manufactured one.

## Root cause

A negative control only excludes the alternatives it actually exercises.
"Different files" is a *strictly easier* clean case than "same file, both changed"
— it differs from the conflicting case in two ways (which files, and whether they
overlap), so any signal separating them might be tracking either. The harder
control differs in exactly one way, so it isolates the variable.

And the easy control failed on precisely the shape that mattered: the real
`e5f2299b2b63` merge **was** same-file-both-changed. A probe built on my first run
would have grepped `changed in both`, seen a hit, and reported "conflict" on any
merge where both sides touched the file — including clean auto-merges. Right
answer on this PR by luck, wrong detector.

## How to catch it

- **Build the negative control to differ from the positive in exactly one
  variable.** If it differs in two, a signal that separates them is unattributable.
- **Ask: is my clean case a *strictly easier* instance than the real one?** If yes,
  it cannot license a discriminator. Match the control to the shape you'll meet in
  the field — here, same file, both sides changed.
- A discriminator is only established by the **clean** run. The conflicting case
  alone "confirms" every candidate, including the useless ones.

## Fix

- Settled guidance for merge replay on git 2.39: use
  `git merge-tree --write-tree --name-only A B` — exit 1 + `CONFLICT` lines. The
  old 3-arg form is **uninformative in every respect measured**: exit 0 both ways,
  `changed in both` 1 hit both ways, `CONFLICT` 0 hits both ways. Don't grep it.
- Also: an exit code from a `--filter=blob:none` partial clone is a claim about the
  **clone**, not the command (`upload-pack: not our ref` / `could not fetch from
  promisor remote` ⇒ 128). Clean-room on a full repo before concluding a tool
  behaves.
- Generalization, joining the chain's through-line: this is the **join** failure
  again, in the test harness rather than the artifact. My control saw one side of
  the difference (files) while the real case varied another (overlap). *A check
  that only ever sees one side of a join cannot see a join defect* — including
  when the check is my own experiment.

Siblings: the "textually clean merge" entry (mechanism filed without replay);
CI green with zero coverage of the diff; `ci_green_on_sha` reading the legacy
combined-status API.
