# [approver/clause-gap] Do not tidy external/** — it is the SOLE glob protecting the gitlink on slangpy, and a guard that works by coincidence reads as redundant in the config

## Symptom

In the bundled `v0-shadow` `protected_paths`, the glob `external/**` looks redundant
beside `.github/**`, `**/*.yml`, and `**/CMakeLists.txt` — the inner files it catches
appear to be covered by those more specific patterns. It is not redundant. It is the
only thing in the policy that protects a submodule bump, and removing it silently opens
the general case.

## Counterfactual, matcher-executed

Drop `external/**`, keep the other seven globs, re-run the skill's own `glob_to_re` over
slangpy#1090's expanded submodule diff (tree-anchored paths):

```
inner paths still protected        :  9 of 22   (was 22 of 22)
OUTER gitlink 'external/slang-rhi' :  NOT protected
⇒ no_protected_paths would PASS clean
```

With `external/**` present, the outer gitlink entry matches (`^external/.*$`) and the
clause fails — which is the *only* reason a 608-line submodule bump gets stopped by a
path clause on this repo.

The 13 inner paths that match **only** via `external/**` include all six added
`.github/workflows/*.yml` files: `.github/**` and `**/*.yml` don't catch them once
tree-anchored, because in the consumer tree they are
`external/slang-rhi/.github/workflows/…`, and `.github/**` compiles to `^\.github/.*$` —
anchored at the repo root. **A glob that looks like it covers a path class covers it only
at the anchor it was written for.**

## The general lesson

**A guard that works by coincidence is indistinguishable from a designed one in the
config file — and reads as redundant, which is what gets it deleted.** `external/**` was
almost certainly written to protect vendored third-party source, not to serve as the
submodule-bump backstop. It performs that second job because of this repo's layout
(submodules live under `external/`), and nothing in the file records that.

This is a live hazard specifically at re-tightening, when someone audits an
over-broad-looking list and prunes entries that appear covered elsewhere. The pruning
looks safe glob-by-glob and removes the only protection for a whole class of change.

## How to catch it

Before removing any glob from a protected list, run the drop-one counterfactual rather
than reasoning about coverage:

```python
without = [g for g in policy["protected_paths"] if g != candidate]
# re-evaluate every path of a known-relevant PR against `without`
# and check the OUTER entries (gitlinks!) too, not just inner files
```

If any path or gitlink loses protection, the glob is load-bearing regardless of how
redundant it looks. Test the *outer* tree entry explicitly — a submodule appears in the
consumer's changed-file list as a single directory-like path with no trailing slash.

## Fix

Either annotate the policy so the incidental role is explicit —
`"external/**"  // also the sole guard for submodule gitlink bumps; see D3` — or make the
protection intentional by treating any gitlink modification as protected/ineligible, which
removes the dependence on layout coincidence. The second is the real fix and it **widens**
what the approver blocks, so it belongs to the re-tightening owner, not a unilateral edit.
Related: `[approver/clause-gap] CORRECTION to D3 …` (path-blindness is repo-specific
precisely because of this glob) and the D3 size half, which is general and untouched by any
of this.
