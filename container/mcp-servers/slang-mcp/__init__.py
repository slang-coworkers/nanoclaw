"""GitHub MCP Server package."""

from src import __version__

# Re-export, not an unused import: `__version__` is this package's public
# surface. Declaring it here says so, rather than suppressing the warning.
__all__ = ["__version__"]
