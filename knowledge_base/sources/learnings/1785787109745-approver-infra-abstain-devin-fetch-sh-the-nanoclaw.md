# [approver/infra-abstain] devin-fetch.sh: the nanoclaw copy lacks the json.loads decode — extractor silently yields an empty Flags section, and a CI counter alone satisfies the done-poll

## Symptom

On shader-slang/slangpy#1090 the Devin run exited 0 and wrote `devin-flags.md`, but
the file's `## Flags` section was **empty** — a clean-looking artifact with the flag
content missing. Devin had in fact produced *2 Flags + 2 Informational*. Silent, and
fails toward clean.

## Two copies exist in the container — establish which one RAN

`find / -name devin-fetch.sh` returns two non-identical files:

| path | lines | `json.loads` decode |
|---|---|---|
| `~/.claude/skills/slang-pr-review-runner/scripts/devin-fetch.sh` | 331 | **yes** (`:215`, `:223`) |
| `~/.claude/skills/nanoclaw-pr-review-runner/scripts/devin-fetch.sh` | 187 | **no** |

Auditing the wrong copy inverts the finding. Never infer from prompt text — both
paths get *mentioned* in the same session. Recover the executed command from the
subagent transcript:

```bash
# tool_use Bash commands, main session + subagents
python3 -c "..."  # filter name=='Bash' and 'devin-fetch' in input.command
# under ~/.claude/projects/-workspace-agent/<session>/subagents/*.jsonl
```

The `/slangpy-pr-approve` workflow text points at the **nanoclaw** runner ("the older
name `slang-pr-review-runner` may not exist"), so the *undecoded* copy is the one the
approver path actually invokes — while the more-correct 331-line copy sits unused.

## Root cause

`agent-browser eval 'document.body.innerText'` returns a **JSON-quoted string**:
one physical line, opens with `"`, newlines as literal two-char `\n`. Verified:
`wc -l devin-page.txt` = **1**, `head -c1` = `"`.

The nanoclaw extractor (`:157`) does
`re.split(r'\n\s*\d+\s*Flags?\s*\n', text, maxsplit=1)` on that raw text. `\n` in the
Python pattern means a *real* newline, which the file contains zero of — so the split
never matches, everything falls into `analysis`, and `flags` stays `''`. The 331-line
copy pipes through `json.loads` first and is immune.

Both guards then pass: no `Generating…` in the body, and total size clears
`DEVIN_MIN_BYTES:-200` because the analysis half is fat. Body-integrity checks that
measure the *whole file* cannot see one empty section.

## Compounding: a CI counter alone is a done-signal

`:104` accepts `/Checks\s*\d+\s*\/\s*\d+/i` as `summary`. On #1090 that was the
**only** signal present — `grep -ciE 'flags?' devin-page.txt` = **0**, no
"All checks passed". So the poll exited on `Checks\n12/17`, a *CI progress counter*,
having never seen a flags summary. Deliberate per the `:95` comment, but it means
done-ness can be satisfied by something carrying no analysis-completion information.

## How to catch it

After any devin-fetch exit 0, assert the section is non-empty, not just the file:

```bash
sed -n '/## Flags/,$p' "$OUT/devin-flags.md" | tr -d '[:space:]' | wc -c   # 0 ⇒ mangled
head -c1 "$OUT/devin-page.txt"                                            # '"' ⇒ JSON-quoted
```

A watchdog on my own grep: `grep -c 'Checks..s\*.d'` returns 0 on a line you can read
with your eyes — unescaped regex metacharacters. Use `grep -cF` for literals; a
false-negative grep reads as "the defect isn't there."

## Fix

Decode before splitting in the nanoclaw copy (port `:215-224` from the slang copy):
`raw=sys.stdin.read().strip(); text=json.loads(raw) if raw.startswith('"') else raw`.
Add a per-section emptiness guard → exit 3 (inconclusive) rather than a silent
exit-0. Prefer requiring a genuine flags/verdict summary for done-ness and treating a
bare CI counter as insufficient. Until fixed: an empty `## Flags` after exit 0 is
**ABSTAIN_INFRA**, never "Devin found nothing".
