from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fake_gitlab import FakeGitLab
from gitlab_read import ReadOnlyError, ReadOnlyGitLab


class ReadOnlyGitLabTests(unittest.TestCase):
    def test_base_url_must_be_bare_https(self) -> None:
        for bad in ("http://gl.example", "https://gl.example/api", "gl.example"):
            with self.assertRaises(ReadOnlyError):
                ReadOnlyGitLab(bad, transport=FakeGitLab({}))

    def test_refuses_paths_outside_api(self) -> None:
        gl = ReadOnlyGitLab("https://gl.example", transport=FakeGitLab({}))
        for bad in ("/users", "/api/v4/../x", "//evil.example/api/v4/x"):
            with self.assertRaises(ReadOnlyError):
                gl.get(bad)

    def test_has_no_write_methods(self) -> None:
        for name in ("post", "put", "patch", "delete", "request"):
            self.assertFalse(hasattr(ReadOnlyGitLab, name))

    def test_pages_in_order(self) -> None:
        fake = FakeGitLab({"/api/v4/x": [1, 2, 3, 4, 5]}, page_size=2)
        gl = ReadOnlyGitLab("https://gl.example", transport=fake)
        self.assertEqual(list(gl.paged("/api/v4/x")), [1, 2, 3, 4, 5])
        self.assertEqual(len(fake.requests), 3)

    def test_rejects_non_sequential_pages(self) -> None:
        def transport(url: str):
            return [1], {"x-next-page": "5"}

        gl = ReadOnlyGitLab("https://gl.example", transport=transport)
        with self.assertRaises(ReadOnlyError):
            list(gl.paged("/api/v4/x"))

    def test_page_cap(self) -> None:
        def transport(url: str):
            page = int(url.rsplit("page=", 1)[1])
            return [page], {"x-next-page": str(page + 1)}

        gl = ReadOnlyGitLab("https://gl.example", transport=transport, max_pages=3)
        with self.assertRaises(ReadOnlyError):
            list(gl.paged("/api/v4/x"))


if __name__ == "__main__":
    unittest.main()
