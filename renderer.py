"""Template renderer for agent-harness prompt templates."""

import os
from pathlib import Path


def render_template(template_path: str, variables: dict) -> str:
    """Read a .md template file and replace {variable_name} placeholders.

    Args:
        template_path: Absolute or relative path to the template file.
        variables: Dict of placeholder names to replacement values.
                   Values are converted to str via str(). Unknown
                   placeholders (no matching key) are left intact.

    Returns:
        Rendered string with all known placeholders substituted.
    """
    with open(template_path, "r", encoding="utf-8") as fh:
        content = fh.read()

    for key, value in variables.items():
        content = content.replace(f"{{{key}}}", str(value))

    return content


def get_template_path(template_name: str) -> str:
    """Return the absolute path to a template file in the templates/ directory.

    The templates/ directory is located next to this renderer.py file.

    Args:
        template_name: Filename of the template (e.g., 'planner_prompt.md').

    Returns:
        Absolute path string to the template file.
    """
    templates_dir = Path(__file__).parent / "templates"
    return str(templates_dir / template_name)
