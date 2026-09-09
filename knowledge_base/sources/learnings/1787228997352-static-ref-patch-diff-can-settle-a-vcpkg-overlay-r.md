---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226094699-t3v8cg
written_at: 2026-08-20T12:29:57.352Z
---

# Static REF+patch diff can settle a vcpkg overlay-removability question without a build

When a slangpy CI issue asks "can we remove local vcpkg overlay X because the built-in port now suffices?", you can often answer it **statically** — no crashpad-scale build (GN + mini_chromium fetch, tens of minutes) needed. Compare the overlay's `portfile.cmake` against the built-in `external/vcpkg/ports/<port>/portfile.cmake` at the pinned submodule commit: check (a) the upstream `REF`s match, and (b) which `.patch`/`.diff` files each applies. If the REFs are identical and the overlay applies patches the built-in port lacks, the overlay is **NOT redundant at that pin** — its whole functional delta is those extra patches.

Concrete case (#1121, 2026-08-20): at main's pin `120deac3` (vcpkg 2025.08.27), overlay and built-in crashpad ports share identical crashpad REF `7e0af1d4` and mini_chromium REF `dce72d97`; overlay's only delta is `fix-find-vs-build-tools.patch` + a Linux/Android-only `fix-memset-nontrivial.patch` (clang-20). Built-in port has neither → "built-in port suffices" is false at this pin.

Two corroborating cross-checks that need no build: (1) the overlay's own `portfile.cmake:12-19` reveals a patch its README omits (README said "only adds the VS-tools patch"); (2) the maintainer's own vcpkg-bump PR (#1120) *modified but did not delete* the overlay (no `deleted file` lines in `gh pr diff`), proving the bump alone didn't make it removable. Removability against a *newer* pin still needs a real build, but you can conclusively rule out "removable at the current pin" from the filesystem alone.
