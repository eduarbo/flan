#!/usr/bin/env python3
"""Copy only the public site out of docs/ for GitHub Pages.

docs/ also holds the repository's documentation (Markdown, README images),
which is read on GitHub and must not be served from flankbd.com. This copies
an explicit allowlist of tracked files, then fails if any page refers to a
local file that was left out.

Usage: python3 tools/stage_site.py OUTPUT_DIR
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import html
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
SITE = 'https://flankbd.com/'

# Pages and files served at the site root.
FILES = [
    'index.html', '404.html', 'offline.html', 'branding.html',
    'favicon.ico', 'favicon.svg', 'apple-touch-icon.png',
    'robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt', 'CNAME',
]
# Folders served whole, except documentation inside them.
TREES = ['assets', 'explore', 'marketing', 'branding/flan']
DOC_SUFFIXES = {'.md'}

ATTR = re.compile(r'''\s(?:href|src|poster)\s*=\s*["']([^"'<>{}$]+)["']''', re.I)
CSS_URL = re.compile(r'''url\(\s*["']?([^"')]+)["']?\s*\)''', re.I)
SCRIPT = re.compile(r'<script\b[^>]*>.*?</script>', re.I | re.S)
STYLE = re.compile(r'<style\b[^>]*>(.*?)</style>', re.I | re.S)
ABSOLUTE = re.compile(re.escape(SITE) + r'''[^\s"'<>)\]`]*''')


def tracked(prefix):
    out = subprocess.run(['git', 'ls-files', '-z', '--', prefix], cwd=DOCS, check=True,
                         capture_output=True).stdout.decode()
    return [p for p in out.split('\0') if p]


def selection():
    chosen = []
    for name in FILES:
        if not tracked(name):
            sys.exit(f'stage_site: {name} is not tracked in docs/')
        chosen.append(name)
    for tree in TREES:
        files = [p for p in tracked(tree) if Path(p).suffix.lower() not in DOC_SUFFIXES]
        if not files:
            sys.exit(f'stage_site: docs/{tree}/ has no site files')
        chosen += files
    return sorted(set(chosen))


def local_target(page, ref):
    """Path inside the site that `ref` on `page` points to, or None if external."""
    ref = html.unescape(ref.strip())
    if not ref or ref.startswith(('#', 'data:', 'mailto:', 'javascript:', 'blob:')):
        return None
    if ref.startswith(SITE):
        url = ref
    elif urlsplit(ref).scheme or ref.startswith('//'):
        return None
    else:
        url = urljoin(SITE + page, ref)
    path = unquote(urlsplit(url).path).lstrip('/')
    return path + 'index.html' if path == '' or path.endswith('/') else path


def missing_references(out):
    missing = set()
    for file in out.rglob('*'):
        if file.suffix.lower() not in {'.html', '.css', '.txt', '.xml', '.js'}:
            continue
        page = file.relative_to(out).as_posix()
        text = file.read_text(errors='ignore')
        suffix = file.suffix.lower()
        refs = ABSOLUTE.findall(text)
        if suffix == '.html':
            # Markup and inline styles only; scripts load their files at run time.
            refs += ATTR.findall(SCRIPT.sub('', text))
            refs += [u for block in STYLE.findall(text) for u in CSS_URL.findall(block)]
        elif suffix == '.css':
            refs += CSS_URL.findall(text)
        for ref in refs:
            target = local_target(page, ref)
            if target is None:
                continue
            if not (out / target).is_file() and not (out / target / 'index.html').is_file():
                missing.add((page, ref))
    return sorted(missing)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('output', type=Path)
    out = parser.parse_args().output.resolve()
    if out == DOCS or DOCS in out.parents or out in DOCS.parents:
        sys.exit('stage_site: output must be outside docs/')
    if out.exists() and any(out.iterdir()):
        sys.exit(f'stage_site: {out} is not empty')
    files = selection()
    for rel in files:
        dest = out / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DOCS / rel, dest)
    missing = missing_references(out)
    for page, ref in missing:
        print(f'missing: {page} -> {ref}', file=sys.stderr)
    if missing:
        sys.exit(f'stage_site: {len(missing)} local references are not in the site')
    size = sum((out / rel).stat().st_size for rel in files)
    print(f'Staged {len(files)} files ({size / 2**20:.1f} MiB) in {out}')


if __name__ == '__main__':
    main()
