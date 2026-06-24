"""Tests for the Helix SVG logo generation scripts."""
from __future__ import annotations

import os
import re
import sys
import tempfile

import pytest

# Add scripts directory to import path
_SCRIPTS = os.path.join(os.path.dirname(__file__), "..", "backend", "public", "mockup", "scripts")
sys.path.insert(0, os.path.abspath(_SCRIPTS))

import gen_logo_batch_50 as batch50


# ── SLUGS data integrity ──────────────────────────────────────────────────────

class TestSlugs:
    def test_correct_count(self):
        assert len(batch50.SLUGS) == 50

    def test_unique(self):
        assert len(set(batch50.SLUGS)) == len(batch50.SLUGS)

    def test_slug_format(self):
        pattern = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")
        for slug in batch50.SLUGS:
            assert pattern.match(slug), f"Slug {slug!r} does not match expected format"

    def test_no_leading_or_trailing_hyphens(self):
        for slug in batch50.SLUGS:
            assert not slug.startswith("-"), f"{slug!r} starts with hyphen"
            assert not slug.endswith("-"), f"{slug!r} ends with hyphen"


# ── svg_wrap ──────────────────────────────────────────────────────────────────

class TestSvgWrap:
    def test_starts_with_svg_element(self):
        result = batch50.svg_wrap("myid", "My Title", "<defs/>", "<body/>", "</svg>")
        assert result.startswith("<svg")

    def test_has_correct_viewbox(self):
        result = batch50.svg_wrap("myid", "My Title", "<defs/>", "<body/>", "</svg>")
        assert 'viewBox="0 0 260 176"' in result

    def test_role_img(self):
        result = batch50.svg_wrap("myid", "My Title", "<defs/>", "<body/>", "</svg>")
        assert 'role="img"' in result

    def test_aria_labelledby_references_title_id(self):
        result = batch50.svg_wrap("tid", "My Title", "<defs/>", "<body/>", "</svg>")
        assert 'aria-labelledby="tid"' in result

    def test_title_element_contains_text(self):
        result = batch50.svg_wrap("tid", "Hello World", "<defs/>", "<body/>", "</svg>")
        assert "<title" in result
        assert "Hello World" in result

    def test_title_id_attribute_matches(self):
        result = batch50.svg_wrap("abc123", "Some Title", "<defs/>", "<body/>", "</svg>")
        assert 'id="abc123"' in result

    def test_defs_block_is_embedded(self):
        defs = "<linearGradient id='g1'/>"
        result = batch50.svg_wrap("t", "T", defs, "<body/>", "</svg>")
        assert defs in result

    def test_body_is_embedded(self):
        body = '<circle cx="130" cy="56" r="10"/>'
        result = batch50.svg_wrap("t", "T", "<defs/>", body, "</svg>")
        assert body in result


# ── body_template ─────────────────────────────────────────────────────────────

class TestBodyTemplate:
    def test_returns_string_for_all_twelve_templates(self):
        for i in range(12):
            result = batch50.body_template(f"p{i:02d}", i)
            assert isinstance(result, str)
            assert len(result) > 0

    def test_template_selection_wraps_at_12(self):
        """body_template selects TEMPLATES[n % 12]; indices 0 and 12 use the same function.
        The geometry may differ (templates receive n directly for variation), but both
        calls must succeed and return non-empty SVG content."""
        for i in range(12):
            r_base = batch50.body_template(f"p{i:02d}", i)
            r_wrap = batch50.body_template(f"p{i:02d}", i + 12)
            assert isinstance(r_base, str) and len(r_base) > 0
            assert isinstance(r_wrap, str) and len(r_wrap) > 0
            # Both must reference the same prefix to confirm it was forwarded
            assert f"p{i:02d}" in r_base
            assert f"p{i:02d}" in r_wrap

    def test_output_contains_svg_elements(self):
        for i in range(12):
            result = batch50.body_template(f"pfx", i)
            # Every template should have at least one SVG path or shape
            assert any(tag in result for tag in ("<path", "<circle", "<ellipse", "<g "))

    def test_prefix_is_used_in_gradient_refs(self):
        result = batch50.body_template("MYPREFIX", 0)
        assert "MYPREFIX" in result


# ── t3 / t3_fix ──────────────────────────────────────────────────────────────

class TestT3Fix:
    def test_t3_contains_invalid_stitch_attribute(self):
        raw = batch50.t3("p", 0, 0, 130, 56)
        assert 'stitch="0"' in raw

    def test_t3_fix_removes_stitch_attribute(self):
        fixed = batch50.t3_fix("p", 0, 0, 130, 56)
        assert 'stitch="0"' not in fixed

    def test_t3_fix_adds_stroke(self):
        fixed = batch50.t3_fix("p", 0, 0, 130, 56)
        assert 'stroke="#ffffff"' in fixed

    def test_t3_fix_adds_stroke_width(self):
        fixed = batch50.t3_fix("p", 0, 0, 130, 56)
        assert 'stroke-width="1"' in fixed

    def test_t3_fix_otherwise_same_as_t3(self):
        raw = batch50.t3("p", 0, 0, 130, 56)
        fixed = batch50.t3_fix("p", 0, 0, 130, 56)
        # Only the stitch attribute replacement should differ
        assert fixed == raw.replace(' stitch="0"', ' stroke="#ffffff" stroke-width="1"')


# ── main() integration ────────────────────────────────────────────────────────

class TestMain:
    def test_generates_correct_number_of_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            original = batch50.OUT
            batch50.OUT = tmpdir
            try:
                batch50.main()
            finally:
                batch50.OUT = original
            files = os.listdir(tmpdir)
            assert len(files) == 100  # 2 files (dark + light) × 50 slugs

    def test_all_generated_files_are_svg(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            original = batch50.OUT
            batch50.OUT = tmpdir
            try:
                batch50.main()
            finally:
                batch50.OUT = original
            for name in os.listdir(tmpdir):
                assert name.endswith(".svg"), f"{name!r} is not an SVG file"

    def test_filenames_match_slug_list(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            original = batch50.OUT
            batch50.OUT = tmpdir
            try:
                batch50.main()
            finally:
                batch50.OUT = original
            files = set(os.listdir(tmpdir))
            for slug in batch50.SLUGS:
                assert f"helix-logo-variant-{slug}.svg" in files, f"Missing dark file for {slug}"
                assert f"helix-logo-variant-{slug}-light.svg" in files, f"Missing light file for {slug}"

    def test_generated_files_are_valid_svg(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            original = batch50.OUT
            batch50.OUT = tmpdir
            try:
                batch50.main()
            finally:
                batch50.OUT = original
            for name in os.listdir(tmpdir):
                path = os.path.join(tmpdir, name)
                with open(path, encoding="utf-8") as f:
                    content = f.read()
                assert content.strip().startswith("<svg"), f"{name} does not start with <svg"
                assert "viewBox" in content, f"{name} missing viewBox"
                assert "Helix" in content, f"{name} missing Helix wordmark text"
