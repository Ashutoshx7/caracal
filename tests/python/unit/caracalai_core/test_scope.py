# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Unit tests for the OAuth 2.0 scope-string evaluation in caracalai_core.

from __future__ import annotations

import unittest

from caracalai_core import has_scope


class HasScopeTests(unittest.TestCase):
    def test_returns_true_when_scope_is_present(self) -> None:
        self.assertTrue(has_scope("read write admin", "write"))
        self.assertTrue(has_scope("read", "read"))

    def test_returns_false_when_scope_is_absent(self) -> None:
        self.assertFalse(has_scope("read write", "admin"))
        self.assertFalse(has_scope("", "read"))

    def test_empty_target_never_matches(self) -> None:
        self.assertFalse(has_scope("read write", ""))

    def test_does_not_match_partial_token(self) -> None:
        self.assertFalse(has_scope("readonly", "read"))
        self.assertFalse(has_scope("write-only", "write"))

    def test_matches_when_scope_string_has_extra_whitespace(self) -> None:
        self.assertTrue(has_scope("read  write", "write"))

    def test_single_scope_matches_exactly(self) -> None:
        self.assertTrue(has_scope("admin", "admin"))
        self.assertFalse(has_scope("admin", "adm"))


if __name__ == "__main__":
    unittest.main()
