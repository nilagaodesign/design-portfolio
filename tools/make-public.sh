#!/bin/sh
# Build the public copy of v2 into dist/ (M4). Local only: it never pushes or deploys anything.
#
#   sh tools/make-public.sh            → dist/ if every check passes, exit 0
#                                        otherwise .capture/dist-check/ for inspection, exit 1
#
# Built from the committed tree (git archive HEAD), so untracked files never leak in.
# Excludes (L17, NILA-ANSWERS Main 1):
#   assets/discount/proto/ (never committed; the live prototypes and the Ascent _ds/ bundle)
#   .claude/  tools/  tokens.html  styles/README.md  .gitignore
#   every Markdown file (planning notes: roadmap, status, next-steps-style docs)
# Flattened: every file ends up at the top level of dist/ (no folders), for drag-and-drop upload.
# The Discount prototypes are replaced by their recordings (assets/discount/rec-*.webp): js/app.js
# shows a recording whenever assets/discount/proto/ is absent (W3-04 fallback).
# Fails if any data-placeholder remains (O10), or if anything excluded is present.
set -u
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT" || exit 1
OUT_OK="$ROOT/dist"
OUT_CHECK="$ROOT/.capture/dist-check"
TMP="$ROOT/.capture/dist-build.$$"
rm -rf "$TMP" && mkdir -p "$TMP"
git archive HEAD | tar -x -C "$TMP" || { echo "❌ git archive failed"; exit 1; }

# exclusions
rm -rf "$TMP/assets/discount/proto" "$TMP/.claude" "$TMP/tools" "$TMP/tokens.html" "$TMP/styles/README.md" "$TMP/.gitignore"
find "$TMP" -name '*.md' -type f -delete
# mark the public copy, so js/app.js can use the recordings directly, with no request for the missing prototypes
sed -i '' 's#^<html lang="en">#<html lang="en" data-build="public">#' "$TMP/index.html"
grep -q 'data-build="public"' "$TMP/index.html" || { echo "❌ could not mark index.html as the public build"; exit 1; }

# flatten (Nila, 8 Nov): every file at the top level, no folders, so the site can be uploaded to GitHub
# by dragging files in the browser (it drops nested folders). File names are unique across the tree
# (checked below), so only the folder prefixes in index.html, js/, data/ and styles/ need rewriting.
dups=$(find "$TMP" -type f ! -name '.*' | xargs -n1 basename | sort | uniq -d)
[ -z "$dups" ] || { echo "❌ cannot flatten, duplicate file names: $dups"; exit 1; }
perl -pi -e 's#(?<![\w.-])(?:assets/(?:ao-fig|discount|explore|figma|sendtime|sla)/|assets/|styles/|js/|data/)##g' \
  "$TMP/index.html" "$TMP"/js/*.js "$TMP"/data/*.js "$TMP"/styles/*.css
find "$TMP" -mindepth 2 -type f -exec mv {} "$TMP/" \;
find "$TMP" -mindepth 1 -type d -empty -delete

fail=0
echo "make-public · $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)$( [ -n "$(git status --porcelain -- . ':!tools' ':!.claude')" ] && echo ' (uncommitted changes are NOT included)')"

# 1. nothing excluded slipped in
for p in assets/discount/proto .claude tools tokens.html styles/README.md; do
  if [ -e "$TMP/$p" ]; then echo "❌ excluded path present: $p"; fail=1; fi
done
md=$(find "$TMP" -name '*.md' | wc -l | tr -d ' ')
[ "$md" = "0" ] || { echo "❌ $md Markdown files present"; fail=1; }

# 2. no prototype references that would load (the fallback needs its recordings)
for f in sms email flows insights; do
  [ -f "$TMP/rec-$f.webp" ] || { echo "❌ missing recording rec-$f.webp"; fail=1; }
done
# flat: no folders left, and every file the code names literally exists at the top level
sub=$(find "$TMP" -mindepth 1 -type d | wc -l | tr -d ' ')
[ "$sub" = "0" ] || { echo "❌ $sub folder(s) left after flattening"; fail=1; }
miss=$(grep -ohE '[A-Za-z0-9_%.-]+\.(jpg|gif|mp4|webp|css|js)\b' "$TMP"/*.html "$TMP"/*.js "$TMP"/*.css | sort -u | while read -r n; do [ -e "$TMP/$n" ] || echo "$n"; done)
[ -z "$miss" ] || { echo "❌ referenced but missing: $(echo $miss)"; fail=1; }

# 3. O10 placeholders (D8): the public build can't ship with any. Markup check here (index.html, data/content.js);
#    CSS rules and the JS helper that draws tags may stay. The rendered check (step 5) counts what actually shows.
ph=$(grep -In 'data-placeholder=' "$TMP/index.html" "$TMP/content.js" | sed "s#$TMP/##")
if [ -n "$ph" ]; then
  n=$(printf '%s\n' "$ph" | wc -l | tr -d ' ')
  echo "❌ $n markup line(s) still carry data-placeholder (O10: lift details still to come):"
  printf '%s\n' "$ph" | cut -c1-140 | sed 's/^/   /'
  fail=1
fi
if grep -q 'to come' "$TMP/content.js"; then echo "❌ data/content.js still has an O10 registry entry ('to come')"; fail=1; fi

# 4. no CNAME, no deploy config
[ -e "$TMP/CNAME" ] && { echo "❌ CNAME present"; fail=1; }

# 5. rendered checks in a browser on the candidate: placeholders shown, prototype requests, 404s, console, E7 weight
python3 "$ROOT/tools/public-check.py" "$TMP" || fail=1

size=$(du -sh "$TMP" | cut -f1)
if [ "$fail" = "0" ]; then
  rm -rf "$OUT_OK" && mv "$TMP" "$OUT_OK"
  echo "✅ dist/ built ($size). Not published: where v2 goes is Nila's decision (L16)."
  exit 0
else
  rm -rf "$OUT_CHECK" && mkdir -p "$(dirname "$OUT_CHECK")" && mv "$TMP" "$OUT_CHECK"
  rm -rf "$OUT_OK"
  echo "❌ not publishable. The candidate is in .capture/dist-check/ ($size) for inspection only; dist/ was not written."
  exit 1
fi
