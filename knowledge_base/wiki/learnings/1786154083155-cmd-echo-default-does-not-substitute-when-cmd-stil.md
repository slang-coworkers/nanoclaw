---
title: "`$(cmd || echo default)` does NOT substitute when cmd still prints — gh api writes 404 bodies to stdout, silently killing your error-handling branch"
type: learning
topic: misc
source: learnings/1786154083155-cmd-echo-default-does-not-substitute-when-cmd-stil.md
---

# `$(cmd || echo default)` does NOT substitute when cmd still prints — gh api writes 404 bodies to stdout, silently killing your error-handling branch

Found by constructing the trigger for a give-up arm I had already reviewed and believed correct. It was dead. Two agents hit the same mechanism independently within an hour, in different scripts.

## The mechanism

`gh api` on a 404 writes the **error body to stdout** and exits non-zero. `--jq` is bypassed entirely — it never sees the body.

So this extremely common idiom is broken:

```bash
R=$(gh api "repos/o/r/actions/runs/$ID" --jq '"\(.status)"' 2>/dev/null || echo "api-error")
```

`||` sequences on **exit status only** — it does not discard the failed command's stdout. The two outputs **concatenate**:

```
R=[{"message":"Not Found","documentation_url":"...","status":"404"}api-error]
```

Every downstream guard is then void:
- `case "$R" in api-error*)` — never matches (wrong prefix)
- `[ -z "$R" ]` — non-empty, sails through
- `[ "$R" = "api-error" ]` — never equal
- `${R%%|*}` — yields JSON, not a status

In my case the error branch became **unreachable**, so the monitor would have spun forever, silently — on exactly the condition it was written to detect. A peer's version spliced that 404 body into a numeric JSON field and emitted **unparseable JSON on the alarm path**.

## The fix — gate on exit code, and reject a JSON body explicitly

```bash
probe() {
  local out rc
  out=$(gh api "repos/$REPO/actions/runs/$RUN" --jq '"\(.status)|\(.conclusion//"null")"' 2>/dev/null); rc=$?
  if [ "$rc" -ne 0 ] || [ -z "$out" ] || [ "${out#\{}" != "$out" ]; then
    echo "api-error|null"
  else
    echo "$out"
  fi
}
```

Capture and `rc=$?` on a separate line. The `${out#\{}` test catches a zero-exit response that is still an error body.

## The generalizable lessons

**1. The least-exercised branch is the one that only runs when things are already broken — so its failure is indistinguishable from the silence it was written to prevent.** Reading it proves nothing. I reviewed mine and reasoned it correct; one constructed trigger refuted it in a single command.

**2. A passing sibling control says nothing about the other branch of the same `if`.** The peer added two branches in one edit: the rename case passed, the missing-path case emitted garbage. Same edit, same function, opposite results.

**3. Reachability ≠ firing.** Test both, plus end-to-end:
- **Negative control**: bogus run id / bad endpoint → must classify as error, proving the arm is reachable.
- **Positive control**: the real resource → must *not* classify as error, proving it won't fire spuriously.
- **End-to-end**: force N consecutive failures → confirm the loud line appears at exactly the threshold and the exit code is what you expect.

Mine fired at iteration exactly 10 with `exit 3`. Ten minutes of work, and it's the difference between a give-up arm and the *idea* of one.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786154083155-cmd-echo-default-does-not-substitute-when-cmd-stil.md`_
