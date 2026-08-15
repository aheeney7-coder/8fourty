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

  /* ---------------- Orientation-aware video sources ----------------
     Each .scrub-video ships a portrait and a landscape file via
     data-src-portrait / data-src-landscape. We pick whichever matches the
     current viewport and reload if the visitor rotates their device or
     resizes past the portrait/landscape boundary. Playback itself is
     handled separately below (scroll-scrubbed, not autoplay). */
  var scrubVideos = Array.prototype.slice.call(document.querySelectorAll(".scrub-video"));

  function isLandscapeViewport() {
    return window.innerWidth > window.innerHeight;
  }

  function pickSource(video) {
    var wanted = isLandscapeViewport() ? video.dataset.srcLandscape : video.dataset.srcPortrait;
    if (!wanted || video.dataset.activeSrc === wanted) return false;
    var resumeFraction = video.duration ? video.currentTime / video.duration : 0;
    video.dataset.activeSrc = wanted;
    video.dataset.resumeFraction = String(resumeFraction);
    video.src = wanted;
    video.load();
    return true;
  }

  scrubVideos.forEach(function (video) { pickSource(video); });

  var orientationDebounce;
  window.addEventListener("resize", function () {
    clearTimeout(orientationDebounce);
    orientationDebounce = setTimeout(function () {
      scrubVideos.forEach(pickSource);
    }, 200);
  });

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

      /* ---- Background videos: scroll-scrubbed, never autoplaying ----
         Every .scrub-video stays paused. Its currentTime is driven
         directly by scroll progress through the section it lives in, so
         the footage only moves while the visitor is actively scrolling
         and holds still the instant they stop. Under reduced motion we
         skip this entirely and just leave the poster frame showing. */
      scrubVideos.forEach(function (v) { v.pause(); });

      function bindScrub(video, triggerVars) {
        if (!video) return;
        function create() {
          if (!video.duration || !isFinite(video.duration)) return;
          if (video._scrubST) video._scrubST.kill();
          video._scrubST = ScrollTrigger.create(
            Object.assign(
              {
                scrub: true,
                onUpdate: function (self) {
                  try { video.currentTime = self.progress * video.duration; } catch (err) {}
                }
              },
              triggerVars
            )
          );
        }
        video.addEventListener("loadedmetadata", create);
        if (video.readyState >= 1) create();
      }

      if (!reduceMotion) {
        bindScrub(document.querySelector(".hero .scrub-video"), {
          trigger: ".hero",
          start: "top top",
          end: "bottom top"
        });
        bindScrub(document.querySelector(".climax .scrub-video"), {
          trigger: ".climax",
          start: "top bottom",
          end: "bottom top"
        });
        /* Base gold/UV videos are scrubbed inside the pinned ScrollTrigger
           below, using the same self.progress that drives the day/night
           crossfade, rather than a second competing trigger on the same
           pinned element. */
      }

      /* ---- Generic scroll reveals ----
         Note: the Signature Base day/night copy (.chapter__copy--gold-phase /
         --uv-phase) is deliberately excluded — its opacity is choreographed
         by the is-night crossfade below, and letting GSAP force it to
         opacity:1 here would stack both phases on top of each other. */
      var revealTargets = document.querySelectorAll(
        ".chapter__title, .chapter__copy:not(.chapter__copy--gold-phase):not(.chapter__copy--uv-phase), .chapter__media, .eyebrow, .climax__mark, .climax__wordmark, .climax__sub, .climax__tagline, .climax__cta"
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
        gsap.from(".hero__bg video", {
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

      /* ---- Signature base: day -> night crossfade tied to scroll ---- */
      var baseSection = document.querySelector(".chapter--base");
      if (baseSection) {
        var baseGoldVideo = baseSection.querySelector(".base-visual__img--gold");
        var baseUvVideo = baseSection.querySelector(".base-visual__img--uv");

        if (reduceMotion) {
          /* Show the night state as a static second beat instead of a scroll-linked crossfade */
          ScrollTrigger.create({
            trigger: baseSection,
            start: "center center",
            once: true,
            onEnter: function () { baseSection.classList.add("is-night"); }
          });
        } else {
          ScrollTrigger.create({
            trigger: baseSection,
            start: "top top",
            end: "+=120%",
            pin: true,
            pinSpacing: true,
            scrub: 0.6,
            onUpdate: function (self) {
              baseSection.classList.toggle("is-night", self.progress > 0.55);
              if (baseGoldVideo && baseGoldVideo.duration) {
                try { baseGoldVideo.currentTime = self.progress * baseGoldVideo.duration; } catch (err) {}
              }
              if (baseUvVideo && baseUvVideo.duration) {
                try { baseUvVideo.currentTime = self.progress * baseUvVideo.duration; } catch (err) {}
              }
            }
          });
        }
      }
    }
  );
})();
