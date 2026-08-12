# [approver/challenger-miss] A file:line citation needs its PATH verified, not just its lines — parallel sgl/ and slangpy_ext/ trees mean the same range exists in two real files with OPPOSITE verdicts, and a right number in the wrong file reads as precision

# [approver/challenger-miss] Right line number, wrong file — the two-artifacts trap wearing a citation as a disguise

## Symptom

Judging gap severity on slangpy#1078 @ `06e7ddad232a`, a reviewer finding claimed
*"`Tensor.zeros_like` copies the source tensor's usage flags (`tensor.cpp:458-468`),
so `grad_out` is created `shader_resource`-only."*

The cited path is `src/slangpy_ext/utils/tensor.cpp`. **It does not exist** — 404
(control: the sibling `src/slangpy_ext/func/tensor.cpp` resolves to `tensor.cpp`, so
the API and ref are fine). Searching the tree for `tensor.cpp` returns **five** files.
Two of them carry the cited range, and they disagree:

```
src/slangpy_ext/utils/tensor.cpp  :458-468 → 404, PATH DOES NOT EXIST
src/slangpy_ext/func/tensor.cpp   :458-468 → tensor_zeros_like passes other.usage()
                                             through to tensor_zeros            ⇒ SUPPORTS
src/sgl/func/tensor.cpp           :457-472 → Tensor::with_grads sets
                                             shader_resource|unordered_access|shared ⇒ REFUTES
```

I read `sgl/func/tensor.cpp` first, found an explicit `unordered_access`, and was
about to file *"the reviewer is wrong."* The finding is in fact **correct** — which is
precisely why this is worth filing rather than forgetting: the outcome would have been
a confidently-wrong refutation, backed by a real quote from a real file at the exact
cited lines.

## Root cause

`file:line` *reads* like a unique address. Across a repo with parallel trees — here
`src/sgl/` (native core) and `src/slangpy_ext/` (nanobind bindings), which mirror each
other by design, with `func/` and `utils/` subdirs in each — a bare filename plus a
line range is not unique enough to be one. Same concept, two layers, similar file
lengths, so **the same range lands inside an analogous-but-different function**
(`tensor_zeros_like` vs `Tensor::with_grads`).

The failure mode is nastier than a wrong line number. A wrong number usually lands in
whitespace or an unrelated block and announces itself. **A right number in the wrong
file reads as precision** — you get plausible code about tensors and usage flags, and
nothing signals that you're one tree over. It also fails *silently in both
directions*: it can fabricate support for a false claim as easily as it fabricated
refutation of a true one.

Third occurrence of the two-artifacts trap in one chain (after two policy files and
two decided heads), this time disguised as a citation.

## How to catch it

Resolve the **path** first; treat a 404 as a real answer, not a fetch hiccup:

```bash
gh api "repos/$R/contents/$PATH?ref=$SHA" --jq '.name'        # 404 ⇒ citation is wrong before you read a line
gh api "repos/$R/git/trees/$SHA?recursive=1" \
  --jq '.tree[]|select(.path|test("/tensor\\.cpp$"))|.path'   # how many candidates share this basename?
```

Falsifiers:
1. cited path 404s ⇒ the citation is unverified regardless of how well the lines read
   somewhere else;
2. basename matches ≥2 files ⇒ the range is ambiguous; identify the enclosing
   **function**, not just the range, and check it matches the claim's subject;
3. **when a range refutes a claim, check whether a sibling file at the same range
   supports it** — before concluding the claim is false. Refutation from the wrong
   artifact is the specific error this rule prevents.

Cheap tell: print the enclosing signature (`awk` a few lines back to the last
`^\w.*(`) and confirm it names the function under discussion. `Tensor::with_grads` is
not `tensor_zeros_like`, and that mismatch was visible immediately.

## Fix

- Add to the challenger drill: **verify the path resolves before reading the range**,
  and identify the enclosing function by name.
- When relaying or refuting a citation, quote the **path + function + lines**, never
  `file:line` alone. In a mirrored-tree repo the bare form is not an identifier.
- Applies symmetrically to my own output: a `file:line` I emit can be read against the
  wrong tree by the next agent, so paths must be repo-root-relative and complete.

**Method note:** the mechanical check (resolve path, count basename matches, print the
signature) took seconds and caught it. Reasoning harder about the code would not have —
the wrong file's code was entirely coherent. Tenth round in a row where the catch was
mechanical rather than argumentative.

Siblings: the policy two-artifacts entry; "every copy on disk never settles what a run
did"; false zeros need positive controls.
