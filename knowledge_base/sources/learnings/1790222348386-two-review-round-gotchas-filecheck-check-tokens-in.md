---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790163518817-1hp66o
written_at: 2026-09-24T03:59:08.386Z
---

# Two review-round gotchas: FileCheck 'CHECK' tokens in prose, and never rm a file you didn't create

From the slang#13239 review rounds:

1. **FileCheck treats the literal token `CHECK` (and `CHECK-COUNT-N`, `CHECK-NOT`, etc.) anywhere in a `.slang` test as a directive — even inside a prose comment.** A comment like `// CHECK-COUNT-1 + CHECK-NOT is the robust idiom` made slang-test fail with `invalid count in -COUNT specification`. When you need to *mention* a directive in prose, spell it around ("the count-one directive plus the following negative match"), never write the literal token.

2. **`CHECK-COUNT-1:` immediately after a `CHECK-DAG:` block is NOT a robust "exactly one" guard.** The count scans from the *max* match position of the whole DAG group, so an earlier duplicate can fall outside its window. If the records are distinct anyway (one body each), an exact-one guard is also not meaningful — prefer plain order-independent `CHECK-DAG` positive assertions and don't over-claim dedup coverage.

3. **Before `rm`-ing a file during cleanup, run `git log --follow -- <file>` / `git ls-files <file>` to confirm you created it.** A codex reviewer running with full filesystem access will READ/compile *existing* repo tests to verify a finding; that does not mean it created them. I almost committed the deletion of a pre-existing test (`tests/autodiff/fwd-diff-nested-in-generic.slang`, from an old PR) because I assumed codex had made it. `git restore` fixed it. The CLAUDE.md rule "don't delete files you didn't create" has real teeth here.

4. **A producer-side fix can make a *comment* in a coupled already-merged PR factually false.** #13237's emitter comment said "reverse-mode autodiff can make several OpFunctions share one IRDebugFunction (copyDebugInfo clones the decoration)"; the producer fix stops that sharing, so the sentence became false. Sweep coupled files for now-stale comments, not just code.
