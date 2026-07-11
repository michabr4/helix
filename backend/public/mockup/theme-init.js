/* Helix — mockup hub pre-paint init (theme, contrast, pane widths, text scale).
   Runs as a blocking <script src> (not defer) so it applies before first paint,
   with no inline script needed — keeps CSP to script-src 'self'. */
(function () {
  /* Theme + contrast before first paint (contrast stacks with light/dark tokens). */
  (function () {
    try {
      const k = "helix-mockup-theme";
      const s = localStorage.getItem(k);
      if (s === "light" || s === "dark") {
        document.documentElement.setAttribute("data-theme", s);
        document.documentElement.style.colorScheme = s;
      } else if (s === "daylight") {
        try {
          const snap = JSON.parse(localStorage.getItem("helix-mockup-daylight-snapshot"));
          const today = new Date().toISOString().slice(0, 10);
          const dh =
            snap && snap.day === today && (snap.theme === "light" || snap.theme === "dark")
              ? snap.theme
              : new Date().getHours() >= 7 && new Date().getHours() < 19
                ? "light"
                : "dark";
          document.documentElement.setAttribute("data-theme", dh);
          document.documentElement.style.colorScheme = dh;
        } catch (err2) {
          document.documentElement.setAttribute("data-theme", "dark");
          document.documentElement.style.colorScheme = "dark";
        }
      }
      const c = localStorage.getItem("helix-mockup-contrast");
      if (c === "soft" || c === "high") document.documentElement.setAttribute("data-contrast", c);
    } catch (err) {}
  })();
  /* UA widgets + readability: align with system when theme not forced (pairs with prefers-color-scheme tokens). */
  (function () {
    try {
      const k = "helix-mockup-theme";
      const s = localStorage.getItem(k);
      if (s !== "light" && s !== "dark" && s !== "daylight") {
        document.documentElement.style.colorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
    } catch (e) {}
  })();
  /* Saved pane widths (3-column desktop layout) — applied before paint. */
  (function () {
    try {
      const sw = localStorage.getItem("helix-mockup-sidebar-w");
      const aw = localStorage.getItem("helix-mockup-ai-pane-w");
      if (sw && /^\d+$/.test(sw)) document.documentElement.style.setProperty("--sidebar-w", sw + "px");
      if (aw && /^\d+$/.test(aw)) document.documentElement.style.setProperty("--ai-pane-w", aw + "px");
    } catch (e) {}
  })();
  /* Left nav section spacing scale (labels, gaps, tab padding) — all views. */
  (function () {
    try {
      const s = localStorage.getItem("helix-mockup-nav-break-scale");
      if (!s || !/^[\d.]+$/.test(s)) return;
      const v = parseFloat(s, 10);
      if (v >= 0.6 && v <= 1.7) document.documentElement.style.setProperty("--nav-break-scale", String(v));
    } catch (e) {}
  })();
  /* Readability: text scale + optional reduce motion (WCAG 2.1 — reflow / motion). */
  (function () {
    try {
      const ts = localStorage.getItem("helix-mockup-text-scale");
      if (ts === "0.9" || ts === "1" || ts === "1.15" || ts === "1.3") {
        document.documentElement.style.setProperty("--text-scale", ts);
      }
      const rm = localStorage.getItem("helix-mockup-reduced-motion");
      if (rm === "1") document.documentElement.setAttribute("data-a11y-reduced-motion", "1");
      const bl = localStorage.getItem("helix-mockup-bluelight");
      if (bl === "low" || bl === "medium" || bl === "high") document.documentElement.setAttribute("data-bluelight", bl);
    } catch (e) {}
  })();
})();
