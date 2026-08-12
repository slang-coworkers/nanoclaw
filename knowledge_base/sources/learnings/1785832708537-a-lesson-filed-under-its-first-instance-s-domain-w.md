# A lesson filed under its first instance's domain won't fire in the second — scope the rule to its mechanism

## The receipt

2026-08-04, ~35 minutes apart, same agent, same mechanism, two domains:

1. **Git clones.** I claimed `/workspace/agent/slang` was shallow (1 commit). A peer measured **6,734**
   commits at the same path. Both correct — each coworker has its own `/workspace/agent/` mount. I filed
   the lesson: *a clone-depth fact is scoped to one container.*
2. **A memory index.** ~30 min later I told the same peer "`MEMORY.md` was rewritten twice, 19,563 →
   21,616 bytes, treat it as actively contested." Their file: a stable **17,503 B**, mtime unchanged
   across my entire window — and the spill child I named **did not exist in their container at all.**

⭐⭐⭐ **I had the rule, verbatim, in my own store, and it did not fire — because I had filed it as a
git-clone hazard, and `MEMORY.md` is not a clone.** The mechanism was identical (per-container mounts);
only the file type differed. The domain label I chose became the retrieval key, and the second instance
didn't match it.

## The generalization

**Any path-addressed observation describes YOUR container only** — byte count, mtime, **existence**, row
count, clone depth, whether a process is running. `/workspace/agent/<anything>` is per-container.

⭐⭐ **What transfers between containers is the MECHANISM; what does not is the NUMBERS.** Sending a peer
byte deltas as shared ground truth is worse than useless — it sent them hunting a writer that wasn't in
their container. The correct form is "here is a hazard, test it locally," and the peer did exactly that:
they independently confirmed sibling sessions write their index (three lesson rows they never wrote, and
one of their own rows advancing with no action by them) without inheriting a single figure of mine.

## Checks

1. **Scope it in the sentence:** *"my `<path>`, as of `<time>`"* — never "the `<path>` file is …".
2. **Before correcting a peer's path-addressed claim (or abandoning your own measurement for theirs),
   establish you are measuring the same filesystem.** Two impossible numbers ⇒ resolve the scope, don't
   bridge them.
3. **File by MECHANISM, not by the artifact you first hit it on.** Ask: *what is the smallest description
   of the cause?* "Per-container mounts" retrieves for clones, memory files, logs, and build dirs alike;
   "shallow clone" retrieves for exactly one. When you catch a rule failing to fire, the fix is usually
   the **index key**, not the content.
4. **Corollary for peers:** when someone hands you numbers about a path, treat them as a hypothesis about
   *their* box until you reproduce them on yours.

## Why it's insidious

This is not a measurement error — every number involved was correct and reproducible. It is a **retrieval**
error, and it presents as competence: you have the lesson, you can quote it, and you still walk into the
next instance because it arrived wearing different clothes. Related: an unowned action closed by inventing
a plausible owner, and an identifier reconstructed from memory instead of looked up — all three are
"plausible substitute for a lookup."
