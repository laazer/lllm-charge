"""GDScript 4.x symbol parser.

Extracts symbols from a single .gd file using line-by-line regex parsing.
No external dependencies — stdlib ``re`` only.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


@dataclass
class GDScriptSymbol:
    name: str
    symbol_type: str          # "class"|"function"|"signal"|"variable"|"constant"|"enum"|"inner_class"
    line: int                 # 1-based
    file_path: str
    return_type: Optional[str] = None
    parent_class: Optional[str] = None
    is_exported: bool = False
    is_static: bool = False
    docstring: Optional[str] = None


# ── regexes ──────────────────────────────────────────────────────────────────

_RE_CLASS_NAME  = re.compile(r"^class_name\s+(\w+)")
_RE_EXTENDS     = re.compile(r"^extends\s+(\w+)")
_RE_INNER_CLASS = re.compile(r"^class\s+(\w+)\s*(?:extends\s+\w+)?\s*:")
_RE_FUNC        = re.compile(r"^(static\s+)?func\s+(\w+)\s*\([^)]*\)\s*(?:->\s*([\w\[\],. ]+?))?\s*:")
_RE_SIGNAL      = re.compile(r"^signal\s+(\w+)")
_RE_VAR         = re.compile(r"^(static\s+)?var\s+(\w+)")
_RE_CONST       = re.compile(r"^const\s+(\w+)")
_RE_ENUM        = re.compile(r"^enum\s+(\w+)\s*\{")
_RE_ANNOTATION  = re.compile(r"^@(\w+)")
_RE_DOCSTRING   = re.compile(r"^##\s?(.*)")


def _strip_indent(line: str) -> str:
    return line.lstrip("\t ")


def _collect_docstring(lines: list[str], index: int) -> Optional[str]:
    """Collect consecutive ## lines immediately before *index* (exclusive)."""
    doc_lines: list[str] = []
    i = index - 1
    while i >= 0:
        stripped = _strip_indent(lines[i])
        m = _RE_DOCSTRING.match(stripped)
        if m:
            doc_lines.insert(0, m.group(1))
            i -= 1
        else:
            break
    return "\n".join(doc_lines) if doc_lines else None


def _strip_leading_annotations(text: str) -> tuple[list[str], str]:
    """Return (annotations, remainder) after stripping all leading @word tokens."""
    annotations: list[str] = []
    remainder = text
    while True:
        m = _RE_ANNOTATION.match(remainder)
        if not m:
            break
        annotations.append(m.group(1))
        remainder = remainder[m.end():].lstrip("\t ")
    return annotations, remainder


def _pre_scan_extends(lines: list[str]) -> Optional[str]:
    """Fast first-pass to find the file-level ``extends`` declaration."""
    for raw_line in lines:
        stripped = _strip_indent(raw_line)
        m = _RE_EXTENDS.match(stripped)
        if m:
            return m.group(1)
    return None


def parse_gdscript_file(path: str) -> List[GDScriptSymbol]:
    """Parse *path* and return all GDScript symbols found.

    Malformed or unrecognised lines are silently skipped.
    Returns an empty list on empty / comment-only files.
    """
    file_path = str(Path(path).resolve())
    try:
        raw = Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []

    lines = raw.splitlines()
    symbols: List[GDScriptSymbol] = []

    # Pre-scan: find extends once so class_name symbols get the right parent_class
    # even when class_name appears before extends in the file.
    extends_class: Optional[str] = _pre_scan_extends(lines)

    pending_annotations: list[str] = []   # annotations accumulated from standalone @lines

    for i, raw_line in enumerate(lines):
        line_no = i + 1
        stripped = _strip_indent(raw_line)

        # Blank line — reset annotations
        if not stripped:
            pending_annotations = []
            continue

        # Pure comment lines (single #, not ##)
        if stripped.startswith("#") and not stripped.startswith("##"):
            continue

        # ## docstring lines — don't reset annotations
        if stripped.startswith("##"):
            continue

        # Strip ALL leading annotations from this line
        line_annotations, remainder = _strip_leading_annotations(stripped)
        all_annotations = pending_annotations + line_annotations

        # If the whole line was annotations (nothing left), accumulate and move on
        if not remainder:
            pending_annotations = all_annotations
            continue

        # ── extends ──────────────────────────────────────────────────────
        m = _RE_EXTENDS.match(remainder)
        if m:
            pending_annotations = []
            continue

        # ── class_name ───────────────────────────────────────────────────
        m = _RE_CLASS_NAME.match(remainder)
        if m:
            docstring = _collect_docstring(lines, i)
            symbols.append(GDScriptSymbol(
                name=m.group(1),
                symbol_type="class",
                line=line_no,
                file_path=file_path,
                parent_class=extends_class,
                docstring=docstring,
            ))
            pending_annotations = []
            continue

        # ── inner class ──────────────────────────────────────────────────
        m = _RE_INNER_CLASS.match(remainder)
        if m:
            docstring = _collect_docstring(lines, i)
            symbols.append(GDScriptSymbol(
                name=m.group(1),
                symbol_type="inner_class",
                line=line_no,
                file_path=file_path,
                parent_class=extends_class,
                docstring=docstring,
            ))
            pending_annotations = []
            continue

        # ── func ─────────────────────────────────────────────────────────
        m = _RE_FUNC.match(remainder)
        if m:
            is_static = bool(m.group(1)) or "static" in all_annotations
            func_name = m.group(2)
            return_type = m.group(3).strip() if m.group(3) else None
            docstring = _collect_docstring(lines, i)
            symbols.append(GDScriptSymbol(
                name=func_name,
                symbol_type="function",
                line=line_no,
                file_path=file_path,
                return_type=return_type,
                parent_class=extends_class,
                is_static=is_static,
                docstring=docstring,
            ))
            pending_annotations = []
            continue

        # ── signal ───────────────────────────────────────────────────────
        m = _RE_SIGNAL.match(remainder)
        if m:
            docstring = _collect_docstring(lines, i)
            symbols.append(GDScriptSymbol(
                name=m.group(1),
                symbol_type="signal",
                line=line_no,
                file_path=file_path,
                parent_class=extends_class,
                docstring=docstring,
            ))
            pending_annotations = []
            continue

        # ── var ──────────────────────────────────────────────────────────
        m = _RE_VAR.match(remainder)
        if m:
            is_exported = "export" in all_annotations
            is_static = bool(m.group(1)) or "static" in all_annotations
            docstring = _collect_docstring(lines, i)
            symbols.append(GDScriptSymbol(
                name=m.group(2),
                symbol_type="variable",
                line=line_no,
                file_path=file_path,
                parent_class=extends_class,
                is_exported=is_exported,
                is_static=is_static,
                docstring=docstring,
            ))
            pending_annotations = []
            continue

        # ── const ────────────────────────────────────────────────────────
        m = _RE_CONST.match(remainder)
        if m:
            docstring = _collect_docstring(lines, i)
            symbols.append(GDScriptSymbol(
                name=m.group(1),
                symbol_type="constant",
                line=line_no,
                file_path=file_path,
                parent_class=extends_class,
                docstring=docstring,
            ))
            pending_annotations = []
            continue

        # ── enum ─────────────────────────────────────────────────────────
        m = _RE_ENUM.match(remainder)
        if m:
            docstring = _collect_docstring(lines, i)
            symbols.append(GDScriptSymbol(
                name=m.group(1),
                symbol_type="enum",
                line=line_no,
                file_path=file_path,
                parent_class=extends_class,
                docstring=docstring,
            ))
            pending_annotations = []
            continue

        # Unrecognised line — reset annotations
        pending_annotations = []

    return symbols
