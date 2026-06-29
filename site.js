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

  // ---------- project showcase: clean vertical WIPE between stacked images (hba style) ----------
  // The section is tall; .showcase__sticky is position:sticky. Each next image is clipped
  // (hidden) and wipes UP over the previous as you scroll — a clean reveal, NOT an opacity
  // crossfade (which looked muddy / double-exposed). Each image holds briefly before the next.
  gsap.utils.toArray("[data-showcase]").forEach(function (sc) {
    var imgs = sc.querySelectorAll(".showcase__img");
    if (imgs.length < 2) return;
    gsap.set(imgs, { opacity: 1 });
    for (var i = 1; i < imgs.length; i++) gsap.set(imgs[i], { clipPath: "inset(100% 0% 0% 0%)", scale: 1.08 });
    var tl = gsap.timeline({ scrollTrigger: { trigger: sc, start: "top top", end: "bottom bottom", scrub: 0.7 } });
    for (var i = 1; i < imgs.length; i++) {
      tl.to(imgs[i], { clipPath: "inset(0% 0% 0% 0%)", ease: "power2.inOut", duration: 1 }, i === 1 ? 0.35 : "+=0.45")
        .to(imgs[i], { scale: 1, ease: "power2.out", duration: 1.2 }, "<");
    }
  });

  // ---------- text + fade reveals (after fonts so line-breaks measure right) ----------
  function setupTypeReveals() {
    var vh = window.innerHeight;

    // line-mask headlines. SplitText's native mask:"lines" wraps each line in a clip
    // container; we slide the lines up out of it. Above-fold plays on load, rest on scroll.
    gsap.utils.toArray("[data-split]").forEach(function (el) {
      var targets;
      if (hasSplit) {
        var split = new SplitText(el, { type: "lines", mask: "lines", linesClass: "ln" });
        targets = split.lines;
      } else {
        targets = [el];
      }
      gsap.set(el, { autoAlpha: 1 });
      gsap.set(targets, { yPercent: 115 });
      var inView = el.getBoundingClientRect().top < vh * 0.9;
      var vars = { yPercent: 0, duration: 1.15, ease: "power3.out", stagger: 0.09 };
      if (inView) vars.delay = 0.15;
      else vars.scrollTrigger = { trigger: el, start: "top 86%" };
      // after the line-mask reveal, un-clip the masks so descenders (y, g, p, q) aren't cut off
      vars.onComplete = function () {
        targets.forEach(function (l) { if (l && l.parentNode) l.parentNode.style.overflow = "visible"; });
      };
      gsap.to(targets, vars);
    });

    // fade-up reveals
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      gsap.set(el, { autoAlpha: 0, y: 26 });
      var inView = el.getBoundingClientRect().top < vh * 0.9;
      var vars = { autoAlpha: 1, y: 0, duration: 1, ease: "power2.out" };
      if (inView) vars.delay = 0.1;
      else vars.scrollTrigger = { trigger: el, start: "top 90%" };
      gsap.to(el, vars);
    });

    ScrollTrigger.refresh();
  }

  if (document.fonts && document.fonts.ready) {
    var done = false;
    var go = function () { if (done) return; done = true; setupTypeReveals(); };
    document.fonts.ready.then(go);
    setTimeout(go, 1200); // fallback if fonts.ready stalls
  } else {
    setupTypeReveals();
  }
})();
