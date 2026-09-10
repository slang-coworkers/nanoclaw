---
name: feedback-a-package-name-match-is-not-the-package
description: "npm gersemi is an unrelated package sharing the name with PyPI's CMake formatter; a version far from the one you need is the tell — check registry+repo before requesting an install"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# A registry name match is not the package

**Measured 2026-08-07.** Slang's `extras/formatting.sh` requires `gersemi` **0.21–0.22** (`require_bin "gersemi" "0.21" "0.22"`). I nearly requested it via `install_packages({npm: [...]})`. Probed first:

- `npm view gersemi version` → **0.1.5**, `repository.url = git://github.com/esha/gersemi.git` — an **unrelated** package that merely occupies the name.
- `pip3 index versions gersemi` → **0.21.0, 0.22.0–0.22.3, … 0.28.0** — the real `BlankSpruce/gersemi` CMake formatter.

Installing the npm one would have satisfied a naive "is `gersemi` on PATH?" check with **entirely different software**, then failed confusingly (or silently mangled CMake files). The formatter is Python; I had assigned it to npm purely because I was already composing an npm list.

**The tell was the version gap.** Needing `0.21` and finding `0.1.5` is not "slightly old" — a registry whose max version is an order of magnitude below your requirement is usually a *different project*. That signal is cheap and I nearly walked past it.

**How to apply:** before requesting any package install, confirm **(a) the right registry** (Python tools are pip, not npm — `gersemi`, `clang-format` wheels, `pre-commit`) and **(b) identity, not just name** — `npm view <p> repository.url` / `pip3 index versions <p>`. A version far from the required one, or a repo URL that isn't the project's, means stop.

⚠️ **`install_packages` accepts apt+npm only and rejects version specs** (`"prettier@3.3.3"` → `Invalid npm package name`). So a pinned-version or PyPI requirement **cannot** be satisfied by that tool — don't shape the request to fit the tool; say the tool is the wrong instrument.

Related: [[feedback_published_negative_env_claims_need_rederivation]], [[project_slang_formatting_toolchain_absent_in_containers]].
