
"use strict";

/* =========================================
   ТЕКСТИ САЙТУ ТА НОВИНИ
   ЗВЯГЕЛЬ ТУРИСТИЧНИЙ
========================================= */

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const element = $(id);

    if (element && value !== undefined && value !== null) {
      element.textContent = String(value);
    }
  }

  function setLink(id, value) {
    const element = $(id);
    if (!element || !value) return;

    try {
      const url = new URL(String(value));

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return;
      }

      element.href = url.href;
    } catch (error) {
      console.warn("Некоректне посилання для елемента:", id);
    }
  }

  function getDatabase() {
    if (!window.db) {
      console.error("Firestore недоступний. Перевірте js/firebase.js.");
      return null;
    }

    return window.db;
  }

  // Головна сторінка.
  function applyHomepage(data) {
    const texts = data.texts || data;

    setText("hero-title", texts.hero_title);
    setText("hero-subtitle", texts.hero_subtitle);
    setText("tours-title", texts.tours_title);
    setText("tours-intro", texts.tours_intro);
    setText("places-title", texts.places_title);
    setText("places-intro", texts.places_intro);
    setText("news-title", texts.news_title);
    setText("news-intro", texts.news_intro);

    const hero = $("hero");

    if (hero && texts.hero_image) {
      try {
        const imageUrl = new URL(String(texts.hero_image));

        if (
          imageUrl.protocol === "https:" ||
          imageUrl.protocol === "http:"
        ) {
          hero.style.backgroundImage =
            'linear-gradient(rgba(9, 24, 46, .60), rgba(9, 24, 46, .68)), url("' +
            imageUrl.href.replace(/["\\\n\r]/g, "") +
            '")';
        }
      } catch (error) {
        console.warn("Не вдалося використати фото головного екрана.");
      }
    }
  }

  // Розділ «Про нас».
  function applyAbout(data) {
    setText("about-title", data.title);
    setText("about-text", data.body || data.text);
    setText("about-box-title", data.box_title);
    setText("about-box-text", data.box_text);

    // Підтримка двох окремих текстових блоків,
    // якщо вони є в розмітці сторінки.
    setText("about-text1", data.text1);
    setText("about-text2", data.text2);
  }

  // Контактна інформація.
  function applyContacts(data) {
    setText("contacts-title", data.title);
    setText("contact-extra", data.extra);
    setText("contact-phone", data.phone);
    setText("contact-address", data.address);
    setText("contact-email", data.email);
    setText("contact-hours", data.hours);

    setLink("contact-facebook", data.facebook);
    setLink("contact-instagram", data.instagram);

    const phoneLink = $("contact-phone-link");

    if (phoneLink && data.phone) {
      const phone = String(data.phone).replace(/[^\d+]/g, "");
      phoneLink.href = "tel:" + phone;
    }

    const emailLink = $("contact-email-link");

    if (emailLink && data.email) {
      emailLink.href = "mailto:" + String(data.email).trim();
    }
  }

  // Розділ «Як дістатися?».
  function applyGettingHere(data) {
    setText("getting-here-text", data.body || data.text);
    setLink("getting-here-map-link", data.mapLink || data.map_link);
    setLink(
      "getting-here-directions-link",
      data.directionsLink || data.directions_link
    );

    // Підтримуємо наявні посилання, якщо вони мають такі ID.
    setLink("map-link", data.mapLink || data.map_link);
    setLink(
      "directions-link",
      data.directionsLink || data.directions_link
    );
  }

  // Створення картки новини.
  function createNewsCard(data, id) {
    const card = document.createElement("article");
    card.className = "card news-card";

    if (data.image) {
      try {
        const imageUrl = new URL(String(data.image));

        if (
          imageUrl.protocol === "https:" ||
          imageUrl.protocol === "http:"
        ) {
          const image = document.createElement("img");
          image.src = imageUrl.href;
          image.alt = data.title || "Новина Звягеля";
          image.loading = "lazy";
          image.className = "card-image";
          image.onerror = function () {
            image.remove();
          };

          card.appendChild(image);
        }
      } catch (error) {
        // Якщо посилання некоректне, картка залишиться без фото.
      }
    }

    const content = document.createElement("div");
    content.className = "card-content";

    if (data.date) {
      const date = document.createElement("p");
      date.className = "card-date";
      date.textContent = String(data.date);
      content.appendChild(date);
    }

    const title = document.createElement("h3");
    title.textContent = data.title || "Новина";
    content.appendChild(title);

    const summary = document.createElement("p");
    summary.textContent = data.summary || data.body || "";
    content.appendChild(summary);

    if (data.link) {
      try {
        const url = new URL(String(data.link));

        if (
          url.protocol === "https:" ||
          url.protocol === "http:"
        ) {
          const link = document.createElement("a");
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.className = "card-link";
          link.textContent = "Читати докладніше";
          content.appendChild(link);
        }
      } catch (error) {
        // Не показуємо некоректне посилання.
      }
    }

    card.appendChild(content);
    card.dataset.id = id;

    return card;
  }

  function renderNews(snapshot) {
    const container = $("news-list");
    if (!container) return;

    container.replaceChildren();

    const items = [];

    snapshot.forEach(function (doc) {
      items.push({
        id: doc.id,
        data: doc.data()
      });
    });

    // Новіші записи спочатку; дата може бути текстом.
    items.sort(function (a, b) {
      return String(b.data.date || "").localeCompare(
        String(a.data.date || ""),
        "uk"
      );
    });

    items.slice(0, 3).forEach(function (item) {
      container.appendChild(createNewsCard(item.data, item.id));
    });

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-message";
      empty.textContent = "Наразі новин немає. Завітайте пізніше!";
      container.appendChild(empty);
    }
  }

  function showNewsError() {
    const container = $("news-list");
    if (!container) return;

    container.replaceChildren();

    const message = document.createElement("p");
    message.className = "error-message";
    message.textContent =
      "Не вдалося завантажити новини. Спробуйте зайти пізніше.";

    container.appendChild(message);
  }

  function initNewsAndContent() {
    const db = getDatabase();
    if (!db) return;

    // Документи з колекції siteContent.
    const documents = [
      {
        id: "homepage",
        apply: applyHomepage
      },
      {
        id: "about",
        apply: applyAbout
      },
      {
        id: "contacts",
        apply: applyContacts
      },
      {
        id: "gettingHere",
        apply: applyGettingHere
      }
    ];

    documents.forEach(function (item) {
      db.collection("siteContent")
        .doc(item.id)
        .onSnapshot(
          function (snapshot) {
            if (snapshot.exists) {
              item.apply(snapshot.data());
            }
          },
          function (error) {
            console.error(
              "Помилка завантаження siteContent/" + item.id,
              error
            );
          }
        );
    });

    // Публікуємо лише записи, позначені published: true.
    db.collection("news")
      .where("published", "==", true)
      .onSnapshot(
        renderNews,
        function (error) {
          console.error("Помилка завантаження новин:", error);
          showNewsError();
        }
      );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNewsAndContent);
  } else {
    initNewsAndContent();
  }
})();
