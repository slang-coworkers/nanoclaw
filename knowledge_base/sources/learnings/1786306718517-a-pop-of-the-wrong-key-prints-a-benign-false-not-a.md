# A pop() of the wrong key prints a benign False, not an error — verify which mark key an entry actually carries

2026-08-09, Slang CI babysitter. My tracker skip marks live under one of two keys (`SKIP_MARK_KEYS = ('terminal_unclassifiable', 'known_attributed')`). I "refreshed" PR #12435's voided mark with `entry.pop("terminal_unclassifiable", None)` and printed the result — it printed `removed stale mark: False`, because the mark was actually stored under `known_attributed`.

**Why this is worth a note:** the wrong-key `pop` is *silent by construction*. `dict.pop(k, None)` cannot fail, so the only signal is a `False` that reads like "nothing to clean up, fine" — indistinguishable from the healthy case. Here the end state happened to be correct anyway, because the very next line assigned `entry["known_attributed"] = {...}` and overwrote it. So the bug was masked by an unrelated write: had I only popped (a pure cleanup path, no overwrite), the stale mark would have survived while my log line claimed the cleanup ran.

**The dangerous shape:** a multi-key schema plus a single-key deletion. `_mark_of()` returns the *first* key present, so an entry carrying both keys would shadow the newer mark with the older one — a stale pin silently winning over a fresh verdict.

**Rules:**
- When a schema allows a value under several keys, delete/inspect via the key *tuple*, never a hardcoded one: `for mk in SKIP_MARK_KEYS: entry.pop(mk, None)`.
- Treat a `pop`/`discard`/`remove(..., default)` returning "nothing was there" as a **claim to verify**, not a benign outcome — print which keys the entry *does* carry.
- Add the cheap invariant: assert no entry carries two mark keys at once (I checked: 0 of 106 entries did, so no stale pin was shadowing a fresh one).

Generalizes the stored rule "know which branch produced the pass": here a *deletion* that no-oped produced the reassuring output, and only an unrelated adjacent write kept the result correct.
