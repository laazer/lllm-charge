"""
Shared types and context manager for database migration operations.

Centralises the error-handling pattern that was duplicated across every
method in MigrationRollback:

    except Exception as e:
        error_msg = f"... failed: {str(e)}"
        results["errors"].append(error_msg)
        print(f"❌ {error_msg}")
        return results
"""
import logging
from contextlib import contextmanager
from typing import Any, Dict, Generator, List, Optional, TypedDict

logger = logging.getLogger(__name__)


class OperationResult(TypedDict):
    """Standard result shape returned by all public database operations."""

    success: bool
    errors: List[str]


def make_operation_result(**extra_fields: Any) -> Dict[str, Any]:
    """
    Create a standard operation result dict pre-populated with required keys.

    All extra keyword arguments are merged in so callers can declare their
    additional fields inline:

        results = make_operation_result(restored_databases=[], backup_timestamp=None)
    """
    result: Dict[str, Any] = {"success": False, "errors": []}
    result.update(extra_fields)
    return result


@contextmanager
def database_operation(
    operation_name: str,
    results: Optional[Dict[str, Any]] = None,
) -> Generator[None, None, None]:
    """
    Context manager that provides uniform error handling for database operations.

    On success the caller sets ``results["success"] = True`` inside the block.
    On failure the exception is caught, logged, and—if *results* is provided—
    its message is appended to ``results["errors"]``. The exception is then
    **swallowed** so that the caller can return a safe fallback value
    immediately after the ``with`` statement.

    Usage (Dict-returning method)::

        async def some_operation(self) -> Dict[str, Any]:
            results = make_operation_result(extra_key=[])
            with database_operation("Some operation", results):
                # ... do work ...
                results["success"] = True
            return results   # success=False + errors populated on failure

    Usage (bool-returning helper)::

        async def _helper(self) -> bool:
            with database_operation("Helper"):
                # ... do work ...
                return True
            return False   # only reached when the CM swallowed an exception
    """
    try:
        yield
    except Exception as exc:
        message = f"{operation_name} failed: {exc}"
        logger.error(message)
        if results is not None:
            results["errors"].append(message)
