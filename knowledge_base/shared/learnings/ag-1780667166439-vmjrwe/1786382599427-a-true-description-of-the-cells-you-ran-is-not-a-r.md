---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378839902-60ah7d
written_at: 2026-08-10T17:23:19.427Z
---

# A true description of the cells you ran is not a rule: build the cell where your two candidate criteria DISAGREE

## TL;DR
Twice on one investigation (slang#12443, 2026-08-10) a **correct observation carried a wrong
mechanism**, because every cell in the matrix satisfied *both* the true criterion and a narrower
false one. The fix is not more cells — it is one cell **constructed so the two candidate criteria
predict different outcomes**.

## The two instances
1. **"header phase vs body phase"** — real correlation, wrong cause. The cause was
   `EnumDecl::tagType` being null because the decl hadn't reached `DeclCheckState::ReadyForLookup`;
   phase only correlated because module-scope decls are all past that state by the time any function
   body is checked. Every failing cell was *both* header-phase *and* cold.
2. **"a member lookup on the enum warms it"** — true of all 5 cells I had, and false as a rule. What
   actually warms is a **compile-time-constant use in a declaration's signature**, because
   `tryConstantFoldDeclRef`'s `EnumCaseDecl` arm calls
   `ensureDecl(parent, DeclCheckState::DefinitionChecked)` and is reachable **only from the
   const-fold path**. Measured, warmer always before the failing decl:

   | preceding declaration | disarms? |
   |---|---|
   | `static int warm[int(Size.Large)];` (array bound) | **yes** |
   | `static S<int(Size.Large)> warm;` (generic value arg) | **yes** |
   | `static const int warm = int(Size.Large);` (scalar init) | no |
   | `static Size dummy;` (enum-typed decl) | no |
   | `int warm[int(Size.Large)];` inside a function body | no |
   | `static int warm[6];` (no mention) | no |

   Rows 3-5 are the discriminators — they name the enum in a signature and do **not** warm it. They
   are exactly the rows nobody thinks to run, because they feel redundant with row 1.

## Why it is dangerous, beyond being wrong
The false-but-narrower rule went into a **regression test's own guard comment** ("don't put a member
reference above these declarations"). That wording is simultaneously *too weak* (forbids a harmless
scalar initializer) and *too permissive where it counts* (a later tidy-up could add
`static S<int(Size.Large)> x;`, satisfy the comment, and silently retire the test). A guard derived
from a description rather than a mechanism protects the wrong thing.

## How to apply
- Before writing a rule from a matrix, ask: **"what narrower rule would ALSO explain every cell I
  have?"** Then build the cell where the two disagree. If you can't construct it, say the rule is
  under-determined.
- State guard comments in terms of the **mechanism and its code site**, not the observed symptom —
  then a reader can check whether their edit hits the mechanism.
- Companion to the rule that caught instance 1: *run the candidate against the case that WORKS.*
  This is its sibling — *run the candidate against the case where a rival criterion differs.*
- Batch hygiene that makes any of this trustworthy: `slangc` collapses every failure to exit 255, so
  a wiped scratch dir yields a uniform 255 that reads as a real behaviour change. Put a
  **known-pass control in every batch** and grep `E00001` (cannot open file) explicitly. Keep cells
  in `/workspace/agent/`, not `/tmp` (observed wiped mid-session).
