/* Mobile nav menu — always runs (a11y baseline, independent of motion prefs / GSAP).
   Open/close on tap, close on link / backdrop / Escape, aria-expanded + focus management. */
(function () {
  "use strict";
  var burger = document.getElementById("navBurger");
  var menu = document.getElementById("navMenu");
  if (!burger || !menu) return;
  var closeBtn = menu.querySelector(".navmenu__close");
  var last = null;
  function open() {
    last = document.activeElement;
    menu.classList.add("open");
    burger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    (closeBtn || menu.querySelector("a")).focus();
  }
  function close() {
    menu.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    if (last && last.focus) last.focus();
  }
  burger.addEventListener("click", function () { menu.classList.contains("open") ? close() : open(); });
  if (closeBtn) closeBtn.addEventListener("click", close);
  menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", close); });
  menu.addEventListener("click", function (e) { if (e.target === menu) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) close(); });
})();

/* Ananta design lab — motion layer. Lenis smooth scroll + GSAP/ScrollTrigger reveals.
   Robust by design: if GSAP is missing or the visitor prefers reduced motion, nothing is
   hidden and the page renders fully static. Heavy effects are gated off touch/mobile. */
(function () {
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = matchMedia("(hover:none)").matches || matchMedia("(pointer:coarse)").matches;

  if (reduce || !window.gsap) {
    document.documentElement.classList.remove("js"); // un-hide: render fully static
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var hasSplit = !!window.SplitText;

  // ---------- Lenis smooth scroll (desktop only; native momentum on touch) ----------
  if (!isTouch && window.Lenis) {
    var lenis = new Lenis({ duration: 1.1, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // ---------- nav: hide on scroll-down, show on scroll-up ----------
  var nav = document.getElementById("nav");
  var lastY = 0;
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: function (self) {
      var y = self.scroll();
      if (y > 140 && y > lastY) nav.classList.add("hide");
      else nav.classList.remove("hide");
      lastY = y;
    }
  });

  // ---------- parallax (desktop only) ----------
  if (!isTouch) {
    gsap.utils.toArray("[data-parallax]").forEach(function (el) {
      var amt = parseFloat(el.dataset.parallax) || 0.15;
      gsap.to(el, {
        yPercent: amt * 100, ease: "none",
        scrollTrigger: { trigger: el.closest("section,header") || el, start: "top top", end: "bottom top", scrub: true }
      });
    });
  }

  // ---------- clip-path image reveal ----------
  gsap.utils.toArray("[data-clip]").forEach(function (el) {
    var img = el.querySelector("img");
    gsap.set(el, { clipPath: "inset(100% 0% 0% 0%)" });
    gsap.to(el, {
      clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 82%" }
    });
    if (img) {
      // cinematic parallax: image sits slightly oversized and drifts as the section
      // passes through the viewport (hba-style depth). Desktop only (gated above by motion IIFE).
      gsap.set(img, { scale: 1.16 });
      gsap.fromTo(img, { yPercent: -5 }, {
        yPercent: 5, ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true }
      });
    }
  });

  // ---------- project showcase: hba-style cover-stack ----------
  // One pinned caption per project. The lead image sits full-bleed; each following
  // (smaller, contained) image rides UP from below to cover it. Only the contained image
  // moves — the dimming is a separate layer (.showcase__dim) that fades IN PLACE over the
  // scene behind, so the background darkens like hba rather than a hard shadow edge sliding
  // up with the image. scrub:true ties it 1:1 to the (Lenis-smoothed) scroll so it tracks
  // the wheel exactly — no easing toward a target, which is what made it look like it crept back.
  gsap.utils.toArray("[data-showcase]").forEach(function (sc) {
    var insets = gsap.utils.toArray(sc.querySelectorAll(".showcase__shot--inset"));
    var dims = gsap.utils.toArray(sc.querySelectorAll(".showcase__dim"));
    if (!insets.length) return;
    gsap.set(insets, { yPercent: 101 });
    gsap.set(dims, { opacity: 0 });
    var tl = gsap.timeline({
      defaults: { ease: "none", duration: 1 },
      scrollTrigger: { trigger: sc, start: "top top", end: "bottom bottom", scrub: true, invalidateOnRefresh: true }
    });
    insets.forEach(function (shot, i) {
      tl.to(shot, { yPercent: 0 }, i);                          // contained image rides up
      if (dims[i]) tl.to(dims[i], { opacity: 0.62 }, i);        // scene behind darkens in place, synced
    });
  });

  // ---------- hero headline: a single line-mask entrance on load ----------
  // Per David: the per-text scroll reveals are gone — all body/section text renders static,
  // so the page's motion is carried by the imagery (clip reveal, parallax, showcase). The one
  // exception is the hero headline, which gets a one-time "curtain up" on load: it plays once
  // and then rests, so it never adds to the scroll-fatigue David was reacting to. Runs after
  // fonts so the line breaks measure right.
  function revealHero() {
    var el = document.querySelector("[data-hero-line]");
    if (el) {
      var targets;
      if (hasSplit) {
        var split = new SplitText(el, { type: "lines", mask: "lines", linesClass: "ln" });
        targets = split.lines;
      } else {
        targets = [el];
      }
      gsap.set(el, { autoAlpha: 1 });
      gsap.set(targets, { yPercent: 115 });
      gsap.to(targets, {
        yPercent: 0, duration: 1.15, ease: "power3.out", stagger: 0.09, delay: 0.15,
        // after the reveal, un-clip the masks so descenders (y, g, p, q) aren't cut off
        onComplete: function () {
          targets.forEach(function (l) { if (l && l.parentNode) l.parentNode.style.overflow = "visible"; });
        }
      });
    }
    ScrollTrigger.refresh(); // fonts/markup settled — let pinned/scrub triggers re-measure
  }

  if (document.fonts && document.fonts.ready) {
    var done = false;
    var go = function () { if (done) return; done = true; revealHero(); };
    document.fonts.ready.then(go);
    setTimeout(go, 1200); // fallback if fonts.ready stalls
  } else {
    revealHero();
  }
})();
