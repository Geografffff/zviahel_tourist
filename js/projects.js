
"use strict";

/* =========================================
   КАРТКИ ТА ФОТОГАЛЕРЕЇ
   ЗВЯГЕЛЬ ТУРИСТИЧНИЙ
========================================= */

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function safeUrl(value) {
    if (!value) return "";

    try {
      const url = new URL(String(value).trim());

      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.href;
      }
    } catch (error) {
      // Некоректне посилання.
    }

    return "";
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function addLink(parent, label, value, className) {
    const url = safeUrl(value);
    if (!url) return;

    const link = createElement("a", className || "card-link", label);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    parent.appendChild(link);
  }

  function normalizeImages(data) {
    const images = [];

    if (data.image) {
      const mainImage = safeUrl(data.image);
      if (mainImage) images.push(mainImage);
    }

    let additional = data.images || [];

    // Підтримуємо масив і текст із посиланнями через перенесення рядка.
    if (typeof additional === "string") {
      additional = additional.split(/\r?\n/);
    }

    if (Array.isArray(additional)) {
      additional.forEach(function (item) {
        const url = safeUrl(item);

        if (url && !images.includes(url)) {
          images.push(url);
        }
      });
    }

    return images;
  }

  function createGallery(data) {
    const images = normalizeImages(data);
    const gallery = createElement("div", "card-media gallery");

    if (images.length === 0) {
      gallery.appendChild(
        createElement("div", "gallery-placeholder", "Звягель туристичний")
      );

      return gallery;
    }

    const image = createElement("img", "gallery-image");
    image.src = images[0];
    image.alt = data.title || "Фото туристичного об'єкта";
    image.loading = "lazy";

    gallery.appendChild(image);

    if (images.length > 1) {
      const counter = createElement("span", "gallery-counter", "1 / " + images.length);
      gallery.appendChild(counter);

      const previous = createElement("button", "gallery-arrow gallery-prev", "‹");
      previous.type = "button";
      previous.setAttribute("aria-label", "Попереднє фото");

      const next = createElement("button", "gallery-arrow gallery-next", "›");
      next.type = "button";
      next.setAttribute("aria-label", "Наступне фото");

      gallery.appendChild(previous);
      gallery.appendChild(next);

      let current = 0;

      function showImage(index) {
        current = (index + images.length) % images.length;
        image.src = images[current];
        counter.textContent = (current + 1) + " / " + images.length;
      }

      previous.addEventListener("click", function () {
        showImage(current - 1);
      });

      next.addEventListener("click", function () {
        showImage(current + 1);
      });
    }

    return gallery;
  }

  function createCard(collection, id, data) {
    const card = createElement("article", "card");
    card.dataset.id = id;
    card.dataset.collection = collection;

    card.appendChild(createGallery(data));

    const content = createElement("div", "card-content");

    content.appendChild(
      createElement("h3", "card-title", data.title || "Без назви")
    );

    if (data.subtitle) {
      content.appendChild(
        createElement("p", "card-subtitle", data.subtitle)
      );
    }

    if (data.address) {
      content.appendChild(
        createElement("p", "card-address", data.address)
      );
    }

    if (data.duration) {
      content.appendChild(
        createElement("p", "card-detail", "Тривалість: " + data.duration)
      );
    }

    if (data.price) {
      content.appendChild(
        createElement("p", "card-price", "Вартість: " + data.price)
      );
    }

    const description = data.description || data.summary || "";

    if (description) {
      content.appendChild(
        createElement("p", "card-description", description)
      );
    }

    if (data.hours) {
      content.appendChild(
        createElement("p", "card-detail", "Графік: " + data.hours)
      );
    }

    if (data.phone) {
      const phone = String(data.phone).trim();
      const phoneLink = createElement("a", "card-link", "Телефон: " + phone);
      phoneLink.href = "tel:" + phone.replace(/[^\d+]/g, "");
      content.appendChild(phoneLink);
    }

    if (data.mapLink) {
      addLink(content, "На карті", data.mapLink);
    }

    if (data.booking) {
      addLink(content, "Записатися на екскурсію", data.booking);
    }

    if (data.link) {
      addLink(
        content,
        collection === "tours" ? "Детальніше про екскурсію" : "Детальніше",
        data.link
      );
    }

    card.appendChild(content);

    return card;
  }

  function renderCollection(collection, containerId, limit) {
    if (!window.db) {
      console.error("Firestore недоступний для колекції:", collection);
      return;
    }

    const container = $(containerId);
    if (!container) return;

    window.db
      .collection(collection)
      .where("published", "==", true)
      .onSnapshot(
        function (snapshot) {
          container.replaceChildren();

          const items = [];

          snapshot.forEach(function (doc) {
            items.push({
              id: doc.id,
              data: doc.data()
            });
          });

          items.sort(function (a, b) {
            return String(a.data.title || "").localeCompare(
              String(b.data.title || ""),
              "uk"
            );
          });

          const visibleItems =
            typeof limit === "number" ? items.slice(0, limit) : items;

          visibleItems.forEach(function (item) {
            container.appendChild(
              createCard(collection, item.id, item.data)
            );
          });

          if (visibleItems.length === 0) {
            const emptyMessages = {
              tours: "Наразі екскурсії готуються до публікації.",
              places: "Інформація про туристичні місця скоро з'явиться.",
              food: "Інформація про заклади харчування скоро з'явиться.",
              stay: "Інформація про проживання скоро з'явиться."
            };

            container.appendChild(
              createElement(
                "p",
                "empty-message",
                emptyMessages[collection] || "Записів поки немає."
              )
            );
          }
        },
        function (error) {
          console.error(
            "Помилка завантаження колекції " + collection + ":",
            error
          );

          container.replaceChildren();
          container.appendChild(
            createElement(
              "p",
              "error-message",
              "Не вдалося завантажити інформацію. Спробуйте пізніше."
            )
          );
        }
      );
  }

  function initProjects() {
    renderCollection("tours", "tours-list", 3);
    renderCollection("places", "places-list", 3);
    renderCollection("food", "food-list");
    renderCollection("stay", "stay-list");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProjects);
  } else {
    initProjects();
  }
})();
