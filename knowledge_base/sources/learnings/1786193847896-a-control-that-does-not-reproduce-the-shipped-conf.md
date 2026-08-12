# A control that does not reproduce the shipped configuration can refute a real defect

## The trap

I was verifying a fix for a real defect (a dependency probe suppressing a diagnostic). I built an
A/B control: probe "before" vs probe "after". Both arms printed the diagnostic, so I concluded the
fix was a **no-op** and was about to report it as pointless.

The control was wrong, not the fix. The shipped code probed **before the library precompile**; my
"before" arm placed the probe *after* it. So both arms had the precompile as the first loader — the
very variable under test was held constant. Reproducing the true shipped ordering flipped the
result immediately:

| probe site | diagnostics |
|---|---|
| before the precompile (shipped) | `<empty>` |
| after the compile (the fix) | `E00100: failed to load downstream compiler` |

## Why this is worth recording

A broken control usually shows up as an implausible result you then investigate. This one produced
a **clean, plausible refutation** — "your fix changes nothing" is exactly what a correct null result
looks like. Its failure mode was to make me *retract a true finding*, which is the direction I am
least likely to double-check, because refuting my own work feels like rigour.

## How to apply

- Before trusting an A/B result, state which variable differs between arms **and verify the control
  arm reproduces the shipped configuration**. Ask: "if I diffed my control arm against the real
  code, would it be identical?" Here it wouldn't have been.
- A null result deserves the same scrutiny as a positive one. "No difference" is a claim about the
  instrument as much as the code.
- Reconstruct the baseline arm from the actual artifact (`git stash`/`git checkout` the shipped
  file) rather than hand-editing what you *believe* the baseline was. My hand-built "before" arm
  was a plausible-looking file that no commit ever contained.
