/* lead-capture.js — one shared handler for every Ananta lead form (landing, villas,
   apartments). Keeps the three EN pages in sync: same submit logic, same Turnstile sitekey,
   same consent version. Posts to /api/lead (the CF Pages Function at functions/api/lead.js),
   which holds the Power Automate token server-side. The PA URL and sig token must NEVER
   appear in this file or any page.
   See council verdict on the Notion Bali page (update 26.6.2026).

   Form contract (per page):
     <form data-lead-form data-project="Ananta Canggu"> ... </form>
   with named inputs: name, email, country, gdpr_consent (checkbox, required),
   marketing_consent (checkbox), website (honeypot, hidden), and a <div class="cf-turnstile-target">.
   A sibling .modal__success is revealed on success; a [data-lead-error] inside the form is
   shown on failure. Modal open/close is driven by data-open-modal / data-close-modal. */
(function () {
  "use strict";

  // Cloudflare Turnstile sitekey for the Ananta lead forms (public; safe in client JS).
  // Pairs with the TURNSTILE_SECRET env var that the /api/lead function verifies against.
  var TURNSTILE_SITEKEY = "0x4AAAAAADrWS2_BkgjuQ6FP";
  // Keep in sync with CONSENT_VERSION in functions/api/lead.js.
  var CONSENT_VERSION = "v1-2026-06-26";

  function field(form, name) {
    return form.querySelector('[name="' + name + '"]');
  }
  function value(form, name) {
    var el = field(form, name);
    return el ? el.value : "";
  }
  function isChecked(form, name) {
    var el = field(form, name);
    return !!(el && el.checked);
  }

  // ----- Turnstile (explicit render so the sitekey lives in one place) -----
  function renderTurnstile() {
    if (!window.turnstile) return;
    var targets = document.querySelectorAll(".cf-turnstile-target");
    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      if (el.getAttribute("data-rendered")) continue;
      try {
        window.turnstile.render(el, { sitekey: TURNSTILE_SITEKEY });
        el.setAttribute("data-rendered", "1");
      } catch (e) {}
    }
  }
  // Turnstile's api.js calls this when it finishes loading (?onload=onTurnstileLoad).
  window.onTurnstileLoad = renderTurnstile;

  function resetTurnstile(form) {
    if (!window.turnstile) return;
    var el = form.querySelector(".cf-turnstile-target");
    try { window.turnstile.reset(el || undefined); } catch (e) {}
  }

  // ----- Submit -----
  function wireForm(form) {
    var box = form.closest(".modal__box") || form.parentElement;
    var successEl = box ? box.querySelector(".modal__success") : null;
    var errorEl = form.querySelector("[data-lead-error]");
    var submitBtn = form.querySelector('[type="submit"]');

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";

      // Required-consent guard (native `required` also enforces this).
      var gdpr = field(form, "gdpr_consent");
      if (gdpr && !gdpr.checked) {
        if (gdpr.reportValidity) gdpr.reportValidity();
        return;
      }

      var tokenEl = form.querySelector('[name="cf-turnstile-response"]');
      var payload = {
        name: value(form, "name"),
        email: value(form, "email"),
        country: value(form, "country"),
        project: form.getAttribute("data-project") || "",
        gdpr_consent: isChecked(form, "gdpr_consent"),
        marketing_consent: isChecked(form, "marketing_consent"),
        consent_version: CONSENT_VERSION,
        website: value(form, "website"), // honeypot; real users leave it empty
        turnstile_token: tokenEl ? tokenEl.value : "",
        page_url: location.href,
      };

      if (submitBtn) submitBtn.disabled = true;

      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r
            .json()
            .catch(function () { return {}; })
            .then(function (body) {
              if (!r.ok || !body || body.ok !== true) throw new Error("post_failed");
            });
        })
        .then(function () {
          // SUCCESS — and only here — reveal the deck. Never on failure.
          form.style.display = "none";
          if (successEl) successEl.style.display = "block";
        })
        .catch(function () {
          // Failure: show the error, keep the form, let them retry. No success, no PDF.
          if (errorEl) errorEl.style.display = "block";
          resetTurnstile(form);
        })
        .then(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  // ----- Generic modal open/close (data-attr driven) -----
  function wireModals() {
    var openers = document.querySelectorAll("[data-open-modal]");
    for (var i = 0; i < openers.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          var m = document.getElementById(btn.getAttribute("data-open-modal"));
          if (m) m.classList.add("open");
        });
      })(openers[i]);
    }
    var closers = document.querySelectorAll("[data-close-modal]");
    for (var j = 0; j < closers.length; j++) {
      closers[j].addEventListener("click", function () {
        var m = this.closest(".modal");
        if (m) m.classList.remove("open");
      });
    }
    var modals = document.querySelectorAll(".modal");
    for (var k = 0; k < modals.length; k++) {
      modals[k].addEventListener("click", function (e) {
        if (e.target === this) this.classList.remove("open");
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var open = document.querySelectorAll(".modal.open");
      for (var n = 0; n < open.length; n++) open[n].classList.remove("open");
    });
  }

  function init() {
    var forms = document.querySelectorAll("form[data-lead-form]");
    for (var i = 0; i < forms.length; i++) wireForm(forms[i]);
    wireModals();
    renderTurnstile();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
