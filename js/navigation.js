
"use strict";

/* =========================================
   НАВІГАЦІЯ — ЗВЯГЕЛЬ ТУРИСТИЧНИЙ
========================================= */

(function () {
  function initNavigation() {
    const menuToggle = document.getElementById("menuToggle");
    const headerRight = document.getElementById("headerRight");
    const travelMenuButton = document.getElementById("travelMenuButton");
    const travelDropdown = document.getElementById("travelDropdown");
    const backTop = document.getElementById("backTop");
    const year = document.getElementById("year");

    // Поточний рік у футері.
    if (year) {
      year.textContent = new Date().getFullYear();
    }

    // Відкривання та закривання мобільного меню.
    if (menuToggle && headerRight) {
      menuToggle.addEventListener("click", function () {
        const isOpen = headerRight.classList.toggle("open");

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute(
          "aria-label",
          isOpen ? "Закрити меню" : "Відкрити меню"
        );
      });

      // Закриваємо меню після вибору пункту.
      headerRight.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          headerRight.classList.remove("open");
          menuToggle.setAttribute("aria-expanded", "false");

          if (travelDropdown) {
            travelDropdown.classList.remove("open");
          }

          if (travelMenuButton) {
            travelMenuButton.setAttribute("aria-expanded", "false");
          }
        });
      });
    }

    // Випадаюче меню «Мандрівникам».
    if (travelMenuButton && travelDropdown) {
      travelMenuButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        const isOpen = travelDropdown.classList.toggle("open");

        travelMenuButton.setAttribute("aria-expanded", String(isOpen));
      });

      // Закриваємо випадаюче меню при натисканні поза ним.
      document.addEventListener("click", function (event) {
        if (
          !travelDropdown.contains(event.target) &&
          !travelMenuButton.contains(event.target)
        ) {
          travelDropdown.classList.remove("open");
          travelMenuButton.setAttribute("aria-expanded", "false");
        }
      });

      // Закриваємо меню клавішею Escape.
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          travelDropdown.classList.remove("open");
          travelMenuButton.setAttribute("aria-expanded", "false");
        }
      });
    }

    // Кнопка повернення на початок сторінки.
    if (backTop) {
      function updateBackTop() {
        backTop.classList.toggle("visible", window.scrollY > 350);
      }

      window.addEventListener("scroll", updateBackTop, {
        passive: true
      });

      updateBackTop();

      backTop.addEventListener("click", function () {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      });
    }

    // Підсвічування активного пункту навігації.
    const navLinks = Array.from(
      document.querySelectorAll(
        '.header-right a[href^="#"], .header-right a.nav-link[href^="#"]'
      )
    );

    const sections = navLinks
      .map(function (link) {
        const id = link.getAttribute("href").slice(1);
        return document.getElementById(id);
      })
      .filter(Boolean);

    if ("IntersectionObserver" in window && sections.length) {
      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;

            const currentId = entry.target.id;

            navLinks.forEach(function (link) {
              const active =
                link.getAttribute("href") === "#" + currentId;

              link.classList.toggle("active", active);

              if (active) {
                link.setAttribute("aria-current", "location");
              } else {
                link.removeAttribute("aria-current");
              }
            });
          });
        },
        {
          rootMargin: "-25% 0px -60% 0px",
          threshold: 0
        }
      );

      sections.forEach(function (section) {
        observer.observe(section);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavigation);
  } else {
    initNavigation();
  }
})();
