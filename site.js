/* ==================================================
   ЗВЯГЕЛЬ ТУРИСТИЧНИЙ — СПІЛЬНА ЛОГІКА САЙТУ
   Підключається на: index.html, catalog.html, article.html
   Порядок: firebase-app-compat → firebase-firestore-compat → site.js (усі з defer),
   далі сторінковий скрипт на DOMContentLoaded.
   ================================================== */
(function () {
"use strict";

/* ---------- Налаштування (єдине місце) ---------- */

// apiKey веб-додатку Firebase публічний за задумом; реальний захист — правила Firestore.
// (admin.html має власну копію конфігу: адмінка навмисно не залежить від публічного коду.)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDEizfKA8Ll-BT_olZSq7gt2z5WHH3PC2M",
  authDomain: "zviahel-tourist.firebaseapp.com",
  projectId: "zviahel-tourist",
  storageBucket: "zviahel-tourist.firebasestorage.app",
  messagingSenderId: "914549612868",
  appId: "1:914549612868:web:3abce6606a89167134b711",
  measurementId: "G-DV5YF43W24"
};

const SITE_URL = "https://geografffff.github.io/zviahel_tourist/";   // для canonical
const DEFAULT_PHONE = "+380673004470";   // запасний номер, поки не прийшли контакти з Firestore
const CACHE_PREFIX = "zv.cache.v3.";
const SPRITE = "icons.svg";
const SVG_NS = "http://www.w3.org/2000/svg";

/* Один опис для всіх типів карток. key = розділ (catalog.html?section=…, article.html?type=…) */
const SECTIONS = {
  tour: {
    key: "tours", collection: "tours", root: "tours-list",
    label: "Екскурсія", plural: "Екскурсії", icon: "compass", detail: true, cta: "Детальніше",
    title: "Екскурсії Звягелем", intro: "Обирайте маршрут і відкривайте історію Звягеля разом із нами.",
    empty: "Наразі екскурсії ще не додано. Слідкуйте за оновленнями туристичного центру."
  },
  place: {
    key: "places", collection: "places", root: "places-list",
    label: "Цікавинка", plural: "Цікавинки", icon: "landmark", detail: true, cta: "Детальніше",
    title: "Цікавинки Звягеля", intro: "Пам’ятки, історичні місця та цікаві локації нашого міста.",
    empty: "Інформація про цікаві місця незабаром з’явиться."
  },
  news: {
    key: "news", collection: "news", root: "news-list",
    label: "Новини", plural: "Новини", icon: "news", detail: true, cta: "Читати",
    title: "Новини та оголошення", intro: "Новини туристичного центру, анонси та події міста.",
    empty: "Нових публікацій поки немає. Слідкуйте за оновленнями."
  },
  project: {
    key: "projects", collection: "projects", root: "projects-list",
    label: "Проєкт", plural: "Проєкти", icon: "bulb", detail: true, cta: "Детальніше",
    title: "Наші проєкти", intro: "Ініціативи, туристичні продукти та проєкти розвитку Звягеля.",
    empty: "Інформація про туристичні проєкти незабаром з’явиться."
  },
  food: {
    key: "food", collection: "food", root: "food-list",
    label: "Де поїсти", plural: "Де поїсти", icon: "utensils", detail: false, cta: "Детальніше",
    title: "Де поїсти у Звягелі", intro: "Заклади харчування для мешканців і гостей міста.",
    empty: "Інформація про заклади харчування незабаром з’явиться."
  },
  stay: {
    key: "stay", collection: "stay", root: "stay-list",
    label: "Проживання", plural: "Де переночувати", icon: "bed", detail: false, cta: "Детальніше",
    title: "Де переночувати у Звягелі", intro: "Готелі та інші варіанти проживання у місті.",
    empty: "Інформація про місця проживання незабаром з’явиться."
  }
};

const typeByKey = key => Object.keys(SECTIONS).find(type => SECTIONS[type].key === key) || "";

/* ---------- Базові допоміжні ---------- */

const $ = id => document.getElementById(id);
const enc = encodeURIComponent;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const scrollBehavior = () => (reducedMotion.matches ? "auto" : "smooth");

const state = { phone: DEFAULT_PHONE };
let db = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", SPRITE + "#i-" + name);
  svg.appendChild(use);
  return svg;
}

function safeHttps(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

/* Перше непорожнє значення з кількох можливих назв поля (підтримка старих і нових схем даних) */
function pick(obj, ...keys) {
  for (const key of keys) {
    const value = obj ? obj[key] : undefined;
    if (value === undefined || value === null) continue;
    if (typeof value === "string" ? value.trim() !== "" : value !== "") return value;
  }
  return "";
}

function clip(value, max) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function setText(id, value) {
  const node = $(id);
  if (node && typeof value === "string" && value.trim()) node.textContent = value;
}

/* Firestore Timestamp → ISO-рядок: дані можна кешувати та порівнювати */
function plain(value) {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = plain(item);
    return out;
  }
  return value;
}

/* ---------- Дати, ціни, телефони ---------- */

/* Розуміє: 29.10.2026 (і з часом), 2026-10-29, повні ISO-мітки. Усе інше ("2025–2026", "осінь") → 0 */
function parseDate(value) {
  if (!value) return 0;
  const text = String(value).trim();

  let m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();

  m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);      // дата без часу — локальна, без зсуву поясів
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const time = Date.parse(text);
    return Number.isNaN(time) ? 0 : time;
  }
  return 0;
}

/* Форматує лише точні дати; вільний текст («2025–2026») лишає як є */
function formatDate(value) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  const time = parseDate(text);
  if (!time) return text;
  return new Date(time).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
}

function formatPrice(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const hasCurrency = /₴|грн|uah|[$€£]|usd|eur/i.test(text);
  return /\d/.test(text) && !hasCurrency ? text + " грн" : text;
}

function makePhone(value) {
  const match = String(value || "").match(/\+?[\d\s().-]{9,}/);
  if (!match) return "";
  const phone = match[0].replace(/[^\d+]/g, "");
  return phone.replace(/\D/g, "").length >= 10 ? phone : "";
}

/* ---------- Відео (YouTube, Vimeo) ----------
   У базі лежить лише посилання. Тут воно розбирається на безпечні адреси:
   плеєр завжди з youtube-nocookie.com / player.vimeo.com, ніякого стороннього HTML.
   Ця ж логіка продубльована в admin.html (адмінка не залежить від site.js). */

const MAX_VIDEOS = 10;

function videoSeconds(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (!text || !match) return 0;
  return Math.min((+match[1] || 0) * 3600 + (+match[2] || 0) * 60 + (+match[3] || 0), 43200);
}

function parseVideo(value) {
  let url;
  try { url = new URL(String(value || "").trim()); } catch { return null; }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  // YouTube: youtu.be/ID, /watch?v=ID, /embed/ID, /shorts/ID, /live/ID
  let id = "";
  if (host === "youtu.be") id = parts[0] || "";
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = url.searchParams.get("v") || "";
    else if (["embed", "shorts", "live", "v"].includes(parts[0])) id = parts[1] || "";
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
    const start = videoSeconds(url.searchParams.get("t") || url.searchParams.get("start"));
    return {
      provider: "youtube", label: "YouTube", id, key: "youtube:" + id,
      watch: "https://www.youtube.com/watch?v=" + id + (start ? "&t=" + start + "s" : ""),
      embed: "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&playsinline=1" + (start ? "&start=" + start : ""),
      thumb: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"
    };
  }

  // Vimeo: vimeo.com/123456789, vimeo.com/123456789/hash (приховані), player.vimeo.com/video/123456789?h=hash
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const at = parts.findIndex(part => /^\d{1,12}$/.test(part));
    if (at === -1) return null;
    const vimeoId = parts[at];
    const hashPart = /^[0-9a-f]{6,20}$/i.test(parts[at + 1] || "") ? parts[at + 1] : "";
    const hash = hashPart || (/^[0-9a-f]{6,20}$/i.test(url.searchParams.get("h") || "") ? url.searchParams.get("h") : "");
    return {
      provider: "vimeo", label: "Vimeo", id: vimeoId, key: "vimeo:" + vimeoId,
      watch: "https://vimeo.com/" + vimeoId + (hash ? "/" + hash : ""),
      embed: "https://player.vimeo.com/video/" + vimeoId + "?autoplay=1&dnt=1" + (hash ? "&h=" + hash : ""),
      thumb: ""
    };
  }
  return null;
}

/* Список посилань із бази → список відео без дублікатів і з обмеженням кількості */
function parseVideos(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const video = parseVideo(item);
    if (!video || seen.has(video.key)) continue;
    seen.add(video.key);
    out.push(video);
    if (out.length >= MAX_VIDEOS) break;
  }
  return out;
}

/* ---------- Кеш (localStorage може бути недоступний) ---------- */

const cache = {
  read(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  write(key, value) {
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value)); } catch { /* ігноруємо */ }
  }
};

/* ---------- Firebase ---------- */

function getDb() {
  if (db) return db;
  if (!window.firebase) throw new Error("Firebase SDK не завантажено");
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();
  return db;
}

/* Лише потрібні для картки поля: менший кеш і менше «сміття» в DOM */
function toCardData(type, raw, options = {}) {
  const description = type === "news"
    ? pick(raw, "summary", "shortDescription", "description", "body")
    : pick(raw, "subtitle", "shortDescription", "description", "summary");

  const images = [...new Set(
    [pick(raw, "image", "mainImage", "photo"), ...(Array.isArray(raw.images) ? raw.images : [])].map(safeHttps).filter(Boolean)
  )].slice(0, 8);

  const order = raw.order === "" || raw.order === null || raw.order === undefined ? NaN : Number(raw.order);

  const data = {
    id: raw.id,
    title: clip(raw.title, 140),
    description: clip(description, 420),
    images,
    address: clip(raw.address, 120),
    price: clip(raw.price, 60),
    hours: clip(raw.hours, 80),
    duration: clip(raw.duration, 60),
    format: clip(pick(raw, "format", "typeLabel"), 60),
    category: clip(raw.category, 60),
    status: clip(raw.status, 60),
    date: String(pick(raw, "date")),
    created: String(pick(raw, "createdAt")),
    order: Number.isFinite(order) ? order : null,
    videoCount: parseVideos(raw.videos).length,
    phone: makePhone(pick(raw, "phone", "booking")),
    link: safeHttps(pick(raw, "link", "url")),
    mapLink: safeHttps(pick(raw, "mapLink", "map"))
  };

  if (options.search) {          // повнотекстовий пошук у каталозі
    data.search = [raw.title, raw.subtitle, raw.description, raw.summary, raw.body,
      raw.address, raw.category, raw.duration, raw.price]
      .filter(Boolean).join(" ").toLocaleLowerCase("uk").slice(0, 3000);
  }
  return data;
}

/* Новини — від найновіших; решта — за полем order, потім за новизною, потім за назвою */
function sortCards(type, items) {
  const byTitle = (a, b) => a.title.localeCompare(b.title, "uk");
  return items.sort(type === "news"
    ? (a, b) => parseDate(b.date || b.created) - parseDate(a.date || a.created) || byTitle(a, b)
    : (a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || parseDate(b.created) - parseDate(a.created) || byTitle(a, b));
}

/* Спершу збережена копія (миттєво), потім тихо оновлюємо свіжими даними.
   Одноразовий get() замість постійних onSnapshot: менше з’єднань і читань. */
async function loadCollection(type, options) {
  const cfg = SECTIONS[type];
  const { limit = 0, search = false, onLoading, onData, onError } = options;
  const key = "c." + cfg.collection + (limit ? ".top" + limit : ".all");
  const cached = cache.read(key);
  const hasCache = Array.isArray(cached);

  if (hasCache) onData(cached);
  else if (onLoading) onLoading();

  try {
    const snapshot = await getDb().collection(cfg.collection).where("published", "==", true).get();
    let items = sortCards(
      type,
      snapshot.docs.map(doc => toCardData(type, { ...plain(doc.data()), id: doc.id }, { search }))
    );
    if (limit) items = items.slice(0, limit);

    if (JSON.stringify(items) !== JSON.stringify(cached)) {
      onData(items);
      cache.write(key, items);
    }
  } catch (error) {
    console.error("Firestore/" + cfg.collection + ":", error);
    if (onError) onError(error, hasCache);
  }
}

async function loadDoc(name, apply) {
  const key = "d." + name;
  const cached = cache.read(key);
  const safeApply = data => {
    try { apply(data); } catch (error) { console.error("siteContent/" + name + ":", error); }
  };
  if (cached) safeApply(cached);

  try {
    const snapshot = await getDb().collection("siteContent").doc(name).get();
    if (!snapshot.exists) return;
    const data = plain(snapshot.data());
    if (JSON.stringify(data) !== JSON.stringify(cached)) {
      safeApply(data);
      cache.write(key, data);
    }
  } catch (error) {
    console.error("siteContent/" + name + ":", error);   // типові тексти в HTML лишаються
  }
}

/* ---------- Картки ---------- */

function placeholder(cfg) {
  const node = el("div", "placeholder");
  node.appendChild(icon(cfg.icon));
  return node;
}

function makeImage(url, alt) {
  const image = document.createElement("img");
  image.src = url;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  return image;
}

function createGallery(data, cfg) {
  const media = el("div", "card-media");
  const label = el("span", "card-label", cfg.label);
  const title = data.title || "Звягель";
  const urls = data.images;

  if (!urls.length) {
    media.append(placeholder(cfg), label);
    return media;
  }

  if (urls.length === 1) {
    const image = makeImage(urls[0], title);
    image.onerror = () => { image.onerror = null; media.replaceChildren(placeholder(cfg), label); };
    media.append(image, label);
    return media;
  }

  /* кілька фото: нативний горизонтальний скрол зі snap — працює свайпом, без бібліотек */
  media.classList.add("is-gallery");

  const track = el("div", "gallery-track");
  track.setAttribute("role", "group");
  track.setAttribute("aria-roledescription", "карусель");
  track.setAttribute("aria-label", "Фото: " + title);

  urls.forEach((url, index) => {
    const slide = el("div", "gallery-slide");
    const image = makeImage(url, title + " — фото " + (index + 1));
    image.onerror = () => { image.onerror = null; slide.replaceChildren(placeholder(cfg)); };
    slide.appendChild(image);
    track.appendChild(slide);
  });

  const count = el("span", "gallery-count");
  count.setAttribute("aria-hidden", "true");

  const sync = () => {
    const index = Math.round(track.scrollLeft / (track.clientWidth || 1));
    count.textContent = (Math.min(index, urls.length - 1) + 1) + " / " + urls.length;
  };

  let frame = 0;
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }, { passive: true });

  function go(direction) {
    const width = track.clientWidth;
    const max = track.scrollWidth - width;
    let target = track.scrollLeft + direction * width;
    if (target < -1) target = max;          // з першого фото назад — на останнє
    else if (target > max + 1) target = 0;  // з останнього вперед — на перше
    track.scrollTo({ left: target, behavior: scrollBehavior() });
  }

  function arrow(direction) {
    const button = el("button", "gallery-arrow " + (direction < 0 ? "gallery-prev" : "gallery-next"));
    button.type = "button";
    button.setAttribute("aria-label", direction < 0 ? "Попереднє фото" : "Наступне фото");
    button.appendChild(icon(direction < 0 ? "chevron-left" : "chevron-right"));
    button.addEventListener("click", () => go(direction));
    return button;
  }

  media.append(track, label, arrow(-1), arrow(1), count);
  sync();
  return media;
}

function buildChips(type, data) {
  const chips = [];
  const add = (iconName, text, accent) => { if (text) chips.push({ iconName, text, accent }); };

  if (type === "tour") {
    add("clock", data.duration, true);
    add(null, formatPrice(data.price), true);
    add(null, data.format, true);
  } else if (type === "food" || type === "stay") {
    add("pin", data.address);
    add(null, formatPrice(data.price));
    add("clock", data.hours);
  } else if (type === "news") {
    add("calendar", data.date ? formatDate(data.date) : "");
  } else if (type === "place") {
    add("pin", data.address);
    add("clock", data.hours);
  } else if (type === "project") {
    add(null, data.category, true);
    add(null, data.status ? "Статус: " + data.status : "");
    add("calendar", data.date ? formatDate(data.date) : "");
  }
  if (SECTIONS[type].detail) add("play", data.videoCount ? "Відео" : "");
  return chips;
}

function phoneButton(phone, text, primary) {
  const link = el("a", "btn" + (primary ? "" : " btn--outline"));
  link.href = "tel:" + (phone || state.phone);
  if (!phone) {
    link.classList.add("js-phone");     // номер із контактів оновиться, коли прийдуть дані
    link.dataset.booking = "default";
  }
  link.append(icon("phone"), document.createTextNode(text));
  return link;
}

function externalButton(text, href, iconName) {
  const link = el("a", "btn btn--outline");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.append(icon(iconName), document.createTextNode(text));
  return link;
}

function buildCard(type, data) {
  const cfg = SECTIONS[type];
  const card = el("article", "card");
  card.appendChild(createGallery(data, cfg));

  const body = el("div", "card-body");
  const title = data.title || "Без назви";
  const href = cfg.detail
    ? "article.html?type=" + enc(cfg.key) + "&id=" + enc(data.id || "")
    : data.link;

  /* заголовок-посилання розтягується на всю картку (див. .card-link::after) */
  const heading = el("h3");
  if (href) {
    const link = el("a", "card-link", title);
    link.href = href;
    if (href.startsWith("https://")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.appendChild(el("span", "sr-only", " (відкриється в новій вкладці)"));
    }
    heading.appendChild(link);
  } else {
    heading.textContent = title;
  }
  body.appendChild(heading);

  const chips = buildChips(type, data);
  if (chips.length) {
    const meta = el("div", "meta");
    chips.forEach(chip => {
      const node = el("span", "chip" + (chip.accent ? " chip--accent" : ""));
      if (chip.iconName) node.appendChild(icon(chip.iconName));
      node.appendChild(document.createTextNode(chip.text));
      meta.appendChild(node);
    });
    body.appendChild(meta);
  }

  if (data.description) body.appendChild(el("p", "card-description", data.description));

  const actions = el("div", "actions");

  if (href) {
    const more = el("span", "more", cfg.cta);
    more.setAttribute("aria-hidden", "true");
    more.appendChild(icon(cfg.detail ? "arrow" : "arrow-up-right"));
    actions.appendChild(more);
  }

  if (type === "tour") actions.appendChild(phoneButton(data.phone, "Записатися", true));
  if ((type === "food" || type === "stay") && data.phone) {
    actions.appendChild(phoneButton(data.phone, "Зателефонувати", false));
  }
  if (type === "project" && data.link) actions.appendChild(externalButton("Відкрити проєкт", data.link, "arrow-up-right"));
  if (data.mapLink) actions.appendChild(externalButton("На карті", data.mapLink, "pin"));

  if (actions.childNodes.length) body.appendChild(actions);

  card.appendChild(body);
  return card;
}

/* ---------- Стани блоку: скелетон, повідомлення, помилка ---------- */

function renderSkeleton(root) {
  root.setAttribute("aria-busy", "true");
  root.replaceChildren(...Array.from({ length: 3 }, () => {
    const card = el("div", "card skeleton");
    card.setAttribute("aria-hidden", "true");
    const body = el("div", "card-body");
    body.append(el("div", "sk sk-title"), el("div", "sk sk-line"), el("div", "sk sk-line"), el("div", "sk sk-line short"));
    card.append(el("div", "sk sk-media"), body);
    return card;
  }));
}

function renderMessage(root, text, retry, retryLabel) {
  root.removeAttribute("aria-busy");
  const note = el("div", "empty");
  note.appendChild(el("p", "", text));
  if (retry) {
    note.setAttribute("role", "alert");
    const button = el("button", "btn btn--outline", retryLabel || "Спробувати ще раз");
    button.type = "button";
    button.addEventListener("click", retry);
    note.appendChild(button);
  }
  root.replaceChildren(note);
}

function renderCards(type, items, root) {
  const cfg = SECTIONS[type];
  root = root || $(cfg.root);
  if (!items.length) {
    renderMessage(root, cfg.empty);
    return;
  }
  root.removeAttribute("aria-busy");
  root.replaceChildren(...items.map(item => buildCard(type, item)));
}

/* Завантажує розділ у контейнер: скелетон → картки → помилка з повтором.
   options: root, limit, search, onItems(items) — власний рендер (каталог), onFail(error) */
function mountSection(type, options = {}) {
  const cfg = SECTIONS[type];
  const root = options.root || $(cfg.root);

  loadCollection(type, {
    limit: options.limit || 0,
    search: !!options.search,
    onLoading: () => renderSkeleton(root),
    onData: options.onItems || (items => renderCards(type, items, root)),
    onError: (error, hadCache) => {
      if (hadCache) return;
      const retry = window.firebase ? () => mountSection(type, options) : () => location.reload();
      renderMessage(root, "Не вдалося завантажити дані. Перевірте з’єднання та спробуйте ще раз.", retry);
      if (options.onFail) options.onFail(error);
    }
  });
}

/* ---------- Контакти (спільні для головної та сторінки матеріалу) ---------- */

function setPhone(rawPhone) {
  const phone = makePhone(rawPhone);
  if (!phone) return;
  state.phone = phone;
  document.querySelectorAll("a.js-phone").forEach(link => { link.href = "tel:" + phone; });
}

function applyContacts(data) {
  setText("contacts-title", data.title);
  setText("contact-address", data.address);
  setText("contact-hours", data.hours);
  setText("contact-extra", data.extra);

  if (data.phone) {
    const phoneLink = $("contact-phone");
    if (phoneLink) phoneLink.textContent = data.phone;
    setPhone(data.phone);
  }

  const email = $("contact-email");
  if (email && data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    email.textContent = data.email;
    email.href = "mailto:" + data.email;
  }

  const facebook = safeHttps(data.facebook);
  const instagram = safeHttps(data.instagram);
  if (facebook && $("contact-facebook")) $("contact-facebook").href = facebook;
  if (instagram && $("contact-instagram")) $("contact-instagram").href = instagram;
}

/* ---------- Керування <head> для сторінок, що змінюють вміст ---------- */

function setMeta({ title, description, path }) {
  if (title) document.title = title;
  if (description) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = description;
  }
  if (path !== undefined) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = SITE_URL + path;
  }
}

/* ---------- Спільна ініціалізація сторінки ---------- */

function init() {
  // шапка стає «скляною», щойно сторінку прокрутили
  const header = document.querySelector(".site-header");
  if (header) {
    const syncHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    syncHeader();
    window.addEventListener("scroll", syncHeader, { passive: true });
  }

  const year = $("year");
  if (year) year.textContent = new Date().getFullYear();

  const backTop = $("backTop");
  if (backTop) {
    backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: scrollBehavior() }));
    window.addEventListener("scroll", () => {
      backTop.classList.toggle("visible", window.scrollY > 450);
    }, { passive: true });
  }

  // На комп’ютері tel: марний: «Записатися» веде до контактів (на цій чи на головній сторінці).
  // На телефоні лишається звичайний дзвінок.
  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-booking]");
    if (!link || !finePointer.matches) return;
    event.preventDefault();
    const contacts = $("contacts");
    if (contacts) contacts.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    else location.href = "index.html#contacts";
  });
}

window.ZV = {
  SECTIONS, SITE_URL, typeByKey, state,
  $, el, icon, enc, scrollBehavior, reducedMotion,
  safeHttps, pick, clip, setText, plain,
  parseDate, formatDate, formatPrice, makePhone,
  parseVideo, parseVideos, MAX_VIDEOS,
  cache, getDb,
  toCardData, sortCards, loadCollection, loadDoc,
  buildCard, renderSkeleton, renderMessage, renderCards, mountSection,
  setPhone, applyContacts, setMeta, init
};
})();
