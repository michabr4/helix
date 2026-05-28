#!/usr/bin/env python3
"""One-off generator: 24 agentic/CX Helix logo pairs (dark + light wordmark)."""
from __future__ import annotations

import os

OUT = os.path.join(
    os.path.dirname(__file__),
    "..",
    "assets",
)

# Shared tail: Helix wordmark + swoosh (prefix for ids)
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


def svg_wrap(
    title_id: str,
    title: str,
    prefix: str,
    defs_block: str,
    body: str,
    footer: str,
) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 176" role="img" aria-labelledby="{title_id}">
  <title id="{title_id}">{title}</title>
  <defs>
{defs_block}
  </defs>
{body}
{footer}
"""


VARIANTS: list[tuple[str, str, str, str]] = [
    (
        "orchestration-fabric",
        "orf",
        "Helix - orchestration fabric",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#orf_g)"/>
  <g fill="none" stroke-linecap="round" opacity="0.35" stroke="#049FD9" stroke-width="1.2">
    <path d="M 70 40 H 190 M 70 56 H 190 M 70 72 H 190 M 86 32 V 80 M 114 32 V 80 M 146 32 V 80 M 174 32 V 80"/>
  </g>
  <path fill="none" stroke="url(#orf_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#orf_gl)" d="M 84 34 C 108 52 124 58 130 60 C 150 54 172 38 188 34"/>
  <path fill="none" stroke="url(#orf_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#orf_gl)" d="M 176 78 C 152 62 134 52 130 50 C 116 58 92 78 72 84"/>
  <circle cx="130" cy="56" r="8" fill="#020617" stroke="url(#orf_bb)" stroke-width="2"/><circle cx="130" cy="56" r="3.5" fill="#ffffff"/>""",
    ),
    (
        "context-thread",
        "ctx",
        "Helix - context thread",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#ctx_g)"/>
  <path fill="none" stroke="#64748b" stroke-width="1.4" stroke-dasharray="4 6" stroke-linecap="round" d="M 130 30 V 82"/>
  <path fill="none" stroke="url(#ctx_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#ctx_gl)" d="M 96 38 C 114 54 118 60 130 56 C 144 52 158 40 172 34"/>
  <path fill="none" stroke="url(#ctx_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#ctx_gl)" d="M 164 78 C 146 64 138 56 130 54 C 118 58 98 72 88 78"/>
  <circle cx="130" cy="56" r="6" fill="#020617" stroke="#7FDBFF" stroke-width="1.8"/>""",
    ),
    (
        "policy-guardrail",
        "pog",
        "Helix - policy guardrail",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#pog_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="2" stroke-linecap="round" opacity="0.45" d="M 78 48 A 52 52 0 0 1 182 48"/>
  <path fill="none" stroke="url(#pog_bb2)" stroke-width="5" stroke-linecap="round" filter="url(#pog_gl)" d="M 88 64 C 102 52 118 46 130 50 C 154 58 168 76 176 84"/>
  <path fill="none" stroke="url(#pog_bb)" stroke-width="5" stroke-linecap="round" filter="url(#pog_gl)" d="M 172 64 C 158 54 142 50 130 48 C 108 52 92 66 84 74"/>
  <circle cx="130" cy="52" r="5" fill="#ffffff" stroke="#020617" stroke-width="1.2"/>""",
    ),
    (
        "telemetry-aura",
        "tla",
        "Helix - telemetry aura",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#tla_g)"/>
  <circle cx="130" cy="56" r="36" fill="none" stroke="#049FD9" stroke-width="1" opacity="0.35"/>
  <circle cx="130" cy="56" r="24" fill="none" stroke="#FF1B8D" stroke-width="1" opacity="0.35"/>
  <circle cx="130" cy="56" r="12" fill="none" stroke="#7FDBFF" stroke-width="1.2" opacity="0.5"/>
  <path fill="none" stroke="url(#tla_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#tla_gl)" d="M 86 44 C 108 32 124 34 130 44 C 138 58 148 72 168 78"/>
  <path fill="none" stroke="url(#tla_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#tla_gl)" d="M 174 44 C 152 36 138 38 130 44 C 120 54 104 70 92 78"/>
  <circle cx="130" cy="56" r="4.5" fill="#020617" stroke="#ffffff" stroke-width="1"/>""",
    ),
    (
        "journey-weft",
        "jwf",
        "Helix - journey weft",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#jwf_g)"/>
  <g stroke="#94a3b8" stroke-width="1" opacity="0.35">
    <line x1="72" y1="42" x2="188" y2="42"/><line x1="72" y1="54" x2="188" y2="54"/><line x1="72" y1="66" x2="188" y2="66"/><line x1="72" y1="78" x2="188" y2="78"/>
  </g>
  <path fill="none" stroke="url(#jwf_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#jwf_gl)" d="M 82 36 C 104 50 118 62 130 68 C 148 58 166 40 178 32"/>
  <path fill="none" stroke="url(#jwf_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#jwf_gl)" d="M 178 80 C 156 70 140 58 130 48 C 116 58 100 72 82 80"/>
  <circle cx="130" cy="58" r="5" fill="#020617" stroke="url(#jwf_bb2)" stroke-width="1.5"/>""",
    ),
    (
        "handshake-protocol",
        "hsp",
        "Helix - handshake protocol",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#hsp_g)"/>
  <path fill="none" stroke="url(#hsp_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#hsp_gl)" d="M 76 72 C 96 44 112 40 124 52"/>
  <path fill="none" stroke="url(#hsp_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#hsp_gl)" d="M 184 72 C 164 44 148 40 136 52"/>
  <path fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.35" d="M 124 52 L 136 52"/>
  <circle cx="118" cy="58" r="4" fill="#020617" stroke="#049FD9" stroke-width="1.4"/>
  <circle cx="142" cy="58" r="4" fill="#020617" stroke="#FF1B8D" stroke-width="1.4"/>""",
    ),
    (
        "cognitive-mesh",
        "cgm",
        "Helix - cognitive mesh",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#cgm_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="1.2" opacity="0.4" d="M 130 40 L 98 72 L 162 72 Z"/>
  <path fill="none" stroke="url(#cgm_bb2)" stroke-width="5" stroke-linecap="round" filter="url(#cgm_gl)" d="M 108 38 C 124 52 130 58 130 62 C 130 52 138 44 154 38"/>
  <path fill="none" stroke="url(#cgm_bb)" stroke-width="5" stroke-linecap="round" filter="url(#cgm_gl)" d="M 96 78 C 114 68 124 62 130 58 C 142 66 158 76 170 82"/>
  <circle cx="130" cy="54" r="5.5" fill="#020617" stroke="url(#cgm_bb)" stroke-width="1.8"/>""",
    ),
    (
        "intent-router",
        "itr",
        "Helix - intent router",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#itr_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="1.4" opacity="0.45" stroke-linecap="round" d="M 130 56 L 94 38 M 130 56 L 166 38 M 130 56 L 88 74 M 130 56 L 172 74"/>
  <circle cx="94" cy="38" r="3.2" fill="#005C8C"/><circle cx="166" cy="38" r="3.2" fill="#FF1B8D"/><circle cx="88" cy="74" r="3" fill="#7FDBFF"/><circle cx="172" cy="74" r="3" fill="#FDA4D0"/>
  <path fill="none" stroke="url(#itr_bb2)" stroke-width="5" stroke-linecap="round" filter="url(#itr_gl)" d="M 108 84 C 118 64 126 56 130 52"/>
  <path fill="none" stroke="url(#itr_bb)" stroke-width="5" stroke-linecap="round" filter="url(#itr_gl)" d="M 152 84 C 142 64 134 56 130 52"/>
  <circle cx="130" cy="52" r="7" fill="#020617" stroke="#ffffff" stroke-width="1.5"/>""",
    ),
    (
        "memory-lattice",
        "mml",
        "Helix - memory lattice",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#mml_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="1" opacity="0.35" d="M 102 42 L 130 32 L 158 42 L 158 70 L 130 80 L 102 70 Z"/>
  <path fill="none" stroke="#FF1B8D" stroke-width="1" opacity="0.3" d="M 130 32 L 130 80 M 102 42 L 158 70 M 158 42 L 102 70"/>
  <path fill="none" stroke="url(#mml_bb2)" stroke-width="5" stroke-linecap="round" filter="url(#mml_gl)" d="M 88 48 C 106 40 122 42 130 52"/>
  <path fill="none" stroke="url(#mml_bb)" stroke-width="5" stroke-linecap="round" filter="url(#mml_gl)" d="M 172 64 C 154 72 138 70 130 58"/>
  <circle cx="130" cy="56" r="5" fill="#ffffff" stroke="#020617" stroke-width="1.2"/>""",
    ),
    (
        "frontier-loop",
        "frl",
        "Helix - frontier loop",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#frl_g)"/>
  <path fill="none" stroke="url(#frl_bb)" stroke-width="6" stroke-linecap="round" filter="url(#frl_gl)" d="M 104 36 C 72 52 72 72 104 80 C 130 86 146 74 156 60"/>
  <path fill="none" stroke="url(#frl_bb2)" stroke-width="6" stroke-linecap="round" filter="url(#frl_gl)" d="M 156 36 C 188 52 188 72 156 80 C 130 86 114 74 104 60"/>
  <circle cx="130" cy="58" r="4.5" fill="#020617" stroke="#ffffff" stroke-width="1"/>""",
    ),
    (
        "bridge-plane",
        "bpl",
        "Helix - bridge plane",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#bpl_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="2" stroke-linecap="round" opacity="0.4" d="M 92 38 V 78 M 168 38 V 78"/>
  <path fill="none" stroke="url(#bpl_bb2)" stroke-width="4.5" stroke-linecap="round" filter="url(#bpl_gl)" d="M 96 42 H 164"/>
  <path fill="none" stroke="url(#bpl_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#bpl_gl)" d="M 118 82 C 124 64 128 52 130 46 C 134 58 140 72 146 82"/>
  <circle cx="130" cy="46" r="5" fill="#020617" stroke="url(#bpl_bb2)" stroke-width="1.6"/>""",
    ),
    (
        "sentinel-ring",
        "snr",
        "Helix - sentinel ring",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#snr_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="1.5" stroke-linecap="round" opacity="0.45" d="M 130 34 L 152 46 L 152 66 L 130 78 L 108 66 L 108 46 Z"/>
  <path fill="none" stroke="url(#snr_bb2)" stroke-width="4.5" stroke-linecap="round" filter="url(#snr_gl)" d="M 116 40 C 132 46 140 54 140 62"/>
  <path fill="none" stroke="url(#snr_bb)" stroke-width="4.5" stroke-linecap="round" filter="url(#snr_gl)" d="M 144 40 C 128 46 120 54 120 62"/>
  <circle cx="130" cy="62" r="5" fill="#ffffff" stroke="#020617" stroke-width="1.2"/>""",
    ),
    (
        "pulse-orchestra",
        "pso",
        "Helix - pulse orchestra",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#pso_g)"/>
  <g stroke-linecap="round">
    <path stroke="#049FD9" stroke-width="3" fill="none" d="M 96 72 V 48"/><path stroke="#049FD9" stroke-width="3" fill="none" opacity="0.7" d="M 114 72 V 40"/><path stroke="#FF1B8D" stroke-width="3" fill="none" d="M 132 72 V 44"/><path stroke="#FF1B8D" stroke-width="3" fill="none" opacity="0.7" d="M 150 72 V 36"/><path stroke="#7FDBFF" stroke-width="3" fill="none" d="M 168 72 V 50"/>
  </g>
  <path fill="none" stroke="url(#pso_bb)" stroke-width="3" stroke-linecap="round" filter="url(#pso_gl)" d="M 92 76 C 110 68 150 68 168 76"/>
  <path fill="none" stroke="url(#pso_bb2)" stroke-width="4" stroke-linecap="round" filter="url(#pso_gl)" d="M 88 58 C 118 54 142 54 172 58"/>""",
    ),
    (
        "convergence-nexus",
        "cnx",
        "Helix - convergence nexus",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#cnx_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="1.3" stroke-linecap="round" opacity="0.5" d="M 130 56 L 96 36"/><path fill="none" stroke="#049FD9" stroke-width="1.3" stroke-linecap="round" opacity="0.5" d="M 130 56 L 164 36"/><path fill="none" stroke="#FF1B8D" stroke-width="1.3" stroke-linecap="round" opacity="0.5" d="M 130 56 L 92 74"/><path fill="none" stroke="#FF1B8D" stroke-width="1.3" stroke-linecap="round" opacity="0.5" d="M 130 56 L 168 74"/>
  <path fill="none" stroke="url(#cnx_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#cnx_gl)" d="M 98 40 C 112 48 122 54 128 56"/>
  <path fill="none" stroke="url(#cnx_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#cnx_gl)" d="M 162 40 C 148 48 138 54 132 56"/>
  <circle cx="130" cy="56" r="8" fill="#020617" stroke="url(#cnx_bb)" stroke-width="2"/><circle cx="130" cy="56" r="3" fill="#ffffff"/>""",
    ),
    (
        "adaptive-lane",
        "adl",
        "Helix - adaptive lane",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#adl_g)"/>
  <path fill="none" stroke="url(#adl_bb)" stroke-width="4" stroke-linecap="round" opacity="0.85" filter="url(#adl_gl)" d="M 78 68 C 98 48 118 42 130 50 C 146 62 162 72 182 68"/>
  <path fill="none" stroke="#64748b" stroke-width="1.2" stroke-dasharray="5 5" stroke-linecap="round" opacity="0.35" d="M 80 56 C 102 38 124 38 130 48 C 142 62 158 68 180 56"/>
  <path fill="none" stroke="url(#adl_bb2)" stroke-width="4.5" stroke-linecap="round" filter="url(#adl_gl)" d="M 182 44 C 162 52 142 50 130 44 C 110 36 94 40 78 48"/>
  <circle cx="130" cy="50" r="4.5" fill="#ffffff" stroke="#020617" stroke-width="1.1"/>""",
    ),
    (
        "signal-braid",
        "sgb",
        "Helix - signal braid",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#sgb_g)"/>
  <path fill="none" stroke="url(#sgb_bb)" stroke-width="4" stroke-linecap="round" filter="url(#sgb_gl)" d="M 88 36 C 108 48 118 58 126 66 C 138 54 154 42 172 36"/>
  <path fill="none" stroke="url(#sgb_bb2)" stroke-width="4" stroke-linecap="round" filter="url(#sgb_gl)" d="M 172 76 C 152 64 140 54 132 46 C 118 58 104 70 88 76"/>
  <path fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="0.4" d="M 100 44 C 120 56 132 56 130 56 C 128 56 140 56 160 44"/>
  <circle cx="130" cy="56" r="3.5" fill="#020617" stroke="#7FDBFF" stroke-width="1.2"/>""",
    ),
    (
        "horizon-arc",
        "hza",
        "Helix - horizon arc",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#hza_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="2" stroke-linecap="round" opacity="0.4" d="M 72 80 Q 130 52 188 80"/>
  <path fill="none" stroke="url(#hza_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#hza_gl)" d="M 90 50 C 110 38 124 36 134 44 C 148 56 158 70 170 72"/>
  <path fill="none" stroke="url(#hza_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#hza_gl)" d="M 170 42 C 150 50 138 52 130 50 C 118 48 102 50 90 58"/>
  <circle cx="130" cy="46" r="5" fill="#FDA4D0" stroke="#020617" stroke-width="1"/>""",
    ),
    (
        "lattice-handoff",
        "lth",
        "Helix - lattice handoff",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#lth_g)"/>
  <g stroke="#64748b" stroke-width="1" opacity="0.4" fill="none">
    <path d="M 92 40 H 168 M 92 56 H 168 M 92 72 H 168 M 112 34 V 78 M 148 34 V 78"/>
  </g>
  <path fill="none" stroke="url(#lth_bb)" stroke-width="4" stroke-linecap="round" filter="url(#lth_gl)" d="M 104 48 C 118 56 124 58 128 58"/>
  <path fill="none" stroke="url(#lth_bb2)" stroke-width="4" stroke-linecap="round" filter="url(#lth_gl)" d="M 156 48 C 142 56 136 58 132 58"/>
  <circle cx="128" cy="58" r="3.5" fill="#049FD9"/><circle cx="132" cy="58" r="3.5" fill="#FF1B8D"/>""",
    ),
    (
        "empathy-weave",
        "emw",
        "Helix - empathy weave",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#emw_g)"/>
  <path fill="none" stroke="url(#emw_bb2)" stroke-width="5" stroke-linecap="round" filter="url(#emw_gl)" d="M 100 70 C 104 44 118 36 130 42 C 142 36 156 44 160 70"/>
  <path fill="none" stroke="url(#emw_bb)" stroke-width="5" stroke-linecap="round" filter="url(#emw_gl)" d="M 94 52 C 108 62 122 66 130 64 C 138 66 152 62 166 52"/>
  <path fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity="0.35" d="M 118 52 Q 130 58 142 52"/>""",
    ),
    (
        "catalyst-hub",
        "cth",
        "Helix - catalyst hub",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#cth_g)"/>
  <g stroke-linecap="round" stroke="#049FD9" stroke-width="1.3" opacity="0.45">
    <path d="M 130 56 L 130 32"/><path d="M 130 56 L 154 44"/><path d="M 130 56 L 154 68"/><path d="M 130 56 L 130 80"/><path d="M 130 56 L 106 68"/><path d="M 130 56 L 106 44"/>
  </g>
  <path fill="none" stroke="url(#cth_bb2)" stroke-width="5" stroke-linecap="round" filter="url(#cth_gl)" d="M 108 64 C 118 52 124 48 130 50 C 142 54 150 62 154 70"/>
  <path fill="none" stroke="url(#cth_bb)" stroke-width="5" stroke-linecap="round" filter="url(#cth_gl)" d="M 152 46 C 142 50 134 52 130 52 C 118 52 108 46 106 42"/>
  <circle cx="130" cy="54" r="6" fill="#020617" stroke="#ffffff" stroke-width="1.5"/>""",
    ),
    (
        "continuum-agent",
        "cag",
        "Helix - continuum agent",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#cag_g)"/>
  <path fill="none" stroke="url(#cag_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#cag_gl)" d="M 96 44 C 120 32 152 40 168 56 C 178 70 168 84 148 84 C 128 84 108 72 104 56 C 100 44 108 36 120 38"/>
  <path fill="none" stroke="url(#cag_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#cag_gl)" d="M 164 44 C 140 32 108 40 92 56 C 82 70 92 84 112 84 C 132 84 152 72 156 56 C 160 44 152 36 140 38"/>
  <circle cx="130" cy="58" r="3.8" fill="#ffffff" stroke="#020617" stroke-width="1"/>""",
    ),
    (
        "prism-split",
        "prm",
        "Helix - prism split",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#prm_g)"/>
  <path fill="none" stroke="#7FDBFF" stroke-width="1.5" opacity="0.5" d="M 130 40 L 108 78 L 152 78 Z"/>
  <path fill="none" stroke="url(#prm_bb)" stroke-width="3.5" stroke-linecap="round" filter="url(#prm_gl)" d="M 128 42 L 98 52"/>
  <path fill="none" stroke="url(#prm_bb2)" stroke-width="3.5" stroke-linecap="round" filter="url(#prm_gl)" d="M 132 42 L 162 52"/>
  <path fill="none" stroke="url(#prm_bb)" stroke-width="5" stroke-linecap="round" filter="url(#prm_gl)" d="M 102 72 C 116 64 124 60 130 60 C 142 62 156 68 166 74"/>
  <circle cx="130" cy="56" r="4" fill="#020617" stroke="#FDA4D0" stroke-width="1.2"/>""",
    ),
    (
        "anchor-trust",
        "ant",
        "Helix - anchor trust",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#ant_g)"/>
  <path fill="none" stroke="#049FD9" stroke-width="2" stroke-linecap="round" opacity="0.45" d="M 98 48 H 162 V 64 H 150 V 78 H 110 V 64 H 98 Z"/>
  <path fill="none" stroke="url(#ant_bb2)" stroke-width="5.5" stroke-linecap="round" filter="url(#ant_gl)" d="M 114 34 C 126 46 132 54 132 60"/>
  <path fill="none" stroke="url(#ant_bb)" stroke-width="5.5" stroke-linecap="round" filter="url(#ant_gl)" d="M 146 34 C 134 46 128 54 128 60"/>
  <circle cx="130" cy="40" r="4" fill="#020617" stroke="#7FDBFF" stroke-width="1.3"/>""",
    ),
    (
        "synapse-grid",
        "syg",
        "Helix - synapse grid",
        """  <ellipse cx="130" cy="56" rx="100" ry="52" fill="url(#syg_g)"/>
  <g stroke="#049FD9" stroke-width="1.3" stroke-linecap="round" opacity="0.45" fill="none">
    <path d="M 98 44 H 122 V 62 H 98 Z M 138 44 H 162 V 62 H 138 Z M 106 66 H 154 M 130 44 V 78"/>
  </g>
  <circle cx="98" cy="44" r="3" fill="#005C8C"/><circle cx="162" cy="44" r="3" fill="#FF1B8D"/><circle cx="98" cy="62" r="2.8" fill="#7FDBFF"/><circle cx="162" cy="62" r="2.8" fill="#FDA4D0"/><circle cx="130" cy="76" r="3.2" fill="#020617" stroke="#ffffff" stroke-width="1"/>
  <path fill="none" stroke="url(#syg_bb2)" stroke-width="4.5" stroke-linecap="round" filter="url(#syg_gl)" d="M 106 50 C 118 56 124 58 130 58"/>
  <path fill="none" stroke="url(#syg_bb)" stroke-width="4.5" stroke-linecap="round" filter="url(#syg_gl)" d="M 154 50 C 142 56 136 58 130 58"/>""",
    ),
]


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for slug, prefix, title, body in VARIANTS:
        # Dark
        dark_defs = DEFS_DARK % {"p": prefix}
        fd = FOOTER_DARK % {"p": prefix}
        tslug = prefix + "_t"
        out_dark = svg_wrap(tslug, title + " (dark UI)", prefix, dark_defs, body, fd)
        path_dark = os.path.join(OUT, f"helix-logo-variant-{slug}.svg")
        with open(path_dark, "w", encoding="utf-8") as f:
            f.write(out_dark)
        # Light: same body but defs use light wm/sh; title id unique
        light_defs = DEFS_LIGHT % {"p": prefix}
        title_light = title + " (light UI)"
        tslug_l = prefix + "l_t"
        fl = FOOTER_DARK % {"p": prefix}
        out_light = svg_wrap(tslug_l, title_light, prefix, light_defs, body, fl)
        path_light = os.path.join(OUT, f"helix-logo-variant-{slug}-light.svg")
        with open(path_light, "w", encoding="utf-8") as f:
            f.write(out_light)
    print("Wrote", len(VARIANTS) * 2, "files to", OUT)


if __name__ == "__main__":
    main()
