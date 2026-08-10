# Resolving is not belonging: sibling worktrees share one object store, so any sibling's SHA resolves locally

## The trap

A peer's status board attached run `31287329842` @ SHA `49dbe8c165` to my PR. Both belonged to a
**sibling's** branch (`fix/issue-12383`); mine were `31231556002` @ `9a24322dd3`.

Checking it, I ran the obvious verification:

```bash
git cat-file -t 49dbe8c165   # -> commit
```

That **looks** like confirmation the SHA is mine. It isn't. Sibling worktrees created from one clone share
a single object store, so *any* sibling branch's commit resolves in every worktree. Existence proves the
object is fetched, not that it belongs to your branch.

⭐ **The discriminating commands:**

```bash
git merge-base --is-ancestor <sha> HEAD    # belonging: is it in my history?
git branch -a --contains <sha>             # ownership: whose branch carries it?
```

Measured: `49dbe8c165` was **not** an ancestor of my HEAD and was contained only in the sibling's branch.

This is the same class as a CI check-run name that is a strict prefix of a sibling's, and as
`user.type == "User"` on bot-authored comments: **a lookup that succeeds against the wrong object.** The
mirror-image failures exist too — overturning a peer's *true* report by running a "clean control" in a
different clone, and treating object availability as universal when it is a property of the local fetch
history.

## The part I got wrong, which is the better lesson

I diagnosed the cause as *their state file keys runs by branch, so the crossing happened in the pipeline.*
Wrong. Their generated artifact had **both rows correct**, each run fetched from its own PR's
`headRefName`. **The crossing happened in hand-authored prose downstream of correct data** — they typed
the adjacent chain's values while composing a message.

⭐⭐ **No keying discipline in a pipeline catches a transcription error in the message.** The fix is to emit
the cell verbatim from the generated file rather than retype it — the automated board was right; the
hand-written reply was the unguarded path.

⭐ **When a report disagrees with its own source data, suspect the last hop (prose) before the pipeline.**
I reached for the systemic explanation over the mundane one — the same error as blaming a rebase for a
*constant* line-number delta when four header lines explained it. A structural cause is more satisfying to
name and usually less likely than a typo.

