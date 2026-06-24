/* mockup-utils.js — pure utility functions extracted for unit testing.
 *
 * Exported as named ES module exports so tests can import them directly.
 * The browser continues to use mockup-hub.js which re-defines these
 * functions inside its IIFE; this file does not affect browser behaviour.
 */

const THEME_KEY = "helix-mockup-theme";
const DAYLIGHT_SNAPSHOT_KEY = "helix-mockup-daylight-snapshot";
const CONTRAST_KEY = "helix-mockup-contrast";

export const PROPERTY_CARD_PHOTOS = [
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=240&h=180&fit=crop&q=80",
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=240&h=180&fit=crop&q=80",
  "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=240&h=180&fit=crop&q=80",
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=240&h=180&fit=crop&q=80",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=240&h=180&fit=crop&q=80",
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=240&h=180&fit=crop&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=240&h=180&fit=crop&q=80",
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=240&h=180&fit=crop&q=80",
];

// ── Storage preference readers ────────────────────────────────────────────────

export function getThemePreference() {
  var s = localStorage.getItem(THEME_KEY);
  if (s === "light" || s === "dark") return s;
  if (s === "daylight") return "daylight";
  return "system";
}

export function resolveDaylightThemeSync() {
  try {
    var snap = JSON.parse(localStorage.getItem(DAYLIGHT_SNAPSHOT_KEY));
    var today = new Date().toISOString().slice(0, 10);
    if (snap && snap.day === today && (snap.theme === "light" || snap.theme === "dark"))
      return snap.theme;
  } catch (e) {}
  var h = new Date().getHours();
  return h >= 7 && h < 19 ? "light" : "dark";
}

export function getContrastPreference() {
  var c = localStorage.getItem(CONTRAST_KEY);
  if (c === "soft" || c === "high") return c;
  return "standard";
}

// ── Geo / reverse-geocode helpers ────────────────────────────────────────────

/** U.S.: two-letter state from principalSubdivisionCode (e.g. US-NV → NV); else full subdivision name. */
export function geoStateDesignation(data) {
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
export function geoCityNameForDisplay(data) {
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

export function geoPlaceLineFromReverseGeoClient(data) {
  var city = geoCityNameForDisplay(data);
  var st = geoStateDesignation(data);
  if (city && st) return city + ", " + st;
  return city || st || "";
}

// ── Formatting utilities ─────────────────────────────────────────────────────

export function pad2(n) {
  return String(n).length < 2 ? "0" + n : String(n);
}

export function escHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatIsoShort(iso) {
  if (!iso) return "—";
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 19);
    return d.toISOString().slice(0, 16).replace("T", " ");
  } catch (e) {
    return "—";
  }
}

// ── Property card helpers ────────────────────────────────────────────────────

export function propertyCardPhotoUrl(index) {
  return PROPERTY_CARD_PHOTOS[index % PROPERTY_CARD_PHOTOS.length];
}

export function propertyCardVariantClass(index) {
  return "property-card--v" + (index % 6);
}

// ── Exposure tier ranking ─────────────────────────────────────────────────────

/**
 * Top exposure tier: highest scores plus ties at the third rank.
 * @param {{ key: string, score: number }[]} entries
 * @returns {Set<string>}
 */
export function topExposureTierKeySet(entries) {
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
 * Places the current top exposure tier first (highest score first);
 * remaining properties follow by score, then original order.
 */
export function orderPropertiesWithExposureGroupFirst(list, keyFn, scoreFn) {
  var decorated = list.map(function (item, origIdx) {
    var s = scoreFn(item);
    return {
      item: item,
      key: keyFn(item),
      score: typeof s === "number" && !isNaN(s) ? s : 0,
      origIdx: origIdx,
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
    tierKeys: tierKeys,
  };
}

// ── Nav order helpers ─────────────────────────────────────────────────────────

/**
 * Merge a saved tab order with the live DOM ids.
 * Saved ids not present in domIds are dropped; dom ids not in saved are appended.
 */
export function mergeNavOrder(saved, domIds) {
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

/**
 * Replace the contiguous CX-tab block in fullDefault with the user-ordered
 * cxOrderedMerged list. Returns fullDefault unchanged if no CX ids are found.
 */
export function injectCxBlockOrder(fullDefault, cxIdsList, cxOrderedMerged) {
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
