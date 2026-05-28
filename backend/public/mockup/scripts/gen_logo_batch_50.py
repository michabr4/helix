#!/usr/bin/env python3
"""Generate 50 Helix logo pairs (dark + light wordmark); distinct geometry via rotating templates."""
from __future__ import annotations

import os

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")

FOOTER_DARK = """
  <g filter="url(#%(p)s_sh)">
    <text x="130" y="156" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="46" font-weight="800" letter-spacing="-0.055em" fill="url(#%(p)s_wm)">Helix</text>
  </g>
  <path d="M 48 166 Q 130 182 212 166" fill="none" stroke="url(#%(p)s_sw)" stroke-width="3.5" stroke-linecap="round"/>
</svg>
"""

DEFS_DARK = """
    <linearGradient id="%(p)s_bb" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
      <stop offset="0%%" stop-color="#003949"/><stop offset="50%%" stop-color="#049FD9"/><stop offset="100%%" stop-color="#7FDBFF"/>
    </linearGradient>
    <linearGradient id="%(p)s_bb2" x1="100%%" y1="0%%" x2="0%%" y2="100%%">
      <stop offset="0%%" stop-color="#9D174D"/><stop offset="50%%" stop-color="#FF1B8D"/><stop offset="100%%" stop-color="#FDA4D0"/>
    </linearGradient>
    <linearGradient id="%(p)s_wm" x1="0%%" y1="0%%" x2="100%%" y2="0%%">
      <stop offset="0%%" stop-color="#ffffff"/><stop offset="40%%" stop-color="#e0f4fc"/><stop offset="65%%" stop-color="#fda4d0"/><stop offset="100%%" stop-color="#ffe4f4"/>
    </linearGradient>
    <linearGradient id="%(p)s_sw" x1="0%%" y1="0%%" x2="100%%" y2="0%%">
      <stop offset="0%%" stop-color="#FF1B8D" stop-opacity="0.35"/><stop offset="50%%" stop-color="#049FD9"/><stop offset="100%%" stop-color="#FF1B8D" stop-opacity="0.35"/>
    </linearGradient>
    <radialGradient id="%(p)s_g" cx="130" cy="56" r="74" gradientUnits="userSpaceOnUse">
      <stop offset="0%%" stop-color="#049FD9" stop-opacity="0.18"/><stop offset="100%%" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
    <filter id="%(p)s_gl"><feGaussianBlur stdDeviation="0.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="%(p)s_sh" x="-8%%" y="-8%%" width="116%%" height="120%%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="blur"/>
      <feOffset in="blur" dy="1.5" result="off"/>
      <feFlood flood-color="#020617" flood-opacity="0.45" result="f"/>
      <feComposite in="f" in2="off" operator="in" result="sh"/>
      <feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
"""

DEFS_LIGHT = """
    <linearGradient id="%(p)s_bb" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
      <stop offset="0%%" stop-color="#003949"/><stop offset="50%%" stop-color="#049FD9"/><stop offset="100%%" stop-color="#7FDBFF"/>
    </linearGradient>
    <linearGradient id="%(p)s_bb2" x1="100%%" y1="0%%" x2="0%%" y2="100%%">
      <stop offset="0%%" stop-color="#9D174D"/><stop offset="50%%" stop-color="#FF1B8D"/><stop offset="100%%" stop-color="#FDA4D0"/>
    </linearGradient>
    <linearGradient id="%(p)s_wm" x1="0%%" y1="0%%" x2="100%%" y2="0%%">
      <stop offset="0%%" stop-color="#0f172a"/><stop offset="38%%" stop-color="#0c4a6e"/><stop offset="64%%" stop-color="#831843"/><stop offset="100%%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="%(p)s_sw" x1="0%%" y1="0%%" x2="100%%" y2="0%%">
      <stop offset="0%%" stop-color="#E6007E" stop-opacity="0.35"/><stop offset="50%%" stop-color="#049FD9"/><stop offset="100%%" stop-color="#E6007E" stop-opacity="0.35"/>
    </linearGradient>
    <radialGradient id="%(p)s_g" cx="130" cy="56" r="74" gradientUnits="userSpaceOnUse">
      <stop offset="0%%" stop-color="#049FD9" stop-opacity="0.18"/><stop offset="100%%" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
    <filter id="%(p)s_gl"><feGaussianBlur stdDeviation="0.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="%(p)s_sh" x="-8%%" y="-8%%" width="116%%" height="120%%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="blur"/>
      <feOffset in="blur" dy="1" result="off"/>
      <feFlood flood-color="#ffffff" flood-opacity="0.65" result="f"/>
      <feComposite in="f" in2="off" operator="in" result="sh"/>
      <feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
"""


def svg_wrap(title_id: str, title: str, defs_block: str, body: str, footer: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 176" role="img" aria-labelledby="{title_id}">
  <title id="{title_id}">{title}</title>
  <defs>
{defs_block}
  </defs>
{body}
{footer}
"""


def body_template(p: str, n: int) -> str:
    k = n % 12
    o = (n * 7) % 12
    cx, cy = 130, 56
    return TEMPLATES[k](p, n, o, cx, cy)


def t0(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {82+o} {34+o%4} C {108+o%8} {48} {118} {58} {130} {62} C {146+o%6} {54} {168} {32} {178} {28+o%3}"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {174-o} {100-o%5} C {152} {78} {138} {62} {130} {54} C {118} {70} {98} {88} {86} {100}"/>
  <circle cx="{cx}" cy="{cy+2}" r="6" fill="#020617" stroke="url(#{p}_bb)" stroke-width="2"/><circle cx="{cx}" cy="{cy+2}" r="3" fill="#ffffff"/>"""


def t1(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <g fill="none" stroke="#049FD9" stroke-width="1.1" opacity="0.4" stroke-linecap="round">
    <path d="M {72+o%6} {40} H {188-o%4} M {72} {56} H {188} M {72} {72} H {188}"/></g>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {90+o%10} {36} C {120} {52} {128} {60} {130} {64}"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {170-o%8} {76} C {140} {58} {132} {52} {130} {48}"/>
  <circle cx="{cx}" cy="{cy}" r="5" fill="#020617" stroke="url(#{p}_bb2)" stroke-width="1.6"/>"""


def t2(p, n, o, cx, cy):
    x0 = 92 + o % 8
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <path stroke="#049FD9" stroke-width="2.5" fill="none" stroke-linecap="round" d="M {x0} {72} V {44+o%8}"/><path stroke="#FF1B8D" stroke-width="2.5" fill="none" d="M {x0+18} {72} V {38+o%6}"/><path stroke="#7FDBFF" stroke-width="2.5" fill="none" d="M {x0+36} {72} V {46+n%5}"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="3.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {88} {78} C {118} {70} {142} {70} {172} {78}"/>
  <circle cx="{cx}" cy="{cy-6}" r="4" fill="#ffffff" stroke="#020617" stroke-width="1"/>"""


def t3(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="6" stroke-linecap="round" filter="url(#{p}_gl)" d="M {100+o%12} {38} C {72+o%10} {52} {72} {72} {100+o%8} {80} C {128} {86} {146+o%6} {74} {156} {58+o%5}"/>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="6" stroke-linecap="round" filter="url(#{p}_gl)" d="M {160-o%10} {38} C {188} {52} {188} {72} {160} {80} C {132} {86} {114} {74} {104} {58}"/>
  <circle cx="{cx}" cy="{cy+4}" r="4" fill="#020617" stitch="0"/>"""


def t3_fix(p, n, o, cx, cy):
    s = t3(p, n, o, cx, cy)
    return s.replace(' stitch="0"', ' stroke="#ffffff" stroke-width="1"')


def t4(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <circle cx="{cx}" cy="{cy}" r="{30+o%8}" fill="none" stroke="#049FD9" stroke-width="1" opacity="0.35"/>
  <circle cx="{cx}" cy="{cy}" r="{18+n%6}" fill="none" stroke="#FF1B8D" stroke-width="1" opacity="0.35"/>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {86+o} {44} C {112} {36} {124} {42} {130} {50}"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {174} {68} C {148} {76} {136} {70} {130} {62}"/>
  <circle cx="{cx}" cy="{cy}" r="4.5" fill="#020617" stroke="#7FDBFF" stroke-width="1.2"/>"""


def t5(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="1.5" opacity="0.45" d="M {130} {40} L {152+o%6} {50} L {152} {62} L {130} {72} L {108} {62} L {108} {50} Z"/>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="4.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {118+o%5} {44} C {128} {52} {130} {56} {130} {60}"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="4.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {142} {44} C {132} {52} {130} {56} {130} {60}"/>
  <circle cx="{cx}" cy="{cy+4}" r="5" fill="#ffffff" stroke="#020617" stroke-width="1.2"/>"""


def t6(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="1.3" opacity="0.45" d="M {cx} {cy} L {96+o} {36} M {cx} {cy} L {164-o} {36} M {cx} {cy} L {92} {74} M {cx} {cy} L {168} {74}"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {102} {42} C {116} {50} {124} {54} {128} {56}"/>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {158} {42} C {144} {50} {136} {54} {132} {56}"/>
  <circle cx="{cx}" cy="{cy}" r="8" fill="#020617" stroke="url(#{p}_bb)" stroke-width="2"/><circle cx="{cx}" cy="{cy}" r="3" fill="#ffffff"/>"""


def t7(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <path fill="none" stroke="#94a3b8" stroke-width="1" opacity="0.35" stroke-dasharray="4 5" d="M {80+o%6} {48} C {102} {32} {124} {32} {130} {42}"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="4.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {78+o%8} {70} C {98} {48} {118} {42} {130} {50} C {146} {62} {162} {72} {182-o%6} {68}"/>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="4" stroke-linecap="round" filter="url(#{p}_gl)" d="M {182} {44} C {162} {52} {142} {50} {130} {44}"/>
  <circle cx="{cx}" cy="{cy+2}" r="4.5" fill="#ffffff" stroke="#020617" stroke-width="1.1"/>"""


def t8(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {100+o%7} {70} C {104} {44} {118} {36} {130} {42} C {142} {36} {156} {44} {160} {70}"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {94+o%5} {52} C {108} {62} {122} {66} {130} {64} C {138} {66} {152} {62} {166} {52}"/>
  <path fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.35" d="M {118} {52} Q {130} {58} {142}"/>"""


def t9(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <g stroke-linecap="round" stroke="#049FD9" stroke-width="1.2" opacity="0.42">
    <path d="M {cx} {cy+2} L {130} {34+o%4}"/><path d="M {cx} {cy+2} L {152} {48}"/><path d="M {cx} {cy+2} L {152} {66}"/><path d="M {cx} {cy+2} L {130} {80}"/><path d="M {cx} {cy+2} L {108} {66}"/><path d="M {cx} {cy+2} L {108} {48}"/></g>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="4.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {110} {64} C {120} {52} {126} {50} {130} {52}"/>
  <circle cx="{cx}" cy="{cy+2}" r="6" fill="#020617" stroke="#ffffff" stroke-width="1.5"/>"""


def t10(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {96+o%6} {44} C {120} {32} {152} {40} {168} {56} C {176} {68} {168} {82} {148} {82} C {128} {82} {108} {72} {104} {56} C {100} {46} {108} {38} {118} {40}"/>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {164} {44} C {140} {32} {108} {40} {92} {56} C {84} {68} {92} {82} {112} {82} C {132} {82} {152} {72} {156} {56} C {160} {46} {152} {38} {142}"/>
  <circle cx="{cx}" cy="{cy+4}" r="3.8" fill="#ffffff" stroke="#020617" stroke-width="1"/>"""


def t11(p, n, o, cx, cy):
    return f"""  <ellipse cx="{cx}" cy="{cy}" rx="100" ry="52" fill="url(#{p}_g)"/>
  <path fill="none" stroke="#7FDBFF" stroke-width="1.4" opacity="0.5" d="M {130} {38+o%3} L {106+o%5} {76} L {154} {76} Z"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="3.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {128} {42} L {96} {52}"/>
  <path fill="none" stroke="url(#{p}_bb2)" stroke-width="3.5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {132} {42} L {164} {52}"/>
  <path fill="none" stroke="url(#{p}_bb)" stroke-width="5" stroke-linecap="round" filter="url(#{p}_gl)" d="M {100+n%6} {72} C {116} {64} {124} {60} {130} {60} C {142} {62} {156} {68} {166} {74}"/>
  <circle cx="{cx}" cy="{cy}" r="4" fill="#020617" stroke="#FDA4D0" stroke-width="1.2"/>"""


TEMPLATES = [t0, t1, t2, t3_fix, t4, t5, t6, t7, t8, t9, t10, t11]

SLUGS = [
    "neural-flow", "quantum-weave", "vector-hub", "delta-stream", "phi-orbit", "sigma-lattice",
    "lambda-braid", "kappa-mesh", "tau-pulse", "omega-shell", "zenith-arc", "apex-weft",
    "signal-stack", "echo-braid", "phase-lock", "resonance-net", "harmonic-hub", "cadence-loop",
    "tempo-spiral", "metric-weave", "radix-fork", "vertex-handoff", "planar-fuse", "tensor-ring",
    "scalar-field", "matrix-path", "cascade-sync", "ripple-orbit", "tide-braid", "surge-hub",
    "flux-ring", "spark-mesh", "arc-fusion", "bolt-weave", "ion-trail", "photon-split",
    "quark-pair", "gluon-web", "hadron-loop", "lepton-path", "boson-ray", "fermion-net",
    "plasma-weft", "stellar-hub", "comet-tail", "aurora-braid", "nebula-net", "eclipse-ring",
    "solstice-arc", "equinox-weave",
]


def main() -> None:
    assert len(SLUGS) == 50
    os.makedirs(OUT, exist_ok=True)
    for i, slug in enumerate(SLUGS):
        prefix = f"z{i:02d}"
        title = "Helix - " + slug.replace("-", " ")
        body = body_template(prefix, i)
        fd = FOOTER_DARK % {"p": prefix}
        dark = svg_wrap(prefix + "_t", title + " (dark UI)", DEFS_DARK % {"p": prefix}, body, fd)
        light = svg_wrap(
            prefix + "l_t", title + " (light UI)", DEFS_LIGHT % {"p": prefix}, body, fd
        )
        with open(os.path.join(OUT, f"helix-logo-variant-{slug}.svg"), "w", encoding="utf-8") as f:
            f.write(dark)
        with open(os.path.join(OUT, f"helix-logo-variant-{slug}-light.svg"), "w", encoding="utf-8") as f:
            f.write(light)
    print("Wrote 100 files for 50 slugs in", OUT)


if __name__ == "__main__":
    main()
