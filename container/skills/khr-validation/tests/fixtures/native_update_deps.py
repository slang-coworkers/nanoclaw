"""Minimal stand-in for Vulkan-ValidationLayers' scripts/update_deps.py.

Same acquisition surface as the public script (GoodRepo.Clone/Fetch/Checkout,
ArtifactUrl, DownloadAndExtractArtifact, a .release marker, helper.cmake), so the
offline adapter is tested against the methods it replaces. It deliberately
reaches for the network the way the real script does.
"""

import argparse
import json
import os
import platform
import shutil
import stat
import subprocess
import sys
import urllib.request
import zipfile

KNOWN_GOOD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "known_good.json")


class GoodRepo:
    def __init__(self, entry, args):
        self._args = args
        self.name = entry["name"]
        self.url = entry["url"]
        self.sub_dir = entry["sub_dir"]
        self.commit = entry.get("commit")
        self.release = entry.get("release")
        self.is_release = self.release is not None
        self.url_format_map = entry.get("url_format_map") or {}
        self.optional = set(entry.get("optional", []))
        self.api = entry.get("api")
        top = os.path.abspath(args.dir)
        self.repo_dir = os.path.join(top, self.sub_dir)
        self.build_dir = (
            os.path.join(top, entry["build_dir"]) if entry.get("build_dir") else None
        )
        self.install_dir = (
            os.path.join(top, entry["install_dir"])
            if entry.get("install_dir")
            else None
        )

    def Clone(self):
        subprocess.run(["git", "clone", self.url, self.repo_dir], check=True)

    def Fetch(self, shallow):
        subprocess.run(
            ["git", "fetch", "origin", self.commit], cwd=self.repo_dir, check=True
        )

    def Checkout(self):
        if not os.path.exists(os.path.join(self.repo_dir, ".git")):
            self.Clone()
        self.Fetch(True)

    def ArtifactUrl(self):
        system, arch = platform.system().lower(), self._args.arch
        system = self.url_format_map.get(system, system)
        arch = self.url_format_map.get(arch, arch)
        return self.url.format(release=self.release, system=system, arch=arch)

    def DownloadAndExtractArtifact(self):
        url = self.ArtifactUrl()
        path = os.path.join(self.build_dir, url.rsplit("/", 1)[-1])
        os.makedirs(self.build_dir, exist_ok=True)
        if not os.path.isfile(path):
            urllib.request.urlretrieve(url, path)
        shutil.rmtree(self.install_dir, ignore_errors=True)
        os.makedirs(self.install_dir)
        with zipfile.ZipFile(path) as z:
            for info in z.infolist():
                out = z.extract(info, self.install_dir)
                mode = info.external_attr >> 16
                if stat.S_ISLNK(mode):
                    os.remove(out)
                    os.symlink(z.read(info).decode(), out)
                elif mode:
                    os.chmod(out, stat.S_IMODE(mode))
        return True

    def AcquireReleaseArtifacts(self):
        if self.DownloadAndExtractArtifact():
            with open(os.path.join(self.install_dir, ".release"), "w") as f:
                f.write(os.path.basename(self.ArtifactUrl()))

    def IsOptional(self, opts):
        return bool(self.optional.intersection(opts))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=".")
    ap.add_argument("--optional", type=lambda s: set(s.split(",")), default=set())
    ap.add_argument("--no-build", dest="do_build", action="store_false")
    ap.add_argument("--arch", type=str.lower, default="64")
    ap.add_argument("--api", default="vulkan")
    args = ap.parse_args()
    with open(KNOWN_GOOD) as f:
        repos = [GoodRepo(e, args) for e in json.load(f)["repos"]]
    os.makedirs(args.dir, exist_ok=True)
    os.chdir(args.dir)
    for repo in repos:
        if repo.api is not None and repo.api != args.api:
            continue
        if repo.IsOptional(args.optional):
            continue
        if repo.is_release:
            if not args.do_build:
                continue
            repo.AcquireReleaseArtifacts()
        else:
            repo.Checkout()
    with open(os.path.join(os.path.abspath("."), "helper.cmake"), "w") as f:
        for repo in repos:
            if not repo.is_release and not repo.IsOptional(args.optional):
                f.write(
                    f'set({repo.name.upper().replace("-", "_")}_DIR "{repo.repo_dir}" CACHE STRING "")\n'
                )
    sys.exit(0)


if __name__ == "__main__":
    main()
