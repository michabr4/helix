/* Helix — mockup hub (external file: CSP-safe when served with Helmet) */
(function () {
  var THEME_KEY = "helix-mockup-theme";
  var DAYLIGHT_SNAPSHOT_KEY = "helix-mockup-daylight-snapshot";
  var CONTRAST_KEY = "helix-mockup-contrast";
  var TEXT_SCALE_KEY = "helix-mockup-text-scale";
  var REDUCED_MOTION_UI_KEY = "helix-mockup-reduced-motion";
  var BLUELIGHT_KEY = "helix-mockup-bluelight";
  var _daylightGeoTimer = null;

  function setAppStatusMessage(msg) {
    var el = document.getElementById("app-status-message");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    window.clearTimeout(setAppStatusMessage._t);
    setAppStatusMessage._t = window.setTimeout(function () {
      el.classList.remove("is-visible");
      el.textContent = "";
    }, 8000);
  }

  function getThemePreference() {
    var s = localStorage.getItem(THEME_KEY);
    if (s === "light" || s === "dark") return s;
    if (s === "daylight") return "daylight";
    return "system";
  }

  function resolveDaylightThemeSync() {
    try {
      var snap = JSON.parse(localStorage.getItem(DAYLIGHT_SNAPSHOT_KEY));
      var today = new Date().toISOString().slice(0, 10);
      if (snap && snap.day === today && (snap.theme === "light" || snap.theme === "dark")) return snap.theme;
    } catch (e) {}
    var h = new Date().getHours();
    return h >= 7 && h < 19 ? "light" : "dark";
  }

  function applyDaylightSnapshot(theme) {
    try {
      localStorage.setItem(
        DAYLIGHT_SNAPSHOT_KEY,
        JSON.stringify({ theme: theme, day: new Date().toISOString().slice(0, 10) })
      );
    } catch (e) {}
  }

  function clearDaylightSchedule() {
    if (_daylightGeoTimer != null) {
      window.clearInterval(_daylightGeoTimer);
      _daylightGeoTimer = null;
    }
  }

  function scheduleDaylightRefresh() {
    clearDaylightSchedule();
    if (getThemePreference() !== "daylight") return;
    _daylightGeoTimer = window.setInterval(function () {
      if (getThemePreference() === "daylight") refreshDaylightThemeFromGeo();
      else clearDaylightSchedule();
    }, 30 * 60 * 1000);
  }

  function pad2(n) {
    return String(n).length < 2 ? "0" + n : String(n);
  }

  function refreshDaylightThemeFromGeo() {
    if (getThemePreference() !== "daylight") return;
    if (!navigator.geolocation) {
      var fb = resolveDaylightThemeSync();
      applyDaylightSnapshot(fb);
      applyDocumentTheme("daylight");
      syncThemeSwitchPanel();
      syncBrandLogoForTheme();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var d = new Date();
        var q = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
        var url =
          "https://api.sunrise-sunset.org/json?lat=" +
          encodeURIComponent(lat) +
          "&lng=" +
          encodeURIComponent(lng) +
          "&date=" +
          q +
          "&formatted=0";
        window
          .fetch(url)
          .then(function (r) {
            return r.json();
          })
          .then(function (data) {
            if (!data || data.status !== "OK" || !data.results) throw new Error("sun_api");
            var rise = new Date(data.results.sunrise).getTime();
            var set = new Date(data.results.sunset).getTime();
            var now = Date.now();
            var th;
            if (!(rise < set) || rise !== rise || set !== set) {
              var hh = new Date().getHours();
              th = hh >= 7 && hh < 19 ? "light" : "dark";
            } else {
              th = now >= rise && now < set ? "light" : "dark";
            }
            applyDaylightSnapshot(th);
            if (getThemePreference() === "daylight") {
              applyDocumentTheme("daylight");
              syncThemeSwitchPanel();
              syncBrandLogoForTheme();
            }
          })
          .catch(function () {
            var h = new Date().getHours();
            var fb = h >= 7 && h < 19 ? "light" : "dark";
            applyDaylightSnapshot(fb);
            if (getThemePreference() === "daylight") {
              applyDocumentTheme("daylight");
              syncThemeSwitchPanel();
              syncBrandLogoForTheme();
            }
          });
      },
      function () {
        var h = new Date().getHours();
        var fb = h >= 7 && h < 19 ? "light" : "dark";
        applyDaylightSnapshot(fb);
        if (getThemePreference() === "daylight") {
          applyDocumentTheme("daylight");
          syncThemeSwitchPanel();
          syncBrandLogoForTheme();
        }
      },
      { timeout: 12000, maximumAge: 3600000, enableHighAccuracy: false }
    );
  }

  function applyDocumentTheme(pref) {
    var root = document.documentElement;
    if (pref === "light") {
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    } else if (pref === "dark") {
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else if (pref === "daylight") {
      var dl = resolveDaylightThemeSync();
      root.setAttribute("data-theme", dl);
      root.style.colorScheme = dl;
    } else {
      root.removeAttribute("data-theme");
      root.style.colorScheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
  }

  function isLightUiTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "light") return true;
    if (t === "dark") return false;
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  }

  function syncBrandLogoForTheme() {
    var img = document.querySelector(".brand-logo[data-src-light]");
    if (!img) return;
    var darkSrc = img.getAttribute("data-src-dark");
    var lightSrc = img.getAttribute("data-src-light");
    if (!darkSrc || !lightSrc) return;
    var next = isLightUiTheme() ? lightSrc : darkSrc;
    if (img.getAttribute("src") !== next) img.setAttribute("src", next);
  }

  function isEffectiveDarkTheme() {
    return !isLightUiTheme();
  }

  function syncThemeButtons() {
    var pref = getThemePreference();
    if (pref === "system") applyDocumentTheme(null);
    else applyDocumentTheme(pref);
    document.querySelectorAll(".theme-btn[data-theme-pref]").forEach(function (btn) {
      var choice = btn.getAttribute("data-theme-pref");
      btn.setAttribute("aria-pressed", choice === pref ? "true" : "false");
    });
    syncThemeSwitchPanel();
    syncBrandLogoForTheme();
    if (pref === "daylight") scheduleDaylightRefresh();
    else clearDaylightSchedule();
  }

  /** Hub topbar: accessible switch + “match system” checkbox */
  function syncThemeSwitchPanel() {
    var cb = document.getElementById("theme-follow-system");
    var dayCb = document.getElementById("theme-daylight-location");
    var sw = document.getElementById("theme-dark-switch");
    if (!cb || !sw) return;

    var pref = getThemePreference();
    var followSys = pref === "system";
    var followDay = pref === "daylight";
    cb.checked = followSys;
    if (dayCb) dayCb.checked = followDay;

    if (followSys || followDay) {
      sw.disabled = true;
      sw.setAttribute("aria-checked", isEffectiveDarkTheme() ? "true" : "false");
      sw.setAttribute("aria-disabled", "true");
    } else {
      sw.disabled = false;
      sw.setAttribute("aria-checked", pref === "dark" ? "true" : "false");
      sw.setAttribute("aria-disabled", "false");
    }
  }

  function announceThemeFromUser() {
    var live = document.getElementById("theme-announce");
    if (!live) return;
    var msg;
    if (getThemePreference() === "system") {
      msg =
        "Using system color theme. Current appearance is " +
        (isEffectiveDarkTheme() ? "dark" : "light") +
        " mode.";
    } else if (getThemePreference() === "daylight") {
      msg =
        "Using daylight at your location. Current appearance is " +
        (isEffectiveDarkTheme() ? "dark" : "light") +
        " mode.";
    } else {
      msg = getThemePreference() === "dark" ? "Dark mode on." : "Light mode on.";
    }
    live.textContent = "";
    window.setTimeout(function () {
      live.textContent = msg;
    }, 50);
  }

  function getContrastPreference() {
    var c = localStorage.getItem(CONTRAST_KEY);
    if (c === "soft" || c === "high") return c;
    return "standard";
  }

  function applyContrastPreference(pref) {
    var root = document.documentElement;
    if (pref === "standard") root.removeAttribute("data-contrast");
    else root.setAttribute("data-contrast", pref);
  }

  function syncContrastButtons() {
    var pref = getContrastPreference();
    document.querySelectorAll(".contrast-btn[data-contrast-pref]").forEach(function (btn) {
      var p = btn.getAttribute("data-contrast-pref");
      btn.setAttribute("aria-pressed", p === pref ? "true" : "false");
    });
  }

  function announceContrastChange() {
    var live = document.getElementById("contrast-announce");
    if (!live) return;
    var pref = getContrastPreference();
    var msg =
      pref === "soft"
        ? "Contrast soft. Softer backgrounds and shadows."
        : pref === "high"
          ? "Contrast high. Stronger borders and text."
          : "Contrast standard.";
    live.textContent = "";
    window.setTimeout(function () {
      live.textContent = msg;
    }, 50);
  }

  var GEO_PLACE_KEY = "helix-mockup-geo-place-label-v2";
  var GEO_PLACE_TS_KEY = "helix-mockup-geo-place-ts-v2";

  /** U.S.: two-letter state from principalSubdivisionCode (e.g. US-NV → NV); else full subdivision name. */
  function geoStateDesignation(data) {
    if (!data) return "";
    var name = (data.principalSubdivision || data.majorSubdivision || "").trim();
    var code = data.principalSubdivisionCode || "";
    if (data.countryCode === "US" && code) {
      var i = code.lastIndexOf("-");
      if (i !== -1) {
        var tail = code.slice(i + 1).trim();
        if (tail.length === 2) return tail.toUpperCase();
      }
    }
    return name;
  }

  /**
   * City for display: incorporated / municipal name, not census-designated places or townships.
   * BigDataCloud often sets locality to a CDP (e.g. Paradise) while city is Las Vegas.
   */
  function geoCityNameForDisplay(data) {
    if (!data) return "";
    var c = (data.city && String(data.city).trim()) || "";
    if (c) return c;
    var adm = data.localityInfo && data.localityInfo.administrative;
    if (Array.isArray(adm)) {
      var i;
      for (i = 0; i < adm.length; i++) {
        var a = adm[i];
        if (!a || !a.name) continue;
        var desc = (a.description || "").toLowerCase();
        if (desc.indexOf("census-designated") !== -1) continue;
        if (desc.indexOf("township") !== -1) continue;
        if (a.adminLevel === 8) {
          return String(a.name).trim();
        }
      }
      for (i = adm.length - 1; i >= 0; i--) {
        var a2 = adm[i];
        if (!a2 || !a2.name) continue;
        var desc2 = (a2.description || "").toLowerCase();
        if (desc2.indexOf("census-designated") !== -1) continue;
        if (desc2.indexOf("township") !== -1) continue;
        if (desc2.indexOf("county") !== -1 && (a2.adminLevel === 6 || /county\b/.test(a2.name))) continue;
        if (a2.adminLevel === 4 || a2.adminLevel === 2) continue;
        if (desc2.indexOf("state of") !== -1 || desc2 === "country in north america") continue;
        return String(a2.name).trim();
      }
    }
    var v = (data.village && String(data.village).trim()) || "";
    if (v && !/\btownship\b/i.test(v)) return v;
    return "";
  }

  function geoPlaceLineFromReverseGeoClient(data) {
    var city = geoCityNameForDisplay(data);
    var st = geoStateDesignation(data);
    if (city && st) return city + ", " + st;
    return city || st || "";
  }

  /** Sidebar clock: 12 h local time; city, state from browser geolocation + reverse geocode (cached in session). */
  function initLocalTimeOfDay() {
    var el = document.getElementById("mockup-local-time");
    var placeEl = document.getElementById("mockup-local-place");
    var allowBtn = document.getElementById("mockup-local-geo-allow");
    if (!el) return;

    var permState = null;
    var geoSettled = false;

    function tick() {
      var d = new Date();
      el.textContent = d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
      el.setAttribute("datetime", d.toISOString());
    }

    function syncGeoAllowButton() {
      if (!allowBtn) return;
      if (!navigator.geolocation) {
        allowBtn.hidden = true;
        return;
      }
      var hasPlace = placeEl && placeEl.textContent && placeEl.textContent.trim().length > 0;
      if (hasPlace) {
        allowBtn.hidden = true;
        return;
      }
      if (!geoSettled && permState !== "denied") {
        allowBtn.hidden = true;
        return;
      }
      allowBtn.hidden = false;
      allowBtn.disabled = false;
      if (permState === "denied") {
        allowBtn.textContent = "Location blocked — allow in browser settings, then retry";
        allowBtn.classList.add("is-denied");
        allowBtn.title =
          "This site does not have location permission. Use your browser’s site settings to allow location, then tap again.";
      } else {
        allowBtn.textContent = "Allow location for city & state";
        allowBtn.classList.remove("is-denied");
        allowBtn.title =
          "Uses one approximate fix to reverse-geocode city and state (BigDataCloud). The clock works without this.";
      }
    }

    function applyPlaceLabel(text) {
      if (!placeEl) return;
      placeEl.textContent = text || "";
      placeEl.setAttribute(
        "title",
        text
          ? "Municipal city and state (U.S. two-letter where available) from approximate device location. CDPs and townships are not used as the city line. Not exact."
          : "Location requires geolocation permission."
      );
      syncGeoAllowButton();
    }

    function markGeoSettled() {
      geoSettled = true;
      syncGeoAllowButton();
    }

    function watchGeolocationPermission() {
      if (!navigator.permissions || !navigator.permissions.query) return;
      navigator.permissions
        .query({ name: "geolocation" })
        .then(function (r) {
          permState = r.state;
          if (permState === "denied") geoSettled = true;
          syncGeoAllowButton();
          r.addEventListener("change", function () {
            permState = r.state;
            if (permState === "denied") geoSettled = true;
            syncGeoAllowButton();
            if (permState === "granted") requestLocation(false);
          });
        })
        .catch(function () {});
    }

    function loadPlaceFromCache() {
      try {
        var t = parseInt(sessionStorage.getItem(GEO_PLACE_TS_KEY), 10);
        var lbl = sessionStorage.getItem(GEO_PLACE_KEY);
        if (lbl && t && Date.now() - t < 6 * 3600000) applyPlaceLabel(lbl);
      } catch (e) {}
    }

    function fetchPlaceFromGeo(lat, lng) {
      var url =
        "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
        encodeURIComponent(lat) +
        "&longitude=" +
        encodeURIComponent(lng) +
        "&localityLanguage=en";
      window
        .fetch(url)
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          var line = geoPlaceLineFromReverseGeoClient(data);
          if (line) {
            try {
              sessionStorage.setItem(GEO_PLACE_KEY, line);
              sessionStorage.setItem(GEO_PLACE_TS_KEY, String(Date.now()));
            } catch (e) {}
            applyPlaceLabel(line);
          }
        })
        .catch(function () {
          loadPlaceFromCache();
        })
        .then(function () {
          markGeoSettled();
        });
    }

    function requestLocation(fromUserGesture) {
      loadPlaceFromCache();
      if (!navigator.geolocation) {
        markGeoSettled();
        return;
      }
      if (allowBtn && fromUserGesture) allowBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          permState = "granted";
          fetchPlaceFromGeo(pos.coords.latitude, pos.coords.longitude);
          if (allowBtn) allowBtn.disabled = false;
        },
        function (err) {
          loadPlaceFromCache();
          if (err && err.code === 1) permState = "denied";
          markGeoSettled();
          if (allowBtn) allowBtn.disabled = false;
        },
        {
          timeout: fromUserGesture ? 20000 : 12000,
          maximumAge: fromUserGesture ? 0 : 600000,
          enableHighAccuracy: false
        }
      );
    }

    if (allowBtn) {
      allowBtn.addEventListener("click", function () {
        requestLocation(true);
      });
    }

    tick();
    window.setInterval(tick, 1000);
    watchGeolocationPermission();
    requestLocation(false);
  }

  function initTheme() {
    syncThemeButtons();
    applyContrastPreference(getContrastPreference());
    syncContrastButtons();

    document.querySelectorAll(".contrast-btn[data-contrast-pref]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var p = btn.getAttribute("data-contrast-pref");
        if (p === "standard") localStorage.removeItem(CONTRAST_KEY);
        else localStorage.setItem(CONTRAST_KEY, p);
        applyContrastPreference(getContrastPreference());
        syncContrastButtons();
        announceContrastChange();
      });
    });

    document.querySelectorAll(".theme-btn[data-theme-pref]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var choice = btn.getAttribute("data-theme-pref");
        if (choice === "system") localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, choice);
        syncThemeButtons();
      });
    });

    var cb = document.getElementById("theme-follow-system");
    var dayCb = document.getElementById("theme-daylight-location");
    var sw = document.getElementById("theme-dark-switch");
    if (cb && sw) {
      cb.addEventListener("change", function () {
        if (cb.checked) {
          if (dayCb) dayCb.checked = false;
          localStorage.removeItem(THEME_KEY);
        } else {
          if (dayCb && dayCb.checked) {
            /* keep daylight */
          } else {
            localStorage.setItem(THEME_KEY, window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
          }
        }
        syncThemeButtons();
        announceThemeFromUser();
      });

      if (dayCb) {
        dayCb.addEventListener("change", function () {
          if (dayCb.checked) {
            cb.checked = false;
            localStorage.setItem(THEME_KEY, "daylight");
            syncThemeButtons();
            refreshDaylightThemeFromGeo();
            announceThemeFromUser();
          } else {
            if (getThemePreference() === "daylight") {
              localStorage.removeItem(THEME_KEY);
              cb.checked = true;
              syncThemeButtons();
              announceThemeFromUser();
            }
          }
        });
      }

      sw.addEventListener("click", function () {
        if (sw.disabled) return;
        var nextDark = sw.getAttribute("aria-checked") !== "true";
        if (cb) cb.checked = false;
        if (dayCb) dayCb.checked = false;
        localStorage.setItem(THEME_KEY, nextDark ? "dark" : "light");
        syncThemeButtons();
        announceThemeFromUser();
      });
    }

    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
      if (getThemePreference() === "system") {
        applyDocumentTheme(null);
        syncThemeSwitchPanel();
        syncBrandLogoForTheme();
      }
    });

    if (getThemePreference() === "daylight") refreshDaylightThemeFromGeo();

    window.addEventListener("storage", function (e) {
      if (e.key === THEME_KEY) {
        syncThemeButtons();
        if (getThemePreference() === "daylight") refreshDaylightThemeFromGeo();
      } else if (e.key === DAYLIGHT_SNAPSHOT_KEY) {
        syncThemeButtons();
      }
      else if (e.key === CONTRAST_KEY) {
        applyContrastPreference(getContrastPreference());
        syncContrastButtons();
        announceContrastChange();
      }
    });

    initLocalTimeOfDay();
    initReadabilityControls();
  }

  function getEffectiveTextScale() {
    var cs = getComputedStyle(document.documentElement).getPropertyValue("--text-scale").trim();
    if (cs === "0.9" || cs === "1" || cs === "1.15" || cs === "1.3") return cs;
    return "1";
  }

  function applyTextScale(scaleStr) {
    document.documentElement.style.setProperty("--text-scale", scaleStr);
    try {
      if (scaleStr === "1") localStorage.removeItem(TEXT_SCALE_KEY);
      else localStorage.setItem(TEXT_SCALE_KEY, scaleStr);
    } catch (e) {}
  }

  function syncTextScaleButtons() {
    var cur = getEffectiveTextScale();
    document.querySelectorAll(".readability-scale-btn[data-text-scale]").forEach(function (btn) {
      var v = btn.getAttribute("data-text-scale");
      btn.setAttribute("aria-pressed", v === cur ? "true" : "false");
    });
  }

  function announceReadability(msg) {
    var el = document.getElementById("readability-announce");
    if (!el) return;
    el.textContent = "";
    window.requestAnimationFrame(function () {
      el.textContent = msg;
    });
  }

  function initReadabilityControls() {
    syncTextScaleButtons();
    document.querySelectorAll(".readability-scale-btn[data-text-scale]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = btn.getAttribute("data-text-scale");
        if (v !== "0.9" && v !== "1" && v !== "1.15" && v !== "1.3") return;
        applyTextScale(v);
        syncTextScaleButtons();
        var pct = v === "1" ? "100" : String(Math.round(parseFloat(v, 10) * 100));
        announceReadability("Text size set to " + pct + " percent.");
      });
    });

    var rmCb = document.getElementById("readability-reduce-motion");
    function applyReducedMotionUi(on) {
      if (on) {
        document.documentElement.setAttribute("data-a11y-reduced-motion", "1");
        try {
          localStorage.setItem(REDUCED_MOTION_UI_KEY, "1");
        } catch (e) {}
      } else {
        document.documentElement.removeAttribute("data-a11y-reduced-motion");
        try {
          localStorage.removeItem(REDUCED_MOTION_UI_KEY);
        } catch (e) {}
      }
    }
    if (rmCb) {
      try {
        rmCb.checked =
          localStorage.getItem(REDUCED_MOTION_UI_KEY) === "1" ||
          document.documentElement.getAttribute("data-a11y-reduced-motion") === "1";
      } catch (e) {
        rmCb.checked = document.documentElement.getAttribute("data-a11y-reduced-motion") === "1";
      }
      rmCb.addEventListener("change", function () {
        applyReducedMotionUi(rmCb.checked);
        announceReadability(
          rmCb.checked
            ? "Reduced motion on."
            : "Reduced motion off. System preference still applies if set."
        );
      });
    }

    function getBluelightPref() {
      try { var v = localStorage.getItem(BLUELIGHT_KEY); } catch (e) { return "off"; }
      return (v === "low" || v === "medium" || v === "high") ? v : "off";
    }
    function applyBluelight(level) {
      if (level === "off") {
        document.documentElement.removeAttribute("data-bluelight");
        try { localStorage.removeItem(BLUELIGHT_KEY); } catch (e) {}
      } else {
        document.documentElement.setAttribute("data-bluelight", level);
        try { localStorage.setItem(BLUELIGHT_KEY, level); } catch (e) {}
      }
    }
    function syncBluelightButtons() {
      var cur = getBluelightPref();
      document.querySelectorAll(".bluelight-btn[data-bluelight]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-bluelight") === cur ? "true" : "false");
      });
    }
    function announceBluelight(level) {
      var el = document.getElementById("bluelight-announce");
      if (!el) return;
      var labels = { off: "Blue light filter off.", low: "Blue light filter: low warmth.", medium: "Blue light filter: medium warmth.", high: "Blue light filter: high warmth." };
      el.textContent = "";
      setTimeout(function () { el.textContent = labels[level] || ""; }, 50);
    }

    applyBluelight(getBluelightPref());
    syncBluelightButtons();
    document.querySelectorAll(".bluelight-btn[data-bluelight]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = btn.getAttribute("data-bluelight");
        if (v !== "off" && v !== "low" && v !== "medium" && v !== "high") return;
        applyBluelight(v);
        syncBluelightButtons();
        announceBluelight(v);
      });
    });

    window.addEventListener("storage", function (e) {
      if (e.key !== TEXT_SCALE_KEY && e.key !== REDUCED_MOTION_UI_KEY && e.key !== BLUELIGHT_KEY) return;
      if (e.key === TEXT_SCALE_KEY) {
        var nv = e.newValue;
        if (nv === "0.9" || nv === "1" || nv === "1.15" || nv === "1.3") {
          document.documentElement.style.setProperty("--text-scale", nv);
        } else if (nv == null) {
          document.documentElement.style.setProperty("--text-scale", "1");
        }
        syncTextScaleButtons();
      }
      if (e.key === REDUCED_MOTION_UI_KEY && rmCb) {
        rmCb.checked = e.newValue === "1";
        if (rmCb.checked) document.documentElement.setAttribute("data-a11y-reduced-motion", "1");
        else document.documentElement.removeAttribute("data-a11y-reduced-motion");
      }
      if (e.key === BLUELIGHT_KEY) {
        applyBluelight(getBluelightPref());
        syncBluelightButtons();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }

  const titles = {
    overview: ["Overview", "Command surface — KPIs, quick actions, activity, and integration sync health"],
    sentiment: ["Sentiment & VoC", "Blended guest signals, escalation queue, and survey / contact-center API integrations"],
    journeys: ["Journey signals", "Journey health vs infrastructure friction — analytics and telemetry API map"],
    "cx-command": [
      "Experience command",
      "Cross-console next steps, customer financials, trend charts, and AI recommendations — single CX pane"
    ],
    "cx-role-actions": [
      "CX role actions",
      "Per-role recommended moves for adoption, cost, delivery speed, and CSAT — aligned to mock portfolio KPIs"
    ],
    "powerbi-pm": [
      "Power BI · Global PM",
      "Embedded Microsoft analytics — RAID, milestones, financial roll-up, and drill-through; live token at /powerbi-pm.html"
    ],
    incidents: ["Incidents", "Filters, queue metrics, list, detail preview, and TAC correlation"],
    devices: ["Devices", "Inventory toolbar, extended columns, assurance issues, and FN/CVE hints"],
    properties: ["Properties", "MGM Las Vegas resorts & remote destinations — adoption, DNA sites, and wave coverage"],
    integrations: ["Waves & integrations", "All MVP waves plus full API connection registry export"],
    "mvp-journey": [
      "MVP journey & adoption",
      "Cisco customer journey map per MVP product — CSPC & Cisco IQ depth, adoption recommendations, optional live source merge"
    ],
    sources: ["Source administration", "Per-source cards, audit log, and env checklist"],
    consoles: ["Console ↔ wave map", "Vendor / SDC surfaces vs MVP waves · out-of-scope callouts"],
    sdcroles: [
      "SDC personas & consoles",
      "Persona workspaces plus live recommended next steps from unified mock data · SDC program consoles + technical execution in SDM"
    ],
    security: ["Security (PSIRT)", "OpenVuln metrics, advisory grid, remediation and token health"],
    fieldnotes: ["Field notices", "FN feed KPIs, severity matrix, and bulk response actions"],
    "network-as-code": [
      "Network as Code",
      "Cisco NaC solutions — Catalyst Center, SD-WAN, ISE, IOS-XE, and NaC toolchain (Collector, Test, Validate, Tool, API) mapped to customer estate"
    ],
    "services-as-code": [
      "Services as Code",
      "Cisco SaC development waves — ACI, SD-WAN, NDFC, ISE, Meraki, Catalyst Center, Unified Branch, FMC, IOS-XE, IOS-XR, AI Assistant, DDS, and partner co-delivery"
    ],
    "digital-document-solutions": [
      "Digital Document Solutions",
      "DDS — automated document generation, approval workflows, secure sharing, and version-controlled customer deliverables"
    ],
  };

  /** Brief purpose line under the centered page title (one per left-nav tab). */
  const viewTabDescriptors = {
    overview: "KPIs, quick actions, activity feed, and integration sync health for the estate.",
    sentiment: "Blended guest sentiment, VoC ingest, surveys, and contact-center signals.",
    journeys: "Journey health, friction index, and analytics / telemetry API alignment.",
    "cx-command": "Unified CX, financials, trends, and AI-ranked next steps in one pane.",
    "cx-role-actions": "Per-role moves across adoption, cost, delivery speed, and CSAT pillars.",
    "powerbi-pm": "Embedded PM analytics — RAID, milestones, capacity, and financial roll-up.",
    incidents: "Queue metrics, filters, detail preview, and TAC-linked correlation.",
    devices: "Inventory, assurance issues, Meraki cloud-managed networks, AppDynamics infra mapping, and DD automation readiness.",
    properties: "Resorts and destinations — adoption, DNA sites, entitlement, and waves.",
    integrations: "MVP waves, Digitized Delivery automation waves (DD-A through DD-N), and the full API connection registry.",
    "mvp-journey": "Product journey depth (CSPC, Cisco IQ) with adoption recommendations.",
    sources: "Per-source cards, audit trail, credentials posture, and env checklist.",
    consoles: "Vendor and SDC consoles mapped to MVP waves with scope callouts.",
    sdcroles: "Personas, program consoles, and data-driven recommended next steps.",
    security: "PSIRT-oriented view — advisories, exposure, and remediation/token health.",
    fieldnotes: "Field-notice KPIs, severity mix, and coordinated response actions.",
    "network-as-code": "NaC solution cards, API capability matrix, NaC toolchain, and customer adoption positioning.",
    "services-as-code": "SaC dev waves (A–J + DDS), automation environments, partner co-delivery, and Cisco Live resources.",
    "digital-document-solutions": "DDS lifecycle — generate, review, share, and archive customer-facing technical documents.",
  };

  /** Page-specific AI narrative + actionable steps (mock). Microsoft 365 Copilot / bot prompts are suggestions only. */
  const AI_INSIGHTS_BY_VIEW = {
    overview: {
      copilotContextPlain:
        "Overview KPIs (mock): 14 open incidents, 2 P1/P2, 1,284 devices, 6 TAC-linked SRs, 98% license compliance, 3 advisory exposures, 2 FN-impacted patterns, blended CSAT 4.2 (+0.4 vs 7d).",
      blocks: [
        {
          urgent: true,
          title: "Operational focus",
          text: "P1/P2 queue is small but concentrated on WAN and ISE drift — typical precursors to customer-visible outages during peak gaming volume.",
          actions: [
            "<strong>Triage</strong> INC-20244 first (POS path + TAC 69861) before broad DNA sync windows.",
            "<strong>Validate</strong> that W5–10 observability jobs actually ran — scheduled-but-not-run is a blind spot for MTTR.",
            "<strong>Align</strong> FN74218 remediation with the Bellagio property plan already flagged in activity."
          ]
        },
        {
          title: "Integration health",
          text: "Four sources are “green” in mock (DNA, TAC, licensing, FMC); security feeds remain nightly batch — good for exec readouts, weaker for real-time war rooms.",
          actions: [
            "<strong>Schedule</strong> a targeted OpenVuln + FN correlation refresh before the next CAB.",
            "<strong>Export</strong> integration sync strip for the PM RAID pack (stakeholder mock)."
          ]
        },
        {
          dd: true,
          title: "Digitized Delivery — portfolio automation pulse",
          text: "1,626 managed devices (DNA + Meraki), 14 DD waves available, 6 AppDynamics-monitored apps. Combined NaC + SaC 3-yr ROI: $2.14M. Payment Gateway Apdex at 0.82 needs attention.",
          actions: [
            "<strong>Present</strong>: Position DD ROI in the next customer QBR — $2.14M combined return is an executive-level story.",
            "<strong>Quick win</strong>: Run nac-collector this sprint on MGM Grand and Corporate (highest readiness).",
            "<strong>Correlate</strong>: Aria-IoT Meraki degradation + Aria ISE PSN degradation — may share root cause.",
            "<strong>AppDynamics</strong>: Payment Gateway Apdex 0.82 is below 0.85 target — set up auto-incident creation."
          ]
        },
        {
          title: "Salesforce CRM — portfolio pulse",
          text: "24 active accounts, 18 open cases (3 high priority), $4.2M pipeline, 7 entitlements expiring within 90 days. All six SDC consoles pulling live SF data via Wave 17 integration.",
          actions: [
            "<strong>Renewals</strong>: 7 entitlements expiring in 90d — flag in Renewals Console for proactive engagement.",
            "<strong>PM</strong>: $4.2M pipeline has 2 opps in risk stage — escalate to CX command.",
            "<strong>Delivery</strong>: 3 high-priority SF cases correlate with active TAC SRs — verify bidirectional linkage.",
            "<strong>Success</strong>: Account health scores from SF Entitlements + Cases feed the Success Console — review Vdara (2 expiring)."
          ]
        }
      ],
      suggestions: [
        "Given 2 P1/P2 incidents and 6 active TAC cases, what’s the recommended sequencing for the delivery team this week?",
        "What is the combined Digitized Delivery ROI across NaC, SaC, and DDS for this customer?",
        "Which integration sync gaps on this overview should block a production change freeze?",
        "Draft talking points for a customer QBR using Digitized Delivery ROI, incidents, and adoption metrics.",
        "Summarize the Salesforce pipeline risk across all accounts and recommend actions for PM and Renewals consoles."
      ]
    },
    sentiment: {
      copilotContextPlain:
        "Sentiment (mock): CSAT 4.2, NPS +18, 7 at-risk journeys, VoC ingest P95 12m. Qualtrics/Medallia/Dynamics Customer Voice/Zendesk/Webex CC/Salesforce table stub.",
      blocks: [
        {
          urgent: true,
          title: "Signals to operations",
          text: "Low sentiment without a matching incident is often identity or WLAN policy drift — correlate ISE client sessions before opening net-new cases.",
          actions: [
            "<strong>Triage</strong>: prioritize MGM Grand gaming floor thread linked INC-20244 before expanding FN-driven work.",
            "<strong>VoC hygiene</strong>: validate survey sampling isn’t biased by post-outage windows only.",
            "<strong>Privacy</strong>: redact PCI/PII in transcript ingest; use hashed tenant IDs in API payloads."
          ]
        }
      ],
      suggestions: [
        "Summarize VoC + incident correlation for an exec QBR in five bullets.",
        "Which Qualtrics vs Zendesk fields should we normalize first for CSAT alignment?",
        "Draft a data contract for Webex Contact Center analytics into Helix.",
        "List risks if Medallia exports stall but DNA health still reads green."
      ]
    },
    journeys: {
      copilotContextPlain:
        "Journeys (mock): 24 active journeys, friction index 0.31, 86% positive exit. Adobe/Amp/DNA/event bus API table; journey grid ties sentiment to phases.",
      blocks: [
        {
          urgent: true,
          title: "Friction attribution",
          text: "Strained sentiment on roaming-heavy journeys usually needs ThousandEyes + DNA client experience together — not survey uplift alone.",
          actions: [
            "<strong>Pair</strong>: attach INC-20244 timeline to Journey J-MGM-4412 for closure evidence.",
            "<strong>Adobe/AEP</strong>: confirm identity graph resolves casino guest vs corporate SSID namespaces.",
            "<strong>Bus contract</strong>: require journey_step events to carry siteId + VLAN for SDM joins."
          ]
        }
      ],
      suggestions: [
        "Propose KPI targets for friction index by property tier.",
        "How should we sequence DNA Center vs Adobe Journey Analytics onboarding?",
        "Generate a RACI for who owns journey definition vs VoC ingestion.",
        "What’s the minimum event schema for resort check-in journey health?"
      ]
    },
    "cx-command": {
      copilotContextPlain:
        "Experience command (mock): ACV $48.2M, renewal risk $3.1M, support $/device $9.40, NRR proxy 102%. Unified next steps across PM, Delivery, CX, Renewals, Architect. Financial lines FY24/FY25. AI recs on ISE drift, Wave 16 gate, QBR bundling.",
      blocks: [
        {
          urgent: true,
          title: "Visibility vs action",
          text: "Keep architect and renewals items in weekly visibility even when no incident fires — drift shows up in money before it shows up in tickets.",
          actions: [
            "<strong>Visibility</strong>: chart true-up and adoption on the same axis as CSAT to catch entitlement narratives early.",
            "<strong>Action</strong>: time-box SDM tasks that unblock renewals QBR — CAB and TAC closure are hard dependencies.",
            "<strong>AI hygiene</strong>: store confidence drivers (VoC, financial var, backlog age) for audit when recommendations influence spend."
          ]
        },
        {
          title: "Financial integrations",
          text: "Revenue Cloud / D365 Finance / NetSuite should resolve to the same account keys as Salesforce Service Cloud for sentiment join.",
          actions: [
            "<strong>Map</strong> <code>account_id</code> → property graph nodes for MGM/portfolio roll-ups.",
            "<strong>Refresh</strong> forecast slice after wave gate changes — delay skews renewal risk scoring."
          ]
        }
      ],
      suggestions: [
        "Rank the three AI recommendations by renewal impact only.",
        "Draft an exec one-pager from Experience command KPIs and financial table.",
        "Which SDC console owns each item if we remove the unified pane?",
        "List data gaps that would drop AI confidence below 60%."
      ]
    },
    "cx-role-actions": {
      copilotContextPlain:
        "CX role actions (mock): matrix of PM/SDM/CXM/CDA/ENG vs adoption, cost, speed, CSAT. KPI strip wave coverage 94%, support $/device $9.40, triage 4.2h, CSAT 4.2 NPS +18.",
      blocks: [
        {
          urgent: true,
          title: "Balancing the four outcomes",
          text: "Adoption and CSAT can compete with cost if waves drag — use Experience command dollars + Sentiment lag as the tie-breaker in steering.",
          actions: [
            "<strong>Adoption</strong>: tie every gate to a property-level entitlement vs inventory story (Renewals + Properties).",
            "<strong>Cost</strong>: chase T&M burndown only after observability jobs run — blind MTTR inflates spend.",
            "<strong>Speed</strong>: yellow W11/W16 gates belong in weekly RAID, not quarterly reviews.",
            "<strong>CSAT</strong>: pair VoC escalations with journey IDs so fixes are traceable in QBR."
          ]
        },
        {
          title: "Who owns the action",
          text: "SDM executes cross-surface sweeps; PM sequences funding and gates; CXM narrates outcomes; CDA proves API parity; Engineers close evidence on incidents/devices.",
          actions: [
            "<strong>Conflict</strong>: when cost cuts skip DNA sync windows, escalate as delivery-speed risk with CSAT impact stub.",
            "<strong>Handoff</strong>: link each recommendation here to Incidents, Sources, or Journeys via mock jumps."
          ]
        },
        {
          dd: true,
          title: "Digitized Delivery — automation strategy per CX role",
          text: "Every CX role has targeted Digitized Delivery actions: SDMs govern NaC adoption, PMs track ROI, Architects design CI/CD pipelines, Engineers build playbooks, CXMs tell the customer story, and Security Engineers automate compliance.",
          actions: [
            "<strong>SDM</strong>: Establish automation change board and embed nac-validate into CAB — 40% faster change cycles.",
            "<strong>PM</strong>: Add DD ROI metrics ($2.14M combined) to QBR; track adoption % by wave per property.",
            "<strong>Architect</strong>: Design Terraform + nac-test + nac-validate CI/CD pipelines for zero-touch provisioning.",
            "<strong>Engineer</strong>: Build Ansible playbooks per technology; train on SaC AI Assistant — 8h → 2.8h avg deployment.",
            "<strong>CXM</strong>: Use DDS for automated delivery reports; present SaC case studies for customer adoption acceleration.",
            "<strong>Security</strong>: Automate ISE + FMC policy validation via as-Code pipelines — continuous compliance."
          ]
        }
      ],
      suggestions: [
        "Rank the 20 cells (5 roles × 4 pillars) by renewal-at-risk dollars only.",
        "Which actions are safe to automate as nudges vs require human approval?",
        "Draft a weekly stand-up agenda from this matrix for the SDC pod.",
        "What instrumentation would prove adoption improved after Wave 16 green?"
      ]
    },
    "powerbi-pm": {
      copilotContextPlain:
        "Power BI Global PM (mockup): capability map for embed at /powerbi-pm.html; surfaces RAID, milestones, financials, capacity, regional drill, VoC, integration health; backend POWERBI_* + GenerateToken.",
      blocks: [
        {
          title: "Single pane for PM leadership",
          text: "Use Power BI for portfolio analytics; keep operational truth in SDM APIs — embed bridges exec-friendly visuals without duplicating incident queues.",
          actions: [
            "<strong>Token hygiene</strong>: embed tokens are short-lived; refresh on navigation, never log tokens or reports IDs in client analytics.",
            "<strong>RLS</strong>: validate service-principal visibility matches MGM data classification before external demos.",
            "<strong>Deep link</strong>: align report bookmarks with Helix views (Properties, Waves, Experience command) for storytelling."
          ]
        },
        {
          urgent: true,
          title: "Operationalizing the dashboard",
          text: "Schedule dataset refresh after integration sync windows so RAID colors align with DNA/TAC/FMC truth.",
          actions: [
            "<strong>Source of truth</strong>: financial tiles from ERP; incident severity from SDM — document joins in dataset notes.",
            "<strong>Failure mode</strong>: if GenerateToken fails, show Operations home link — don’t leave an empty embed without explanation."
          ]
        }
      ],
      suggestions: [
        "Summarize which Helix pages should deep-link to which Power BI bookmarks.",
        "Draft acceptance tests for RLS as the Global PM report rolls out.",
        "What KPIs should block a release gate if Power BI is stale?",
        "Compare cost of SP-based embed vs user-delegated embed for this tenant."
      ]
    },
    incidents: {
      copilotContextPlain:
        "Incidents (mock): queue depth 14, P1/P2=2, mean ack→triage 4.2h. Sample INC-20244 P1 WAN jitter MGM Grand, INC-20243 ISE posture Bellagio, TAC correlation 69861/69857.",
      blocks: [
        {
          urgent: true,
          title: "Queue intelligence",
          text: "Two active SRs tie directly to P2 incidents — leverage Support API enrichment before escalating internally.",
          actions: [
            "<strong>Link hygiene</strong>: ensure INC-20244 ↔ SR 69861 notes mirror customer-committed next steps.",
            "<strong>Parallel path</strong>: ISE posture drift (Bellagio) may share AAA dependencies with Wi-Fi client density noise — correlate pxGrid sessions if available.",
            "<strong>SLA</strong>: P1 clock — prioritize path diversity evidence (TE test + DNA interface errors)."
          ]
        },
        {
          title: "Salesforce — case correlation",
          text: "3 open SF cases correlate with active SDM incidents. SF Case 00128346 (High priority, MGM Grand) maps to INC-000042 with TAC SR-700000001.",
          actions: [
            "<strong>Auto-link</strong>: Verify SF Case 00128346 → INC-000042 bidirectional status sync is active.",
            "<strong>Escalation</strong>: SF case priority mismatches incident priority in 1 record — reconcile.",
            "<strong>Contact</strong>: SF Contacts on the linked account should be notified via Success Console workflow."
          ]
        }
      ],
      suggestions: [
        "Which incidents in this queue pose the highest revenue or compliance risk and why?",
        "Draft a customer update paragraph for INC-20244 referencing TAC SR 69861 status.",
        "Propose a runbook checklist to close ISE posture drift incidents faster across resorts.",
        "How should we group these incidents for war-room moderation in WebEx?",
        "Which Salesforce cases are not yet linked to SDM incidents and should be?"
      ]
    },
    devices: {
      copilotContextPlain:
        "Devices (mock): 1,284 DNA-managed, 23 health<80, 7 stale>24h telemetry, 26 FN advisory matches. Sample mgm-core-sw01, mgm-ftd-01 W16 FMC.",
      blocks: [
        {
          urgent: true,
          title: "Remediation targets",
          text: "Health <80 cluster likely drives incident backlog — FTD row confirms firewall context is now in-scope via FMC (W16).",
          actions: [
            "<strong>Patch wave</strong>: group C9500/ASR1K on same maintenance bundle to collapse CVE count visible to customers.",
            "<strong>FMC</strong>: reconcile mgm-ftd-01 policy revision with DNA routing intent to avoid asymmetric security policy.",
            "<strong>Stale telemetry</strong>: seven stale devices — schedule DNAC poller health task before blaming WAN."
          ]
        },
        {
          dd: true,
          title: "Digitized Delivery \u2014 device automation readiness",
          text: "342 Meraki cloud-managed devices visible alongside 1,284 DNA devices. 6 AppDynamics apps mapped to infrastructure nodes. NaC IOS-XE RESTCONF readiness at 42% of estate.",
          actions: [
            "<strong>Meraki</strong>: Aria-IoT degraded \u2014 single WAN site risk. Position Meraki as Code (DD-E) for standardized config templates.",
            "<strong>AppDynamics</strong>: Payment Gateway critical (Apdex 0.82) \u2014 correlate with network devices mgm-pay-sv01.",
            "<strong>NaC readiness</strong>: IOS-XE devices support RESTCONF for Day 2 automation \u2014 priority target for nac-collector.",
            "<strong>Unified view</strong>: Combined DNA + Meraki + AppDynamics inventory enables full-stack automation recommendations."
          ]
        },
        {
          title: "Salesforce \u2014 entitlement coverage",
          text: "Device entitlement mapping from SF: 3 devices with active SNTC/DNA entitlements, 1 expiring within 90 days (edge-rtr-01). Renewals Console flagged.",
          actions: [
            "<strong>Renewals</strong>: edge-rtr-01 SNTC Essentials expires 2026-06-30 \u2014 flag for proactive renewal in SF Opportunity.",
            "<strong>Success</strong>: 3/3 core devices covered \u2014 use as proof point in customer health narrative."
          ]
        }
      ],
      suggestions: [
        "Prioritize the top 5 devices to remediate first using health, FN match, and role in the topology.",
        "Explain how FMC-managed FTD inventory should appear alongside Catalyst Center rows in SDM.",
        "What change window narrative should NetOps use given assurance issues and stale telemetry counts?",
        "Generate a CSV-style column checklist for a device export audit."
      ]
    },
    properties: {
      copilotContextPlain:
        "Properties: full MGM mock portfolio — 11 Las Vegas resorts + 7 remote sites; per-property DNA site IDs, adoption %, wave tags (see Technology at property panel).",
      blocks: [
        {
          title: "Portfolio leverage",
          text: "Las Vegas strip cluster shows uneven ISE adoption — use Aria/Bellagio as templates for Park MGM and Luxor standardization.",
          actions: [
            "<strong>Governance</strong>: align SITE-* codes with Smart Account virtual account boundaries before renewal negotiations.",
            "<strong>Remote parity</strong>: Detroit + Borgata carry higher device counts — prioritize collector coverage (W10) there first.",
            "<strong>Filter coaching</strong>: use Las Vegas vs Remote chips to brief regional NOCs without overloading one dashboard."
          ]
        }
      ],
      suggestions: [
        "Which three properties should we prioritize for ISE posture uplift next quarter based on this grid?",
        "Compare Las Vegas vs remote portfolios: device scale, incident proxy, and integration wave coverage.",
        "Draft property-level OKRs for the PM console using adoption % and wave tags only.",
        "What risks appear if Corporate HQ and Detroit share overlapping DNA logical sites?"
      ]
    },
    integrations: {
      copilotContextPlain:
        "Integrations: 16 MVP waves W1–16 including FMC W16; 4 sources enabled in mock; API builds table from registry.",
      blocks: [
        {
          urgent: true,
          title: "Wave sequencing",
          text: "FMC + ISE + Secure Access interlock — policy automation without console swivel depends on API entitlement completeness.",
          actions: [
            "<strong>Gate</strong>: confirm DevNet API products cover W11 ISE as Code and W16 FMC in same project.",
            "<strong>Pilot</strong>: enable Support API (W4) before expanding PSIRT exposure narratives to customers.",
            "<strong>Debt</strong>: WebEx/Teams still manual — flag collaboration gap for incident bridges."
          ]
        }
      ],
      suggestions: [
        "What is the minimum viable wave order to stand up FMC + ISE + DNA with least rework?",
        "List API entitlement risks if we promote WebEx-only war rooms without Support API.",
        "Explain to a customer why Wave 14–15 security feeds are batch while operations are real-time.",
        "Which waves should appear in a renewal risk workshop slide?"
      ]
    },
    "mvp-journey": {
      copilotContextPlain:
        "MVP journey view: 16 waves + DD automation maturity on a 6-phase Cisco customer journey; CSPC, Cisco IQ, Meraki, AppDynamics, and Salesforce pipeline per phase; mock maturity % per rail; deep CSPC collector/Smart Account and Cisco IQ entitlement panels; DD callout mapping NaC/SaC/DDS readiness and Meraki as Code/AppDynamics APM per phase; Salesforce Opportunities aligned to journey stages; Live merges /admin/sources.",
      blocks: [
        {
          title: "Journey honesty",
          text: "CSPC and Cisco IQ sit earlier in the journey than DNA or TAC unless entitlements and collectors are already industrialized — don’t claim Optimize-stage outcomes before Implement gates close.",
          actions: [
            "<strong>CSPC</strong>: sequence collector coverage with property tiers used in renewal QBR (remote hubs first if DNA sites lag).",
            "<strong>Cisco IQ</strong>: bind insight families to Smart Account PAK lines before widening API poll — avoids silent entitlement skew.",
            "<strong>SDM tie-in</strong>: use this rail in PM/renewal decks as the canonical ‘where we are’ per product."
          ]
        },
        {
          urgent: true,
          title: "Live data hook",
          text: "Source registry flags are authoritative for enable/disable; CSPC/IQ telemetry here remains illustrative until dedicated collectors & IQ endpoints feed Helix.",
          actions: [
            "<strong>Token</strong>: admin, sdm, or manager role required for GET /api/v1/admin/sources.",
            "<strong>Fallback</strong>: keep mock KV blocks for customer workshops when API roles are narrower."
          ]
        },
        {
          dd: true,
          title: "Digitized Delivery — journey automation maturity",
          text: "Each Cisco customer journey phase now maps to DD automation waves, Meraki cloud management readiness, and AppDynamics APM adoption. NaC readiness rises from 25% (Evaluate) to 90% (Optimize) as properties graduate through journey phases.",
          actions: [
            "<strong>NaC pipeline</strong>: properties in Evaluate need nac-collector only; don’t push nac-validate until Commit phase confirms device readiness.",
            "<strong>Meraki as Code</strong>: 342 cloud-managed devices can leverage Dashboard API for Day 2 ops starting at Implement phase.",
            "<strong>AppDynamics</strong>: 6 monitored apps provide app-health correlation for incident triage starting at Commit phase.",
            "<strong>DDS</strong>: QBR packs and adoption reports activate at Optimize — align with PM/CXM delivery cadence."
          ]
        },
        {
          title: "Salesforce — pipeline ↔ journey alignment",
          text: "14 Salesforce Opportunities map across 4 journey phases with $4.2M total pipeline. PM Console uses this to track commercial velocity alongside technical adoption milestones.",
          actions: [
            "<strong>PM</strong>: track Opportunity probability vs journey phase maturity — flag misalignment when pipeline is in Commit but journey is stuck at Evaluate.",
            "<strong>Renewals</strong>: use Optimize-phase Opportunities as proof points for renewal QBR narratives.",
            "<strong>CXM</strong>: journey-pipeline alignment score should appear in customer success plans."
          ]
        }
      ],
      suggestions: [
        "Given MGM’s mock maturity scores, which two waves should we advance from Evaluate to Commit next quarter?",
        "Write a customer email explaining why CSPC gates Cisco IQ value realization.",
        "How should TAM align DNA Optimize milestones with CSPC Implement completeness?",
        "List audit evidence needed to prove journey stage claims at renewal.",
        "How does Digitized Delivery automation maturity per phase affect time-to-Optimize for properties with Meraki-heavy deployments?",
        "Summarize the Salesforce pipeline risk across journey phases and recommend actions for PM and Renewals consoles."
      ]
    },
    sources: {
      copilotContextPlain:
        "Sources admin: 18 VALID_SOURCES, 4 enabled (dna, tac, smart-licensing, fmc); vault cred refs; audit log mock entries. DD waves require specific sources (DD-F needs dna-center, DD-D needs ise, DD-K/E needs Meraki API, DD-L needs AppDynamics API). Salesforce (W17) requires Connected App OAuth.",
      blocks: [
        {
          urgent: true,
          title: "Operational controls",
          text: "Credential rotation and schedule drift are the top two audit findings in most SDM programs.",
          actions: [
            "<strong>Test cadence</strong>: run connection tests for FMC + OpenVuln after secret rotation drills.",
            "<strong>Scope</strong>: keep W14–16 filter for security team reviews; separate hospitality vs corporate refs.",
            "<strong>Evidence</strong>: export registry CSV for SOC2 change-management evidence (mock)."
          ]
        },
        {
          dd: true,
          title: "Digitized Delivery — source readiness for DD waves",
          text: "Each DD automation wave depends on specific API sources being enabled and syncing. DD-F requires dna-center (Wave 1), DD-D requires ise (Wave 11), DD-K/E requires Meraki Dashboard API, DD-L requires AppDynamics Controller API. Source admin status directly gates DD wave activation.",
          actions: [
            "<strong>NaC prerequisite</strong>: verify dna-center and ise sources are both green before enabling DD-D or DD-F NaC pipelines.",
            "<strong>Meraki</strong>: ensure Meraki Dashboard API key is registered and tested before DD-K wave rollout.",
            "<strong>AppDynamics</strong>: AppDynamics Controller API credentials required for DD-L; test connection via /admin/sources/appdynamics/test.",
            "<strong>Gap</strong>: ACI (DD-A) and SD-WAN (DD-B) sources are not yet in the registry — manual until promoted."
          ]
        },
        {
          title: "Salesforce — Wave 17 source health",
          text: "Salesforce Connected App (OAuth 2.0 password flow) is registered as source ‘salesforce’ in the admin registry. Token TTL ~110 min with auto-refresh. 9 SF objects exposed via REST v59.0. Test via /api/v1/admin/sources/salesforce/test.",
          actions: [
            "<strong>Config</strong>: set SALESFORCE_ENABLED=true and all SALESFORCE_* env vars before activation.",
            "<strong>Sync</strong>: every 15 min via sourceAdmin cron; on-demand via /sync/salesforce.",
            "<strong>Scope</strong>: 6 SDC consoles consume SF data — test each console’s API route after enabling."
          ]
        }
      ],
      suggestions: [
        "What should our credential rotation checklist include for FMC vs DNA Center?",
        "Summarize source health for the last 24h assuming zero failed tests — what’s still missing?",
        "Which sources are candidates for ‘read-only analyst’ roles vs admin-only toggles?",
        "Draft policy text for enabling field-notices in production.",
        "Which DD waves are blocked by missing source registrations, and what’s the fastest path to activate them?",
        "Summarize the Salesforce source health and list any configuration gaps for Wave 17 activation."
      ]
    },
    consoles: {
      copilotContextPlain:
        "Console map: SDC/vendor surfaces mapped to MVP waves W1–17 + DD-A–N; Meraki and AppDynamics now integrated inline (no standalone pages); Salesforce CRM (W17) as CRM layer across all consoles; DD waves extend console surfaces with automation capabilities.",
      blocks: [
        {
          title: "Parity planning",
          text: "Use this table as a contract scope guardrail — every row should map to API builds in the registry or be explicitly out-of-scope.",
          actions: [
            "<strong>Challenge</strong>: any stakeholder request for Meraki parity needs a promotion path, not an exception.",
            "<strong>QA</strong>: for each console row, pick one acceptance test script tied to a wave KPI.",
            "<strong>Partner</strong>: align TAC/Support console wording with CXRenewals storytelling."
          ]
        },
        {
          dd: true,
          title: "Digitized Delivery — console parity via automation waves",
          text: "DD waves A–N extend the console-wave map with 14 automation capabilities spanning Terraform, Ansible, NaC tools, and AI assistants. Each DD wave targets a specific console surface with API-driven Day 2 operations that reduce swivel-chair across vendor UIs.",
          actions: [
            "<strong>DD-E (Meraki)</strong>: Meraki Dashboard now integrated inline on Devices, Properties, and Integrations views — 342 cloud-managed devices covered.",
            "<strong>DD-L (AppDynamics)</strong>: AppDynamics now integrated inline on Devices, Incidents, and Overview views — 6 monitored apps correlated.",
            "<strong>Console parity</strong>: each DD wave should have a corresponding acceptance test tied to its target console surface.",
            "<strong>Scope freeze</strong>: Meraki and AppDynamics promoted from ‘Out of MVP’ to inline integration per latest scope freeze update."
          ]
        },
        {
          title: "Salesforce CRM — console CRM layer",
          text: "Wave 17 (Salesforce) provides the customer relationship layer spanning all SDC consoles. 9 SF objects (Cases, Accounts, Contacts, Opportunities, Entitlements, Service Contracts, Tasks, Knowledge) feed 6 consoles with 12 API endpoints.",
          actions: [
            "<strong>All consoles</strong>: Salesforce data now appears in Overview, Incidents, Devices, Properties, Experience Command, and SDC Personas views.",
            "<strong>CRM backbone</strong>: SF Accounts and Cases form the relationship glue between operational SDM data and customer context.",
            "<strong>W17 in map</strong>: Salesforce CRM row should appear in the console-wave matrix with Wave 17 designation."
          ]
        }
      ],
      suggestions: [
        "Which console rows are most likely to be challenged by customers during delivery?",
        "Create a gap analysis template between this map and CISCO_DATA_SOURCES.md.",
        "How should we explain ‘Gate 1–17’ to a non-technical exec sponsor?",
        "What’s the minimal API set for Service Delivery Console parity?",
        "How do DD automation waves change the console parity story for Meraki and AppDynamics?",
        "Which Salesforce objects are most critical for each SDC console, and are all API routes tested?"
      ]
    },
    sdcroles: {
      copilotContextPlain:
        "SDC personas view: live recommended next steps panel re-renders on tab focus from APP_DATA_SNAPSHOT (incidents, devices, sentiment, journeys, cx-command, PSIRT, FN, integrations, overview KPIs, DD automation, Meraki, AppDynamics, Salesforce CRM). PM/SDM/CXM/CDA/ENG/High Touch Operations Manager each get 4 ranked steps with data provenance pills. DD callout maps automation recommendations per persona. Meraki site health and AppDynamics app health feed persona-specific workflows.",
      blocks: [
        {
          title: "Role clarity",
          text: "Engineers are strong contributors on Service Delivery + Architect consoles — avoid duplicating SDM ownership on queue hygiene.",
          actions: [
            "<strong>Handoff</strong>: use SDM for escalation routing; Engineer for execution evidence in DNA/FMC/ISE.",
            "<strong>CXM</strong>: keep renewal heat narrative tied to W3/W4/W10 — don’t overload PSIRT detail in customer decks.",
            "<strong>CDA</strong>: use W1–16 registry as single design authority to settle wave disputes."
          ]
        },
        {
          urgent: true,
          title: "Unified CX role queue",
          text: "The live next-steps grid weights P1/P2, renewal-at-risk dollars, VoC lag, observability gaps, and FN/PSIRT exposure so each customer-facing role sees the same truth with different priorities.",
          actions: [
            "<strong>PM</strong>: sequence RAID from Experience command financial variance + wave yellow gates.",
            "<strong>CXM</strong>: pair Sentiment escalations with Journey friction before QBR.",
            "<strong>SDM</strong>: own cross-surface actions until incident closure or source sync green.",
            "<strong>HTOM</strong>: own exec-ready briefing cadence and joint-session narrative alignment (Experience command + VoC + incidents)."
          ]
        },
        {
          dd: true,
          title: "Digitized Delivery — persona automation recommendations",
          text: "Each SDC persona leverages DD waves differently. NaC/SaC readiness scores, Meraki cloud health, and AppDynamics app performance drive targeted automation recommendations: PM gets ROI in QBR packs, SDM gets NaC validation in change windows, CXM gets adoption narratives from wave maturity, CDA gets reference architectures from SaC patterns, Engineers get Terraform/Ansible pipelines.",
          actions: [
            "<strong>PM</strong>: Meraki site-level health for milestone tracking + AppDynamics app health for project readiness.",
            "<strong>SDM</strong>: Meraki config drift detection + AppDynamics incident correlation with app health.",
            "<strong>CXM</strong>: Meraki cloud-managed adoption metrics + AppDynamics customer experience scores.",
            "<strong>Engineer</strong>: Meraki API for Day 2 ops + AppDynamics health-rule tuning for alerting."
          ]
        },
        {
          title: "Salesforce CRM — console data backbone",
          text: "Wave 17 (Salesforce) feeds all six SDC program consoles: Cases → Service Delivery, Opportunities → Renewals, Entitlements → Success, Accounts → PM + High Touch. 24 accounts active, 18 open cases, $4.2M pipeline.",
          actions: [
            "<strong>PM Console</strong>: SF Accounts + Opportunities power milestone tracking and pipeline oversight.",
            "<strong>Service Delivery</strong>: SF Cases auto-correlate with SDM incidents and TAC SRs for complete case lifecycle.",
            "<strong>Success Console</strong>: SF Entitlements + account health drive adoption narratives and risk scoring.",
            "<strong>Renewals Console</strong>: SF Opportunities + Service Contracts provide the renewal pipeline and quote readiness view."
          ]
        }
      ],
      suggestions: [
        "How should RACI change if we add a dedicated Security Operations role?",
        "Draft a one-page ‘who does what’ for war-room bridge calls.",
        "What metrics should each persona see first on login?",
        "Suggest coaching tips for PMs using Delivery Architect console artifacts.",
        "Diff the PM vs CXM top recommendation — where do they conflict?",
        "How should DD automation recommendations differ for PM vs Engineer personas given Meraki and AppDynamics data?",
        "Which personas benefit most from Meraki Dashboard vs AppDynamics Controller integration?"
      ]
    },
    security: {
      copilotContextPlain:
        "PSIRT mock: OpenVuln sync OK, 7 CVEs in estate, 1 critical/high patch window, 412 advisories tracked; sample remediation timeline.",
      blocks: [
        {
          urgent: true,
          title: "Exposure management",
          text: "Inventory-matched advisories should drive change windows — token health is a single point of failure for continuous monitoring.",
          actions: [
            "<strong>Token</strong>: refresh OAuth client before weekend batch jobs — failure masks new criticals.",
            "<strong>Patch bundle</strong>: align IOS-XE upgrade on mgm-core-sw01 with ISE posture recertification.",
            "<strong>Comms</strong>: prepare customer-safe language for CVE-2026-1234 exposure counts."
          ]
        }
      ],
      suggestions: [
        "Rank open advisories by blast radius using only the sample grid.",
        "Draft an executive risk paragraph for April CAB.",
        "What questions should we ask Cisco TAC about ISE advisory mitigations?",
        "Propose KPIs for a weekly PSIRT stand-up."
      ]
    },
    fieldnotes: {
      copilotContextPlain:
        "Field notices: 2 active inventory matches, 26 devices flagged, feed sync OK; samples FN74218 optics C9500, FN73990 WLC. DD callout maps NaC remediation pipelines and SaC impact reports per FN. Meraki as Code identifies 12 cloud-managed APs in FN blast radius. AppDynamics correlates 3 affected business transactions. Salesforce Cases track FN-to-case escalation per account.",
      blocks: [
        {
          urgent: true,
          title: "Proactive response",
          text: "FN74218 pattern spans MGM Grand + Aria — batch serial export reduces duplicate incidents.",
          actions: [
            "<strong>Bulk</strong>: run impacted-serial CSV before opening net-new incidents per property.",
            "<strong>Pair</strong>: cross-check FN titles with PSIRT CVE list to avoid conflicting remediation advice.",
            "<strong>Owners</strong>: assign property leads for Bellagio pending review item explicitly."
          ]
        },
        {
          dd: true,
          title: "Digitized Delivery — FN remediation automation",
          text: "NaC pipelines auto-validate affected devices and stage remediation configs for field notices. Meraki as Code identifies 12 cloud-managed APs downstream of affected WLCs. AppDynamics correlates 3 business transactions impacted by FN-affected infrastructure.",
          actions: [
            "<strong>NaC</strong>: FN74218 has nac-validate staged for C9500 optics replacement; run before scheduling maintenance window.",
            "<strong>Meraki</strong>: 12 Meraki APs downstream of FN73990-affected C9800 WLC — assess wireless impact and plan failover.",
            "<strong>AppDynamics</strong>: 3 business transactions show degradation correlated with FN73990 WLC instability — prioritize WLC remediation.",
            "<strong>SaC</strong>: cross-site FN impact report covers all affected properties; use for coordinated remediation scheduling."
          ]
        },
        {
          title: "Salesforce — FN-to-case tracking",
          text: "Field notices trigger Salesforce Cases for affected accounts. 3 SF Cases track FN74218 and FN73990 escalation across MGM Grand, Bellagio, and Aria. PM and SDM consoles use SF data to track remediation commitments and customer communication.",
          actions: [
            "<strong>Case creation</strong>: auto-create SF Case when FN matches inventory devices; link to SDM incident for traceability.",
            "<strong>Account impact</strong>: SF Account health score factors in open FN exposure — visible in PM and Renewals consoles.",
            "<strong>Escalation</strong>: FN-triggered SF Cases inherit priority from FN severity; P2 for FN74218, P2 for FN73990."
          ]
        }
      ],
      suggestions: [
        "Create a customer email template explaining FN74218 impact and next steps.",
        "Which properties need a site visit based on FN and device flag counts?",
        "How do we prove API sync coverage to auditors for field notices?",
        "Suggest an incident linking strategy between FN74218 and existing cases.",
        "How should NaC remediation pipelines prioritize FN-affected devices given Meraki AP downstream impact?",
        "Which Salesforce Cases are linked to field notices and what’s their resolution status?"
      ]
    },
    "network-as-code": {
      copilotContextPlain:
        "Network as Code: 9 NaC solutions (Catalyst Center, SD-WAN, ISE, IOS-XE, 5 NaC tools), 42% automation readiness, 1,626 total devices (DNA + Meraki), estimated 3-yr ROI $886K.",
      blocks: [
        {
          dd: true,
          urgent: true,
          title: "Critical positioning — NaC ROI & adoption",
          text: "The customer's 1,284 DNA-managed + 342 Meraki devices represent $450K/yr in manual change costs. NaC delivers 72% reduction with $886K 3-year net ROI and 3.5-month payback. This is a high-confidence, fast-payback engagement.",
          actions: [
            "<strong>Immediate</strong>: Present ROI calculator to customer IT leadership — $886K net return is a strong executive-level story.",
            "<strong>Quick win</strong>: Run nac-collector on Catalyst Center + ISE this week to produce baseline YAML for 2 properties.",
            "<strong>Position</strong>: Frame NaC as risk reduction (60% fewer config-caused incidents = $72K/yr saved) alongside efficiency gains.",
            "<strong>Expand</strong>: Use Meraki as Code (DD-E) to extend automation to all 342 cloud-managed devices simultaneously.",
            "<strong>Validate</strong>: Propose nac-test + nac-validate as CI gates for all change windows — positions continuous compliance."
          ]
        },
        {
          title: "NaC adoption strategy by property",
          text: "MGM Grand and Corporate are highest readiness. Bellagio and Vdara follow. Aria has partial readiness. Springfield is IOS-XE only.",
          actions: [
            "<strong>Phase 1</strong>: Run nac-collector across Catalyst Center and ISE to generate YAML baselines this sprint.",
            "<strong>Phase 2</strong>: Build nac-validate schemas for SD-Access compliance and schedule CI gate reviews.",
            "<strong>Phase 3</strong>: Propose Terraform pipeline PoC for MGM Grand fabric as quick win for stakeholder buy-in.",
            "<strong>Training</strong>: Share NaC learning labs and Cisco Live LTRDCN-2459 with engineering."
          ]
        }
      ],
      suggestions: [
        "What is the full ROI breakdown for NaC across all 6 properties?",
        "Generate a nac-collector run plan for all Catalyst Center and ISE nodes in the estate.",
        "Which properties should be prioritized for NaC Phase 1 based on device count and readiness?",
        "How does adding Meraki as Code change the overall automation coverage percentage?",
        "Build an executive brief showing NaC payback period and risk-reduction metrics."
      ]
    },
    "services-as-code": {
      copilotContextPlain:
        "Services as Code: 14 SaC technologies, 7 dev waves, AI Assistant available, estimated 3-yr ROI $1,258K. Partner co-delivery route saves 20% on delivery costs.",
      blocks: [
        {
          dd: true,
          urgent: true,
          title: "Critical positioning — SaC portfolio ROI",
          text: "480 annual service deployments at $480K/yr manual cost. SaC delivers 65% automation, AI Assistant adds 40% time savings, and partner co-delivery saves $96K/yr. Total 3-yr net ROI: $1,258K with 2.5-month payback.",
          actions: [
            "<strong>Lead with AI</strong>: Demo SaC AI Assistant generating ACI config from plain English — this is the 'wow' moment for customer architects.",
            "<strong>ROI story</strong>: Present combined NaC + SaC ROI of $2.14M over 3 years in QBR context.",
            "<strong>Co-delivery</strong>: Position partner route for Meraki as Code (Wave E) and Unified Branch (Wave G) to accelerate.",
            "<strong>DDS integration</strong>: Auto-generate delivery reports from SaC pipeline outputs — zero manual documentation overhead.",
            "<strong>Compliance</strong>: ISE as Code + FMC as Code = continuous security policy validation, 60% audit-prep reduction."
          ]
        },
        {
          title: "SaC wave prioritization",
          text: "Waves A (ACI) and B (SD-WAN) have AI Assistant support. Wave D (ISE) aligns with NaC. Wave F (Catalyst Center) converges with NaC pipeline for dual value.",
          actions: [
            "<strong>Quick win</strong>: Demo SaC AI Assistant generating ACI tenant config from natural language.",
            "<strong>Align</strong>: Map SaC Wave F (CC) to NaC CC work — single pipeline, dual value.",
            "<strong>Partner</strong>: Evaluate co-delivery for Meraki as Code (Wave E) given branch expansion.",
            "<strong>DDS</strong>: Include DDS wave — automated runbooks and QBR packs from SDM data."
          ]
        }
      ],
      suggestions: [
        "What is the combined NaC + SaC ROI for this customer over 3 years?",
        "Build a 6-month SaC adoption roadmap prioritized by automation ROI.",
        "How does the SaC AI Assistant compare to manual Terraform authoring for ACI?",
        "What partner co-delivery options reduce time-to-value for ISE as Code?",
        "Generate an executive presentation on Digitized Delivery ROI for the next QBR."
      ]
    },
    "digital-document-solutions": {
      copilotContextPlain:
        "Digital Document Solutions: 12 templates, 8 active shares, 3 pending approvals, 24 docs generated this month. DDS automates delivery documentation tied to NaC and SaC pipeline outputs.",
      blocks: [
        {
          dd: true,
          title: "DDS — strategic document automation",
          text: "DDS closes the delivery loop by auto-generating customer-facing documents from NaC/SaC pipeline data. Network assessments, compliance reports, and QBR packs are built from live SDM data with zero manual effort.",
          actions: [
            "<strong>Automate</strong>: Wire NaC readiness scores and SaC wave progress into executive brief templates.",
            "<strong>Share</strong>: Set up recurring secure-link distribution for monthly Security Posture Reports.",
            "<strong>Approval</strong>: Clear 3 pending reviews — 2 incident summaries awaiting SDM sign-off.",
            "<strong>ROI proof</strong>: Use DDS to generate the Digitized Delivery ROI presentation automatically from calculator data."
          ]
        }
      ],
      suggestions: [
        "Generate a Network Assessment Report for all Las Vegas properties this quarter.",
        "Create a Digitized Delivery ROI executive brief from the NaC and SaC calculators.",
        "How can we automate QBR pack generation from SDM + NaC + SaC data?",
        "Set up monthly Security Posture Report distribution to all property stakeholders."
      ]
    },
  };

  let currentViewId = "overview";

  function renderAiInsights(viewId) {
    const mount = document.getElementById("ai-insights-mount");
    if (!mount) return;
    const pack = AI_INSIGHTS_BY_VIEW[viewId] || AI_INSIGHTS_BY_VIEW.overview;
    mount.innerHTML = pack.blocks
      .map(
        (b) => `
      <div class="ai-insight-block${b.urgent ? " ai-insight-block--urgent" : ""}${b.dd ? " ai-insight-block--dd" : ""}"${b.urgent ? ' data-insight-urgent="true"' : ""}>
        <h3>${b.title}</h3>
        <p>${b.text}</p>
        <ul class="ai-actions">${b.actions.map((a) => `<li>${a}</li>`).join("")}</ul>
      </div>`
      )
      .join("");

    const sugList = document.getElementById("ai-suggestions-list");
    if (!sugList) return;
    sugList.innerHTML = "";
    pack.suggestions.forEach((text) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-suggestion";
      btn.textContent = text;
      btn.addEventListener("click", function () {
        const ta = document.getElementById("ai-copilot-query");
        if (ta) {
          ta.value = text;
          ta.focus();
        }
      });
      li.appendChild(btn);
      sugList.appendChild(li);
    });

    var panAnn = document.getElementById("ai-panel-announce");
    if (panAnn) {
      var vt = titles[viewId] ? titles[viewId][0] : viewId;
      panAnn.textContent = "";
      window.setTimeout(function () {
        panAnn.textContent = "Insights and suggested questions updated for " + vt + ".";
      }, 80);
    }
  }

  function buildCopilotAgentContextBlock() {
    const pack = AI_INSIGHTS_BY_VIEW[currentViewId] || AI_INSIGHTS_BY_VIEW.overview;
    const t = titles[currentViewId];
    const titleLine = t ? t[0] : currentViewId;
    return `[Helix · mockup hub · Microsoft 365 Copilot context]\nView: ${titleLine}\n${pack.copilotContextPlain}\n\nUser question:\n`;
  }

  function initCopilotAgentPanel() {
    const copyBtn = document.getElementById("ai-btn-copy-copilot");
    const openBtn = document.getElementById("ai-btn-open-copilot");
    const ta = document.getElementById("ai-copilot-query");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        const q = ta && ta.value ? ta.value.trim() : "";
        const blob = buildCopilotAgentContextBlock() + (q || "(Add your question above.)");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(blob).then(
            function () {
              setAppStatusMessage(
                "Copied context and question to clipboard. Paste into Microsoft 365 Copilot or your SDM-linked Copilot experience."
              );
            },
            function () {
              window.prompt("Copy this text for Copilot:", blob.slice(0, 4000));
            }
          );
        } else {
          window.prompt("Copy this text for Copilot:", blob.slice(0, 4000));
        }
      });
    }
    if (openBtn) {
      openBtn.addEventListener("click", function () {
        window.open("https://www.microsoft365.com/chat", "_blank", "noopener,noreferrer");
      });
    }
  }

  /** Human titles for the integration wave grid (W4 is merged in buildWaveGridModels). */
  const WAVE_GRID_TITLE = {
    "dna-center": "Catalyst Center",
    tac: "TAC API",
    "smart-licensing": "Smart Licensing",
    thousandeyes: "ThousandEyes",
    umbrella: "Umbrella",
    stealthwatch: "Stealthwatch / SNA",
    dwdm: "DWDM / optical",
    "cisco-iq": "Cisco IQ",
    cspc: "CSPC",
    ise: "ISE + ISE as Code",
    "cisco-spaces": "Cisco Spaces",
    "secure-access": "Secure Access",
    "psirt-openvuln": "PSIRT / OpenVuln",
    "field-notices": "Field notices",
    fmc: "FMC (Firepower)"
  };

  const WAVE_GRID_META = {
    "dna-center": "Inventory, assurance, sites",
    tac: "Service requests, linkage",
    "smart-licensing": "SSM / SWAPI alignment",
    thousandeyes: "Synthetic paths, alerts",
    umbrella: "DNS / SIG",
    stealthwatch: "Flow analytics",
    dwdm: "EMS telemetry",
    "cisco-iq": "Insights",
    cspc: "Collector / upload",
    ise: "ERS · OpenAPI · pxGrid — policy/config automation APIs · export/import pipelines",
    "cisco-spaces": "Location / DX",
    "secure-access": "SSE / ZTNA",
    "psirt-openvuln":
      'OAuth client @ <code style="font-size:13px;color:#93c5fd">id.cisco.com</code> · advisories · CVE ↔ inventory',
    "field-notices": "Field Notice API / feed · PID · serial · software correlation",
    fmc: "FTD / managed-device inventory, access policies, objects & rules — FMC REST parity"
  };

  /** Aligned to backend VALID_SOURCES + sourceAdmin seed (auth_type, schedule, notes). */
  const INTEGRATION_SOURCES = [
    { name: "dna-center", on: true, wave: "W1", note: "Catalyst Center inventory & assurance", authType: "basic-token", schedule: "*/30 * * * *", apiBuild: "DNA Center intent APIs · <code>/dna/intent/api/v1</code> family" },
    { name: "tac", on: true, wave: "W2", note: "TAC Service Request API", authType: "api-key-secret", schedule: "*/15 * * * *", apiBuild: "<code>tools.cisco.com/tac/api</code> · contract-scoped SRs" },
    { name: "smart-licensing", on: true, wave: "W3", note: "SSM / SWAPI", authType: "oauth2-client-credentials", schedule: "0 * * * *", apiBuild: "<code>swapi.cisco.com</code> · Smart Account consumption" },
    { name: "webex", on: false, wave: "W4", note: "Control Hub", authType: "bot-token-oauth", schedule: "manual", apiBuild: "Webex REST · Control Hub · spaces & meetings for war rooms" },
    { name: "support-api", on: false, wave: "W4", note: "EoX / Bug / Contract", authType: "api-key-secret", schedule: "0 2 * * *", apiBuild: "Cisco Support APIs · case enrichment" },
    { name: "teams", on: false, wave: "—", note: "Microsoft Teams", authType: "oauth2-bot", schedule: "manual", apiBuild: "Graph / Bot Framework (non-Cisco bridge)" },
    { name: "thousandeyes", on: false, wave: "W5", note: "Synthetics & path visibility", authType: "api-token", schedule: "*/15 * * * *", apiBuild: "ThousandEyes API v6 · tests & alerts" },
    { name: "umbrella", on: false, wave: "W6", note: "DNS / SIG", authType: "api-key-oauth", schedule: "0 * * * *", apiBuild: "Umbrella Reporting / Investigate APIs (entitled)" },
    { name: "stealthwatch", on: false, wave: "W7", note: "Secure Network Analytics", authType: "api-basic-or-token", schedule: "*/30 * * * *", apiBuild: "SNA REST · flow & security events" },
    { name: "dwdm", on: false, wave: "W8", note: "Optical / transport EMS", authType: "collector-or-ems", schedule: "0 * * * *", apiBuild: "EMS or collector adapter · transport health" },
    { name: "cisco-iq", on: false, wave: "W9", note: "Insights", authType: "oauth2-or-api-key", schedule: "0 4 * * *", apiBuild: "Cisco IQ APIs (product-specific)" },
    { name: "cspc", on: false, wave: "W10", note: "Collector registration", authType: "collector-registration", schedule: "0 1 * * *", apiBuild: "CSPC → Smart Account upload alignment" },
    { name: "ise", on: false, wave: "W11", note: "ISE + ISE as Code", authType: "ers-pxgrid", schedule: "*/30 * * * *", apiBuild: "ERS · OpenAPI · <strong>pxGrid</strong> · infra-as-code export/import for policy artifacts", spotlight: true },
    { name: "cisco-spaces", on: false, wave: "W12", note: "Location services", authType: "oauth2-api-key", schedule: "0 * * * *", apiBuild: "Spaces CDP / partner APIs" },
    { name: "secure-access", on: false, wave: "W13", note: "SSE / ZTNA", authType: "oauth2-client-credentials", schedule: "*/15 * * * *", apiBuild: "Secure Access (SSE) diagnostics APIs" },
    { name: "psirt-openvuln", on: false, wave: "W14", note: "PSIRT advisories & CVEs", authType: "oauth2-client-credentials", schedule: "0 3 * * *", apiBuild: "<strong>OpenVuln</strong> · OAuth <code>id.cisco.com</code> · <code>OPENVULN_CLIENT_ID/SECRET</code>", spotlight: true },
    { name: "field-notices", on: false, wave: "W15", note: "Cisco Field Notices", authType: "api-key-oauth", schedule: "0 4 * * *", apiBuild: "FN API/feed · <code>FIELD_NOTICE_API_BASE_URL</code> + <code>CISCO_FN_API_KEY</code> · PID/serial/software match", spotlight: true },
    { name: "fmc", on: true, wave: "W16", note: "Firepower Management Center — FTD inventory & access policies", authType: "api-token-or-basic", schedule: "*/30 * * * *", apiBuild: "FMC REST API · managed devices, access rules, network & host objects · policy deployment status · <code>/api/</code> per Cisco FMC guide", spotlight: true }
  ];

  /**
   * Mock placement on a 6-phase Cisco customer journey (0=Discover … 5=Expand).
   * phaseIndex + maturityPct are illustrative; deep links CSPC (W10) and Cisco IQ (W9).
   */
  const MVP_JOURNEY_BY_WAVE = {
    W1: {
      phaseIndex: 4,
      maturityPct: 88,
      mapNote:
        "Journey: <strong>Optimize (5)</strong> — Catalyst Center APIs power daily ops; customer realizes value through automated assurance and inventory truth.",
      rec: "Advance <strong>closed-loop remediation</strong>: bind DNA issues to CAB + PM RAID with property-scoped owners; export site health for renewal QBR evidence."
    },
    W2: {
      phaseIndex: 5,
      maturityPct: 91,
      mapNote:
        "Journey: <strong>Expand (6)</strong> — TAC linkage is a portfolio signal; use SR patterns to steer adoption and executive narrative beyond break/fix.",
      rec: "Productize <strong>SR themes → playbooks</strong>; feed top five recurring classes into CX command and Field Notice correlation for proactive outreach."
    },
    W3: {
      phaseIndex: 4,
      maturityPct: 84,
      mapNote:
        "Journey: <strong>Optimize (5)</strong> — Smart Licensing is operational; focus shifts to entitlement hygiene vs physical estate (CSPC alignment).",
      rec: "Run <strong>entitlement vs deploy</strong> reconciliation monthly; pair SWAPI reads with CSPC uploads so true-up stories match hardware reality."
    },
    W4: {
      phaseIndex: 3,
      maturityPct: 52,
      mapNote:
        "Journey: <strong>Implement (4)</strong> — Webex + Support APIs bridge collaboration and entitlement data; still maturing for automation.",
      rec: "Complete <strong>OAuth product pairing</strong> for Control Hub and Support API in one DevNet project; script EoX lookups into incident templates."
    },
    W5: {
      phaseIndex: 3,
      maturityPct: 49,
      mapNote:
        "Journey: <strong>Implement (4)</strong> — ThousandEyes paths validate WAN assumptions before customer commits to SLO dashboards.",
      rec: "Publish <strong>TE test packs per property tier</strong>; align alerts to DNA issue categories so NOC and CX see one fault language."
    },
    W6: {
      phaseIndex: 2,
      maturityPct: 36,
      mapNote:
        "Journey: <strong>Commit (3)</strong> — Umbrella org alignment and reporting entitlements precede full DNS/SIG analytics automation.",
      rec: "Prioritize <strong>Smart Account org mapping</strong> for umbrella virtual accounts; schedule Investigate API pilot on Corporate HQ + Detroit only."
    },
    W7: {
      phaseIndex: 3,
      maturityPct: 58,
      mapNote:
        "Journey: <strong>Implement (4)</strong> — SNA flows augment DNA; customer is wiring evidence into SOC workflows.",
      rec: "Standardize <strong>flow export to SIEM</strong> naming; tie security events to ISE session partitions for faster constrained-device hunts."
    },
    W8: {
      phaseIndex: 1,
      maturityPct: 28,
      mapNote:
        "Journey: <strong>Evaluate (2)</strong> — Optical/EMS integrations are often vendor-specific; still in PoV / architecture.",
      rec: "Lock <strong>EMS interface choice</strong> per region; avoid duplicate transport telemetry that competes with DNA path health — consolidate KPIs."
    },
    W9: {
      phaseIndex: 1,
      maturityPct: 38,
      deep: "iq",
      mapNote:
        "Journey: <strong>Evaluate (2)</strong> — Cisco IQ insight packs are entitlement-bound; stage gates customer before estate-wide API polling.",
      rec: "<strong>Cisco IQ:</strong> confirm OAuth scopes + PAK mapping; pilot Network health + Security posture packs on Bellagio + Corporate HQ; widen poll only after CSPC coverage ≥80% sites."
    },
    W10: {
      phaseIndex: 3,
      maturityPct: 44,
      deep: "cspc",
      mapNote:
        "Journey: <strong>Implement (4)</strong> — CSPC collectors are the Smart Account upload path; prerequisite for trustworthy IQ + licensing stories.",
      rec: "<strong>CSPC:</strong> close collector gaps on remote properties first; validate nightly upload window vs cron; remediate devices pending first inventory push before IQ narratives."
    },
    W11: {
      phaseIndex: 3,
      maturityPct: 62,
      mapNote:
        "Journey: <strong>Implement (4)</strong> — ISE + ISE as Code sits mid-implementation; pxGrid and ERS automation are active delivery threads.",
      rec: "Freeze <strong>golden policy bundles</strong> per property class; promote ISE as Code pipeline to Optimize when drift checks pass two consecutive sprints."
    },
    W12: {
      phaseIndex: 2,
      maturityPct: 33,
      mapNote:
        "Journey: <strong>Commit (3)</strong> — Spaces CDP entitlements and data residency reviews precede full campus digital twin roll-out.",
      rec: "Anchor <strong>location use cases</strong> to named MGM venues; avoid estate-wide enable until privacy assessment completes for guest Wi‑Fi paths."
    },
    W13: {
      phaseIndex: 2,
      maturityPct: 31,
      mapNote:
        "Journey: <strong>Commit (3)</strong> — Secure Access / SSE diagnostics APIs follow ZTNA procurement and IdP integration decisions.",
      rec: "Sequence <strong>SSE pilots</strong> after ISE posture baselines stabilize; reuse same service account model as DNA API for audit simplicity."
    },
    W14: {
      phaseIndex: 4,
      maturityPct: 71,
      mapNote:
        "Journey: <strong>Optimize (5)</strong> — OpenVuln operationalized for CVE exposure; batch cadence still requires human triage.",
      rec: "Automate <strong>OpenVuln → device join</strong> on serial/PID; escalate only criticals + FN-linked patterns to renewal risk slides."
    },
    W15: {
      phaseIndex: 4,
      maturityPct: 68,
      mapNote:
        "Journey: <strong>Optimize (5)</strong> — Field Notice ingestion supports operational cadence; ties to PSIRT for customer trust.",
      rec: "Templatize <strong>FN response bullets</strong> per property; ensure W15 job runs before weekly CAB while DNA assurance jobs remain green."
    },
    W16: {
      phaseIndex: 4,
      maturityPct: 72,
      mapNote:
        "Journey: <strong>Optimize (5)</strong> — FMC REST parity lands firewall policy in the same API-first story as DNA and ISE.",
      rec: "Reconcile <strong>FTD rev vs DNA intent</strong> weekly; add policy export snapshots to change evidence for regulated properties (Detroit, National Harbor)."
    }
  };

  const OVERVIEW_SYNC_LINES = {
    "dna-center": 'Last sync <strong style="color:var(--ok)">12 min ago</strong> · 1,284 devices',
    tac: 'Last sync <strong style="color:var(--ok)">8 min ago</strong> · 42 cases',
    "smart-licensing": 'Last sync <strong style="color:var(--ok)">44 min ago</strong> · 98% compliant',
    fmc: 'Last sync <strong style="color:var(--ok)">22 min ago</strong> · 86 FTD/LINA devices · policy rev 412'
  };

  const CONSOLE_MAP_ROWS = [
    ["Cisco API Console (DevNet)", "Gate 1–17", "OAuth clients, API products, entitlements"],
    ["Cisco Catalyst Center", "1", "Inventory, sites, health, issues"],
    ["SSM / Smart Licensing portals", "3", "Smart Account, consumption, compliance"],
    ["Support / TAC", "2, 4", "SR lifecycle, contract/EoX/bug enrichment"],
    ["WebEx Control Hub", "4", "Spaces, meetings, war rooms"],
    ["ThousandEyes", "5", "Tests, alerts, path visibility"],
    ["Cisco Umbrella", "6", "DNS / SIG–class reporting & investigate"],
    ["Secure Network Analytics (Stealthwatch)", "7", "Flow & security analytics"],
    ["Optical / DWDM EMS", "8", "Transport health"],
    ["Cisco IQ", "9", "Insights (entitlement-scoped)"],
    ["CSPC / collector", "10", "Collection & Smart Account alignment"],
    ["Cisco ISE + ISE as Code", "11", "Identity, posture, ERS/OpenAPI/pxGrid, policy-as-code"],
    ["Cisco Spaces", "12", "Location & digital experience"],
    ["Cisco Secure Access", "13", "SSE / ZTNA diagnostics"],
    ["PSIRT / OpenVuln", "14", "Advisories, CVE exposure vs estate"],
    ["Cisco Field Notices", "15", "FN impact on PID, serial, software"],
    ["Cisco Firepower Management Center (FMC)", "16", "FTD inventory, access policies, objects — REST API parity"],
    ["<strong style='color:#00a1e0'>Salesforce CRM</strong>", "<strong>17</strong>", "Cases, Accounts, Contacts, Opportunities, Entitlements, Service Contracts — REST v59.0 / SOQL"],
    ["Meraki Dashboard", "DD-K", "Cloud-managed devices, config templates, site health (inline on Devices, Properties, Integrations)"],
    ["AppDynamics APM", "DD-L", "App health, business transactions, incident correlation (inline on Devices, Incidents, Overview)"]
  ];

  /** Resort / venue stock photos (Unsplash) — small thumbnails on property cards; CSP allows https: images. */
  const PROPERTY_CARD_PHOTOS = [
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=240&h=180&fit=crop&q=80",
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=240&h=180&fit=crop&q=80",
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=240&h=180&fit=crop&q=80",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=240&h=180&fit=crop&q=80",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=240&h=180&fit=crop&q=80",
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=240&h=180&fit=crop&q=80",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=240&h=180&fit=crop&q=80",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=240&h=180&fit=crop&q=80"
  ];

  function propertyCardPhotoUrl(index) {
    return PROPERTY_CARD_PHOTOS[index % PROPERTY_CARD_PHOTOS.length];
  }

  function propertyCardVariantClass(index) {
    return "property-card--v" + index % 6;
  }

  /**
   * Mock MGM portfolio: Las Vegas strip / resort campus + remote regional & corporate sites.
   * region: "lv" | "remote"
   */
  const MGM_PROPERTIES = [
    {
      name: "MGM Grand",
      region: "lv",
      kind: "Resort",
      site: "SITE-MGM-01",
      locale: "Las Vegas, NV",
      devices: 428,
      incidents: 3,
      networkExposureScore: 72,
      progLabel: "Wave rollout (DNAC + ISE)",
      progPct: 92,
      footer: 'Primary DNA site <code style="font-size:12px">SITE-MGM-01</code>',
      waves: ["W1", "W3", "W5", "W8", "W14", "W16"]
    },
    {
      name: "Bellagio",
      region: "lv",
      kind: "Resort",
      site: "SITE-BEL-01",
      locale: "Las Vegas, NV",
      devices: 512,
      incidents: 2,
      networkExposureScore: 88,
      progLabel: "Telemetry coverage (TE / SNA)",
      progPct: 88,
      footer: 'SNA flow export <span class="tag tag-auth">W7</span>',
      waves: ["W1", "W6", "W7", "W11"]
    },
    {
      name: "Aria",
      region: "lv",
      kind: "Resort",
      site: "SITE-ARIA-01",
      locale: "Las Vegas, NV",
      devices: 391,
      incidents: 4,
      networkExposureScore: 91,
      progLabel: "ISE posture adoption",
      progPct: 76,
      footer: '<span class="tag tag-build">ISE as Code</span> baseline drift check weekly',
      waves: ["W1", "W3", "W5", "W11", "W14"]
    },
    {
      name: "Vdara",
      region: "lv",
      kind: "Resort",
      site: "SITE-VDARA-01",
      locale: "Las Vegas, NV",
      devices: 182,
      incidents: 0,
      networkExposureScore: 35,
      progLabel: "Wireless assurance readiness",
      progPct: 91,
      footer: "Non-gaming tower · shared NOC routing",
      waves: ["W1", "W5", "W12"]
    },
    {
      name: "Park MGM",
      region: "lv",
      kind: "Resort",
      site: "SITE-PARK-01",
      locale: "Las Vegas, NV",
      devices: 267,
      incidents: 1,
      networkExposureScore: 48,
      progLabel: "Integration wave completeness",
      progPct: 85,
      footer: 'Park theater cluster · <code style="font-size:12px">SITE-PARK-01</code>',
      waves: ["W1", "W3", "W6", "W10"]
    },
    {
      name: "New York-New York",
      region: "lv",
      kind: "Resort",
      site: "SITE-NYNY-01",
      locale: "Las Vegas, NV",
      devices: 224,
      incidents: 2,
      networkExposureScore: 55,
      progLabel: "Casino floor network hardening",
      progPct: 79,
      footer: "Roller-coaster venue · segmented WLAN",
      waves: ["W1", "W5", "W7"]
    },
    {
      name: "Luxor",
      region: "lv",
      kind: "Resort",
      site: "SITE-LUXOR-01",
      locale: "Las Vegas, NV",
      devices: 198,
      incidents: 1,
      networkExposureScore: 42,
      progLabel: "DNAC site compliance",
      progPct: 83,
      footer: "Pyramid arena backhaul",
      waves: ["W1", "W3", "W8"]
    },
    {
      name: "Excalibur",
      region: "lv",
      kind: "Resort",
      site: "SITE-EXCAL-01",
      locale: "Las Vegas, NV",
      devices: 176,
      incidents: 0,
      networkExposureScore: 32,
      progLabel: "Guest Wi-Fi capacity plan",
      progPct: 81,
      footer: "Shared core with MGM campus",
      waves: ["W1", "W5"]
    },
    {
      name: "Mandalay Bay",
      region: "lv",
      kind: "Resort",
      site: "SITE-MBAY-01",
      locale: "Las Vegas, NV",
      devices: 445,
      incidents: 3,
      networkExposureScore: 79,
      progLabel: "Events center bandwidth readiness",
      progPct: 87,
      footer: "Convention hall · fiber link diversity",
      waves: ["W1", "W3", "W6", "W8", "W14", "W16"]
    },
    {
      name: "Delano Las Vegas",
      region: "lv",
      kind: "Resort",
      site: "SITE-DELANO-01",
      locale: "Las Vegas, NV",
      devices: 94,
      incidents: 0,
      networkExposureScore: 28,
      progLabel: "Aligned to Mandalay DNA fabric",
      progPct: 89,
      footer: "Tower suites · ISE policy inheritance",
      waves: ["W1", "W11"]
    },
    {
      name: "The Cosmopolitan",
      region: "lv",
      kind: "Resort",
      site: "SITE-COSMO-01",
      locale: "Las Vegas, NV",
      devices: 338,
      incidents: 2,
      networkExposureScore: 68,
      progLabel: "Marquee ops telemetry",
      progPct: 84,
      footer: "High-density wireless · <span class=\"tag tag-sched\">W5</span>",
      waves: ["W1", "W3", "W5", "W14"]
    },
    {
      name: "Corporate HQ",
      region: "remote",
      kind: "Office",
      site: "SITE-MGM-CORP-01",
      locale: "Las Vegas, NV (HQ)",
      devices: 156,
      incidents: 1,
      networkExposureScore: 40,
      progLabel: "Umbrella + TE integration",
      progPct: 95,
      footer: "Enterprise IT · identity SSO bridge",
      waves: ["W1", "W5", "W9", "W10"]
    },
    {
      name: "MGM Grand Detroit",
      region: "remote",
      kind: "Resort",
      site: "SITE-DETROIT-01",
      locale: "Detroit, MI",
      devices: 612,
      incidents: 2,
      networkExposureScore: 94,
      progLabel: "Regional DNA hub completeness",
      progPct: 90,
      footer: "Midwest failover hub",
      waves: ["W1", "W3", "W7", "W14", "W16"]
    },
    {
      name: "Beau Rivage",
      region: "remote",
      kind: "Resort",
      site: "SITE-BEAU-01",
      locale: "Biloxi, MS",
      devices: 287,
      incidents: 0,
      networkExposureScore: 42,
      progLabel: "Coastal WAN resilience",
      progPct: 86,
      footer: "Gulf properties anchor",
      waves: ["W1", "W5", "W6"]
    },
    {
      name: "MGM National Harbor",
      region: "remote",
      kind: "Resort",
      site: "SITE-NHARB-01",
      locale: "Oxon Hill, MD",
      devices: 198,
      incidents: 1,
      networkExposureScore: 45,
      progLabel: "DMV metro path diversity",
      progPct: 82,
      footer: "Potomac cross-connect",
      waves: ["W1", "W3", "W11"]
    },
    {
      name: "MGM Springfield",
      region: "remote",
      kind: "Resort",
      site: "SITE-SPRING-01",
      locale: "Springfield, MA",
      devices: 142,
      incidents: 0,
      networkExposureScore: 34,
      progLabel: "Northeast compliance pack",
      progPct: 78,
      footer: "State regulatory logging hooks",
      waves: ["W1", "W5", "W10"]
    },
    {
      name: "Borgata",
      region: "remote",
      kind: "Resort",
      site: "SITE-BORG-01",
      locale: "Atlantic City, NJ",
      devices: 356,
      incidents: 2,
      networkExposureScore: 64,
      progLabel: "Boardwalk property mesh health",
      progPct: 80,
      footer: "Marina + water-front RF design",
      waves: ["W1", "W6", "W7", "W14"]
    },
    {
      name: "MGM Northfield Park",
      region: "remote",
      kind: "Entertainment",
      site: "SITE-NFP-01",
      locale: "Northfield, OH",
      devices: 89,
      incidents: 0,
      networkExposureScore: 28,
      progLabel: "Racino VLAN segmentation",
      progPct: 74,
      footer: "Smaller footprint · template site",
      waves: ["W1", "W5"]
    }
  ];

  /** One-line copy for Properties tab cards (mock portfolio). */
  const PROPERTY_CARD_DESCRIPTORS = {
    "MGM Grand": "Iconic Strip mega-resort — flagship DNA site, casino and room estate scale.",
    Bellagio: "Luxury resort — fountain campus, retail concourse, and dense guest Wi‑Fi.",
    Aria: "Modern glass tower — strong ISE posture program and converged resort LAN.",
    Vdara: "All-suite non-gaming tower — quiet hospitality spine linked to Bellagio services.",
    "Park MGM": "Mid-Strip resort and theater — Park Theater cluster and shared park Wi‑Fi.",
    "New York-New York": "Themed casino-resort — Brooklyn Bridge zone and roller-coaster venue networking.",
    Luxor: "Pyramid landmark — arena events and pyramid-atrium wireless design.",
    Excalibur: "Castle-themed value resort — family and tour traffic on shared campus core.",
    "Mandalay Bay": "Convention and events giant — Shark Reef hall, exhibit hall bandwidth.",
    "Delano Las Vegas": "Boutique tower — inherits Mandalay fabric and suite-heavy policy sets.",
    "The Cosmopolitan": "Contemporary Strip resort — Marquee ops and ultra-high-density wireless.",
    "Corporate HQ": "Enterprise IT hub — SSO, Umbrella, and TE integration for the portfolio.",
    "MGM Grand Detroit": "Urban Midwest flagship — regional DNA hub and casino-resort stack.",
    "Beau Rivage": "Gulf Coast anchor — coastal WAN resilience and storm-season operations.",
    "MGM National Harbor": "Potomac waterfront — DMV metro cross-connect and compact core.",
    "MGM Springfield": "Massachusetts full-service casino — state regulatory and logging posture.",
    Borgata: "Atlantic City flagship — marina district mesh and boardwalk RF planning.",
    "MGM Northfield Park": "Ohio racino — smaller template site with segmented VLANs."
  };

  function mockPropertyDescriptor(p) {
    return PROPERTY_CARD_DESCRIPTORS[p.name] || `${p.kind} venue · ${p.locale}.`;
  }

  /**
   * Top exposure tier: highest scores plus ties at the third rank (for mock + simple live heuristic).
   * @param {{ key: string, score: number }[]} entries
   * @returns {Set<string>}
   */
  function topExposureTierKeySet(entries) {
    var sorted = entries
      .filter(function (e) {
        return typeof e.score === "number" && e.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });
    if (!sorted.length) return new Set();
    var cutoff = sorted[Math.min(2, sorted.length - 1)].score;
    return new Set(
      sorted
        .filter(function (e) {
          return e.score >= cutoff;
        })
        .map(function (e) {
          return e.key;
        })
    );
  }

  /**
   * Places the current top exposure tier (Splunk-magenta outline cohort) first, highest score first;
   * remaining properties follow by score, then original order.
   */
  function orderPropertiesWithExposureGroupFirst(list, keyFn, scoreFn) {
    var decorated = list.map(function (item, origIdx) {
      var s = scoreFn(item);
      return {
        item: item,
        key: keyFn(item),
        score: typeof s === "number" && !isNaN(s) ? s : 0,
        origIdx: origIdx
      };
    });
    var tierKeys = topExposureTierKeySet(
      decorated.map(function (d) {
        return { key: d.key, score: d.score };
      })
    );
    decorated.sort(function (a, b) {
      var aCrit = tierKeys.has(a.key);
      var bCrit = tierKeys.has(b.key);
      if (aCrit !== bCrit) return aCrit ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return a.origIdx - b.origIdx;
    });
    return {
      ordered: decorated.map(function (d) {
        return d.item;
      }),
      tierKeys: tierKeys
    };
  }

  function livePropertyDescriptor(p) {
    var raw = p.description || p.summary || p.notes;
    if (raw != null && String(raw).trim() !== "") return String(raw).trim();
    var t = p.property_type || "Estate";
    return "Managed " + t + " in the live portfolio — device and incident totals from API.";
  }

  function propertyCardHtml(p, idx, criticalNames) {
    const badgeClass = p.region === "lv" ? "region-badge region-badge--lv" : "region-badge region-badge--remote";
    const regionShort = p.region === "lv" ? "LV" : "Remote";
    const v = propertyCardVariantClass(idx);
    const photo = propertyCardPhotoUrl(idx);
    const photoAlt = `${p.name} — reference property photo`;
    const desc = escHtml(mockPropertyDescriptor(p));
    const exposureCrit =
      criticalNames && criticalNames.has(p.name) ? " property-card--exposure-critical" : "";
    const exposureSr =
      criticalNames && criticalNames.has(p.name)
        ? '<span class="visually-hidden"> Top network exposure index in this portfolio — prioritize remediation.</span>'
        : "";
    return `
        <div class="card property-card ${v}${exposureCrit}" data-region="${p.region}">
          <div class="property-card__head">
            <h3>${p.name} <span class="${badgeClass}">${regionShort}</span>${exposureSr}</h3>
            <img class="property-card__photo" src="${photo}" width="80" height="60" alt="${photoAlt.replace(/"/g, "&quot;")}" loading="lazy" decoding="async" />
          </div>
          <p class="property-card__desc">${desc}</p>
          <div class="meta">${p.kind} · ${p.devices.toLocaleString()} devices · <strong>${p.incidents}</strong> open incidents</div>
          <div class="progress-wrap"><div class="progress-lbl"><span>${p.progLabel}</span><span>${p.progPct}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${p.progPct}%"></div></div></div>
          <div class="stat-inline" style="margin-top:8px">${p.footer}</div>
        </div>`;
  }

  function renderPropertyCards() {
    const el = document.getElementById("property-cards-grid");
    if (!el) return;
    const pack = orderPropertiesWithExposureGroupFirst(
      MGM_PROPERTIES,
      function (p) {
        return p.name;
      },
      function (p) {
        return p.networkExposureScore;
      }
    );
    el.innerHTML = pack.ordered.map((p, i) => propertyCardHtml(p, i, pack.tierKeys)).join("");
  }

  function renderPropertySiteMap() {
    const body = document.getElementById("property-site-map-body");
    if (!body) return;
    const ordered = orderPropertiesWithExposureGroupFirst(
      MGM_PROPERTIES,
      function (p) {
        return p.name;
      },
      function (p) {
        return p.networkExposureScore;
      }
    ).ordered;
    body.innerHTML = ordered
      .map(
        (p) =>
          `<tr><td>${p.name}</td><td><code style="font-size:13px">${p.site}</code></td><td>${p.locale}</td></tr>`
      )
      .join("");
  }

  function renderPropertyTechDl() {
    const dl = document.getElementById("property-tech-dl");
    if (!dl) return;
    const ordered = orderPropertiesWithExposureGroupFirst(
      MGM_PROPERTIES,
      function (p) {
        return p.name;
      },
      function (p) {
        return p.networkExposureScore;
      }
    ).ordered;
    dl.innerHTML = ordered.map((p) => {
      const waves = p.waves.map((w) => `<span class="wave">${w}</span>`).join(" ");
      return `<dt>${p.name}</dt><dd>${waves}</dd>`;
    }).join("");
  }

  function applyPropertyRegionFilter(filter) {
    document.querySelectorAll(".property-filter-chips .chip").forEach((c) => {
      c.classList.toggle("on", c.getAttribute("data-property-region-filter") === filter);
    });
    document.querySelectorAll(".property-card").forEach((card) => {
      const r = card.getAttribute("data-region");
      card.classList.toggle("is-hidden", filter !== "all" && r !== filter);
    });
  }

  function initPropertyFilters() {
    const wrap = document.querySelector(".property-filter-chips");
    if (!wrap) return;
    wrap.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip[data-property-region-filter]");
      if (!chip) return;
      applyPropertyRegionFilter(chip.getAttribute("data-property-region-filter"));
    });
    wrap.addEventListener("keydown", (e) => {
      const chip = e.target.closest(".chip[data-property-region-filter]");
      if (!chip || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      applyPropertyRegionFilter(chip.getAttribute("data-property-region-filter"));
    });
  }

  function buildWaveGridModels() {
    const sorted = INTEGRATION_SOURCES.filter((s) => /^W\d+$/.test(s.wave)).sort(
      (a, b) => parseInt(a.wave.slice(1), 10) - parseInt(b.wave.slice(1), 10)
    );
    const rows = [];
    let lastWave = null;
    for (const s of sorted) {
      if (s.wave === "W4") {
        if (lastWave === "W4") continue;
        lastWave = "W4";
        rows.push({
          wave: "W4",
          title: "WebEx · Support APIs",
          meta: "War rooms, EoX, bugs",
          spotlight: false
        });
        continue;
      }
      lastWave = s.wave;
      rows.push({
        wave: s.wave,
        title: WAVE_GRID_TITLE[s.name] || s.name,
        meta: WAVE_GRID_META[s.name] || s.note,
        spotlight: !!s.spotlight
      });
    }
    return rows;
  }

  function renderIntegrationWaveCards() {
    const el = document.getElementById("integration-wave-cards");
    if (!el) return;
    el.innerHTML = buildWaveGridModels()
      .map(
        (r) => `
        <div class="card${r.spotlight ? " spotlight" : ""}">
          <h3><span class="wave">${r.wave}</span> ${r.title}</h3>
          <div class="meta">${r.meta}</div>
        </div>`
      )
      .join("");
  }

  function renderOverviewSyncCards() {
    const el = document.getElementById("overview-sync-cards");
    if (!el) return;
    const enabled = INTEGRATION_SOURCES.filter((s) => s.on && /^W\d+$/.test(s.wave)).sort(
      (a, b) => parseInt(a.wave.slice(1), 10) - parseInt(b.wave.slice(1), 10)
    );
    const enabledHtml = enabled
      .map((s) => {
        const title = WAVE_GRID_TITLE[s.name] || s.name;
        const line = OVERVIEW_SYNC_LINES[s.name] || "Scheduled — enable in sources admin";
        return `<div class="card"><h3><span class="wave">${s.wave}</span> ${title}</h3><div class="meta">${line}</div></div>`;
      })
      .join("");

    const staticHtml = `
      <div class="card"><h3><span class="wave">W5–10</span> Observability stack</h3><div class="meta">ThousandEyes, Umbrella, SNA <strong style="color:var(--warn)">Scheduled</strong> · not run today</div></div>
      <div class="card"><h3><span class="wave">W11</span> ISE as Code</h3><div class="meta">Last snapshot <strong style="color:var(--muted)">Manual</strong> · policy bundle v2026.04.02</div></div>
      <div class="card"><h3><span class="wave">W14–15</span> Security feeds</h3><div class="meta">OpenVuln <strong style="color:var(--ok)">03:00</strong> · Field notices <strong style="color:var(--ok)">04:00</strong></div></div>`;

    el.innerHTML = enabledHtml + staticHtml;
  }

  function renderConsoleMapTable() {
    const body = document.getElementById("console-map-tbody");
    if (!body) return;
    body.innerHTML = CONSOLE_MAP_ROWS.map(
      ([surface, wave, themes]) =>
        `<tr><td>${surface}</td><td>${wave}</td><td>${themes}</td></tr>`
    ).join("");
  }

  function renderSources() {
    const el = document.getElementById("source-mock-cards");
    if (!el) return;
    el.innerHTML = INTEGRATION_SOURCES.map(
      (s) => `
        <div class="card source-card${s.spotlight ? " spotlight" : ""}">
          <div style="flex:1;min-width:0">
            <h3 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 6px">
              <code style="font-size:15px">${s.name}</code>
              <span class="wave">${s.wave}</span>
              ${s.spotlight ? '<span class="tag tag-build">API build</span>' : ""}
            </h3>
            <div class="meta"><span class="status-dot ${s.on ? "on" : "off"}"></span>${s.note}</div>
            <div class="source-tags">
              <span class="tag tag-auth">${s.authType}</span>
              <span class="tag tag-sched">${s.schedule}</span>
            </div>
            <div class="api-line">${s.apiBuild}</div>
            <div class="btn-row" style="margin-top:10px">
              <button class="btn btn-ghost" type="button" style="padding:6px 10px;font-size:14px">Save</button>
              <button class="btn btn-ghost" type="button" style="padding:6px 10px;font-size:14px">Test connection</button>
            </div>
          </div>
          <div class="toggle ${s.on ? "on" : ""}" title="enabled in seed"></div>
        </div>`
    ).join("");
  }

  /** Canonical mock figures — align with visible KPIs across hub views */
  const APP_DATA_SNAPSHOT = {
    openIncidents: 14,
    p1p2: 2,
    p1Id: "INC-20244",
    p2Ise: "INC-20243",
    tacLinked: 6,
    tacSrOpen: "69861",
    devicesMonitored: 1284,
    healthUnder80: 23,
    staleTelemetry: 7,
    fnAdvisoryMatch: 26,
    licenseCompliancePct: 98,
    advisoryExposure: 3,
    fnImpactedPatterns: 2,
    fnId: "FN74218",
    csat: 4.2,
    nps: 18,
    atRiskJourneys: 7,
    vocLagMin: 12,
    journeyFriction: 0.31,
    acvM: 48.2,
    renewalRiskM: 3.1,
    nrrProxyPct: 102,
    psirtCves: 7,
    psirtCriticalHigh: 1,
    bellagioRenewal: "Elevated",
    observabilityBlurb: "W5–10 scheduled · not run today"
  };

  function personaProvenancePills(labels) {
    return (
      '<div class="persona-live-prov"><span>Data</span>' +
      labels.map((l) => `<span class="src-pill">${l}</span>`).join("") +
      "</div>"
    );
  }

  function renderPersonaNextSteps() {
    const mount = document.getElementById("persona-next-steps-mount");
    const refresh = document.getElementById("persona-next-refresh");
    if (!mount) return;
    const S = APP_DATA_SNAPSHOT;
    const ts = new Date().toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
    if (refresh) {
      refresh.textContent =
        "Analysis refreshed " + ts + " · unified mock index (simulated live; no backend call).";
    }

    const jump = (view, label) =>
      `<a href="#" class="mock-jump" data-mock-view="${view}">${label}</a>`;

    const cards = [
      {
        role: "Project Manager",
        title: "Program, gates & stakeholder posture",
        steps: [
          {
            title: "Unblock wave gates W11 + W16 before next milestone payment review",
            body: `ISE as Code is manual and FMC parity is still sealing — tie to ${S.p2Ise} and FTD inventory on <code>mgm-ftd-01</code>. Open ${jump("integrations", "Integrations")} + ${jump("overview", "Overview sync strip")} + ${jump("sources", "Sources")}.`,
            src: ["Integrations", "Overview", "Sources", "Incidents"]
          },
          {
            title: `Promote ${S.fnId} + P1/P2 blockers to RAID “top 3” for exec readout`,
            body: `${S.fnImpactedPatterns} FN-impacted patterns, ${S.p1p2} P1/P2 incidents (${S.p1Id}), and Bellagio renewal ${S.bellagioRenewal} converge on customer-visible risk. Cross-check ${jump("fieldnotes", "Field notices")} + ${jump("incidents", "Incidents")} + ${jump("properties", "Properties")}.`,
            src: ["Field notices", "Incidents", "Properties", "Experience command"]
          },
          {
            title: "Reconcile portfolio financial narrative with CSAT trajectory",
            body: `Blended CSAT ${S.csat}, NPS +${S.nps}, portfolio ACV $${S.acvM}M, renewal-at-risk $${S.renewalRiskM}M — ensure PM RAID explains dollar linkage. Use ${jump("cx-command", "Experience command")} + ${jump("sentiment", "Sentiment & VoC")}.`,
            src: ["Experience command", "Sentiment & VoC", "Overview"]
          },
          {
            title: `Schedule CAB evidence pack around ${S.advisoryExposure} advisory exposures`,
            body: `PSIRT shows ${S.psirtCves} CVEs in estate (${S.psirtCriticalHigh} critical/high patch window). Pair with device rows showing CVE hints. ${jump("security", "PSIRT")} + ${jump("devices", "Devices")}.`,
            src: ["PSIRT", "Devices", "Integrations"]
          }
        ]
      },
      {
        role: "Service Delivery Manager",
        title: "Operations, TAC & integration truth",
        steps: [
          {
            title: `Drive ${S.p1Id} to closure ahead of CX QBR window`,
            body: `P1 on MGM Grand POS path — TAC SR ${S.tacSrOpen} in research. Confirm war-room bridge and ${jump("incidents", "incident timeline")} match customer comms.`,
            src: ["Incidents", "Experience command", "Sentiment & VoC"]
          },
          {
            title: `Clear observability blind spot: ${S.observabilityBlurb.toLowerCase()}`,
            body: `Queue a TE / Umbrella / SNA sync before the next P1 bridge; ${S.staleTelemetry} devices are stale &gt;24h telemetry. ${jump("sources", "Sources")} + ${jump("overview", "Overview")}.`,
            src: ["Sources", "Overview", "Incidents"]
          },
          {
            title: `Triage ${S.healthUnder80} devices under health 80 + ${S.fnAdvisoryMatch} FN matches`,
            body: `Prioritize cores and WLCs tied to active incidents; assurance lists memory + wireless density issues. ${jump("devices", "Devices")} + ${jump("fieldnotes", "Field notices")}.`,
            src: ["Devices", "Field notices", "Incidents"]
          },
          {
            title: `Staff TAC correlation backlog (${S.tacLinked} linked SRs)`,
            body: `Support API enrichment should reflect SR status for every P2 — eliminate duplicate customer updates. ${jump("incidents", "Incidents")} + ${jump("integrations", "Waves")}.`,
            src: ["Incidents", "Integrations", "Sources"]
          }
        ]
      },
      {
        role: "Customer Experience Manager",
        title: "Outcomes, VoC & renewals storytelling",
        steps: [
          {
            title: `Prepare QBR storyline: CSAT ${S.csat} + ${S.atRiskJourneys} at-risk journeys`,
            body: `Tie gaming-floor journey to ${S.p1Id}; friction index ${S.journeyFriction} is below red-line but trending. ${jump("sentiment", "Sentiment")} + ${jump("journeys", "Journey signals")} + ${jump("cx-command", "Experience command")}.`,
            src: ["Sentiment & VoC", "Journey signals", "Experience command"]
          },
          {
            title: `Recover Bellagio renewal posture (risk: ${S.bellagioRenewal})`,
            body: `Licensing gap + open FN on property — partner with SDM on ${S.p2Ise} before renewal dry-run. ${jump("properties", "Properties")} + ${jump("cx-command", "financial table")}.`,
            src: ["Properties", "Experience command", "Field notices"]
          },
          {
            title: `Reduce VoC pipeline lag (P95 ${S.vocLagMin} minutes)`,
            body: `Survey + transcript ingest delays erode “live” CX promise; validate scheduler and API tokens. ${jump("sentiment", "VoC integrations table")} + ${jump("sources", "Sources")}.`,
            src: ["Sentiment & VoC", "Sources", "Overview"]
          },
          {
            title: `Customer-safe PSIRT narrative (${S.advisoryExposure} exposure rows)`,
            body: `Export non-technical language for exec sponsors; avoid raw CVE tables in QBR deck. ${jump("security", "PSIRT")} + ${jump("overview", "Overview KPIs")}.`,
            src: ["PSIRT", "Overview", "Experience command"]
          }
        ]
      },
      {
        role: "Customer Delivery Architect",
        title: "Design integrity & API parity",
        steps: [
          {
            title: `Close design gap: ISE posture drift (${S.p2Ise}) vs golden baseline`,
            body: `Evidence from DNA assurance + PSN ${jump("devices", "aria-ise-psn2 row")} — align remediation to W11 snapshot contract. ${jump("integrations", "Waves")} + ${jump("consoles", "Console map")}.`,
            src: ["Incidents", "Devices", "Integrations", "Consoles"]
          },
          {
            title: "Validate W16 FMC intent vs DNA routing for mgm-ftd-01",
            body: `Prevent asymmetric security policy narrative during renewal architecture review. ${jump("devices", "Devices")} + ${jump("sources", "Sources")}.`,
            src: ["Devices", "Sources", "Integrations"]
          },
          {
            title: `Stress-test estate against ${S.healthUnder80} sub-80 health devices`,
            body: `Design baseline expects &lt;20 bad-health catalysts — exceed triggers capacity planning for change windows. ${jump("devices", "Devices")} + ${jump("overview", "Overview")}.`,
            src: ["Devices", "Overview", "Properties"]
          },
          {
            title: `Audit API parity claims vs ${S.openIncidents} open incidents`,
            body: `If any blocker still requires native console swivel, file scope exception with wave ID. ${jump("consoles", "Console map")} + ${jump("incidents", "Incidents")}.`,
            src: ["Console map", "Incidents", "Integrations"]
          }
        ]
      },
      {
        role: "Engineer (SDC technical delivery)",
        title: "Hands-on execution & evidence",
        steps: [
          {
            title: `Execute NET-WAN-FAILOVER-01 for ${S.p1Id}`,
            body: `Collect interface errors on <code>mgm-edge-rtr01</code>, attach TE tests, update TAC SR ${S.tacSrOpen}. ${jump("incidents", "Incidents")} + ${jump("devices", "Devices")}.`,
            src: ["Incidents", "Devices", "Integrations"]
          },
          {
            title: "ISE PSN health: remediate degraded node feeding banquet VLAN",
            body: `Correlates with ${S.p2Ise}; validate session / posture dashboards before closing ticket. ${jump("devices", "Devices")} + ${jump("incidents", "Incidents")}.`,
            src: ["Devices", "Incidents", "Sources"]
          },
          {
            title: `FN ${S.fnId} serial sweep on C9500 pattern`,
            body: `Match ${S.fnAdvisoryMatch} advisory-tagged devices to ${S.fnId} remediation template; export serial CSV for property leads. ${jump("fieldnotes", "Field notices")} + ${jump("devices", "Devices")}.`,
            src: ["Field notices", "Devices", "Incidents"]
          },
          {
            title: `Patch evidence for ${S.psirtCriticalHigh} critical/high CVE window`,
            body: `Upload change result to incident notes and verify inventory no longer exposes IOS-XE pattern in PSIRT grid. ${jump("security", "PSIRT")} + ${jump("devices", "Devices")}.`,
            src: ["PSIRT", "Devices", "Incidents"]
          }
        ]
      },
      {
        role: "High Touch Operations Manager",
        title: "Flagship cadence, exec readiness & joint sessions",
        steps: [
          {
            title: `Lock QBR / renewal rehearsal narrative before next exec touchpoint (Bellagio ${S.bellagioRenewal})`,
            body: `Bundle CSAT ${S.csat}, licensing gap, and ${S.fnId} into one customer-safe storyline — no raw CVE tables. Pair ${jump("cx-command", "Experience command")} + ${jump("sentiment", "VoC")} + ${jump("properties", "Properties")}.`,
            src: ["Experience command", "Sentiment & VoC", "Properties", "Overview"]
          },
          {
            title: `Script ${S.p1Id} war-room updates to match customer-facing comms`,
            body: `TAC SR ${S.tacSrOpen} language must align with incident timeline and gaming-floor VoC thread — avoid contradictory status. ${jump("incidents", "Incidents")} + ${jump("journeys", "Journeys")}.`,
            src: ["Incidents", "Journey signals", "Sentiment & VoC"]
          },
          {
            title: `Drive “single pane” exec brief from PM RAID + SDM queue + renewals risk`,
            body: `Host dry-run with PM and SDM: top 3 blockers, observability gap (${S.observabilityBlurb.toLowerCase()}), and renewal heat. ${jump("overview", "Overview")} + ${jump("integrations", "Integrations")}.`,
            src: ["Overview", "Integrations", "Incidents", "Sources"]
          },
          {
            title: `Escalate data-freshness gaps that would embarrass live customer sessions`,
            body: `VoC P95 ${S.vocLagMin}m lag or ${S.staleTelemetry} stale-telemetry devices undermine trust — treat as HTOM escalation to ${jump("sources", "Sources")} owners before the session.`,
            src: ["Sources", "Sentiment & VoC", "Overview", "Devices"]
          }
        ]
      }
    ];

    mount.innerHTML = cards
      .map(
        (card) => `
      <article class="persona-live-card">
        <p class="persona-live-role">${card.role}</p>
        <h3>${card.title}</h3>
        <ol class="persona-live-steps">
          ${card.steps
            .map(
              (s) => `
            <li>
              <strong>${s.title}</strong>
              <p>${s.body}</p>
              ${personaProvenancePills(s.src)}
            </li>`
            )
            .join("")}
        </ol>
      </article>`
      )
      .join("");
  }

  function renderCxRoleActions() {
    const mount = document.getElementById("cx-role-actions-mount");
    const refresh = document.getElementById("cx-role-actions-refresh");
    if (!mount) return;
    const S = APP_DATA_SNAPSHOT;
    const ts = new Date().toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
    if (refresh) {
      refresh.textContent =
        "Focus matrix refreshed " +
        ts +
        " · outcomes: adoption, cost, delivery speed, CSAT (mock snapshot; no API call).";
    }

    const j = (view, label) => `<a href="#" class="mock-jump" data-mock-view="${view}">${label}</a>`;

    const pillar = (cls, name, html) =>
      `<div class="cx-focus-pillar ${cls}"><div class="pillar-cap"><span class="pillar-name">${name}</span></div><p>${html}</p></div>`;

    const roles = [
      {
        role: "Project Manager",
        adoption: `Publish a single <strong>adoption scorecard</strong> per property: wave tags on ${j("properties", "Properties")} vs plan, with flagship tier called out in ${j("cx-command", "Experience command")}.`,
        cost: `Re-baseline contingency: hold <strong>$420K milestone</strong> narrative until ${j("integrations", "W11 + W16")} gates flip green — avoids surprise T&M on RAID.`,
        speed: `Run a <strong>weekly 30m gate stand-up</strong> on yellow integrations; tie actions to ${S.p1Id} / ${S.p2Ise} blockers in ${j("incidents", "Incidents")}.`,
        csat: `Bundle <strong>CSAT + wave delay</strong> in exec RAID: cite VoC lag P95 ${S.vocLagMin}m and ${S.atRiskJourneys} at-risk journeys from ${j("sentiment", "Sentiment")}.`
      },
      {
        role: "Service Delivery Manager",
        adoption: `Drive <strong>inventory truth</strong> for adoption stories: DNA + FMC sync on ${j("devices", "Devices")}; close ${S.staleTelemetry} stale-telemetry devices this week.`,
        cost: `Cut <strong>repeat bridges</strong>: close ${j("incidents", "INC-20244")} with TAC ${S.tacSrOpen} before duplicate war-room minutes burn ${j("overview", "support $/device")} trend.`,
        speed: `Execute <strong>observability triad</strong> (${S.observabilityBlurb}) via ${j("sources", "Sources")} — TE/Umbrella/SNA before next P1.`,
        csat: `Clear <strong>gaming-floor VoC</strong> thread linked ${S.p1Id}; confirm journey ${j("journeys", "J-MGM-4412")} narrative matches customer comms.`
      },
      {
        role: "Customer Experience Manager",
        adoption: `Launch <strong>“entitled vs deployed”</strong> QBR slide: Smart Licensing % + property bars in ${j("properties", "Properties")}; pair with ${j("overview", "license KPIs")}.`,
        cost: `Shift spend story to <strong>efficiency</strong>: highlight ${j("cx-command", "$9.40/device")} down QoQ while NPS +${S.nps} — justify renewal without discounting.`,
        speed: `Demand <strong>VoC ingest SLA</strong>: if P95 stays at ${S.vocLagMin}m, treat as delivery incident until ${j("sources", "source health")} green.`,
        csat: `Run <strong>executive readout</strong> on Wi‑Fi recovery post-${S.p1Id}; target +4 NPS — draft from ${j("sentiment", "Sentiment escalations")}.`
      },
      {
        role: "Customer Delivery Architect",
        adoption: `Prove <strong>design adoption</strong>: ISE posture parity % vs golden baseline on Bellagio; unblock ${S.p2Ise} before ${j("properties", "property adoption")} stalls.`,
        cost: `Prevent <strong>true-up surprises</strong>: reconcile ${j("devices", "FTD + DNA")} rows with entitlements — ties to ${j("cx-command", "true-up line")} in financial table.`,
        speed: `Compress <strong>W16 FMC validation</strong> to bi-weekly checkpoint until parity green — same playbook as ${j("consoles", "console map")} audit.`,
        csat: `Map <strong>guest auth friction</strong> to ISE session evidence — give CXM technical receipts, not raw logs, via ${j("journeys", "Journeys")}.`
      },
      {
        role: "Engineer (SDC delivery)",
        adoption: `Complete <strong>FN ${S.fnId} remediation</strong> on C9500 pattern so property “fully adopted” claims match ${j("fieldnotes", "inventory")}.`,
        cost: `Prefer <strong>bundle patches</strong> (IOS-XE + ISE) per ${j("security", "PSIRT")} queue — fewer change windows than one-off hotfixes.`,
        speed: `Ship <strong>${S.p1Id} evidence pack</strong> in &lt;8h SLA: TE + DNA iface errors on ${j("devices", "mgm-edge-rtr01")} attached to SR.`,
        csat: `Post <strong>mitigation notes</strong> customer-visible (no jargon): link ${j("incidents", "INC-20244")} closure to VoC thread resolution.`
      },
      {
        role: "High Touch Operations Manager",
        adoption: `Run a <strong>rehearsal readout</strong> with CXM: Smart Licensing %, wave tags, and flagship property bars from ${j("properties", "Properties")} — one deck for the sponsor.`,
        cost: `Eliminate <strong>duplicate exec bridges</strong> by publishing a single HTOM briefing doc sourced from ${j("cx-command", "Experience command")} instead of parallel swivel exports.`,
        speed: `Time-box <strong>pre-touchpoint huddles</strong> (${S.p1Id}, renewal ${S.bellagioRenewal}) so PM · SDM · CXM sign one timeline before the customer call.`,
        csat: `Standardize <strong>customer-safe language</strong> for PSIRT (${S.advisoryExposure} rows) and FN — HTOM signs off with ${j("sentiment", "VoC")} context.`
      }
    ];

    mount.innerHTML = roles
      .map(
        (r) => `
      <article class="cx-role-focus-card">
        <p class="cx-role-label">${r.role}</p>
        <div class="cx-focus-pillars">
          ${pillar("pillar-adoption", "Customer adoption", r.adoption)}
          ${pillar("pillar-cost", "Cost reduction", r.cost)}
          ${pillar("pillar-speed", "Delivery speed", r.speed)}
          ${pillar("pillar-csat", "Customer satisfaction", r.csat)}
        </div>
      </article>`
      )
      .join("");
  }

  function renderApiBuildsTable() {
    const body = document.getElementById("api-builds-body");
    if (!body) return;
    body.innerHTML = INTEGRATION_SOURCES.map(
      (s) => `
        <tr>
          <td><code style="font-size:14px">${s.name}</code>${s.spotlight ? ' <span class="tag tag-build">new</span>' : ""}</td>
          <td><span class="wave">${s.wave}</span></td>
          <td><span class="tag tag-auth">${s.authType}</span></td>
          <td><span class="tag tag-sched">${s.schedule}</span></td>
          <td style="font-size:14px;color:var(--muted);max-width:360px">${s.apiBuild}</td>
        </tr>`
    ).join("");
  }

  function showView(id) {
    currentViewId = id;
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.querySelectorAll(".nav-item[data-view]").forEach((n) => {
      n.classList.remove("active");
      if (n.getAttribute("role") === "tab") {
        n.setAttribute("aria-selected", "false");
        n.setAttribute("tabindex", "-1");
      }
    });
    const view = document.getElementById("view-" + id);
    if (view) view.classList.add("active");
    const nav = document.querySelector('.nav-item[data-view="' + id + '"]');
    if (nav) {
      nav.classList.add("active");
      if (nav.getAttribute("role") === "tab") {
        nav.setAttribute("aria-selected", "true");
        nav.setAttribute("tabindex", "0");
      }
    }
    const t = titles[id];
    const h = t ? t[0] : "";
    const b = viewTabDescriptors[id] != null ? viewTabDescriptors[id] : t ? t[1] : "";
    var titleEl = document.getElementById("pageTitle");
    var blurbEl = document.getElementById("pageBlurb");
    if (titleEl) titleEl.textContent = h;
    if (blurbEl) blurbEl.textContent = b;
    var routeAnn = document.getElementById("route-announce");
    if (routeAnn && h) {
      routeAnn.textContent = "";
      window.setTimeout(function () {
        routeAnn.textContent = "View changed to " + h + ". " + b;
      }, 50);
    }
    document.title = h ? h + " \u2014 Helix UI Mockup Hub" : "Helix \u2014 UI Mockup Hub";
    history.replaceState(null, "", "#" + id);
    var scrollContent = document.querySelector(".content");
    if (scrollContent) scrollContent.scrollTop = 0;
    renderAiInsights(id);
    if (id === "sdcroles") renderPersonaNextSteps();
    if (id === "cx-role-actions") renderCxRoleActions();
    if (id === "mvp-journey") renderMvpProductJourney();
    renderIntegrationAdvisor();
    refreshMainPaneBlocksDraggable();
  }

  /** Persisted order for all left nav tabs (data-view ids). */
  var NAV_ORDER_KEY = "helix-mockup-nav-order";
  var NAV_CX_ORDER_KEY = "helix-mockup-nav-cx-order";
  var NAV_ORDER_KEY_LEGACY = "helix-mockup-nav-order";
  var CX_TAB_VIEW_IDS = ["sentiment", "journeys", "cx-command", "cx-role-actions", "powerbi-pm"];

  function mergeNavOrder(saved, domIds) {
    var seen = Object.create(null);
    var out = [];
    var i;
    for (i = 0; i < saved.length; i++) {
      var sid = saved[i];
      if (seen[sid] || domIds.indexOf(sid) === -1) continue;
      seen[sid] = true;
      out.push(sid);
    }
    for (i = 0; i < domIds.length; i++) {
      var d = domIds[i];
      if (seen[d]) continue;
      seen[d] = true;
      out.push(d);
    }
    return out;
  }

  function readSavedCxTabOrder() {
    try {
      var raw = localStorage.getItem(NAV_CX_ORDER_KEY);
      if (raw) {
        var cur = JSON.parse(raw);
        if (Array.isArray(cur)) return cur;
      }
      var leg = localStorage.getItem(NAV_ORDER_KEY_LEGACY);
      if (leg) {
        var old = JSON.parse(leg);
        if (Array.isArray(old)) {
          var extracted = old.filter(function (id) {
            return CX_TAB_VIEW_IDS.indexOf(id) !== -1;
          });
          if (extracted.length === CX_TAB_VIEW_IDS.length) return extracted;
        }
      }
    } catch (e) {}
    return null;
  }

  function injectCxBlockOrder(fullDefault, cxIdsList, cxOrderedMerged) {
    var cxSet = Object.create(null);
    var k;
    for (k = 0; k < cxIdsList.length; k++) cxSet[cxIdsList[k]] = true;
    var first = -1;
    var last = -1;
    var i;
    for (i = 0; i < fullDefault.length; i++) {
      if (cxSet[fullDefault[i]]) {
        if (first < 0) first = i;
        last = i;
      }
    }
    if (first < 0) return fullDefault.slice();
    return fullDefault.slice(0, first).concat(cxOrderedMerged).concat(fullDefault.slice(last + 1));
  }

  function readFullSavedNavOrder(domIds) {
    try {
      var raw = localStorage.getItem(NAV_ORDER_KEY);
      if (raw) {
        var cur = JSON.parse(raw);
        if (Array.isArray(cur) && cur.length) return cur;
      }
    } catch (e) {}
    var cxSaved = readSavedCxTabOrder();
    if (cxSaved && cxSaved.length) {
      var cxMerged = mergeNavOrder(cxSaved, CX_TAB_VIEW_IDS.slice());
      return injectCxBlockOrder(domIds, CX_TAB_VIEW_IDS, cxMerged);
    }
    return null;
  }

  function applySavedNavOrder() {
    var sortable = document.querySelector(".nav-sortable");
    if (!sortable) return;
    var domIds = Array.prototype.map.call(sortable.querySelectorAll(".nav-item[data-view]"), function (n) {
      return n.getAttribute("data-view");
    });
    var saved = readFullSavedNavOrder(domIds);
    if (!saved) return;
    var merged = mergeNavOrder(saved, domIds);
    merged.forEach(function (id) {
      var el = sortable.querySelector('.nav-item[data-view="' + id + '"]');
      if (el) sortable.appendChild(el);
    });
  }

  function persistNavOrderFromDom() {
    var sortable = document.querySelector(".nav-sortable");
    if (!sortable) return;
    var ids = Array.prototype.map.call(sortable.querySelectorAll(".nav-item[data-view]"), function (n) {
      return n.getAttribute("data-view");
    });
    try {
      localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(ids));
    } catch (e) {}
  }

  function initNavReorder() {
    var sortable = document.querySelector(".nav-sortable");
    if (!sortable) return;
    applySavedNavOrder();
    var draggingEl = null;

    function persistNavOrder() {
      persistNavOrderFromDom();
    }

    function getDragAfterElement(y) {
      var items = Array.prototype.slice.call(sortable.querySelectorAll(".nav-item:not(.is-dragging)"));
      var closest = { offset: Number.NEGATIVE_INFINITY, child: null };
      var j;
      for (j = 0; j < items.length; j++) {
        var child = items[j];
        var box = child.getBoundingClientRect();
        var offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          closest = { offset: offset, child: child };
        }
      }
      return closest.child;
    }

    sortable.querySelectorAll(".nav-item[data-view]").forEach(function (item) {
      item.setAttribute("draggable", "true");
    });

    sortable.addEventListener("dragstart", function (e) {
      var item = e.target && e.target.closest ? e.target.closest(".nav-item") : null;
      if (!item || !sortable.contains(item)) return;
      draggingEl = item;
      item.classList.add("is-dragging");
      try {
        e.dataTransfer.setData("text/plain", item.getAttribute("data-view") || "");
        e.dataTransfer.effectAllowed = "move";
      } catch (err) {}
      document.body.classList.add("is-nav-dragging");
    });

    sortable.addEventListener("dragend", function () {
      if (draggingEl) draggingEl.classList.remove("is-dragging");
      sortable.querySelectorAll(".nav-item.is-dragging").forEach(function (n) {
        n.classList.remove("is-dragging");
      });
      document.body.classList.remove("is-nav-dragging");
      draggingEl = null;
      persistNavOrder();
    });

    sortable.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      var active = draggingEl || sortable.querySelector(".nav-item.is-dragging");
      if (!active) return;
      var after = getDragAfterElement(e.clientY);
      if (after == null) sortable.appendChild(active);
      else sortable.insertBefore(active, after);
    });

    sortable.addEventListener("drop", function (e) {
      e.preventDefault();
    });
  }

  initNavReorder();

  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", function () {
      showView(item.getAttribute("data-view"));
    });
    item.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showView(item.getAttribute("data-view"));
      }
    });
  });

  var tablist = document.querySelector('.nav-sortable[role="tablist"]');
  if (tablist) {
    tablist.addEventListener("keydown", function (e) {
      var tabs = Array.prototype.slice.call(tablist.querySelectorAll('.nav-item[role="tab"][data-view]'));
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        e.stopPropagation();
        var cur = tabs[i];
        if (e.key === "ArrowUp" && i > 0) {
          tablist.insertBefore(cur, tabs[i - 1]);
        } else if (e.key === "ArrowDown" && i < tabs.length - 1) {
          tablist.insertBefore(tabs[i + 1], cur);
        }
        persistNavOrderFromDom();
        return;
      }
      var next = i;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        next = (i + 1) % tabs.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        next = (i - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        next = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        next = tabs.length - 1;
      } else {
        return;
      }
      showView(tabs[next].getAttribute("data-view"));
      tabs[next].focus();
    });
  }

  var ddTablist = document.querySelector('.nav-sortable-dd[role="tablist"]');
  if (ddTablist) {
    ddTablist.addEventListener("keydown", function (e) {
      var tabs = Array.prototype.slice.call(ddTablist.querySelectorAll('.nav-item[role="tab"][data-view]'));
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var next = i;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        next = (i + 1) % tabs.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        next = (i - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        next = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        next = tabs.length - 1;
      } else {
        return;
      }
      showView(tabs[next].getAttribute("data-view"));
      tabs[next].focus();
    });
  }

  document.addEventListener("click", function (e) {
    var jump = e.target.closest("a[data-mock-view]");
    if (jump) {
      e.preventDefault();
      showView(jump.getAttribute("data-mock-view"));
    }
  });

  /** Mockup-live: same-origin /api/v1 + JWT from Operations (localStorage accessToken). */
  var MOCKUP_LIVE_KEY = "helix-mockup-live";
  var API_BASE_KEY = "helix-mockup-api-base";
  var ACCESS_TOKEN_KEY = "accessToken";

  function operationsBaseUrl() {
    try {
      var h = location.hostname;
      if (h === "localhost" || h === "127.0.0.1") return location.origin.replace(/\/$/, "");
      if (location.protocol === "file:") return "http://localhost:3000";
    } catch (e) {}
    return "http://localhost:3000";
  }

  /** GitHub Pages / file:// cannot share localStorage with your API host — paste token or open mockup on the backend origin. */
  function mockupTokenStorageIsSeparateFromBackend() {
    try {
      if (location.protocol === "file:") return true;
      var h = location.hostname;
      if (h === "localhost" || h === "127.0.0.1") return false;
      return true;
    } catch (e) {
      return true;
    }
  }

  function syncMockupBackendLinks() {
    var base = operationsBaseUrl();
    document.querySelectorAll("a[data-mockup-backend-path]").forEach(function (a) {
      var p = a.getAttribute("data-mockup-backend-path") || "/";
      if (p.charAt(0) !== "/") p = "/" + p;
      a.setAttribute("href", base + p);
    });
  }

  function getLiveAccessToken() {
    try {
      var t = localStorage.getItem(ACCESS_TOKEN_KEY);
      return t ? String(t).trim() : "";
    } catch (e) {
      return "";
    }
  }

  function escHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatIsoShort(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).slice(0, 19);
      return d.toISOString().slice(0, 16).replace("T", " ");
    } catch (e) {
      return "—";
    }
  }

  function journeyMiniRailSvg(phaseIndex, maturityPct) {
    var n = Math.max(0, Math.min(5, phaseIndex | 0));
    var circles = "";
    var i;
    for (i = 0; i < 6; i++) {
      var active = i === n;
      var cx = 16 + i * 28;
      var fill = active ? "var(--accent)" : "var(--border2)";
      circles +=
        '<circle cx="' +
        cx +
        '" cy="14" r="6" fill="' +
        fill +
        '" stroke="var(--border)" stroke-width="1"/>';
    }
    var px = 16 + n * 28;
    return (
      '<div class="pj-rail-wrap"><svg class="pj-rail-svg" viewBox="0 0 184 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<line x1="16" y1="14" x2="168" y2="14" stroke="var(--border2)" stroke-width="2"/>' +
      circles +
      '<text x="' +
      px +
      '" y="28" text-anchor="middle" fill="var(--muted)" font-size="11" font-family="Inter,system-ui,sans-serif">' +
      escHtml(String(maturityPct)) +
      "% maturity</text></svg></div>"
    );
  }

  function renderMvpProductJourney() {
    var el = document.getElementById("mvp-journey-products");
    if (!el) return;
    var rows = buildWaveGridModels();
    el.innerHTML = rows
      .map(function (r) {
        var j = MVP_JOURNEY_BY_WAVE[r.wave] || {
          phaseIndex: 2,
          maturityPct: 50,
          mapNote: "Journey position not curated for this wave — align with your TAM success plan.",
          rec: "Define success criteria and evidence per phase before claiming later-stage outcomes."
        };
        var deepBadges =
          j.deep === "cspc"
            ? ' <span class="tag tag-build">CSPC depth</span>'
            : j.deep === "iq"
              ? ' <span class="tag tag-auth">Cisco IQ depth</span>'
              : "";
        return (
          '<article class="pj-product card" data-pj-wave="' +
          escHtml(r.wave) +
          '">' +
          '<div class="pj-product-top">' +
          '<div class="pj-product-title"><span class="wave">' +
          escHtml(r.wave) +
          "</span><h3>" +
          escHtml(r.title) +
          "</h3>" +
          deepBadges +
          "</div>" +
          journeyMiniRailSvg(j.phaseIndex, j.maturityPct) +
          "</div>" +
          '<p class="pj-map-note">' +
          j.mapNote +
          "</p>" +
          '<div class="pj-rec"><strong>Adoption recommendation:</strong> ' +
          j.rec +
          "</div>" +
          '<p class="meta pj-meta">' +
          escHtml(r.meta) +
          "</p></article>"
        );
      })
      .join("");
  }

  function applyMvpJourneyLiveFromSources(body, status) {
    var note = document.getElementById("mvp-journey-live-note");
    if (note) {
      note.textContent = "";
      note.className = "pj-live-note";
    }
    if (status === 403 || status === 401) {
      if (note) {
        note.textContent =
          "Live: /admin/sources not authorized for this token (use admin, sdm, or manager). Mock CSPC / IQ metrics unchanged.";
        note.classList.add("pj-live-warn");
      }
      return;
    }
    if (!body || !Array.isArray(body)) {
      if (note) {
        note.textContent = "Live: source registry not returned — mock metrics shown.";
        note.classList.add("pj-live-warn");
      }
      return;
    }
    function srcRow(name) {
      for (var i = 0; i < body.length; i++) {
        if (body[i].sourceName === name) return body[i];
      }
      return null;
    }
    var cspc = srcRow("cspc");
    var iq = srcRow("cisco-iq");
    var elC = document.getElementById("journey-cspc-sdm");
    var elI = document.getElementById("journey-iq-sdm");
    if (elC) {
      elC.textContent = cspc
        ? (cspc.enabled ? "Enabled" : "Disabled") +
          " in SDM registry · " +
          (cspc.updatedAt ? "updated " + formatIsoShort(cspc.updatedAt) : "updated —")
        : "cspc not listed in registry.";
    }
    if (elI) {
      elI.textContent = iq
        ? (iq.enabled ? "Enabled" : "Disabled") +
          " in SDM registry · " +
          (iq.updatedAt ? "updated " + formatIsoShort(iq.updatedAt) : "updated —")
        : "cisco-iq not listed in registry.";
    }
    if (note) {
      note.textContent =
        "Live: merged " +
        body.length +
        " integration source rows from /api/v1/admin/sources (mock CSPC / Cisco IQ KPIs below remain illustrative until collectors & IQ APIs feed Helix).";
      note.classList.add("pj-live-ok");
    }
  }

  function getMockupApiPrefix() {
    var b = (localStorage.getItem(API_BASE_KEY) || "").trim();
    if (!b) b = "/api/v1";
    return b.replace(/\/$/, "");
  }

  /** When live API cannot be reached (backend stopped, wrong URL, CORS, offline). */
  function liveModeApiUnreachableMessage(prefix, detail) {
    var sameOriginTip =
      "This page is " +
      (function () {
        try {
          return location.origin;
        } catch (e) {
          return "";
        }
      })() +
      ". Use a relative API base (/api/v1) or the same host/port as the backend.";
    return (
      "Live mode: connection failed — cannot reach " +
      prefix +
      ". Start the backend (cd backend && npm run dev), open " +
      operationsBaseUrl() +
      "/api/v1/health in a new tab to verify, then Refresh. " +
      "If you set localStorage '" +
      API_BASE_KEY +
      "', clear it: localStorage.removeItem('" +
      API_BASE_KEY +
      "'). " +
      sameOriginTip +
      (detail ? " — " + detail : "")
    );
  }

  function isMockupLive() {
    return localStorage.getItem(MOCKUP_LIVE_KEY) === "1";
  }

  /** Signals for integration advisor — merges mock snapshot with live KPI DOM when Live data is on. */
  function getAdvisorSignals() {
    var S = {
      openIncidents: APP_DATA_SNAPSHOT.openIncidents,
      p1p2: APP_DATA_SNAPSHOT.p1p2,
      p1Id: APP_DATA_SNAPSHOT.p1Id,
      healthUnder80: APP_DATA_SNAPSHOT.healthUnder80,
      staleTelemetry: APP_DATA_SNAPSHOT.staleTelemetry,
      psirtCriticalHigh: APP_DATA_SNAPSHOT.psirtCriticalHigh,
      fnImpactedPatterns: APP_DATA_SNAPSHOT.fnImpactedPatterns,
      advisoryExposure: APP_DATA_SNAPSHOT.advisoryExposure,
      atRiskJourneys: APP_DATA_SNAPSHOT.atRiskJourneys,
      observabilityBlurb: APP_DATA_SNAPSHOT.observabilityBlurb
    };
    if (isMockupLive()) {
      function num(id) {
        var el = document.getElementById(id);
        if (!el) return null;
        var t = (el.textContent || "").replace(/,/g, "").trim();
        var n = parseInt(t, 10);
        return isNaN(n) ? null : n;
      }
      var oi = num("mockup-live-kpi-overview-incidents");
      var p12 = num("mockup-live-kpi-overview-p12");
      if (oi != null) S.openIncidents = oi;
      if (p12 != null) S.p1p2 = p12;
    }
    return S;
  }

  function advisorSource(name) {
    for (var i = 0; i < INTEGRATION_SOURCES.length; i++) {
      if (INTEGRATION_SOURCES[i].name === name) return INTEGRATION_SOURCES[i];
    }
    return null;
  }

  /**
   * Prioritized next steps + suggested wave cards (enable + schedule automation).
   * Recomputed on tab change and live refresh.
   */
  function buildIntegrationAdvisorPlan(viewId, signals) {
    var live = isMockupLive();
    var steps = [];
    var waves = [];
    var seenW = {};
    function addStep(text, view, label) {
      steps.push({ text: text, view: view || null, label: label || (view ? "Open" : "") });
    }
    function addWave(wave, title, meta, urgent) {
      if (seenW[wave]) return;
      seenW[wave] = true;
      waves.push({ wave: wave, title: title, meta: meta, urgent: !!urgent });
    }

    var vt = titles[viewId] ? titles[viewId][0] : viewId;
    var headline =
      (live ? "Live API" : "Mock") +
      " · " +
      signals.openIncidents +
      " open inc · " +
      signals.p1p2 +
      " P1/P2 — " +
      vt;

    addStep("Open Integrations to schedule waves the advisor flags below.", "integrations", "Waves");

    if (signals.p1p2 >= 1) {
      addStep(
        signals.p1p2 + " sev incidents: automate W4 Support API + W5 ThousandEyes for TAC-ready evidence.",
        "incidents",
        "Queue"
      );
      var sup = advisorSource("support-api");
      if (sup && !sup.on)
        addWave(
          "W4",
          "Support API · enable",
          "Cron EoX / bug / contract pull to enrich " + escHtml(signals.p1Id) + " — off in registry.",
          true
        );
      var te = advisorSource("thousandeyes");
      if (te && !te.on)
        addWave("W5", "ThousandEyes · enable", "Automated path alerts tied to WAN incidents — off in registry.", true);
    }

    if (signals.observabilityBlurb && signals.observabilityBlurb.indexOf("not run") !== -1) {
      addStep("Observability not run today: enable W5–W7 scheduled jobs in Sources.", "sources", "Sources");
      if (advisorSource("umbrella") && !advisorSource("umbrella").on)
        addWave("W6", "Umbrella reporting", "Batch DNS/SIG analytics after TE paths are green.", false);
    }

    if (signals.healthUnder80 >= 20) {
      addStep(signals.healthUnder80 + " sub-80 health devices: add FMC export + DNA assurance cadence.", "devices", "Devices");
      addWave(
        "W16",
        "FMC · automate",
        "REST policy snapshot job for weak-health cohort — aligns FTD rows with DNA intent.",
        signals.healthUnder80 >= 23
      );
    }

    if (signals.staleTelemetry >= 1) {
      addStep(signals.staleTelemetry + " stale telemetry devices: tighten DNA poll window (Sources).", "sources", "Sources");
    }

    if (signals.psirtCriticalHigh >= 1 || signals.advisoryExposure >= 2) {
      addStep("Advisory exposure: automate OpenVuln nightly join vs inventory.", "security", "PSIRT");
      var ov = advisorSource("psirt-openvuln");
      if (ov && !ov.on) addWave("W14", "OpenVuln OAuth", "Scheduled CVE match — required before CAB narrative.", true);
    }

    if (signals.fnImpactedPatterns >= 1) {
      var fn = advisorSource("field-notices");
      if (fn && !fn.on)
        addWave(
          "W15",
          "Field notices API",
          "PID/serial automation for " + escHtml(APP_DATA_SNAPSHOT.fnId) + " sweep.",
          true
        );
    }

    if (signals.atRiskJourneys >= 5) {
      addStep(signals.atRiskJourneys + " at-risk journeys: wire VoC + ISE session exports.", "journeys", "Journeys");
    }

    var ise = advisorSource("ise");
    if (ise && !ise.on && signals.p1p2 >= 1) {
      addWave(
        "W11",
        "ISE · pxGrid / ERS",
        "Posture + session automation feeding " + escHtml(APP_DATA_SNAPSHOT.p2Ise) + " closure.",
        true
      );
    }

    if (live) {
      addStep("Re-pull /admin/sources after role changes — advisor uses registry on refresh.", "sources", "Registry");
    } else {
      addStep("Turn on Live data to drive advisor from your tenant KPIs + source flags.", null, "");
    }

    return {
      headline: headline,
      ts: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }),
      steps: steps.slice(0, 6),
      waves: waves.slice(0, 8)
    };
  }

  function renderIntegrationAdvisor() {
    var viewId = currentViewId;
    var signals = getAdvisorSignals();
    var plan = buildIntegrationAdvisorPlan(viewId, signals);

    var strip = document.getElementById("integration-advisor-strip");
    if (strip) {
      var lis = plan.steps
        .map(function (s) {
          var link = "";
          if (s.view && s.label)
            link =
              ' <a href="#" class="mock-jump" data-mock-view="' +
              escHtml(s.view) +
              '">' +
              escHtml(s.label) +
              "</a>";
          return "<li>" + escHtml(s.text) + link + "</li>";
        })
        .join("");
      strip.innerHTML =
        '<div class="integration-advisor-strip-inner">' +
        '<span class="advisor-strip-kicker">Integration advisor</span>' +
        '<p class="advisor-strip-headline">' +
        escHtml(plan.headline) +
        "</p>" +
        '<ul class="advisor-strip-list">' +
        lis +
        "</ul>" +
        '<span class="advisor-strip-ts">' +
        escHtml(plan.ts) +
        "</span></div>";
    }

    var cardsMount = document.getElementById("integration-advisor-cards");
    if (cardsMount) {
      if (!plan.waves.length) {
        cardsMount.innerHTML =
          '<p class="hint advisor-cards-empty">No extra wave automations recommended for current signals — lower severity or enable missing sources in <a href="#" class="mock-jump" data-mock-view="sources">Source administration</a>.</p>';
      } else {
        cardsMount.innerHTML = plan.waves
          .map(function (w) {
            var u = w.urgent ? " advisor-wave-card--urgent" : "";
            return (
              '<div class="card advisor-wave-card' +
              u +
              '"><span class="advisor-wave-pill">Automate next</span><h3><span class="wave">' +
              escHtml(w.wave) +
              "</span> " +
              w.title +
              '</h3><div class="meta">' +
              w.meta +
              "</div></div>"
            );
          })
          .join("");
      }
    }

    var ann = document.getElementById("integration-advisor-announce");
    if (ann) {
      ann.textContent = "";
      window.setTimeout(function () {
        ann.textContent =
          "Integration advisor updated for " +
          (titles[viewId] ? titles[viewId][0] : viewId) +
          ". " +
          plan.waves.length +
          " wave suggestions.";
      }, 60);
    }
  }

  function syncMockupLiveBar() {
    var bar = document.getElementById("mockup-live-bar");
    var t = document.getElementById("mockup-live-toggle");
    var pill = document.getElementById("mockup-data-pill");
    if (t) t.checked = isMockupLive();
    if (bar) bar.classList.toggle("mockup-live-on", isMockupLive());
    if (pill) pill.textContent = isMockupLive() ? "Live API" : "Mock data";
  }

  function mockupPostJson(path, bodyObj) {
    var token = getLiveAccessToken();
    var prefix = getMockupApiPrefix();
    var url = prefix + (path.charAt(0) === "/" ? path : "/" + path);
    var headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(bodyObj && typeof bodyObj === "object" ? bodyObj : {})
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = { message: text ? text.slice(0, 200) : "Invalid JSON" };
          }
          return { ok: res.ok, status: res.status, body: j };
        });
      })
      .catch(function (e) {
        var msg = e && e.message ? e.message : String(e);
        return { ok: false, status: 0, body: { message: msg } };
      });
  }

  function mockupFetchJson(path) {
    var token = getLiveAccessToken();
    var prefix = getMockupApiPrefix();
    var url = prefix.charAt(0) === "/" ? prefix + path : prefix + path;
    var headers = { Accept: "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(url, { headers: headers })
      .then(function (res) {
        return res.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = { message: text ? text.slice(0, 200) : "Invalid JSON" };
          }
          return { ok: res.ok, status: res.status, body: j, networkError: false };
        });
      })
      .catch(function (e) {
        var msg = e && e.message ? e.message : String(e);
        return {
          ok: false,
          status: 0,
          body: { message: msg },
          networkError: true,
          errorDetail: msg
        };
      });
  }

  function isIncidentOpen(status) {
    var s = (status || "").toLowerCase();
    return s !== "resolved" && s !== "closed" && s !== "cancelled";
  }

  function badgePriorityHtml(p) {
    var cls = "b-p3";
    if (p === "P1") cls = "b-p1";
    else if (p === "P2") cls = "b-p2";
    else if (p === "P4") cls = "b-p4";
    return '<span class="badge ' + cls + '">' + escHtml(p) + "</span>";
  }

  function badgeStatusHtml(status) {
    var s = (status || "").toLowerCase();
    var ok = s === "resolved" || s === "closed";
    return '<span class="badge ' + (ok ? "b-ok" : "b-warn") + '">' + escHtml(status) + "</span>";
  }

  function deviceStatusBadgeHtml(st) {
    var s = (st || "").toLowerCase();
    var cls = "b-ok";
    if (s === "failed" || s === "decommissioned") cls = "b-p1";
    else if (s === "maintenance" || s === "inactive") cls = "b-warn";
    return '<span class="badge ' + cls + '">' + escHtml(st) + "</span>";
  }

  function setElText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function propNameMap(properties) {
    var m = {};
    properties.forEach(function (p) {
      m[p.property_id] = p.name;
    });
    return m;
  }

  function applyLiveOverviewKpis(properties, devices, incidents, tacCases) {
    var openInc = incidents.filter(function (i) {
      return isIncidentOpen(i.status);
    });
    var p12 = openInc.filter(function (i) {
      return i.priority === "P1" || i.priority === "P2";
    });
    setElText("mockup-live-kpi-overview-incidents", String(openInc.length));
    setElText("mockup-live-kpi-overview-incidents-sub", "Live · open statuses");
    setElText("mockup-live-kpi-overview-p12", String(p12.length));
    setElText("mockup-live-kpi-overview-devices", String(devices.length));
    setElText("mockup-live-kpi-overview-devices-sub", "From /devices");
    var withTac = incidents.filter(function (i) {
      return i.tac_case_number && String(i.tac_case_number).length > 0;
    }).length;
    setElText("mockup-live-kpi-overview-tac", String(tacCases.length));
    setElText("mockup-live-kpi-overview-tac-sub", withTac + " incidents with TAC id");
  }

  function applyLiveIncidentView(incidents, properties, tacCases) {
    var names = propNameMap(properties);
    var openInc = incidents.filter(function (i) {
      return isIncidentOpen(i.status);
    });
    var p12 = openInc.filter(function (i) {
      return i.priority === "P1" || i.priority === "P2";
    });
    setElText("mockup-live-kpi-inc-open", String(openInc.length));
    setElText("mockup-live-kpi-inc-p12", String(p12.length));
    var tacLinked = incidents.filter(function (i) {
      return i.tac_case_number;
    }).length;
    setElText("mockup-live-kpi-inc-tac", String(tacLinked));
    setElText("mockup-live-kpi-inc-total", String(incidents.length));

    var tb = document.getElementById("mockup-live-incidents-tbody");
    if (tb) {
      if (!incidents.length) {
        tb.innerHTML =
          '<tr><td colspan="8" style="color:var(--muted)">No incidents returned from API.</td></tr>';
      } else {
        tb.innerHTML = incidents
          .slice(0, 80)
          .map(function (i) {
            return (
              "<tr><td>" +
              escHtml(i.incident_number) +
              "</td><td>" +
              escHtml(i.title) +
              "</td><td>" +
              badgePriorityHtml(i.priority) +
              "</td><td>" +
              badgeStatusHtml(i.status) +
              "</td><td>" +
              escHtml(names[i.property_id] || i.property_id || "—") +
              "</td><td>—</td><td>" +
              escHtml(i.tac_case_number || "—") +
              "</td><td>—</td></tr>"
            );
          })
          .join("");
      }
    }

    var tt = document.getElementById("mockup-live-tac-tbody");
    if (tt) {
      if (!tacCases.length) {
        tt.innerHTML = '<tr><td colspan="3" style="color:var(--muted)">No TAC cases in API.</td></tr>';
      } else {
        tt.innerHTML = tacCases
          .slice(0, 40)
          .map(function (t) {
            return (
              "<tr><td>" +
              escHtml(t.case_number) +
              "</td><td>" +
              escHtml(String(t.severity)) +
              "</td><td>" +
              badgeStatusHtml(t.status) +
              "</td></tr>"
            );
          })
          .join("");
      }
    }
  }

  function applyLiveDevicesView(devices, properties) {
    var names = propNameMap(properties);
    var active = devices.filter(function (d) {
      return (d.status || "").toLowerCase() === "active";
    }).length;
    var maint = devices.filter(function (d) {
      return (d.status || "").toLowerCase() === "maintenance";
    }).length;
    var failed = devices.filter(function (d) {
      return (d.status || "").toLowerCase() === "failed";
    }).length;
    setElText("mockup-live-kpi-dev-total", String(devices.length));
    setElText("mockup-live-kpi-dev-active", String(active));
    setElText("mockup-live-kpi-dev-maint", String(maint));
    setElText("mockup-live-kpi-dev-fail", String(failed));

    var tb = document.getElementById("mockup-live-devices-tbody");
    if (tb) {
      if (!devices.length) {
        tb.innerHTML =
          '<tr><td colspan="9" style="color:var(--muted)">No devices returned from API.</td></tr>';
      } else {
        tb.innerHTML = devices
          .slice(0, 100)
          .map(function (d) {
            return (
              "<tr><td>" +
              escHtml(d.hostname) +
              "</td><td>—</td><td>—</td><td>" +
              escHtml(d.serial_number || "—") +
              "</td><td>" +
              escHtml(d.ip_address || "—") +
              "</td><td>—</td><td>" +
              escHtml(names[d.property_id] || d.property_id || "—") +
              "</td><td>" +
              deviceStatusBadgeHtml(d.status) +
              '</td><td>—</td></tr>'
            );
          })
          .join("");
      }
    }
  }

  function renderLivePropertyPortfolio(properties, devices, incidents) {
    var grid = document.getElementById("property-cards-grid");
    var body = document.getElementById("property-site-map-body");
    var dl = document.getElementById("property-tech-dl");
    if (!grid) return;

    function incOpenForProp(pid) {
      return incidents.filter(function (i) {
        return i.property_id === pid && isIncidentOpen(i.status);
      }).length;
    }
    function devCountForProp(pid) {
      return devices.filter(function (d) {
        return d.property_id === pid;
      }).length;
    }

    var packLive = null;
    if (!properties.length) {
      grid.innerHTML = '<div class="empty-hint">No properties from API.</div>';
    } else {
      packLive = orderPropertiesWithExposureGroupFirst(
        properties,
        function (p) {
          return p.property_id;
        },
        function (p) {
          var dc = devCountForProp(p.property_id);
          var ic = incOpenForProp(p.property_id);
          return Math.min(100, Math.round(dc * 0.11 + ic * 24));
        }
      );
      var tierKeys = packLive.tierKeys;
      grid.innerHTML = packLive.ordered
        .map(function (p, idx) {
          var dc = devCountForProp(p.property_id);
          var ic = incOpenForProp(p.property_id);
          var v = propertyCardVariantClass(idx);
          var photo = propertyCardPhotoUrl(idx);
          var ex =
            tierKeys.has(p.property_id) ? " property-card--exposure-critical" : "";
          var exSr = tierKeys.has(p.property_id)
            ? '<span class="visually-hidden"> Top network exposure index in live portfolio — prioritize remediation.</span>'
            : "";
          return (
            '<div class="card property-card ' +
            v +
            ex +
            '" data-region="lv">' +
            '<div class="property-card__head">' +
            "<h3>" +
            escHtml(p.name) +
            ' <span class="badge b-ok">' +
            escHtml(p.property_type) +
            "</span>" +
            exSr +
            "</h3>" +
            '<img class="property-card__photo" src="' +
            photo +
            '" width="80" height="60" alt="' +
            escHtml(p.name + " — reference property photo") +
            '" loading="lazy" decoding="async" />' +
            "</div>" +
            '<p class="property-card__desc">' +
            escHtml(livePropertyDescriptor(p)) +
            "</p>" +
            '<div class="meta">Live · ' +
            dc +
            " devices · <strong>" +
            ic +
            "</strong> open incidents</div>" +
            '<div class="stat-inline" style="margin-top:8px"><code style="font-size:13px">' +
            escHtml(p.property_id) +
            "</code></div></div>"
          );
        })
        .join("");
    }

    if (body) {
      body.innerHTML = (packLive ? packLive.ordered : properties)
        .map(function (p) {
          return (
            "<tr><td>" +
            escHtml(p.name) +
            "</td><td><code style=\"font-size:13px\">" +
            escHtml(p.property_id) +
            "</code></td><td>" +
            escHtml(p.property_type) +
            "</td></tr>"
          );
        })
        .join("");
    }

    if (dl) {
      dl.innerHTML =
        "<dt>Live mode</dt><dd>Wave tags not loaded from API; device/incident counts above reflect <code>/api/v1</code>.</dd>";
    }
  }

  function liveModeMissingTokenMessage() {
    var origin = "";
    try {
      origin = location.origin;
    } catch (e) {}
    var ops = operationsBaseUrl() + "/";
    var parts = [
      "Live mode needs a JWT in localStorage key accessToken on this page’s origin (" +
        (origin || "unknown") +
        ")."
    ];
    if (mockupTokenStorageIsSeparateFromBackend()) {
      parts.push(
        "This hosted page cannot see a login on your machine — open " +
          ops +
          "mockup/ on the same host as the API, or paste a token below."
      );
    } else {
      parts.push(
        "Sign in at " + ops + " (not the React dev app on another port unless you paste the token here). Then click Refresh."
      );
    }
    return parts.join(" ");
  }

  function refreshMockupLiveData() {
    if (!isMockupLive()) return;
    if (!getLiveAccessToken()) {
      setAppStatusMessage(liveModeMissingTokenMessage());
      var hint = document.getElementById("mockup-live-hint-panel");
      if (hint) hint.hidden = false;
      return;
    }

    Promise.all([
      mockupFetchJson("/properties"),
      mockupFetchJson("/devices"),
      mockupFetchJson("/incidents"),
      mockupFetchJson("/tac-cases")
    ])
      .then(function (results) {
        var pRes = results[0];
        if (results.some(function (r) { return r.networkError; })) {
          setAppStatusMessage(
            liveModeApiUnreachableMessage(getMockupApiPrefix(), pRes.errorDetail || pRes.body.message)
          );
          return;
        }
        if (pRes.status === 401) {
          setAppStatusMessage(
            "Live mode: 401 Unauthorized — token expired or wrong API host. Sign in again at " +
              operationsBaseUrl() +
              "/ or paste a fresh token, then Refresh."
          );
          return;
        }
        if (!pRes.ok || !results[1].ok || !results[2].ok || !results[3].ok) {
          var msg = pRes.body && pRes.body.message ? pRes.body.message : "";
          var st = [pRes.status, results[1].status, results[2].status, results[3].status].join(" / ");
          setAppStatusMessage(
            (msg ? msg + " — " : "") +
              "Live pull failed (HTTP " +
              st +
              "). Sign in on Operations, or open " +
              operationsBaseUrl() +
              "/api/v1/health — if that fails, the API is not running."
          );
          return;
        }
        var properties = Array.isArray(pRes.body) ? pRes.body : [];
        var devices = Array.isArray(results[1].body) ? results[1].body : [];
        var incidents = Array.isArray(results[2].body) ? results[2].body : [];
        var tacCases = Array.isArray(results[3].body) ? results[3].body : [];

        applyLiveOverviewKpis(properties, devices, incidents, tacCases);
        applyLiveIncidentView(incidents, properties, tacCases);
        applyLiveDevicesView(devices, properties);
        renderLivePropertyPortfolio(properties, devices, incidents);
        renderIntegrationAdvisor();
        setAppStatusMessage(
          "Live data refreshed · " +
            properties.length +
            " properties, " +
            devices.length +
            " devices, " +
            incidents.length +
            " incidents."
        );
        var hintOk = document.getElementById("mockup-live-hint-panel");
        if (hintOk) hintOk.hidden = true;

        mockupFetchJson("/admin/sources").then(function (srcRes) {
          applyMvpJourneyLiveFromSources(
            srcRes.ok && Array.isArray(srcRes.body) ? srcRes.body : null,
            srcRes.status
          );
          renderIntegrationAdvisor();
        });
      })
      .catch(function (e) {
        setAppStatusMessage(
          liveModeApiUnreachableMessage(getMockupApiPrefix(), e && e.message ? e.message : String(e))
        );
      });
  }

  function onLiveAccessTokenMaybeChanged() {
    if (!isMockupLive()) return;
    refreshMockupLiveData();
  }

  function initMockupLiveTokenPaste() {
    var inp = document.getElementById("mockup-live-token");
    var save = document.getElementById("mockup-live-token-save");
    var clear = document.getElementById("mockup-live-token-clear");
    if (save && inp) {
      save.addEventListener("click", function () {
        var v = (inp.value || "").trim();
        if (!v) {
          setAppStatusMessage("Paste a JWT from Operations (Application → Local Storage → accessToken), then Save.");
          return;
        }
        try {
          localStorage.setItem(ACCESS_TOKEN_KEY, v);
          inp.value = "";
          setAppStatusMessage("Token saved to localStorage. Pulling live data…");
          refreshMockupLiveData();
        } catch (e) {
          setAppStatusMessage("Could not save token: " + (e && e.message ? e.message : String(e)));
        }
      });
    }
    if (clear) {
      clear.addEventListener("click", function () {
        try {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          if (inp) inp.value = "";
          setAppStatusMessage("accessToken cleared from localStorage.");
          if (isMockupLive()) refreshMockupLiveData();
        } catch (e) {}
      });
    }
  }

  var PANES_SIDEBAR_KEY = "helix-mockup-sidebar-w";
  var PANES_AI_KEY = "helix-mockup-ai-pane-w";
  var PANE_BLOCKS_KEY = "helix-mockup-pane-blocks-order";
  var PANES_DEF_SB = 272;
  var PANES_DEF_AI = 332;
  var PANES_SB_MIN = 200;
  var PANES_SB_MAX = 520;
  var PANES_AI_MIN = 220;
  var PANES_AI_MAX = 560;
  var PANES_CENTER_MIN = 320;

  var mainContentDragBlock = null;
  var aiScrollDragBlock = null;

  function readCssPxVar(name, fallback) {
    var raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    var m = /^([\d.]+)px$/.exec(raw);
    if (m) return Math.round(parseFloat(m[1], 10));
    return fallback;
  }

  function persistPaneWidths(sb, ai) {
    try {
      localStorage.setItem(PANES_SIDEBAR_KEY, String(sb));
      localStorage.setItem(PANES_AI_KEY, String(ai));
    } catch (e) {}
  }

  function setPaneWidths(sb, ai, writeStorage) {
    sb = Math.max(PANES_SB_MIN, Math.min(PANES_SB_MAX, Math.round(sb)));
    ai = Math.max(PANES_AI_MIN, Math.min(PANES_AI_MAX, Math.round(ai)));
    var root = document.documentElement;
    root.style.setProperty("--sidebar-w", sb + "px");
    root.style.setProperty("--ai-pane-w", ai + "px");
    if (writeStorage) persistPaneWidths(sb, ai);
  }

  function clampOuterPanesToViewport() {
    var mq = window.matchMedia("(min-width: 1101px)");
    if (!mq.matches) return;
    var vw = window.innerWidth || document.documentElement.clientWidth || 1200;
    var g = readCssPxVar("--pane-gutter-track", 6) * 2;
    var sb = readCssPxVar("--sidebar-w", PANES_DEF_SB);
    var ai = readCssPxVar("--ai-pane-w", PANES_DEF_AI);
    sb = Math.max(PANES_SB_MIN, Math.min(PANES_SB_MAX, sb));
    ai = Math.max(PANES_AI_MIN, Math.min(PANES_AI_MAX, ai));
    var maxPair = vw - g - PANES_CENTER_MIN;
    if (sb + ai > maxPair) {
      var over = sb + ai - maxPair;
      var fromAi = Math.min(over, ai - PANES_AI_MIN);
      ai -= fromAi;
      over -= fromAi;
      if (over > 0) sb = Math.max(PANES_SB_MIN, sb - over);
    }
    setPaneWidths(sb, ai, true);
  }

  function balanceOuterPaneWidths() {
    var mq = window.matchMedia("(min-width: 1101px)");
    if (!mq.matches) {
      setAppStatusMessage("Balance columns needs a wide window (over 1100px).");
      return;
    }
    var vw = window.innerWidth || document.documentElement.clientWidth || 1200;
    var g = readCssPxVar("--pane-gutter-track", 6) * 2;
    var budget = vw - g - PANES_CENTER_MIN;
    if (budget <= PANES_SB_MIN + PANES_AI_MIN) {
      setPaneWidths(PANES_SB_MIN, PANES_AI_MIN, true);
      clampOuterPanesToViewport();
      setAppStatusMessage("Columns set to minimum widths (narrow viewport).");
      return;
    }
    var half = Math.floor(budget / 2);
    var sb = Math.max(PANES_SB_MIN, Math.min(PANES_SB_MAX, half));
    var ai = budget - sb;
    ai = Math.max(PANES_AI_MIN, Math.min(PANES_AI_MAX, ai));
    if (sb + ai > budget) ai = Math.max(PANES_AI_MIN, budget - sb);
    setPaneWidths(sb, ai, true);
    clampOuterPanesToViewport();
    setAppStatusMessage("Balanced sidebar and AI column widths.");
  }

  function resetOuterPaneWidthsToDefaults() {
    setPaneWidths(PANES_DEF_SB, PANES_DEF_AI, true);
    clampOuterPanesToViewport();
    setAppStatusMessage("Column widths restored to defaults.");
  }

  function loadPaneBlocksStore() {
    try {
      var raw = localStorage.getItem(PANE_BLOCKS_KEY);
      if (!raw) return { main: {}, aiScroll: [] };
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return { main: {}, aiScroll: [] };
      if (!o.main || typeof o.main !== "object") o.main = {};
      if (!Array.isArray(o.aiScroll)) o.aiScroll = [];
      return o;
    } catch (e) {
      return { main: {}, aiScroll: [] };
    }
  }

  function savePaneBlocksStore(store) {
    try {
      localStorage.setItem(PANE_BLOCKS_KEY, JSON.stringify(store));
    } catch (e) {}
  }

  function ensureViewBlockIds(view) {
    if (!view || !view.id) return;
    var vid = view.id;
    var max = 0;
    Array.from(view.children).forEach(function (el) {
      var ps = el.dataset.paneSlot;
      if (!ps || ps.indexOf(vid + "-b") !== 0) return;
      var m = /-b(\d+)$/.exec(ps);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    Array.from(view.children).forEach(function (el) {
      if (el.dataset.paneSlot) return;
      max += 1;
      el.dataset.paneSlot = vid + "-b" + max;
    });
  }

  function applyMainViewBlockOrder(view) {
    if (!view) return;
    ensureViewBlockIds(view);
    var store = loadPaneBlocksStore();
    var order = store.main[view.id];
    if (!order || !order.length) return;
    var map = Object.create(null);
    Array.from(view.children).forEach(function (el) {
      if (el.dataset.paneSlot) map[el.dataset.paneSlot] = el;
    });
    var domIds = Array.from(view.children)
      .map(function (c) {
        return c.dataset.paneSlot;
      })
      .filter(Boolean);
    var merged = mergeNavOrder(order, domIds);
    merged.forEach(function (slot) {
      var el = map[slot];
      if (el) view.appendChild(el);
    });
  }

  function persistMainViewBlockOrder(view) {
    if (!view) return;
    var store = loadPaneBlocksStore();
    store.main[view.id] = Array.from(view.children)
      .map(function (c) {
        return c.dataset.paneSlot;
      })
      .filter(Boolean);
    savePaneBlocksStore(store);
  }

  function ensureAiScrollBlockIds(scroll) {
    if (!scroll) return;
    var max = 0;
    Array.from(scroll.children).forEach(function (el) {
      var ps = el.dataset.paneSlot;
      var m = ps && /^ai-pane-scroll-b(\d+)$/.exec(ps);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    Array.from(scroll.children).forEach(function (el) {
      if (el.dataset.paneSlot) return;
      max += 1;
      el.dataset.paneSlot = "ai-pane-scroll-b" + max;
    });
  }

  function applyAiScrollBlockOrder(scroll) {
    if (!scroll) return;
    ensureAiScrollBlockIds(scroll);
    var store = loadPaneBlocksStore();
    var order = store.aiScroll;
    if (!order || !order.length) return;
    var map = Object.create(null);
    Array.from(scroll.children).forEach(function (el) {
      if (el.dataset.paneSlot) map[el.dataset.paneSlot] = el;
    });
    var domIds = Array.from(scroll.children)
      .map(function (c) {
        return c.dataset.paneSlot;
      })
      .filter(Boolean);
    var merged = mergeNavOrder(order, domIds);
    merged.forEach(function (slot) {
      var el = map[slot];
      if (el) scroll.appendChild(el);
    });
  }

  function persistAiScrollBlockOrder(scroll) {
    if (!scroll) return;
    var store = loadPaneBlocksStore();
    store.aiScroll = Array.from(scroll.children)
      .map(function (c) {
        return c.dataset.paneSlot;
      })
      .filter(Boolean);
    savePaneBlocksStore(store);
  }

  function getBlockAfterElement(container, y, dragging, selector) {
    var items = Array.prototype.slice.call(container.querySelectorAll(selector));
    var closest = { offset: Number.NEGATIVE_INFINITY, child: null };
    var j;
    for (j = 0; j < items.length; j++) {
      var child = items[j];
      if (child === dragging) continue;
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset: offset, child: child };
      }
    }
    return closest.child;
  }

  function refreshMainPaneBlocksDraggable() {
    document.querySelectorAll("section.view > [data-pane-slot]").forEach(function (el) {
      el.removeAttribute("draggable");
    });
    var v = document.querySelector("section.view.active");
    if (!v) return;
    v.querySelectorAll(":scope > [data-pane-slot]").forEach(function (el) {
      el.setAttribute("draggable", "true");
    });
  }

  function initPaneBlocksAndColumnControls() {
    document.querySelectorAll("section.view").forEach(function (v) {
      ensureViewBlockIds(v);
      applyMainViewBlockOrder(v);
    });
    var aiScroll = document.querySelector(".ai-pane-scroll");
    if (aiScroll) {
      applyAiScrollBlockOrder(aiScroll);
    }

    var contentInner = document.querySelector(".content-inner");
    if (contentInner) {
      contentInner.addEventListener(
        "dragstart",
        function (e) {
          var block = e.target.closest("section.view.active > [data-pane-slot]");
          if (!block || !contentInner.contains(block)) return;
          if (e.target.closest("button, a, input, textarea, select, .mock-jump")) {
            e.preventDefault();
            return;
          }
          mainContentDragBlock = block;
          block.classList.add("is-pane-block-dragging");
          try {
            e.dataTransfer.setData("text/plain", block.dataset.paneSlot || "");
            e.dataTransfer.effectAllowed = "move";
          } catch (err) {}
        },
        true
      );
      contentInner.addEventListener("dragend", function () {
        if (mainContentDragBlock) mainContentDragBlock.classList.remove("is-pane-block-dragging");
        contentInner.querySelectorAll(".is-pane-block-dragging").forEach(function (n) {
          n.classList.remove("is-pane-block-dragging");
        });
        var vActive = document.querySelector("section.view.active");
        if (vActive) persistMainViewBlockOrder(vActive);
        mainContentDragBlock = null;
      });
      contentInner.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        var v0 = document.querySelector("section.view.active");
        if (!v0 || !mainContentDragBlock || !v0.contains(mainContentDragBlock)) return;
        var after = getBlockAfterElement(
          v0,
          e.clientY,
          mainContentDragBlock,
          ":scope > [data-pane-slot]:not(.is-pane-block-dragging)"
        );
        if (after == null) v0.appendChild(mainContentDragBlock);
        else v0.insertBefore(mainContentDragBlock, after);
      });
      contentInner.addEventListener("drop", function (e) {
        e.preventDefault();
      });
    }

    if (aiScroll) {
      aiScroll.querySelectorAll("[data-pane-slot]").forEach(function (el) {
        el.setAttribute("draggable", "true");
      });
      aiScroll.addEventListener("dragstart", function (e) {
        var block = e.target.closest(".ai-pane-scroll > [data-pane-slot]");
        if (!block || block.parentElement !== aiScroll) return;
        if (e.target.closest("button, a, input, textarea, select")) {
          e.preventDefault();
          return;
        }
        aiScrollDragBlock = block;
        block.classList.add("is-pane-block-dragging");
        try {
          e.dataTransfer.setData("text/plain", block.dataset.paneSlot || "");
          e.dataTransfer.effectAllowed = "move";
        } catch (err2) {}
      });
      aiScroll.addEventListener("dragend", function () {
        if (aiScrollDragBlock) aiScrollDragBlock.classList.remove("is-pane-block-dragging");
        aiScroll.querySelectorAll(".is-pane-block-dragging").forEach(function (n) {
          n.classList.remove("is-pane-block-dragging");
        });
        persistAiScrollBlockOrder(aiScroll);
        aiScrollDragBlock = null;
      });
      aiScroll.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!aiScrollDragBlock) return;
        var after = getBlockAfterElement(
          aiScroll,
          e.clientY,
          aiScrollDragBlock,
          ":scope > [data-pane-slot]:not(.is-pane-block-dragging)"
        );
        if (after == null) aiScroll.appendChild(aiScrollDragBlock);
        else aiScroll.insertBefore(aiScrollDragBlock, after);
      });
      aiScroll.addEventListener("drop", function (e) {
        e.preventDefault();
      });
    }

    var bal = document.getElementById("mockup-pane-balance");
    var rst = document.getElementById("mockup-pane-reset");
    if (bal) bal.addEventListener("click", balanceOuterPaneWidths);
    if (rst) rst.addEventListener("click", resetOuterPaneWidthsToDefaults);

    refreshMainPaneBlocksDraggable();
  }

  /** Drag or keyboard-adjust sidebar / AI column widths (desktop 3-column layout only). */
  function initPaneResize() {
    var mq = window.matchMedia("(min-width: 1101px)");
    var g1 = document.querySelector(".pane-gutter--sidebar-main");
    var g2 = document.querySelector(".pane-gutter--main-ai");
    if (!g1 || !g2) return;

    var clampToViewport = function () {
      clampOuterPanesToViewport();
    };

    var drag = null;

    var endDrag = function () {
      if (!drag) return;
      drag = null;
      document.body.classList.remove("is-resizing-panes");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchmove", onTouchMove, true);
      window.removeEventListener("touchend", endDrag);
      window.removeEventListener("touchcancel", endDrag);
    };

    var onMove = function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.startX;
      if (drag.which === "sidebar") {
        setPaneWidths(drag.startSb + dx, drag.startAi, true);
      } else {
        setPaneWidths(drag.startSb, drag.startAi + dx, true);
      }
      clampToViewport();
    };

    var onTouchMove = function (ev) {
      if (!drag || !ev.touches || !ev.touches[0]) return;
      ev.preventDefault();
      onMove({ clientX: ev.touches[0].clientX });
    };

    var startDrag = function (which, clientX) {
      if (!mq.matches) return;
      var sb = readCssPxVar("--sidebar-w", PANES_DEF_SB);
      var ai = readCssPxVar("--ai-pane-w", PANES_DEF_AI);
      drag = { which: which, startX: clientX, startSb: sb, startAi: ai };
      document.body.classList.add("is-resizing-panes");
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", endDrag);
      window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
      window.addEventListener("touchend", endDrag);
      window.addEventListener("touchcancel", endDrag);
    };

    g1.addEventListener("mousedown", function (ev) {
      if (ev.button !== 0) return;
      ev.preventDefault();
      startDrag("sidebar", ev.clientX);
    });
    g2.addEventListener("mousedown", function (ev) {
      if (ev.button !== 0) return;
      ev.preventDefault();
      startDrag("ai", ev.clientX);
    });

    g1.addEventListener(
      "touchstart",
      function (ev) {
        if (!mq.matches || !ev.touches[0]) return;
        ev.preventDefault();
        startDrag("sidebar", ev.touches[0].clientX);
      },
      { passive: false }
    );
    g2.addEventListener(
      "touchstart",
      function (ev) {
        if (!mq.matches || !ev.touches[0]) return;
        ev.preventDefault();
        startDrag("ai", ev.touches[0].clientX);
      },
      { passive: false }
    );

    g1.addEventListener("dblclick", function () {
      if (!mq.matches) return;
      var ai = readCssPxVar("--ai-pane-w", PANES_DEF_AI);
      setPaneWidths(PANES_DEF_SB, ai, true);
      clampToViewport();
    });
    g2.addEventListener("dblclick", function () {
      if (!mq.matches) return;
      var sb = readCssPxVar("--sidebar-w", PANES_DEF_SB);
      setPaneWidths(sb, PANES_DEF_AI, true);
      clampToViewport();
    });

    var onKey = function (ev) {
      if (!mq.matches) return;
      var step = ev.shiftKey ? 24 : 8;
      var sb = readCssPxVar("--sidebar-w", PANES_DEF_SB);
      var ai = readCssPxVar("--ai-pane-w", PANES_DEF_AI);
      if (ev.currentTarget === g1) {
        if (ev.key === "ArrowLeft") {
          ev.preventDefault();
          setPaneWidths(sb - step, ai, true);
          clampToViewport();
        } else if (ev.key === "ArrowRight") {
          ev.preventDefault();
          setPaneWidths(sb + step, ai, true);
          clampToViewport();
        } else if (ev.key === "Home") {
          ev.preventDefault();
          setPaneWidths(PANES_SB_MIN, ai, true);
          clampToViewport();
        } else if (ev.key === "End") {
          ev.preventDefault();
          setPaneWidths(PANES_SB_MAX, ai, true);
          clampToViewport();
        }
      } else if (ev.currentTarget === g2) {
        if (ev.key === "ArrowLeft") {
          ev.preventDefault();
          setPaneWidths(sb, ai - step, true);
          clampToViewport();
        } else if (ev.key === "ArrowRight") {
          ev.preventDefault();
          setPaneWidths(sb, ai + step, true);
          clampToViewport();
        } else if (ev.key === "Home") {
          ev.preventDefault();
          setPaneWidths(sb, PANES_AI_MIN, true);
          clampToViewport();
        } else if (ev.key === "End") {
          ev.preventDefault();
          setPaneWidths(sb, PANES_AI_MAX, true);
          clampToViewport();
        }
      }
    };
    g1.addEventListener("keydown", onKey);
    g2.addEventListener("keydown", onKey);

    mq.addEventListener("change", endDrag);
    window.addEventListener("resize", function () {
      clampToViewport();
    });
    clampToViewport();
  }

  var NAV_BREAK_KEY = "helix-mockup-nav-break-scale";
  var NAV_BREAK_MIN = 0.6;
  var NAV_BREAK_MAX = 1.7;

  function setNavBreakScale(scale) {
    scale = Math.round(Math.max(NAV_BREAK_MIN, Math.min(NAV_BREAK_MAX, scale)) * 100) / 100;
    document.documentElement.style.setProperty("--nav-break-scale", String(scale));
    try {
      localStorage.setItem(NAV_BREAK_KEY, String(scale));
    } catch (e) {}
    return scale;
  }

  function syncNavBreakRangeAria(inp, scale) {
    if (!inp) return;
    inp.setAttribute("aria-valuenow", inp.value);
    inp.setAttribute("aria-valuetext", Math.round(scale * 100) + " percent of default nav spacing");
  }

  function initNavBreakScale() {
    var inp = document.getElementById("mockup-nav-break-scale");
    if (!inp) return;
    var cur = 1;
    try {
      var s = localStorage.getItem(NAV_BREAK_KEY);
      if (s && /^[\d.]+$/.test(s)) cur = parseFloat(s, 10);
    } catch (e) {}
    cur = setNavBreakScale(cur);
    inp.value = String(Math.round(cur * 100));
    syncNavBreakRangeAria(inp, cur);
    inp.addEventListener("input", function () {
      var v = parseInt(inp.value, 10) / 100;
      setNavBreakScale(v);
      syncNavBreakRangeAria(inp, v);
    });
    var reset = document.getElementById("mockup-nav-break-reset");
    if (reset) {
      reset.addEventListener("click", function () {
        inp.value = "100";
        setNavBreakScale(1);
        syncNavBreakRangeAria(inp, 1);
      });
    }
  }

  function initOverviewWarRoom() {
    var btn = document.getElementById("overview-open-war-room");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!getLiveAccessToken()) {
        setAppStatusMessage(
          "Open war room requires a JWT: sign in on Operations (same host) or paste accessToken, then try again."
        );
        var hp = document.getElementById("mockup-live-hint-panel");
        if (hp) hp.hidden = false;
        return;
      }
      btn.disabled = true;
      mockupPostJson("/integrations/webex/war-room", {}).then(function (r) {
        btn.disabled = false;
        if (r.ok && r.body && r.body.webUrl) {
          window.open(r.body.webUrl, "_blank", "noopener,noreferrer");
          setAppStatusMessage("Webex space created: " + (r.body.title || "war room") + ". Opened in a new tab.");
          return;
        }
        var msg =
          r.body && r.body.message
            ? r.body.message
            : r.status === 401
              ? "Unauthorized — sign in again on Operations."
              : r.status === 403
                ? "Forbidden — your role cannot create war rooms (needs admin, sdm, tam, manager, or engineer)."
                : r.status === 503
                  ? "Webex bot is not configured on the server (WEBEX_BOT_TOKEN)."
                  : "Could not create Webex space (HTTP " + (r.status || "?") + ").";
        setAppStatusMessage(msg);
      });
    });
  }

  function initMockupLiveMode() {
    syncMockupBackendLinks();

    if (location.search.indexOf("live=1") !== -1) localStorage.setItem(MOCKUP_LIVE_KEY, "1");
    if (location.search.indexOf("live=0") !== -1) localStorage.removeItem(MOCKUP_LIVE_KEY);

    var toggle = document.getElementById("mockup-live-toggle");
    var refresh = document.getElementById("mockup-live-refresh");
    syncMockupLiveBar();

    if (toggle) {
      toggle.addEventListener("change", function () {
        if (toggle.checked) {
          localStorage.setItem(MOCKUP_LIVE_KEY, "1");
          syncMockupLiveBar();
          if (!getLiveAccessToken()) {
            var hint0 = document.getElementById("mockup-live-hint-panel");
            if (hint0) hint0.hidden = false;
          }
          refreshMockupLiveData();
        } else {
          localStorage.removeItem(MOCKUP_LIVE_KEY);
          location.reload();
        }
      });
    }
    if (refresh) {
      refresh.addEventListener("click", function () {
        refreshMockupLiveData();
      });
    }

    window.addEventListener("storage", function (e) {
      if (e.key === ACCESS_TOKEN_KEY) onLiveAccessTokenMaybeChanged();
    });

    initMockupLiveTokenPaste();

    if (isMockupLive()) {
      syncMockupLiveBar();
      if (mockupTokenStorageIsSeparateFromBackend()) {
        var hp0 = document.getElementById("mockup-live-hint-panel");
        if (hp0) hp0.hidden = false;
      }
      refreshMockupLiveData();
    }
  }

  renderSources();
  renderApiBuildsTable();
  renderIntegrationWaveCards();
  renderOverviewSyncCards();
  renderConsoleMapTable();
  renderPropertyCards();
  renderPropertySiteMap();
  renderPropertyTechDl();
  renderMvpProductJourney();
  initMockupLiveMode();
  initOverviewWarRoom();
  initPropertyFilters();
  initCopilotAgentPanel();
  initPaneResize();
  initPaneBlocksAndColumnControls();
  initNavBreakScale();
  var hash = (location.hash || "#overview").slice(1);
  showView(titles[hash] ? hash : "overview");
})();
