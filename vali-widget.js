/* VALI – VITA Chat-Widget (selbststaendig, ohne Abhaengigkeiten)
   Einbau: <script src="/vali-widget.js" defer></script> vor </body>.
   Ruft die Netlify-Funktion /.netlify/functions/chat auf (gleiche Domain,
   konform mit eurer Content-Security-Policy connect-src 'self'). */
(function () {
  "use strict";

  var ENDPOINT = "/.netlify/functions/chat";

  var WELCOME =
    "Hallo, ich bin **VALI**.\n\n" +
    "Dein digitaler Assistent für IT, Cybersecurity und Automatisierung.\n\n" +
    "Ich unterstütze dich bei:\n\n" +
    "- KI & Automatisierung\n" +
    "- Cybersecurity & IT-Risiken\n" +
    "- CRM, ERP & Business IT\n" +
    "- Governance & Compliance\n" +
    "- Schulungen & Support\n\n" +
    "Wie kann ich dich unterstützen?";

  var messages = [{ role: "assistant", content: WELCOME }];
  var loading = false;
  var open = false;

  // ---- kleine Markdown-Darstellung (fett, Listen, Absaetze) ----
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inline(t) {
    return t
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>");
  }
  function renderMarkdown(md) {
    var esc = escapeHtml(md);
    var lines = esc.split("\n");
    var html = "", inUl = false, inOl = false, para = [];
    function closeLists() {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (inOl) { html += "</ol>"; inOl = false; }
    }
    function flushPara() {
      if (para.length) { html += "<p>" + inline(para.join(" ")) + "</p>"; para = []; }
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line === "") { flushPara(); closeLists(); continue; }
      var ulm = line.match(/^[-*]\s+(.*)/);
      var olm = line.match(/^\d+\.\s+(.*)/);
      var hm = line.match(/^#{1,6}\s+(.*)/);
      if (ulm) {
        flushPara();
        if (inOl) { html += "</ol>"; inOl = false; }
        if (!inUl) { html += "<ul>"; inUl = true; }
        html += "<li>" + inline(ulm[1]) + "</li>";
      } else if (olm) {
        flushPara();
        if (inUl) { html += "</ul>"; inUl = false; }
        if (!inOl) { html += "<ol>"; inOl = true; }
        html += "<li>" + inline(olm[1]) + "</li>";
      } else if (hm) {
        flushPara(); closeLists();
        html += '<p class="vali-h">' + inline(hm[1]) + "</p>";
      } else {
        closeLists();
        para.push(line);
      }
    }
    flushPara(); closeLists();
    return html;
  }

  // ---- Styles ----
  var css =
    "#vali-root{position:fixed;bottom:24px;right:24px;z-index:2147483000;font-family:'Barlow',system-ui,sans-serif}" +
    "#vali-btn{display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#0a1628,#1a3a6b);color:#f0f4ff;border:1px solid #c9a84c;padding:12px 18px;border-radius:999px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:'Rajdhani',sans-serif;font-weight:600;font-size:15px;letter-spacing:.5px}" +
    "#vali-btn:hover{filter:brightness(1.12)}" +
    "#vali-btn svg{width:20px;height:20px;fill:#c9a84c}" +
    "#vali-panel{display:none;flex-direction:column;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 48px);background:linear-gradient(180deg,#0a1628,#060e1e);border:1px solid rgba(201,168,76,.35);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.5);overflow:hidden}" +
    "#vali-root.vali-open #vali-panel{display:flex}" +
    "#vali-root.vali-open #vali-btn{display:none}" +
    "#vali-head{display:flex;justify-content:space-between;align-items:flex-start;padding:16px 18px;border-bottom:1px solid rgba(201,168,76,.25);background:rgba(201,168,76,.04)}" +
    "#vali-head .vali-title{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:18px;color:#f0f4ff;line-height:1.1;letter-spacing:1px}" +
    "#vali-head .vali-sub{font-size:11px;color:#c9a84c;letter-spacing:.4px;margin-top:2px}" +
    "#vali-close{background:none;border:none;color:#c8d4e8;font-size:20px;cursor:pointer;line-height:1;padding:0 2px}" +
    "#vali-close:hover{color:#f0f4ff}" +
    "#vali-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}" +
    ".vali-msg{max-width:86%;padding:10px 13px;border-radius:12px;font-size:14px;line-height:1.5;color:#e7eefc;word-wrap:break-word}" +
    ".vali-msg.user{align-self:flex-end;background:#1a3a6b;border:1px solid rgba(201,168,76,.2)}" +
    ".vali-msg.bot{align-self:flex-start;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07)}" +
    ".vali-msg p{margin:0 0 8px 0}.vali-msg p:last-child{margin-bottom:0}" +
    ".vali-msg ul,.vali-msg ol{margin:0 0 8px 0;padding-left:18px}.vali-msg li{margin:2px 0}" +
    ".vali-msg strong{color:#fff;font-weight:600}.vali-msg .vali-h{font-weight:700;color:#c9a84c}" +
    ".vali-dots span{display:inline-block;animation:vali-b 1s infinite}.vali-dots span:nth-child(2){animation-delay:.15s}.vali-dots span:nth-child(3){animation-delay:.3s}" +
    "@keyframes vali-b{0%,60%,100%{opacity:.3}30%{opacity:1}}" +
    "#vali-foot{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(201,168,76,.2)}" +
    "#vali-input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 12px;color:#f0f4ff;font-size:14px;font-family:'Barlow',sans-serif;outline:none}" +
    "#vali-input::placeholder{color:#7c8aa6}" +
    "#vali-input:focus{border-color:#c9a84c}" +
    "#vali-send{background:#c9a84c;border:none;color:#0a1628;width:44px;border-radius:10px;cursor:pointer;font-size:18px;font-weight:700}" +
    "#vali-send:disabled{opacity:.5;cursor:default}" +
    "#vali-msgs::-webkit-scrollbar{width:8px}#vali-msgs::-webkit-scrollbar-thumb{background:rgba(201,168,76,.3);border-radius:8px}";

  // ---- Aufbau ----
  var root, msgsEl, inputEl, sendEl;

  function build() {
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    root = document.createElement("div");
    root.id = "vali-root";
    root.innerHTML =
      '<button id="vali-btn" aria-label="VALI Chat öffnen">' +
      '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.5 3.4 6L4 21l4.5-2.1c1.1.3 2.3.4 3.5.4 5.5 0 10-3.6 10-8s-4.5-8-10-8z"/></svg>' +
      "VALI</button>" +
      '<div id="vali-panel" role="dialog" aria-label="VALI Chat">' +
      '<div id="vali-head"><div><div class="vali-title">VALI</div>' +
      '<div class="vali-sub">VITA Assistant für Lösungen &amp; IT</div></div>' +
      '<button id="vali-close" aria-label="Schließen">&times;</button></div>' +
      '<div id="vali-msgs"></div>' +
      '<div id="vali-foot"><input id="vali-input" type="text" placeholder="Frag etwas..." autocomplete="off">' +
      '<button id="vali-send" aria-label="Senden">&rarr;</button></div>' +
      "</div>";
    document.body.appendChild(root);

    msgsEl = root.querySelector("#vali-msgs");
    inputEl = root.querySelector("#vali-input");
    sendEl = root.querySelector("#vali-send");

    root.querySelector("#vali-btn").addEventListener("click", toggle);
    root.querySelector("#vali-close").addEventListener("click", toggle);
    sendEl.addEventListener("click", send);
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });

    paint();
  }

  function toggle() {
    open = !open;
    root.classList.toggle("vali-open", open);
    if (open) { setTimeout(function () { inputEl.focus(); }, 50); }
  }

  function paint() {
    msgsEl.innerHTML = "";
    messages.forEach(function (m) {
      var d = document.createElement("div");
      d.className = "vali-msg " + (m.role === "user" ? "user" : "bot");
      if (m.role === "user") { d.textContent = m.content; }
      else { d.innerHTML = renderMarkdown(m.content); }
      msgsEl.appendChild(d);
    });
    if (loading) {
      var l = document.createElement("div");
      l.className = "vali-msg bot vali-dots";
      l.innerHTML = "<span>&bull;</span><span>&bull;</span><span>&bull;</span>";
      msgsEl.appendChild(l);
    }
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function send() {
    var text = inputEl.value.trim();
    if (!text || loading) return;
    messages.push({ role: "user", content: text });
    inputEl.value = "";
    loading = true;
    sendEl.disabled = true;
    paint();

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || !data.reply) throw new Error(data.error || "Fehler");
          return data.reply;
        });
      })
      .then(function (reply) {
        messages.push({ role: "assistant", content: reply });
      })
      .catch(function () {
        messages.push({
          role: "assistant",
          content:
            "Entschuldige, da ist etwas schiefgelaufen. Bitte versuch es gleich noch einmal – oder erreiche uns direkt unter +43 670 1 84 83 82.",
        });
      })
      .finally(function () {
        loading = false;
        sendEl.disabled = false;
        paint();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
