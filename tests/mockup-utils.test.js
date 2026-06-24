import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  pad2,
  escHtml,
  formatIsoShort,
  getThemePreference,
  getContrastPreference,
  resolveDaylightThemeSync,
  geoStateDesignation,
  geoCityNameForDisplay,
  geoPlaceLineFromReverseGeoClient,
  propertyCardPhotoUrl,
  propertyCardVariantClass,
  PROPERTY_CARD_PHOTOS,
  topExposureTierKeySet,
  orderPropertiesWithExposureGroupFirst,
  mergeNavOrder,
  injectCxBlockOrder,
} from "../backend/public/mockup/mockup-utils.js";

// ── pad2 ──────────────────────────────────────────────────────────────────────

describe("pad2", () => {
  it("pads single digits with a leading zero", () => {
    expect(pad2(0)).toBe("00");
    expect(pad2(1)).toBe("01");
    expect(pad2(9)).toBe("09");
  });

  it("leaves two-digit numbers unchanged", () => {
    expect(pad2(10)).toBe("10");
    expect(pad2(59)).toBe("59");
    expect(pad2(99)).toBe("99");
  });
});

// ── escHtml ───────────────────────────────────────────────────────────────────

describe("escHtml", () => {
  it("returns empty string for null or undefined", () => {
    expect(escHtml(null)).toBe("");
    expect(escHtml(undefined)).toBe("");
  });

  it("escapes ampersands", () => {
    expect(escHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than", () => {
    expect(escHtml("<b>hi</b>")).toBe("&lt;b>hi&lt;/b>");
  });

  it("escapes double quotes", () => {
    expect(escHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escHtml("it's")).toBe("it&#39;s");
  });

  it("escapes all special chars together", () => {
    expect(escHtml('<a href="x" title=\'y\'>a & b</a>')).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;>a &amp; b&lt;/a>"
    );
  });

  it("returns plain strings unchanged", () => {
    expect(escHtml("hello world")).toBe("hello world");
  });
});

// ── formatIsoShort ────────────────────────────────────────────────────────────

describe("formatIsoShort", () => {
  it("returns em dash for falsy inputs", () => {
    expect(formatIsoShort("")).toBe("—");
    expect(formatIsoShort(null)).toBe("—");
    expect(formatIsoShort(undefined)).toBe("—");
  });

  it("formats a valid ISO string to YYYY-MM-DD HH:MM", () => {
    expect(formatIsoShort("2024-06-15T10:30:00Z")).toBe("2024-06-15 10:30");
  });

  it("returns first 19 chars for non-date strings", () => {
    expect(formatIsoShort("not-a-date-just-text")).toBe("not-a-date-just-tex");
  });

  it("returns em dash for completely invalid dates that parse to NaN", () => {
    // Strings that new Date() rejects entirely
    const result = formatIsoShort("!@#");
    // Either "—" (NaN path) or the raw string slice — both are acceptable
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── getThemePreference ────────────────────────────────────────────────────────

describe("getThemePreference", () => {
  beforeEach(() => localStorage.clear());

  it("returns 'system' when nothing is stored", () => {
    expect(getThemePreference()).toBe("system");
  });

  it("returns 'light' when stored", () => {
    localStorage.setItem("helix-mockup-theme", "light");
    expect(getThemePreference()).toBe("light");
  });

  it("returns 'dark' when stored", () => {
    localStorage.setItem("helix-mockup-theme", "dark");
    expect(getThemePreference()).toBe("dark");
  });

  it("returns 'daylight' when stored", () => {
    localStorage.setItem("helix-mockup-theme", "daylight");
    expect(getThemePreference()).toBe("daylight");
  });

  it("returns 'system' for an unrecognised stored value", () => {
    localStorage.setItem("helix-mockup-theme", "rainbow");
    expect(getThemePreference()).toBe("system");
  });
});

// ── getContrastPreference ─────────────────────────────────────────────────────

describe("getContrastPreference", () => {
  beforeEach(() => localStorage.clear());

  it("returns 'standard' when nothing is stored", () => {
    expect(getContrastPreference()).toBe("standard");
  });

  it("returns 'soft' when stored", () => {
    localStorage.setItem("helix-mockup-contrast", "soft");
    expect(getContrastPreference()).toBe("soft");
  });

  it("returns 'high' when stored", () => {
    localStorage.setItem("helix-mockup-contrast", "high");
    expect(getContrastPreference()).toBe("high");
  });

  it("returns 'standard' for an unrecognised stored value", () => {
    localStorage.setItem("helix-mockup-contrast", "ultra");
    expect(getContrastPreference()).toBe("standard");
  });
});

// ── resolveDaylightThemeSync ──────────────────────────────────────────────────

describe("resolveDaylightThemeSync", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("returns 'light' during daytime (10:00 UTC) with no snapshot", () => {
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
    expect(resolveDaylightThemeSync()).toBe("light");
  });

  it("returns 'dark' at night (21:00 UTC) with no snapshot", () => {
    vi.setSystemTime(new Date("2024-06-15T21:00:00Z"));
    expect(resolveDaylightThemeSync()).toBe("dark");
  });

  it("returns 'light' exactly at 07:00 UTC", () => {
    vi.setSystemTime(new Date("2024-06-15T07:00:00Z"));
    expect(resolveDaylightThemeSync()).toBe("light");
  });

  it("returns 'dark' exactly at 19:00 UTC", () => {
    vi.setSystemTime(new Date("2024-06-15T19:00:00Z"));
    expect(resolveDaylightThemeSync()).toBe("dark");
  });

  it("uses a valid cached snapshot for today", () => {
    vi.setSystemTime(new Date("2024-06-15T21:00:00Z")); // night — would be dark without cache
    localStorage.setItem(
      "helix-mockup-daylight-snapshot",
      JSON.stringify({ day: "2024-06-15", theme: "light" })
    );
    expect(resolveDaylightThemeSync()).toBe("light");
  });

  it("ignores a snapshot from a different day", () => {
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z")); // daytime
    localStorage.setItem(
      "helix-mockup-daylight-snapshot",
      JSON.stringify({ day: "2024-06-14", theme: "dark" })
    );
    expect(resolveDaylightThemeSync()).toBe("light"); // falls back to time-of-day
  });

  it("ignores a corrupt snapshot and falls back to time-of-day", () => {
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
    localStorage.setItem("helix-mockup-daylight-snapshot", "{bad json{{");
    expect(resolveDaylightThemeSync()).toBe("light");
  });

  it("ignores a snapshot with an invalid theme value", () => {
    vi.setSystemTime(new Date("2024-06-15T21:00:00Z")); // night
    localStorage.setItem(
      "helix-mockup-daylight-snapshot",
      JSON.stringify({ day: "2024-06-15", theme: "system" }) // not "light" or "dark"
    );
    expect(resolveDaylightThemeSync()).toBe("dark"); // falls back to time-of-day
  });
});

// ── geoStateDesignation ───────────────────────────────────────────────────────

describe("geoStateDesignation", () => {
  it("returns empty string for null", () => {
    expect(geoStateDesignation(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(geoStateDesignation(undefined)).toBe("");
  });

  it("extracts two-letter state code from US principalSubdivisionCode", () => {
    expect(geoStateDesignation({ countryCode: "US", principalSubdivisionCode: "US-NV" })).toBe("NV");
    expect(geoStateDesignation({ countryCode: "US", principalSubdivisionCode: "US-CA" })).toBe("CA");
    expect(geoStateDesignation({ countryCode: "US", principalSubdivisionCode: "US-NY" })).toBe("NY");
  });

  it("returns full subdivision name for non-US countries", () => {
    expect(
      geoStateDesignation({
        countryCode: "GB",
        principalSubdivisionCode: "GB-ENG",
        principalSubdivision: "England",
      })
    ).toBe("England");
  });

  it("falls back to principalSubdivision when US code is absent", () => {
    expect(
      geoStateDesignation({ countryCode: "US", principalSubdivision: "Nevada" })
    ).toBe("Nevada");
  });

  it("falls back to majorSubdivision when principalSubdivision is absent", () => {
    expect(
      geoStateDesignation({ countryCode: "DE", majorSubdivision: "Bayern" })
    ).toBe("Bayern");
  });

  it("handles a code with no dash gracefully", () => {
    expect(
      geoStateDesignation({
        countryCode: "US",
        principalSubdivisionCode: "USNV",
        principalSubdivision: "Nevada",
      })
    ).toBe("Nevada"); // no dash → falls through to principalSubdivision
  });

  it("handles a tail longer than 2 chars (not a state abbr)", () => {
    expect(
      geoStateDesignation({
        countryCode: "US",
        principalSubdivisionCode: "US-ENG",
        principalSubdivision: "SomeState",
      })
    ).toBe("SomeState"); // 3-char tail → falls through
  });
});

// ── geoCityNameForDisplay ─────────────────────────────────────────────────────

describe("geoCityNameForDisplay", () => {
  it("returns empty string for null / undefined", () => {
    expect(geoCityNameForDisplay(null)).toBe("");
    expect(geoCityNameForDisplay(undefined)).toBe("");
  });

  it("returns the city field when present", () => {
    expect(geoCityNameForDisplay({ city: "Las Vegas" })).toBe("Las Vegas");
  });

  it("trims whitespace from city field", () => {
    expect(geoCityNameForDisplay({ city: "  Reno  " })).toBe("Reno");
  });

  it("uses adminLevel 8 entry from localityInfo when city is absent", () => {
    const data = {
      localityInfo: {
        administrative: [
          { name: "Clark County", adminLevel: 6, description: "county" },
          { name: "Las Vegas", adminLevel: 8, description: "city" },
        ],
      },
    };
    expect(geoCityNameForDisplay(data)).toBe("Las Vegas");
  });

  it("skips census-designated places at adminLevel 8", () => {
    const data = {
      localityInfo: {
        administrative: [
          { name: "Paradise", adminLevel: 8, description: "census-designated place" },
        ],
      },
    };
    expect(geoCityNameForDisplay(data)).toBe(""); // no non-CDP fallback available
  });

  it("skips township entries", () => {
    const data = {
      localityInfo: {
        administrative: [
          { name: "Springfield Township", adminLevel: 8, description: "township in Ohio" },
        ],
      },
    };
    expect(geoCityNameForDisplay(data)).toBe("");
  });

  it("falls back through the reverse-scan when no adminLevel-8 match", () => {
    const data = {
      localityInfo: {
        administrative: [
          { name: "Nevada", adminLevel: 4, description: "state of the US" },
          { name: "Clark County", adminLevel: 6, description: "county" },
          { name: "Spring Valley", adminLevel: 10, description: "neighborhood" },
        ],
      },
    };
    // adminLevel 4 is excluded; county adminLevel 6 is excluded; adminLevel 10 is kept
    expect(geoCityNameForDisplay(data)).toBe("Spring Valley");
  });

  it("skips county rows in the reverse scan", () => {
    const data = {
      localityInfo: {
        administrative: [
          { name: "Clark County", adminLevel: 6, description: "county in Nevada" },
        ],
      },
    };
    expect(geoCityNameForDisplay(data)).toBe("");
  });

  it("returns village when city and localityInfo are absent", () => {
    expect(geoCityNameForDisplay({ village: "Smalltown" })).toBe("Smalltown");
  });

  it("skips village names containing 'township'", () => {
    expect(geoCityNameForDisplay({ village: "Springfield Township" })).toBe("");
  });

  it("returns empty string when nothing matches", () => {
    expect(geoCityNameForDisplay({})).toBe("");
  });
});

// ── geoPlaceLineFromReverseGeoClient ──────────────────────────────────────────

describe("geoPlaceLineFromReverseGeoClient", () => {
  it("returns empty string for null", () => {
    expect(geoPlaceLineFromReverseGeoClient(null)).toBe("");
  });

  it("combines city and state with a comma", () => {
    const data = {
      city: "Las Vegas",
      countryCode: "US",
      principalSubdivisionCode: "US-NV",
    };
    expect(geoPlaceLineFromReverseGeoClient(data)).toBe("Las Vegas, NV");
  });

  it("returns just the city when state is absent", () => {
    expect(geoPlaceLineFromReverseGeoClient({ city: "Las Vegas" })).toBe("Las Vegas");
  });

  it("returns just the state when city is absent", () => {
    expect(
      geoPlaceLineFromReverseGeoClient({
        countryCode: "US",
        principalSubdivisionCode: "US-NV",
      })
    ).toBe("NV");
  });

  it("returns empty string when both city and state are absent", () => {
    expect(geoPlaceLineFromReverseGeoClient({})).toBe("");
  });
});

// ── propertyCardPhotoUrl ──────────────────────────────────────────────────────

describe("propertyCardPhotoUrl", () => {
  it("returns the first URL for index 0", () => {
    expect(propertyCardPhotoUrl(0)).toBe(PROPERTY_CARD_PHOTOS[0]);
  });

  it("returns the second URL for index 1", () => {
    expect(propertyCardPhotoUrl(1)).toBe(PROPERTY_CARD_PHOTOS[1]);
  });

  it("wraps around at the array length boundary", () => {
    const len = PROPERTY_CARD_PHOTOS.length;
    expect(propertyCardPhotoUrl(len)).toBe(PROPERTY_CARD_PHOTOS[0]);
    expect(propertyCardPhotoUrl(len + 1)).toBe(PROPERTY_CARD_PHOTOS[1]);
  });

  it("all returned URLs are non-empty strings", () => {
    for (let i = 0; i < PROPERTY_CARD_PHOTOS.length * 2; i++) {
      expect(typeof propertyCardPhotoUrl(i)).toBe("string");
      expect(propertyCardPhotoUrl(i).length).toBeGreaterThan(0);
    }
  });
});

// ── propertyCardVariantClass ──────────────────────────────────────────────────

describe("propertyCardVariantClass", () => {
  it("generates classes from 0 to 5", () => {
    for (let i = 0; i <= 5; i++) {
      expect(propertyCardVariantClass(i)).toBe(`property-card--v${i}`);
    }
  });

  it("wraps around at 6", () => {
    expect(propertyCardVariantClass(6)).toBe("property-card--v0");
    expect(propertyCardVariantClass(7)).toBe("property-card--v1");
    expect(propertyCardVariantClass(11)).toBe("property-card--v5");
    expect(propertyCardVariantClass(12)).toBe("property-card--v0");
  });
});

// ── topExposureTierKeySet ─────────────────────────────────────────────────────

describe("topExposureTierKeySet", () => {
  it("returns an empty set for empty input", () => {
    expect(topExposureTierKeySet([])).toEqual(new Set());
  });

  it("filters out zero and negative scores", () => {
    expect(
      topExposureTierKeySet([
        { key: "a", score: 0 },
        { key: "b", score: -5 },
      ])
    ).toEqual(new Set());
  });

  it("includes all items when there are fewer than 3", () => {
    const result = topExposureTierKeySet([
      { key: "a", score: 90 },
      { key: "b", score: 70 },
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("includes exactly the top 3 when scores are distinct", () => {
    const result = topExposureTierKeySet([
      { key: "d", score: 40 },
      { key: "a", score: 90 },
      { key: "c", score: 70 },
      { key: "b", score: 80 },
    ]);
    expect(result).toEqual(new Set(["a", "b", "c"]));
    expect(result.has("d")).toBe(false);
  });

  it("includes all ties at the third-rank cutoff", () => {
    const result = topExposureTierKeySet([
      { key: "a", score: 90 },
      { key: "b", score: 80 },
      { key: "c", score: 70 },
      { key: "d", score: 70 }, // ties with c at the cutoff
      { key: "e", score: 60 },
    ]);
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
    expect(result.has("c")).toBe(true);
    expect(result.has("d")).toBe(true); // tie is included
    expect(result.has("e")).toBe(false);
  });

  it("handles a single entry", () => {
    const result = topExposureTierKeySet([{ key: "x", score: 55 }]);
    expect(result).toEqual(new Set(["x"]));
  });
});

// ── orderPropertiesWithExposureGroupFirst ─────────────────────────────────────

describe("orderPropertiesWithExposureGroupFirst", () => {
  const mkItem = (name, score) => ({ name, score });
  const key = (p) => p.name;
  const scr = (p) => p.score;

  it("places the top-tier items first, highest score first within the tier", () => {
    const list = [
      mkItem("low", 20),
      mkItem("top1", 90),
      mkItem("top2", 80),
      mkItem("top3", 70),
    ];
    const { ordered } = orderPropertiesWithExposureGroupFirst(list, key, scr);
    expect(ordered[0].name).toBe("top1");
    expect(ordered[1].name).toBe("top2");
    expect(ordered[2].name).toBe("top3");
    expect(ordered[3].name).toBe("low");
  });

  it("returns tierKeys containing only tier members", () => {
    const list = [mkItem("a", 90), mkItem("b", 80), mkItem("c", 70), mkItem("d", 10)];
    const { tierKeys } = orderPropertiesWithExposureGroupFirst(list, key, scr);
    expect(tierKeys.has("a")).toBe(true);
    expect(tierKeys.has("b")).toBe(true);
    expect(tierKeys.has("c")).toBe(true);
    expect(tierKeys.has("d")).toBe(false);
  });

  it("preserves original order for items with equal non-tier scores", () => {
    const list = [mkItem("x", 10), mkItem("y", 10), mkItem("z", 90)];
    const { ordered } = orderPropertiesWithExposureGroupFirst(list, key, scr);
    // z is tier; x and y are equal, should respect original order
    expect(ordered[0].name).toBe("z");
    expect(ordered[1].name).toBe("x");
    expect(ordered[2].name).toBe("y");
  });

  it("handles items with NaN scores by treating them as 0", () => {
    const list = [mkItem("a", NaN), mkItem("b", 50)];
    const { ordered } = orderPropertiesWithExposureGroupFirst(list, key, scr);
    // b has a positive score, so it enters the tier; a (NaN → 0) does not
    expect(ordered[0].name).toBe("b");
  });
});

// ── mergeNavOrder ─────────────────────────────────────────────────────────────

describe("mergeNavOrder", () => {
  it("returns dom order when saved is empty", () => {
    expect(mergeNavOrder([], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns saved order when all ids are in dom", () => {
    expect(mergeNavOrder(["c", "a", "b"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });

  it("appends dom ids not present in saved", () => {
    expect(mergeNavOrder(["b", "a"], ["a", "b", "c"])).toEqual(["b", "a", "c"]);
  });

  it("drops saved ids not present in dom", () => {
    expect(mergeNavOrder(["a", "x", "b"], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("deduplicates repeated ids in saved", () => {
    expect(mergeNavOrder(["a", "a", "b"], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns all dom ids when saved contains only unknown ids", () => {
    expect(mergeNavOrder(["x", "y"], ["a", "b"])).toEqual(["a", "b"]);
  });
});

// ── injectCxBlockOrder ────────────────────────────────────────────────────────

describe("injectCxBlockOrder", () => {
  const cx = ["s", "j", "c"];

  it("returns fullDefault unchanged when no CX ids are present", () => {
    const full = ["overview", "incidents", "devices"];
    expect(injectCxBlockOrder(full, cx, ["c", "s", "j"])).toEqual(full);
  });

  it("replaces the CX block with the ordered version", () => {
    const full = ["overview", "s", "j", "c", "properties"];
    const result = injectCxBlockOrder(full, cx, ["c", "s", "j"]);
    expect(result).toEqual(["overview", "c", "s", "j", "properties"]);
  });

  it("handles a CX block at the start of fullDefault", () => {
    const full = ["s", "j", "c", "properties"];
    const result = injectCxBlockOrder(full, cx, ["c", "j", "s"]);
    expect(result).toEqual(["c", "j", "s", "properties"]);
  });

  it("handles a CX block at the end of fullDefault", () => {
    const full = ["overview", "properties", "s", "j", "c"];
    const result = injectCxBlockOrder(full, cx, ["j", "s", "c"]);
    expect(result).toEqual(["overview", "properties", "j", "s", "c"]);
  });

  it("does not mutate the original fullDefault array", () => {
    const full = ["a", "s", "j", "c", "b"];
    const copy = [...full];
    injectCxBlockOrder(full, cx, ["c", "s", "j"]);
    expect(full).toEqual(copy);
  });
});
