#!/usr/bin/env python3
"""
Clean unused i18n keys from locale files.

Scans all TypeScript/TSX source files for t("key") usages and removes keys
from locales/en.json and locales/zh.json that are not referenced anywhere.

Usage:
  python3 scripts/clean-i18n.py          # dry run: report unused keys
  python3 scripts/clean-i18n.py --fix    # remove unused keys from locale files
"""

import json
import re
import sys
import argparse
from pathlib import Path

ROOT = Path(__file__).parent.parent

LOCALE_FILES = [
    ROOT / "locales" / "en.json",
    ROOT / "locales" / "zh.json",
]

# Directories to scan for i18n key usages
SCAN_DIRS = [
    ROOT / "app",
    ROOT / "components",
    ROOT / "lib",
    ROOT / "hooks",
]

SCAN_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx"}


def flatten_keys(obj: dict, prefix: str = "", result: list | None = None) -> list[str]:
    """Flatten a nested JSON object into a list of dotted key paths (leaves only)."""
    if result is None:
        result = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            full_key = f"{prefix}.{k}" if prefix else k
            flatten_keys(v, full_key, result)
    else:
        result.append(prefix)
    return result


def get_source_files(scan_dirs: list[Path], extensions: set[str]) -> list[Path]:
    files = []
    for d in scan_dirs:
        if d.exists():
            for ext in extensions:
                files.extend(d.rglob(f"*{ext}"))
    return files


def extract_used_keys(files: list[Path], all_keys: set[str]) -> tuple[set[str], list[str]]:
    """
    Extract key usages from source files.

    Strategy:
      1. Direct t("key") calls (static string literal).
      2. <Trans i18nKey="key" /> usages.
      3. Any quoted string literal that exactly matches a known locale key —
         this catches patterns like ROUTE_LABELS = { admin: "nav.admin" }
         where the key is later passed to t(variable).
      4. Dynamic prefixes from t(`prefix.${...}`) and t("prefix." + ...).

    Returns:
        static_keys: set of fully-qualified key strings used as literals
        dynamic_prefixes: list of prefixes used in dynamic key expressions
    """
    static_keys: set[str] = set()
    dynamic_prefixes: list[str] = []

    # t("some.key") or t('some.key')
    static_re = re.compile(r'\bt\(\s*["\']([a-zA-Z0-9_.]+)["\']\s*[\),]')

    # <Trans i18nKey="some.key" /> or i18nKey={'some.key'}
    trans_re = re.compile(r'i18nKey\s*=\s*["\'{`]([a-zA-Z0-9_.]+)["\'}` ]')

    # Any quoted string that could be an i18n key (at least two dot-separated segments)
    # Used to catch indirect usages like: ROUTE_LABELS = { x: "nav.admin" } → t(labelKey)
    any_string_re = re.compile(
        r'["\']([a-zA-Z][a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)["\']')

    # Dynamic template literal directly in t(): t(`prefix.${...}`)
    dynamic_template_re = re.compile(r'\bt\(\s*`([a-zA-Z0-9_.]*)\$\{')

    # Dynamic concatenation: t("prefix." + ...)  or  t('prefix.' + ...)
    dynamic_concat_re = re.compile(r'\bt\(\s*["\']([a-zA-Z0-9_.]+)["\']\s*\+')

    # Template literal stored in a variable with an i18n-like prefix, then used
    # e.g.: const key = `assetManager.fileTypeFilter.types.${type}`; t(key)
    any_template_re = re.compile(
        r'`([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)\.\$\{')

    for path in files:
        try:
            content = path.read_text(encoding="utf-8")
        except Exception:
            continue

        for m in static_re.finditer(content):
            static_keys.add(m.group(1))

        for m in trans_re.finditer(content):
            static_keys.add(m.group(1))

        # Collect string literals that exactly match a known key
        for m in any_string_re.finditer(content):
            candidate = m.group(1)
            if candidate in all_keys:
                static_keys.add(candidate)

        for m in dynamic_template_re.finditer(content):
            prefix = m.group(1).rstrip(".")
            if prefix:
                dynamic_prefixes.append(prefix)

        for m in dynamic_concat_re.finditer(content):
            prefix = m.group(1).rstrip(".")
            if prefix:
                dynamic_prefixes.append(prefix)

        for m in any_template_re.finditer(content):
            prefix = m.group(1)
            if prefix:
                dynamic_prefixes.append(prefix)

    return static_keys, dynamic_prefixes


def is_key_used(key: str, static_keys: set[str], dynamic_prefixes: list[str]) -> bool:
    if key in static_keys:
        return True
    # A dynamic prefix covers this key if the key equals the prefix or is a child of it
    for prefix in dynamic_prefixes:
        if key == prefix or key.startswith(prefix + "."):
            return True
    return False


def remove_unused(
    obj: dict,
    checker: callable,
    prefix: str = "",
) -> tuple[dict, list[str]]:
    """
    Recursively remove unused leaf keys from a locale dict.

    Returns:
        new_obj: cleaned dict
        removed: list of removed dotted key paths
    """
    new_obj: dict = {}
    removed: list[str] = []

    for k, v in obj.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            new_v, sub_removed = remove_unused(v, checker, full_key)
            removed.extend(sub_removed)
            if new_v:
                new_obj[k] = new_v
            # If new_v is empty, the whole subtree was unused — don't add the key
        else:
            if checker(full_key):
                new_obj[k] = v
            else:
                removed.append(full_key)

    return new_obj, removed


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Report or remove unused i18n keys from locale files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Remove unused keys from locale files (default: dry run)",
    )
    args = parser.parse_args()

    # Load reference locale (en.json) to enumerate all keys
    with open(LOCALE_FILES[0], encoding="utf-8") as f:
        en_data = json.load(f)

    all_keys = flatten_keys(en_data)
    all_keys_set = set(all_keys)

    # Scan source files
    source_files = get_source_files(SCAN_DIRS, SCAN_EXTENSIONS)
    static_keys, dynamic_prefixes = extract_used_keys(
        source_files, all_keys_set)

    unique_dynamic = sorted(set(dynamic_prefixes))

    # Classify keys
    unused = [k for k in all_keys if not is_key_used(
        k, static_keys, dynamic_prefixes)]
    used_count = len(all_keys) - len(unused)

    # ── Report ────────────────────────────────────────────────────────────────
    print(f"Scanned {len(source_files)} source files")
    print(f"Total keys : {len(all_keys)}")
    print(f"Used keys  : {used_count}")
    print(f"Unused keys: {len(unused)}")

    if unique_dynamic:
        print(f"\nDynamic prefixes detected (all child keys preserved):")
        for p in unique_dynamic:
            print(f"  {p}.*")

    if unused:
        print(f"\nUnused keys:")
        for k in unused:
            print(f"  - {k}")
    else:
        print("\nNo unused keys found.")

    if not args.fix:
        if unused:
            print(f"\nRun with --fix to remove these {len(unused)} keys.")
        return

    # ── Fix ───────────────────────────────────────────────────────────────────
    if not unused:
        print("\nNothing to remove.")
        return

    def checker(k): return is_key_used(k, static_keys, dynamic_prefixes)

    for locale_file in LOCALE_FILES:
        with open(locale_file, encoding="utf-8") as f:
            data = json.load(f)

        new_data, removed = remove_unused(data, checker)

        with open(locale_file, "w", encoding="utf-8") as f:
            json.dump(new_data, f, ensure_ascii=False, indent=2)
            f.write("\n")

        print(
            f"\nUpdated {locale_file.relative_to(ROOT)} — removed {len(removed)} keys")

    print(f"\nDone. Removed {len(unused)} unused keys.")


if __name__ == "__main__":
    main()
