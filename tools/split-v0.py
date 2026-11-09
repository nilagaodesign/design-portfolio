#!/usr/bin/env python3
"""One-off mechanical split of the reviewed index.html (v0-review) into styles/, data/ and js/ (commit v0-split).

Kept for the record: it cuts by line range only (never parses or rewrites code), keeps every block in its
original order, and refuses to run unless index.html is byte-identical to the v0-review commit.

Line numbers (1-based, reviewed index.html):
  <style> L10 … </style> L3182            <script> L3692 … </script> L5204
  styles/tokens.css ← L11–21 (:root) + L2107 (:root --holly): custom properties only, safe to hoist
  styles/site.css   ← L22–3181 minus L2107, unchanged and in order
  data/content.js   ← L3693–3761 (THUMBS … ORDER), L4025–4325 (CS), L4326 (SZ)
  js/answers.js     ← L3771–3785 (INTRO_H … SUGGEST), L3874–3948 (answers header comment, ALIASES … QUIPS)
  js/app.js         ← everything else in the script, in order: L3762–3770, L3786–3873, L3949–4024, L4327–5203
                      (routeTo() stays the last line)
"""
import hashlib, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
orig = subprocess.check_output(["git", "show", "v0-review:index.html"])
cur = open("index.html", "rb").read()
if cur != orig:
    sys.exit("index.html differs from v0-review; refusing to split")
L = orig.decode("utf-8").split("\n")  # L[i-1] is line i
assert L[9] == "<style>" and L[3181] == "</style>", (L[9], L[3181])
assert L[3691] == "<script>" and L[5203] == "</script>", (L[3691], L[5203])
assert L[10] == ":root{" and L[20] == "}" and L[2106].startswith(":root{--holly")
assert L[3692].startswith("const THUMBS") and L[3760].startswith("const ORDER")
assert L[3770].startswith("const INTRO_H") and L[3783] == "];" and L[3784] == ""
assert L[3873].startswith("/* ---------- answers") and L[3874].startswith("const ALIASES") and L[3947].startswith("const QUIPS")
assert L[4024] == "const CS={" and L[4324] == "};" and L[4325].startswith("const SZ=")
assert L[5202] == "routeTo();"


def lines(a, b):  # inclusive, 1-based
    return L[a - 1:b]


tokens = lines(11, 21) + lines(2107, 2107)
site = lines(22, 2106) + lines(2108, 3181)
content = lines(3693, 3761) + lines(4025, 4326)
answers = lines(3771, 3785) + lines(3874, 3948)
app = lines(3762, 3770) + lines(3786, 3873) + lines(3949, 4024) + lines(4327, 5203)

# every line of the two blocks is used exactly once
assert len(tokens) + len(site) == 3181 - 11 + 1
assert len(content) + len(answers) + len(app) == 5203 - 3693 + 1

files = {
    "styles/tokens.css": tokens, "styles/site.css": site,
    "data/content.js": content, "js/answers.js": answers, "js/app.js": app,
}
for p, body in files.items():
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write("\n".join(body) + "\n")

shell = (L[:9]
         + ['<link rel="stylesheet" href="styles/tokens.css">', '<link rel="stylesheet" href="styles/site.css">']
         + L[3182:3691]
         + ['<script src="data/content.js"></script>', '<script src="js/answers.js"></script>', '<script src="js/app.js"></script>']
         + L[5204:])
open("index.html", "w", encoding="utf-8").write("\n".join(shell))
for p in ["index.html", *files]:
    print(f"{p:20s} {sum(1 for _ in open(p, encoding='utf-8')):6d} lines  {os.path.getsize(p):8d} bytes")
