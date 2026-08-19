---
name: feedback_versioned_clang_format_needs_llvm_apt_source
description: "install_packages(apt:['clang-format-17']) ALWAYS fails on Debian bookworm — versioned clang-format-N lives only in apt.llvm.org, not the default repos (bookworm ships bare `clang-format` = v14). install_packages takes BARE names only, so it cannot add the apt source the fix needs → operator/Dockerfile action. And a FAILED rebuild leaves the poison entry PERSISTED in packages_apt, so every later rebuild re-fails until removed."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ca41560b-b199-4c60-94f8-8afbca9f7f07
---

# Versioned `clang-format-N` needs the LLVM apt source; `install_packages` can't add it

**Measured 2026-08-17, slang-fixer (`ag-1780667166439-vmjrwe`).** A rebuild failed on
`E: Unable to locate package clang-format-17` (added alongside libx11-dev/libvulkan1/vulkan-tools).

**Why:** Debian bookworm ships **`clang-format` (v14)** under the bare name; **versioned
`clang-format-17` exists only in the LLVM apt repo** (apt.llvm.org), which the base image doesn't
configure. So `apt-get install clang-format-17` can never succeed as written. The Slang repo needs
**17.x specifically** (`./extras/formatting.sh` matches 17.x; v14 produces diffs), so falling back to
bookworm's bare `clang-format` does NOT satisfy formatting.

**Two boundaries that make this an OPERATOR action, not a retry:**
- `install_packages` accepts **bare apt names only** — it cannot add an apt source line. The fix (add
  `apt.llvm.org/bookworm llvm-toolchain-bookworm-17` before install) is a **Dockerfile / base-image
  change**, i.e. operator territory. See [[feedback_main_cannot_approve_install_packages]] (Main can
  request/list self-mod, not approve — those route to a human).
- ⭐**A FAILED rebuild leaves the bad entry PERSISTED in `packages_apt`.** Verified by me:
  `ncl groups config get --id <ag>` → `packages_apt: [libx11-dev, libvulkan1, vulkan-tools,
  clang-format-17]` **after** the build failed and "nothing was applied." ⇒ the entry is a **poison
  landmine**: every subsequent rebuild of that container re-fails on the same line until someone strips
  it or adds the source. The running container is unaffected (it stays on its prior image); only the
  rebuild PATH is broken.

**How to apply — the operator's fork:**
1. **Add the LLVM 17 apt source in the image build** (satisfies formatting, keeps the capability), then
   retry. Not expressible via `install_packages`; needs a Dockerfile edit.
2. **Strip `clang-format-17` from `packages_apt`** (`ncl groups config remove-package` — mutating,
   approval-gated) so rebuilds work again, at the cost of no 17.x clang-format. Acceptable stopgap:
   the fixer already formats via the **build's own toolchain**, so #12430 work is unaffected either way.

**Detector:** a coworker reporting a failed package rebuild → `ncl groups config get --id <ag>` and
check whether the failing package name is still in `packages_apt`. If it is, the rebuild path is
poisoned regardless of "nothing was applied."

Related: [[feedback_main_cannot_approve_install_packages]].
