#!/usr/bin/env python3
"""Baselines, noise floor and split proof (Main only).

  python3 tools/baseline.py capture <dir>          capture all 15 routes + truth.json into <dir>
  python3 tools/baseline.py noise <runA> <runB>    write baseline/noise.json and baseline/NOISE.md
  python3 tools/baseline.py compare <A> <B> [--md OUT]
                                                   text, console, axe, scrollWidth identical? pixels within noise?
  python3 tools/baseline.py promote <dir> <name>   copy <dir> to baseline/<name> and set baseline/CURRENT
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _lib
_lib.ensure_venv()
import asyncio, datetime, filecmp, json, shutil, subprocess


def capture(d):
    os.makedirs(d, exist_ok=True)
    asyncio.run(_lib.capture(_lib.ROUTES, d))
    subprocess.run([sys.executable, os.path.join(_lib.TOOLS, "truth-test.py"), "--json", os.path.join(d, "truth.json")], cwd=_lib.ROOT)


def compare(a, b):
    """Per route: equality of text, console, axe, scrollWidth, plus pixel counts."""
    out = {}
    for r in _lib.ROUTES:
        s = _lib.slug(r)
        ra, rb = _lib.load_capture(a, r), _lib.load_capture(b, r)
        row = {}
        for w in ("1440", "390"):
            wa, wb = ra["widths"][w], rb["widths"][w]
            ta, tb = os.path.join(a, f"{s}.{w}.txt"), os.path.join(b, f"{s}.{w}.txt")
            row[w] = {
                "text": filecmp.cmp(ta, tb, shallow=False),
                "console": sorted(wa["console"]) == sorted(wb["console"]) and sorted(wa.get("failed", [])) == sorted(wb.get("failed", [])),
                "axe": wa["axe"] == wb["axe"],
                "scrollWidth": wa["scrollWidth"] == wb["scrollWidth"],
                "sw": (wa["scrollWidth"], wb["scrollWidth"]),
                "pixels": _lib.pixel_diff(os.path.join(a, f"{s}.{w}.png"), os.path.join(b, f"{s}.{w}.png"))[0],
                "colors": wa["colors"] == wb["colors"],
                "motion": (wa["motion"]["running"], wa["motion"]["hiddenText"]) == (wb["motion"]["running"], wb["motion"]["hiddenText"]),
                "keyboard": wa["keyboard"] == wb["keyboard"],
                "external": wa["external"] == wb["external"],
            }
        out[r] = row
    return out


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd = sys.argv[1]
    if cmd == "capture":
        capture(sys.argv[2])
    elif cmd == "noise":
        a, b = sys.argv[2], sys.argv[3]
        res = compare(a, b)
        noise = {_lib.slug(r): {w: res[r][w]["pixels"] for w in ("1440", "390")} for r in _lib.ROUTES}
        os.makedirs(_lib.BASELINE_DIR, exist_ok=True)
        json.dump(noise, open(os.path.join(_lib.BASELINE_DIR, "noise.json"), "w"), indent=1)
        lines = ["# Noise floor", "",
                 f"_Measured {datetime.datetime.now():%Y-%m-%d %H:%M} by Main: two captures of `v0-review` with `tools/capture.py` "
                 "(reduced motion, paused clock, Math.random 0.42, fonts from cache, animations disabled)._", "",
                 f"Pixels = pixels whose largest channel difference between the two runs exceeds {_lib.PIXEL_TOL}/255 (smaller differences are image-resampling noise). `tools/gate.py` flags an untouched route only "
                 "when its difference from the baseline is **above** this number. Other columns: ✅ = identical in both runs.", "",
                 "| Route | px 1440 | px 390 | text | console | axe | scrollWidth | colours | motion | keyboard |", "|---|---|---|---|---|---|---|---|---|---|"]
        for r in _lib.ROUTES:
            x = res[r]
            f = lambda k: "✅" if x["1440"][k] and x["390"][k] else "❌"
            lines.append(f"| `{r}` | {x['1440']['pixels']} | {x['390']['pixels']} | {f('text')} | {f('console')} | {f('axe')} | {f('scrollWidth')} | {f('colors')} | {f('motion')} | "
                         + ("✅" if x["1440"]["keyboard"] else "❌") + " |")
        tot = sum(v for d in noise.values() for v in d.values())
        lines += ["", f"Total noise: {tot} px across 30 full-page screenshots." + (" The capture is fully deterministic." if tot == 0 else "")]
        open(os.path.join(_lib.BASELINE_DIR, "NOISE.md"), "w").write("\n".join(lines) + "\n")
        print("\n".join(lines))
    elif cmd == "compare":
        a, b = sys.argv[2], sys.argv[3]
        res = compare(a, b)
        noise = _lib.load_noise()
        lines = ["| Route | text | console | axe | scrollWidth | px 1440 (noise) | px 390 (noise) | Pass |", "|---|---|---|---|---|---|---|---|"]
        npass = 0
        for r in _lib.ROUTES:
            x, s = res[r], _lib.slug(r)
            ok = all(x[w][k] for w in ("1440", "390") for k in ("text", "console", "axe", "scrollWidth"))
            px = all(x[w]["pixels"] <= noise.get(s, {}).get(w, 0) for w in ("1440", "390"))
            npass += ok and px
            f = lambda k: "✅" if x["1440"][k] and x["390"][k] else "❌"
            lines.append(f"| `{r}` | {f('text')} | {f('console')} | {f('axe')} | {f('scrollWidth')} | {x['1440']['pixels']} ({noise.get(s, {}).get('1440', 0)}) | "
                         f"{x['390']['pixels']} ({noise.get(s, {}).get('390', 0)}) | {'✅' if ok and px else '❌'} |")
        lines += ["", f"**{npass} of 15 routes pass.**"]
        md = "\n".join(lines)
        if "--md" in sys.argv:
            open(sys.argv[sys.argv.index("--md") + 1], "w").write(md + "\n")
        print(md)
        sys.exit(0 if npass == 15 else 1)
    elif cmd == "promote":
        src, name = sys.argv[2], sys.argv[3]
        dst = os.path.join(_lib.BASELINE_DIR, name)
        if os.path.exists(dst):
            sys.exit(f"{dst} exists; pick a new name")
        shutil.copytree(src, dst)
        open(os.path.join(_lib.BASELINE_DIR, "CURRENT"), "w").write(name + "\n")
        print(f"baseline → {dst} (CURRENT = {name})")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
