/* =========================================================
   EIGHT40 — PREMIUM RUM
   Vanilla JS + GSAP/ScrollTrigger. Built per gsap-skills
   guidance: registerPlugin once, gsap.matchMedia() for
   prefers-reduced-motion, ScrollTrigger.batch() for reveals,
   toggleActions instead of re-triggering on every scroll tick.
   ========================================================= */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  /* ---------------- Age gate ---------------- */
  var AGE_KEY = "eight40_age_verified";
  var ageGate = document.getElementById("age-gate");
  var yesBtn = document.getElementById("age-yes");
  var siteNav = document.getElementById("site-nav");
  var mainEl = document.querySelector("main");

  function lockBackground() {
    document.body.style.overflow = "hidden";
    if (siteNav) siteNav.inert = true;
    if (mainEl) mainEl.inert = true;
  }
  function unlockBackground() {
    document.body.style.overflow = "";
    if (siteNav) siteNav.inert = false;
    if (mainEl) mainEl.inert = false;
  }
  function closeGate() {
    if (!ageGate) return;
    ageGate.setAttribute("hidden", "");
    unlockBackground();
  }

  try {
    if (sessionStorage.getItem(AGE_KEY) === "true") {
      closeGate();
    } else if (ageGate) {
      lockBackground();
      if (yesBtn) yesBtn.focus();
    }
  } catch (e) {
    /* sessionStorage unavailable (privacy mode) — gate still works, just re-asks each load */
    if (ageGate) { lockBackground(); if (yesBtn) yesBtn.focus(); }
  }

  if (yesBtn) {
    yesBtn.addEventListener("click", function () {
      try { sessionStorage.setItem(AGE_KEY, "true"); } catch (e) {}
      closeGate();
    });
  }

  /* ---------------- Footer year ---------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- Smooth in-page nav (targeted, not global) ----------------
     We deliberately don't use CSS `scroll-behavior: smooth` site-wide — it
     fights the GSAP ScrollTrigger pin on the Signature Base section and was
     the main cause of choppy scrolling. Instead, only anchor-link clicks get
     a smooth scroll. */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  });

  /* ---------------- Nav visibility ---------------- */
  var nav = document.getElementById("site-nav");
  if (nav) {
    requestAnimationFrame(function () { nav.classList.add("is-visible"); });
    var onScroll = function () {
      nav.classList.toggle("is-scrolled", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------------- GSAP setup ---------------- */
  var hasGSAP = window.gsap && window.ScrollTrigger;
  if (!hasGSAP) {
    document.documentElement.classList.add("is-ready");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* iOS Safari resizes the viewport as its address bar shows/hides while
     scrolling, which otherwise re-triggers ScrollTrigger's layout math
     mid-scroll and is a common source of stutter on mobile. */
  ScrollTrigger.config({ ignoreMobileResize: true });

  var mm = gsap.matchMedia();

  mm.add(
    {
      reduceMotion: "(prefers-reduced-motion: reduce)",
      fullMotion: "(prefers-reduced-motion: no-preference)"
    },
    function (context) {
      var reduceMotion = context.conditions.reduceMotion;

      document.documentElement.classList.add("is-ready");

      /* ---- Generic scroll reveals ----
         Note: the Signature Base day/night copy (.chapter__copy--gold-phase /
         --uv-phase) is deliberately excluded — its opacity is choreographed
         by the is-night crossfade below, and letting GSAP force it to
         opacity:1 here would stack both phases on top of each other. */
      var revealTargets = document.querySelectorAll(
        ".chapter__title, .chapter__copy:not(.chapter__copy--gold-phase):not(.chapter__copy--uv-phase), .chapter__media, .eyebrow, .climax__mark, .climax__wordmark, .climax__sub, .climax__tagline, .climax__cta, .moment__tagline"
      );
      revealTargets.forEach(function (el) { el.classList.add("reveal"); });

      if (reduceMotion) {
        gsap.set(revealTargets, { clearProps: "all" });
      } else {
        ScrollTrigger.batch(revealTargets, {
          start: "top 88%",
          once: true,
          onEnter: function (batch) {
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: "power2.out",
              stagger: 0.08,
              overwrite: true
            });
          }
        });
      }

      /* ---- Hero entrance ---- */
      if (!reduceMotion) {
        gsap.from(".hero__content > *", {
          opacity: 0,
          y: 22,
          duration: 1.1,
          ease: "power2.out",
          stagger: 0.15,
          delay: 0.2
        });
        gsap.from(".hero__bg img", {
          scale: 1.08,
          duration: 2.2,
          ease: "power2.out"
        });
      }

      /* ---- The Code: typewriter readout ---- */
      var readout = document.getElementById("code-readout");
      if (readout) {
        var lines = readout.querySelectorAll(".code-readout__line");
        ScrollTrigger.create({
          trigger: readout,
          start: "top 75%",
          once: true,
          onEnter: function () {
            if (reduceMotion) {
              lines.forEach(function (line) { line.textContent = line.dataset.text; });
              return;
            }
            readout.classList.add("is-typing");
            var tl = gsap.timeline();
            lines.forEach(function (line, i) {
              var text = line.dataset.text || "";
              var state = { i: 0 };
              tl.call(function () {
                lines.forEach(function (l) { l.classList.remove("code-readout__line--active"); });
                line.classList.add("code-readout__line--active");
              });
              tl.to(state, {
                i: text.length,
                duration: Math.max(0.5, text.length * 0.045),
                ease: "none",
                onUpdate: function () {
                  line.textContent = text.slice(0, Math.round(state.i));
                }
              }, i === 0 ? undefined : "+=0.15");
            });
            tl.call(function () { readout.classList.remove("is-typing"); });
          }
        });
      }

      /* ---- Signature base: day -> night crossfade ----
         Deliberately simple: a single one-time trigger flips to the UV/night
         state once you've scrolled about halfway through the section, and
         CSS handles the crossfade. No pinning, no scroll-scrub — those were
         the source of the visible glitching, and this reads just as well
         without them. Same behavior for everyone, reduced-motion or not. */
      var baseSection = document.querySelector(".chapter--base");
      if (baseSection) {
        ScrollTrigger.create({
          trigger: baseSection,
          start: "center center",
          once: true,
          onEnter: function () { baseSection.classList.add("is-night"); }
        });
      }
    }
  );
})();
