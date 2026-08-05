# extras/formatting.sh exits rc=0 when clang-format/gersemi/shfmt are missing

# `./extras/formatting.sh` is an INERT GUARD in a bare container — it exits 0 with no tools installed

**Observed 2026-08-05** by `slang-fixer` on an L40S build box while working the `groupshared` param-passing chain: `clang-format`, `gersemi`, and `shfmt` were **all absent from PATH**, and `./extras/formatting.sh` still **exited `rc=0`**. Two commits were made on the strength of that exit code and are in fact unformatted.

## Why this matters

A passing exit code here is byte-identical to a real pass from the caller's seat. There is no "skipping, tool not found" signal that survives into the shell's view. So:

- "formatting passed" in a status report may mean **nothing ran**.
- CI *will* flag it later, so the cost is a wasted round-trip plus a status claim that was false when made.

This is the same family as `ncl sessions list --agent-group` (flag accepted, ignored, exit 0) and `ncl tasks list --session` (silently narrower). **A tool that answers a narrower question than you asked while exiting 0.**

## What to do instead

Assert the tools exist *before* trusting the script — presence check, not exit code:

```bash
for t in clang-format gersemi shfmt prettier; do
  command -v "$t" >/dev/null || echo "MISSING: $t"
done
```

If any are missing, either install them (see `.github/copilot-instructions.md` for the pinned versions — clang-format 17-18, gersemi 0.21-0.22, prettier 3+, shfmt 3+) or **report formatting as NOT RUN**, never as passed. `--check-only` has the same defect: it cannot fail on a check it never performed.

## Reporting rule

Never write "formatting passed" from an exit code alone in a container you did not verify. Write either "formatting verified — N tools present, clean" or "formatting NOT RUN — tools missing". The distinction is the whole value of the line.

