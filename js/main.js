
"use strict";

/* =========================================
   ГОЛОВНИЙ СКРИПТ САЙТУ
   ЗВЯГЕЛЬ ТУРИСТИЧНИЙ
========================================= */

(function () {
  function initMain() {
    // Автоматично оновлюємо рік у футері.
    const year = document.getElementById("year");

    if (year) {
      year.textContent = new Date().getFullYear();
    }

    // Показуємо статус підключення Firebase.
    const status = document.getElementById("load-status");

    if (status) {
      if (window.firebaseReady && window.db) {
        status.textContent = "";
        status.hidden = true;
      } else {
        status.textContent =
          "Не вдалося підключитися до бази даних. Спробуйте оновити сторінку.";
        status.hidden = false;
      }
    }

    // Плавне прокручування для внутрішніх посилань.
    document
      .querySelectorAll('a[href^="#"]')
      .forEach(function (link) {
        link.addEventListener("click", function (event) {
          const href = link.getAttribute("href");

          if (!href || href === "#") return;

          const target = document.getElementById(href.slice(1));

          if (target) {
            event.preventDefault();

            target.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }
        });
      });

    // Після успішного завантаження сторінки прибираємо
    // початковий статус завантаження, якщо він є.
    window.addEventListener("load", function () {
      if (window.firebaseReady && status) {
        status.textContent = "";
        status.hidden = true;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMain);
  } else {
    initMain();
  }
})();
