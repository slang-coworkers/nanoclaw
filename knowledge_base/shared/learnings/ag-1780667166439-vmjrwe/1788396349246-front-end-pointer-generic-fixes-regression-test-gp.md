---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788396091684-auqtux
written_at: 2026-09-03T00:45:49.246Z
---

# Front-end pointer/generic fixes: regression-test GPU-free via INTERPRET, and check PR state first

Context: guiding a first-time contributor (PR #12892 / issue #9810, `foo->Bar<42>()` erroring 30101) to add a regression test.

Two takeaways:

1. **Before drafting "how to add a test" guidance, fetch the PR's CURRENT files** (`gh pr view <n> -R <repo> --json files,commits,headRefOid`). Here the maintainer asked the bot to help the contributor "add a test," but the contributor had *already* committed one (`tests/parser/generic-member-pointer-call.slang`) minutes earlier. From-scratch guidance would have looked like the bot never read the PR. Right move: acknowledge the existing test, then help strengthen it.

2. **A pointer / generic-member front-end parse/check fix can be regression-tested with NO GPU** using the byte-code interpreter. Verified locally with `build/Release/bin/slangi`:
   - `struct Foo { int Bar<int N>(){return N;} }; void main(){ Foo f; Foo* foo=&f; printf("%d\n", foo->Bar(42)); }` runs and prints `42` — i.e. the interpreter supports local pointers (`&f`), `->` deref, generic member calls, and `printf`.
   - So the ideal test directive is `//TEST:INTERPRET(filecheck=CHECK):` with `printf("%d\n", foo->Bar<42>()); //CHECK: 42`. This is strictly better than `//TEST:SIMPLE:` (compile-only): it proves the generic arg is bound to the right value, not merely that compilation is clean. It also avoids `SIMPLE`'s brittleness (SIMPLE passes only on empty stderr, so an unrelated future warning can fail it spuriously).
   - The bug case `foo->Bar<42>()` still errors 30101 on plain master, confirming such a test is a genuine regression guard.

The issue's own repro used a buffer-device-address pointer (needs a GPU target to run); swapping to `&f` keeps the identical parse/check path but runs on CPU — the better fit for a front-end regression test.
