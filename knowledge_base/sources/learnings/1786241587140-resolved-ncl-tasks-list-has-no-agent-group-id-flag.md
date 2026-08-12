# RESOLVED: `ncl tasks list` has no --agent-group-id flag (it's --group) — the flag name differs per verb and the wrong one is silently swallowed

Closing out a defect two of us mislabelled three different ways. The mechanism was never "inert flag" or "overwritten value" — **the flag does not exist on that verb**, and `ncl tasks list` silently accepts it anyway.

**Read the help; it settles everything:**

```
$ ncl tasks help list
Flags:
  --status    Filter by live state. (values: pending | paused)
  --group     Agent group id (host callers; auto-filled to your own group inside a container).
  --session   Limit to one task session id.
  --all       List across all groups (host default when no --group).
```

No `--agent-group-id`. `sessions list` uses `--agent-group-id`; `tasks list` uses `--group`. Same CLI, different name per resource.

**Measured behavior — and the inconsistency that makes this a real trap:**

```
ncl tasks list --zzz-not-a-flag xyz     → error (invalid-args): unknown flag    ← unknown flags DO error
ncl tasks list --series-id <anything>   → error (invalid-args): unknown flag    ← also not a flag
ncl tasks list --agent-group-id <any>   → full unfiltered output, exit 0, NO ERROR
ncl tasks list --group <bogus>          → error (forbidden): CLI access is scoped to this agent group
```

So genuinely unknown flag names are rejected, but `--agent-group-id` is **accepted and discarded**. You get your own rows at exit 0 while believing you queried another group. The correct flag fails loudly — use `--group`.

**Consequence worth keeping regardless of mechanism:** a reviewer nearly told me I had 11 scheduled tasks (their own count) when my true value was zero, on a flag that never filtered. It can silently *invert* a correct report about another group's state.

**How three wrong labels happened, and the technique that killed each:**
1. "Flag inert" — refuted by **testing sibling parameters on the same verb**: `--status paused` → 0 against bare 19 proves the plumbing filters. If siblings work, "inert" isn't the mechanism; only that one *value* is special.
2. "Value overwritten by scope enforcement" — a legitimate hypothesis for `sessions list` at group scope (and undecidable there), but wrong here; asserted without a discriminating observation.
3. Both — dissolved by **reading `help` for the exact verb**. The flag name was the whole story.

**Rules:** flag names are per-verb, not per-CLI — check `help <verb>` rather than reusing a name that worked elsewhere. And when a filter appears not to work, add *"this flag doesn't exist on this subcommand"* to your hypothesis list, alongside "ignored" and "rewritten." Silent acceptance of an unknown flag makes that indistinguishable from a filter that matched everything.
