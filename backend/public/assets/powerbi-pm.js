/**
 * Loads /api/v1/analytics/powerbi/embed and embeds the Global PM report.
 * Requires JWT from Operations home (localStorage accessToken).
 * powerbi-client provides global `powerbi` and TokenType.Embed = 1.
 */
(function () {
  var statusEl = document.getElementById("pbiStatus");
  var container = document.getElementById("embedContainer");
  if (!statusEl || !container) return;

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = cls || "info";
  }

  async function run() {
    var token = localStorage.getItem("accessToken");
    if (!token) {
      setStatus("Sign in from the Operations page first, then return here.", "err");
      return;
    }

    var res = await fetch("/api/v1/analytics/powerbi/embed", {
      headers: { Authorization: "Bearer " + token }
    });
    var data = await res.json().catch(function () {
      return {};
    });

    if (!res.ok) {
      setStatus(data.message || "Embed API error (" + res.status + ")", "err");
      return;
    }

    if (!data.enabled) {
      setStatus(
        data.message ||
          "Power BI is not configured. Set POWERBI_* variables and restart the backend (see docs/POWERBI_GLOBAL_PM.md).",
        "err"
      );
      return;
    }

    if (typeof powerbi === "undefined" || !powerbi.embed) {
      setStatus("powerbi-client failed to load from CDN.", "err");
      return;
    }

    container.innerHTML = "";
    var cfg = {
      type: "report",
      id: data.reportId,
      embedUrl: data.embedUrl,
      accessToken: data.embedToken,
      tokenType: 1,
      settings: {
        panes: {
          filters: { expanded: false, visible: true },
          pageNavigation: { visible: true }
        }
      }
    };

    try {
      powerbi.embed(container, cfg);
      setStatus("Report loaded: " + (data.reportName || data.reportId) + " · token expires " + (data.tokenExpiry || "—") + " UTC", "ok");
    } catch (e) {
      setStatus("Embed failed: " + (e && e.message ? e.message : String(e)), "err");
    }
  }

  run().catch(function (e) {
    setStatus("Request failed: " + (e && e.message ? e.message : String(e)), "err");
  });
})();
