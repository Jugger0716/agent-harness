"""Tests for renderer.py - template rendering functionality."""

import os
import pytest
import tempfile
from pathlib import Path


# Import after implementation exists
def get_renderer():
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from renderer import render_template, get_template_path
    return render_template, get_template_path


class TestRenderTemplate:
    def test_simple_variable_replacement(self, tmp_path):
        """Single variable is replaced correctly."""
        template = tmp_path / "t.md"
        template.write_text("Hello, {name}!")

        render_template, _ = get_renderer()
        result = render_template(str(template), {"name": "World"})
        assert result == "Hello, World!"

    def test_multiple_variables(self, tmp_path):
        """Multiple variables are all replaced."""
        template = tmp_path / "t.md"
        template.write_text("{greeting}, {name}! You are {age} years old.")

        render_template, _ = get_renderer()
        result = render_template(str(template), {"greeting": "Hi", "name": "Alice", "age": 30})
        assert result == "Hi, Alice! You are 30 years old."

    def test_missing_variable_kept_intact(self, tmp_path):
        """Placeholders with no matching variable are left as-is."""
        template = tmp_path / "t.md"
        template.write_text("Hello, {name}! Task: {unknown_var}")

        render_template, _ = get_renderer()
        result = render_template(str(template), {"name": "Bob"})
        assert result == "Hello, Bob! Task: {unknown_var}"

    def test_empty_variables(self, tmp_path):
        """Empty variables dict leaves all placeholders intact."""
        template = tmp_path / "t.md"
        template.write_text("No {replacement} here {either}.")

        render_template, _ = get_renderer()
        result = render_template(str(template), {})
        assert result == "No {replacement} here {either}."

    def test_multiline_template(self, tmp_path):
        """Multiline templates work correctly with replacements throughout."""
        template = tmp_path / "t.md"
        template.write_text(
            "# {title}\n\nRepo: {repo_path}\nLang: {lang}\n\nDescription:\n{task_description}"
        )

        render_template, _ = get_renderer()
        result = render_template(
            str(template),
            {
                "title": "My Task",
                "repo_path": "/path/to/repo",
                "lang": "python",
                "task_description": "Fix the bug",
            },
        )
        assert result == "# My Task\n\nRepo: /path/to/repo\nLang: python\n\nDescription:\nFix the bug"

    def test_value_converted_to_string(self, tmp_path):
        """Non-string values (int, bool) are converted via str()."""
        template = tmp_path / "t.md"
        template.write_text("Round: {round_num}, Flag: {flag}")

        render_template, _ = get_renderer()
        result = render_template(str(template), {"round_num": 2, "flag": True})
        assert result == "Round: 2, Flag: True"

    def test_same_placeholder_multiple_times(self, tmp_path):
        """A placeholder appearing multiple times is replaced every occurrence."""
        template = tmp_path / "t.md"
        template.write_text("{lang} is great. Use {lang} today!")

        render_template, _ = get_renderer()
        result = render_template(str(template), {"lang": "Python"})
        assert result == "Python is great. Use Python today!"


class TestGetTemplatePath:
    def test_returns_absolute_path(self):
        """get_template_path returns an absolute path."""
        _, get_template_path = get_renderer()
        path = get_template_path("planner_prompt.md")
        assert os.path.isabs(path)

    def test_path_ends_with_template_name(self):
        """Returned path ends with the given template filename."""
        _, get_template_path = get_renderer()
        path = get_template_path("planner_prompt.md")
        assert path.endswith("planner_prompt.md")

    def test_path_inside_templates_dir(self):
        """Returned path is inside a 'templates' directory."""
        _, get_template_path = get_renderer()
        path = get_template_path("planner_prompt.md")
        # Normalise separators
        normalised = path.replace("\\", "/")
        assert "/templates/" in normalised

    def test_planner_template_exists(self):
        """planner_prompt.md file actually exists on disk."""
        _, get_template_path = get_renderer()
        path = get_template_path("planner_prompt.md")
        assert os.path.isfile(path), f"File not found: {path}"

    def test_generator_template_exists(self):
        """generator_prompt.md file actually exists on disk."""
        _, get_template_path = get_renderer()
        path = get_template_path("generator_prompt.md")
        assert os.path.isfile(path), f"File not found: {path}"

    def test_evaluator_template_exists(self):
        """evaluator_prompt.md file actually exists on disk."""
        _, get_template_path = get_renderer()
        path = get_template_path("evaluator_prompt.md")
        assert os.path.isfile(path), f"File not found: {path}"


class TestTemplateContents:
    """Sanity-check that template files contain expected placeholder variables."""

    def _read(self, name):
        _, get_template_path = get_renderer()
        path = get_template_path(name)
        return Path(path).read_text(encoding="utf-8")

    def test_planner_has_required_variables(self):
        content = self._read("planner_prompt.md")
        for var in ["{task_description}", "{repo_path}", "{lang}", "{scope}"]:
            assert var in content, f"planner_prompt.md missing placeholder: {var}"

    def test_generator_has_required_variables(self):
        content = self._read("generator_prompt.md")
        for var in ["{round_num}", "{spec_content}", "{qa_feedback}", "{scope}", "{max_files}", "{skill_instructions}"]:
            assert var in content, f"generator_prompt.md missing placeholder: {var}"

    def test_evaluator_has_required_variables(self):
        content = self._read("evaluator_prompt.md")
        for var in ["{round_num}", "{spec_content}", "{changes_content}", "{test_available}", "{build_cmd}", "{test_cmd}", "{scope}"]:
            assert var in content, f"evaluator_prompt.md missing placeholder: {var}"
