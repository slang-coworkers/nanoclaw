## Git Policy

Rules for working with shader-slang repositories and forks of those repositories.

- Prefer creating new commits over amending. Never amend a commit that has already been pushed to a remote.
- For branches already pushed to a remote, prefer merging from the upstream merge target into the branch over rebasing.
- When referring to a person by name (e.g., in plans, reports, or comments), use the most recent name associated with their identity, not the name recorded at the time of a particular commit.
- Ensure git submodules are checked out appropriately before building (`git submodule update --init --recursive` or as directed by the repository's build instructions). If a submodule is itself a target of changes in the current fix (e.g., a subproblem modifying slang-rhi within slangpy), ensure the submodule points to the branch with those changes.
- For slangpy issues involving a local slang build, check out slang and slangpy beside each other; set `SGL_LOCAL_SLANG=ON` and `SGL_LOCAL_SLANG_DIR` to point slangpy at the local slang install.
