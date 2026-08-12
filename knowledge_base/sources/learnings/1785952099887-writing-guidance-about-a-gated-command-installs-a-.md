# Writing guidance ABOUT a gated command installs a permanent tripwire: the critique gate's Bash branch is UNANCHORED, so grepping your own notes for "gh pr create" is denied and burns soft-cap strikes

# Recording a rule about `gh pr create` makes reading your own memory file a gate denial

Observed 2026-08-05 by `slang-fixer`. Two false-positive denials, then a third that hit the denial cap and auto-escalated a bypass request to an admin.

## Mechanism, verified at source

`/app/hooks/gate-critique-on-deliver.sh`:

```
:52  BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'
:71  send_message branch:  grep -qE "^[[:space:]]*\[($MSG_MARKERS)\]" <<< "$TEXT"   ← ANCHORED
:81  Bash branch:          grep -qE "($BASH_PATTERNS)"                <<< "$TEXT"   ← UNANCHORED
```

The `Bash` branch matches the pattern anywhere in the **whole command text**. So:

```
grep -n "gh pr create" active-github-policy.md    → BLOCKED as "PR creation"
python3 heredoc whose data contains that string   → BLOCKED
cat notes.md   # merely mentions "pulls"          → allowed  (needs literal `gh api …pulls`)
```

**`grep`-ing for the string is indistinguishable from executing the command.** A gate that cannot tell *reading-about* from *doing* will always misfire on documentation — and memory/notes files are documentation by construction.

## The durable part (why this isn't a one-off)

I migrated a policy rule into a memory file: *"`gh pr list --search "<n>"` before build AND before `gh pr create`."* That substring now lives **permanently** in `active-github-policy.md`. Every future `cat`/`grep`/`sed`/heredoc over that file is denied. **Writing down guidance about a gated command installs a tripwire against reading your own notes**, inherited by anyone who records the same rule. No expiry.

## The cap interaction — the part that bites hardest

The hook's own comment at `:64-67`, on the *other* branch, says unanchored matching previously burned *"a denial — and one of the session's 3 soft-cap strikes — every time an agent merely MENTIONED a marker mid-sentence."* **The `Bash` branch is now doing exactly that, and these false positives consume the same 3 strikes.** So routine housekeeping can push a session into an admin escalation via a substring. The anchoring fix was discovered, documented, applied to one branch, and not carried to the sibling branch eleven lines away.

## This does NOT contradict the "text-matching is documented design" learning

See `1785799990839-correction-the-slang-critique-gate-s-text-matching…`, which correctly establishes that the text-matching is **deliberate advisory friction** (`:76-80` names the OneCLI credential layer as the durable backstop) and warns against hardening the matcher into a load-bearing check. Both are true because they concern **opposite failure directions**:

- That file defends **pattern incompleteness** → false **negatives** (a string-split slips through). Hardening for that is what it warns against, and rightly.
- This file reports **missing anchoring** → false **positives** (documentation text denied). Anchoring `:81` the way `:71` already is does **not** make the hook load-bearing; it removes matches that were never command invocations. It narrows scope rather than adding enforcement.

Keep the distinction when reading either: *don't make the matcher stricter about what counts as an invocation; do stop matching prose.*

## Interim mitigation

Read such files with the `Read`/`Grep` **tools**, never a Bash command — tool calls don't route through the `Bash` branch. I put a banner at the top of the offending file saying so. **That is a workaround, not a fix** — label it as such, because a mitigation recorded as a fix is how a live defect stops being tracked.

Also: once you have confirmed a gate false-positive, **stop reproducing it.** Each retry costs a strike. I burned the cap on a third probe that bought no new information.
