/**
 * Embeddable “Report inaccuracy” widget for docs sites.
 *
 * Usage (script tag):
 *   <script
 *     src="https://YOUR_DASHBOARD/embed.js"
 *     data-repo-id="repo_demo"
 *     data-page="docs/api.md"
 *     data-api="https://YOUR_DASHBOARD/api/feedback"
 *     defer
 *   ></script>
 *
 * Or React: import { FeedbackWidget } from "@/components/feedback-widget"
 */
(function () {
  var script =
    document.currentScript ||
    (function () {
      var list = document.getElementsByTagName("script");
      return list[list.length - 1];
    })();
  if (!script) return;

  var api =
    script.getAttribute("data-api") ||
    (script.src ? script.src.replace(/\/embed\.js.*$/, "/api/feedback") : "/api/feedback");
  var repoId = script.getAttribute("data-repo-id") || "";
  var repoFullName = script.getAttribute("data-repo-full-name") || "";
  var page =
    script.getAttribute("data-page") ||
    (typeof location !== "undefined" ? location.pathname.replace(/^\//, "") : "docs/");
  var mountId = script.getAttribute("data-mount") || "";

  var host = mountId ? document.getElementById(mountId) : null;
  if (!host) {
    host = document.createElement("div");
    host.setAttribute("data-shtd-feedback", "1");
    (script.parentNode || document.body).insertBefore(host, script.nextSibling);
  }

  /* Ink & Signal — light paper variant for docs sites */
  host.innerHTML =
    '<details style="font:500 14px/1.5 Sora,ui-sans-serif,system-ui,sans-serif;max-width:28rem;margin:1.25rem 0;border:1px solid rgba(20,36,48,0.12);border-radius:10px;padding:0.9rem 1.05rem;background:linear-gradient(165deg,#f4f7f9 0%,#eef3f5 100%);color:#0e141b;box-shadow:0 1px 0 rgba(46,196,182,0.08)">' +
    '<summary style="cursor:pointer;font-family:Syne,ui-sans-serif,system-ui,sans-serif;font-weight:650;letter-spacing:-0.01em;list-style:none">' +
    '<span style="display:inline-block;width:0.4rem;height:0.4rem;margin-right:0.5rem;border-radius:50%;background:#2ec4b6;vertical-align:middle"></span>' +
    "Report inaccuracy</summary>" +
    '<form style="display:grid;gap:0.65rem;margin-top:0.85rem">' +
    '<label style="display:grid;gap:0.3rem;font-size:0.8rem;color:#5c6d82;font-weight:500">Quoted text (optional)' +
    '<input name="quote" style="padding:0.55rem 0.7rem;border:1px solid rgba(20,36,48,0.16);border-radius:4px;background:#fff;color:#0e141b;font:inherit" /></label>' +
    '<label style="display:grid;gap:0.3rem;font-size:0.8rem;color:#5c6d82;font-weight:500">What’s wrong?' +
    '<textarea name="note" required rows="3" style="padding:0.55rem 0.7rem;border:1px solid rgba(20,36,48,0.16);border-radius:4px;background:#fff;color:#0e141b;font:inherit;resize:vertical"></textarea></label>' +
    '<button type="submit" style="justify-self:start;padding:0.5rem 0.95rem;border:0;border-radius:4px;background:#2ec4b6;color:#04201c;font-weight:650;font:inherit;cursor:pointer">Send</button>' +
    '<p data-status style="margin:0;font-size:0.82rem;color:#5c6d82"></p>' +
    "</form></details>";

  var form = host.querySelector("form");
  var status = host.querySelector("[data-status]");
  if (!form) return;

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var fd = new FormData(form);
    var note = String(fd.get("note") || "").trim();
    var quote = String(fd.get("quote") || "").trim();
    if (!note) return;
    if (status) status.textContent = "Sending…";

    var payload = {
      page: page,
      note: note,
      quote: quote || undefined,
      repoId: repoId || undefined,
      repoFullName: repoFullName || undefined,
    };

    fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.error && JSON.stringify(body.error)) || "Failed");
          return body;
        });
      })
      .then(function (body) {
        if (status) {
          var fid = body.finding && body.finding.id;
          status.textContent = fid
            ? "Thanks — queued as finding " + fid
            : "Thanks — feedback received";
        }
        form.reset();
      })
      .catch(function (err) {
        if (status) status.textContent = err.message || "Failed to send";
      });
  });
})();
