const $ = (s) => document.querySelector(s),
  app = $("#app"),
  modal = $("#modal");
let user = null,
  csrf,
  category = "",
  query = "",
  page = 0,
  feed = [],
  saved = new Set(),
  current = null,
  viewVersion = 0,
  afterLogin = null,
  toastTimer;
const labels = {
  BLOG: "Blog",
  FILM: "Film",
  SERIES: "Dizi",
  HISTORY: "Tarih",
  TECH: "Teknoloji",
  SPORT: "Spor",
};
const canWrite = () => ["WRITER", "ADMIN"].includes(user?.role);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const date = (s) =>
  new Date(s).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
const read = (s) => Math.max(1, Math.ceil(s.split(/\s+/).length / 200));
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 3500);
}
async function api(url, method = "GET", data) {
  const headers = {};
  if (!["GET", "HEAD"].includes(method)) {
    csrf = await api("/csrf");
    headers[csrf.header] = csrf.token;
  }
  if (data) headers["Content-Type"] = "application/json";
  let r;
  try {
    r = await fetch("/api" + url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    throw new Error(
      "Sunucuya bağlanılamadı. Bağlantını kontrol edip yeniden dene.",
    );
  }
  if (!r.ok) {
    if (r.status === 401 && user) {
      user = null;
      saved.clear();
      account();
    }
    let e = await r.json().catch(() => ({}));
    throw new Error(
      e.message ||
        {
          401: "Devam etmek için giriş yap.",
          403: "Bu işlem için yetkin yok.",
          409: "Bu e-posta zaten kullanılıyor.",
        }[r.status] ||
        "İşlem tamamlanamadı. Lütfen yeniden dene.",
    );
  }
  return r.status === 204 || r.headers.get("content-length") === "0"
    ? null
    : r.text().then((t) => (t ? JSON.parse(t) : null));
}
async function init() {
  try {
    user = await api("/me");
    if (!user.id) user = null;
    if (user) saved = new Set((await api("/bookmarks")).map((p) => p.id));
    account();
    await route();
  } catch (e) {
    errorView(e.message);
  }
}
function account() {
  $("#account").innerHTML = user
    ? `<button data-action="bookmarks">Okuma listem</button>${canWrite() ? '<button data-action="mine">Yazılarım</button><button class="btn" data-action="write">＋ Yazı yaz</button>' : ""}${user.role === "ADMIN" ? '<button data-action="writers">Yazarlar</button>' : ""}<button data-action="account" title="Hesabım">${esc(user.name.split(" ")[0])} ◉</button>`
    : '<button data-action="login">Giriş yap</button><button class="btn dark" data-action="register">Aramıza katıl ↗</button>';
}
const categorySymbols = {
  BLOG: "¶",
  FILM: "◉",
  SERIES: "▤",
  HISTORY: "◷",
  TECH: "⌘",
  SPORT: "↗",
};
function card(p) {
  return `<article class="post-card"><a class="thumb ${p.category.toLowerCase()}" href="#post/${p.id}" aria-label="${esc(p.title)}"><small>${labels[p.category]}</small><span class="symbol" aria-hidden="true">${categorySymbols[p.category]}</span><span class="cover-word">${p.rating ? p.rating + "<small>/10</small>" : "satır."}</span></a><div class="post-content"><div class="author"><span class="avatar">${esc(p.author_name[0])}</span>${esc(p.author_name)}${p.published ? "" : " · Taslak"}</div><a href="#post/${p.id}"><h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p></a><div class="meta"><span>${date(p.created_at)} · ${read(p.body)} dk okuma</span>${p.rating ? `<span>★ ${p.rating}/10</span>` : ""}${p.published ? saveButton(p.id) : ""}</div></div></article>`;
}
function hero() {
  return `<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="dot"></span> BAĞIMSIZ BİR OKUMA ALANI</div><h1>Merakın varsa,<br><em>yerin burada.</em></h1><p class="lead">Bir filmin son sahnesinden hayatın küçük ayrıntılarına. <br>Dur, oku. Kendi bakış açına bir yenisini ekle.</p><button class="btn" data-action="${canWrite() ? "write" : "discover"}">${canWrite() ? "Kendi satırını yaz" : "Bir okuma molası ver"}<span aria-hidden="true">↗</span></button><span class="hero-footnote">Farklı konular. Ortak bir merak.</span></div><div class="hero-art" aria-hidden="true"><div class="notebook"><div class="notebook-top"><span>SATIR / AÇIK DEFTER</span><span>01 — ∞</span></div><div class="notebook-title">Her satırda<br>başka bir<br><em>ihtimal.</em></div><div class="notebook-lines"><i></i><i></i><i></i></div><div class="notebook-bottom">OKUMAYA YER AÇ.<span>↗</span></div></div><div class="margin-note">biraz dur.<br>biraz düşün.</div><span class="art-dot"></span></div></section>`;
}
async function home(append = false, version = viewVersion) {
  if (!append) page = 0;
  const data = await api(
    "/posts?q=" +
      encodeURIComponent(query) +
      "&category=" +
      category +
      "&page=" +
      page,
  );
  if (version !== viewVersion) return;
  if (!append) feed = [];
  feed.push(...data);
  app.innerHTML =
    (category || query ? "" : hero()) +
    `<section class="discovery"><div class="section-label"><span class="eyebrow">MERAK ETTİĞİN YERDEN BAŞLA</span><span class="muted">Altı konu, sayısız bakış.</span></div><div class="tabs" aria-label="Kategoriler">${[
      ["", "Bütün yazılar"],
      ["BLOG", "Blog"],
      ["FILM", "Filmler"],
      ["SERIES", "Diziler"],
      ["HISTORY", "Tarih"],
      ["TECH", "Teknoloji"],
      ["SPORT", "Spor"],
    ]
      .map(
        ([v, l], i) =>
          `<button class="topic-tab ${v.toLowerCase()} ${category === v ? "active" : ""}" data-category="${v}" aria-pressed="${category === v}"><span class="topic-number">0${i + 1}</span><span>${l}</span><span class="topic-icon" aria-hidden="true">${categorySymbols[v] || "≡"}</span></button>`,
      )
      .join("")}</div></section>
    <div class="layout"><section class="feed-section"><div class="feed-heading"><div><span class="eyebrow">${category ? "KONU DEFTERİ" : "KENDİNE BİRKAÇ DAKİKA AYIR"}</span><h2>${category ? labels[category] : query ? "Arama sonuçları" : "Okuma molası"}<span class="heading-dot">.</span></h2></div>${!category && !query ? '<span class="feed-caption">Yeni yazılar, yeni pencereler.</span>' : ""}</div>${category ? `<p class="category-description">${categoryDescriptions[category]}</p>` : ""}${query ? `<div class="search-result"><p class="sub">“${esc(query)}” için sonuçlar</p><button data-action="clear-search">Aramayı temizle ×</button></div>` : ""}<div class="post-grid">${feed.length ? feed.map(card).join("") : emptyFeed()}</div>${data.length === 20 ? '<button class="btn light loadmore" data-action="more">Daha fazla yazı</button>' : ""}</section></div>
    <aside class="community"><div class="community-intro"><span class="eyebrow">SATIR ARASI</span><h3>İyi bir yazı,<br>yeni bir pencere.</h3></div><div><p>İzlediklerimiz, öğrendiklerimiz, aklımıza takılanlar. Satır, farklı bakış açılarına aynı masada yer açar.</p><a class="text-link" href="#about">Satır’ı tanı <span>↗</span></a></div><div class="community-action"><p>${canWrite() ? "Aklındaki düşünceyi bir satıra dönüştür." : user ? "Sana iyi gelen yazıları bir arada tut." : "Bir sonraki okuma molanı kendine sakla."}</p><button class="btn light" data-action="${canWrite() ? "write" : user ? "bookmarks" : "register"}">${canWrite() ? "Yazmaya başla" : user ? "Okuma listem" : "Okuyucu olarak katıl"} <span>↗</span></button></div></aside>`;
  document.title = category
    ? labels[category] + " | Satır"
    : "Satır — Merakın varsa, yerin burada.";
}
async function detail(id, version = viewVersion) {
  const p = await api("/posts/" + id);
  const comments = await api("/posts/" + id + "/comments");
  if (version !== viewVersion) return;
  current = p;
  document.title = p.title + " | Satır";
  app.innerHTML = `<article class="article"><a class="sub" href="#">← Bütün yazılar</a><div class="eyebrow article-kicker">${labels[p.category].toLocaleUpperCase("tr-TR")}</div><h1>${esc(p.title)}</h1><p class="summary">${esc(p.summary)}</p><div class="author"><span class="avatar">${esc(p.author_name[0])}</span>${esc(p.author_name)} · ${date(p.created_at)} · ${read(p.body)} dk okuma ${p.published ? "" : "· Taslak"}</div>${p.rating ? `<div class="review-box"><b>${p.rating}<small>/10</small></b><span>${esc(p.work_title)}<br><small>${labels[p.category]} değerlendirmesi</small></span></div>` : ""}${p.spoiler ? '<p class="spoiler">⚑ Bu değerlendirme olay örgüsü hakkında spoiler içeriyor.</p>' : ""}<div class="body">${esc(p.body)}</div><div class="article-actions">${p.published ? saveButton(p.id, true) : ""}${canWrite() && user?.id === p.author_id ? `<button class="btn" data-action="edit">Düzenle</button><button class="btn light" data-action="delete">Yazıyı sil</button>` : ""}</div>${p.published ? `<h2 id="comment-count">Satır arası · ${comments.length} yorum</h2><div id="comments">${commentsHtml(comments)}</div>${user ? '<form id="comment-form"><label>Sen ne düşünüyorsun?<textarea name="body" maxlength="2000" required rows="3" placeholder="Sohbete bir satır ekle..."></textarea></label><p class="error" role="alert"></p><button class="btn">Yorumu paylaş</button></form>' : '<button class="btn light" data-action="login">Yorum yapmak için giriş yap</button>'}` : ""}</article>`;
}
async function listing(kind, version = viewVersion) {
  if (!user) {
    accessView("Okuma listene ve yazılarına ulaşmak için giriş yap.");
    return;
  }
  if (kind === "mine" && !canWrite()) {
    accessView("Yazı masası yalnızca yetkili yazarlara açık.", false);
    return;
  }
  const posts = await api(kind === "mine" ? "/mine" : "/bookmarks");
  if (version !== viewVersion) return;
  document.title =
    (kind === "mine" ? "Yazı masam" : "Okuma listem") + " | Satır";
  app.innerHTML = `<h2 class="section-title">${kind === "mine" ? "Yazı masam" : "Okuma listem"}</h2><p class="sub">${kind === "mine" ? "Taslakların, düşüncelerin ve yayımladığın hikâyelerin." : "Kendine ayırdığın bir sonraki okuma molası."}</p>${kind === "mine" ? '<button class="btn" data-action="write">＋ Yeni yazı</button>' : ""}<div class="article">${posts.map(card).join("") || `<div class="empty-state"><span class="empty-icon">${kind === "mine" ? "✎" : "♧"}</span><h3>${kind === "mine" ? "İlk satırını yaz." : "Bir sonraki okuman burada."}</h3><p>${kind === "mine" ? "Bir taslakla başla; hazır olduğunda okurlarınla paylaş." : "Yazılardaki kaydet düğmesine dokun. Seçtiğin yazılar bu listede seni bekleyecek."}</p>${kind === "mine" ? '<a class="btn" href="#write">Yeni yazı oluştur</a>' : '<a class="btn light" href="#">Yazıları keşfet</a>'}</div>`}</div>`;
}
function editor(p = {}) {
  if (!user) {
    accessView("Yazı masasına ulaşmak için giriş yap.");
    return;
  }
  if (!canWrite()) {
    accessView("Yazı yayımlama yetkisini yalnızca yönetici verebilir.", false);
    return;
  }
  if (p.id && p.author_id !== user.id) {
    accessView("Yalnızca kendi yazılarını düzenleyebilirsin.", false);
    return;
  }
  document.title = (p.id ? "Yazıyı düzenle" : "Yeni yazı") + " | Satır";
  app.innerHTML = `<section class="editor"><a class="sub" href="#mine">← Yazı masam</a><h1>${p.id ? "Satırlarına geri dön." : "Boş bir sayfa, yeni bir hikâye."}</h1><form id="editor-form" data-id="${p.id || ""}"><label>Başlık<input name="title" required maxlength="180" value="${esc(p.title || "")}" placeholder="Hikâyenin adı..."></label><div class="row"><label>Yazı türü<select name="category">${Object.entries(
    labels,
  )
    .map(
      ([k, v]) =>
        `<option value="${k}" ${p.category === k ? "selected" : ""}>${v}</option>`,
    )
    .join(
      "",
    )}</select></label><label data-review-field>Eser adı (film/dizi için)<input name="workTitle" maxlength="160" value="${esc(p.work_title || "")}" placeholder="Hangi yapımı değerlendiriyorsun?"></label><label data-review-field>Puan<select name="rating"><option value="">Puan yok</option>${Array.from({ length: 10 }, (_, i) => `<option ${p.rating === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label></div><label>Kısa özet<textarea name="summary" rows="2" maxlength="400" required placeholder="Okuru ilk satırda yakala...">${esc(p.summary || "")}</textarea></label><label>Yazın<textarea name="body" rows="17" maxlength="100000" required placeholder="İçinden geldiği gibi yaz...">${esc(p.body || "")}</textarea></label><label class="check" data-review-field><input type="checkbox" name="spoiler" ${p.spoiler ? "checked" : ""}> Spoiler içeriyor</label><p id="word-count" class="sub word-count"></p><p class="error" id="form-error" role="alert"></p><div class="row"><button class="btn light" name="intent" value="draft">Taslak olarak kaydet</button><button class="btn" name="intent" value="publish">${p.published ? "Güncelle ve yayımla" : "Yayımla"} ↗</button></div></form></section>`;
  syncEditor();
  updateWordCount();
  window.scrollTo(0, 0);
}
function auth(mode = "login") {
  modal.innerHTML = `<button class="close" data-action="close" aria-label="Kapat">×</button><a class="logo" href="#" aria-label="Satır ana sayfa">satır<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span></a><h2>${mode === "login" ? "Yeniden merhaba." : "Senin hikâyen burada."}</h2><p class="sub">${mode === "login" ? "Kaldığın satırdan devam et." : "Okumak, yazmak ve yeni bakış açıları keşfetmek için katıl."}</p><form id="auth-form" data-mode="${mode}">${mode === "register" ? '<label>Adın<input name="name" required maxlength="80" autocomplete="name"></label>' : ""}<label>E-posta<input type="email" name="email" required maxlength="254" autocomplete="email"></label><label>Şifre<input type="password" name="password" required minlength="${mode === "register" ? 10 : 1}" maxlength="72" autocomplete="${mode === "register" ? "new-password" : "current-password"}"></label>${mode === "register" ? '<small class="sub">Okuyucu hesabıyla keşfet, kaydet ve yorum yap. Yazar hesaplarını yalnızca yönetici oluşturur. Şifren en az 10 karakter olmalı.</small>' : ""}<p class="error" id="auth-error" role="alert"></p><button class="btn">${mode === "login" ? "Giriş yap" : "Hesap oluştur"}</button></form><button class="switch" data-action="${mode === "login" ? "register" : "login"}">${mode === "login" ? "Henüz hesabın yok mu? Aramıza katıl." : "Zaten hesabın var mı? Giriş yap."}</button>`;
  if (!modal.open) modal.showModal();
}
async function writers(version = viewVersion) {
  if (user?.role !== "ADMIN") {
    app.innerHTML =
      '<div class="empty">Bu bölüm yalnızca yöneticiye açık.<br><a href="#">Ana sayfaya dön</a></div>';
    return;
  }
  const members = await api("/admin/writers");
  if (version !== viewVersion) return;
  document.title = "Yazarlar | Satır";
  app.innerHTML = `<section class="editor admin-page"><a class="sub" href="#">← Ana sayfa</a><div class="eyebrow article-kicker">YÖNETİCİ PANELİ</div><h1>Yazarlar</h1><p class="sub">Yayın ekibini buradan oluştur. Yazarlar kendi yazılarını ekleyip düzenleyebilir; hesap yönetimine erişemez.</p><div class="admin-grid"><section class="admin-box"><h2>Yeni yazar ekle</h2><form id="writer-form"><label>Ad soyad<input name="name" required maxlength="80" autocomplete="off"></label><label>E-posta<input name="email" type="email" required maxlength="254" autocomplete="off"></label><label>İlk şifre<input name="password" type="password" required minlength="10" maxlength="72" autocomplete="new-password"></label><p class="sub">Giriş bilgilerini yazara güvenli bir kanaldan ilet. Bu işlem e-posta göndermez.</p><p class="error" role="alert"></p><button class="btn">Yazar hesabı oluştur</button></form></section><section class="admin-box"><h2>Okuyucuyu yazar yap</h2><p class="sub">Zaten kayıtlı bir okuyucuya mevcut hesabıyla yazma yetkisi ver.</p><form id="promote-form"><label>Okuyucunun e-postası<input name="email" type="email" required maxlength="254"></label><p class="error" role="alert"></p><button class="btn light">Yazar yetkisi ver</button></form><p class="sub">Kullanıcı menüsünün güncellenmesi için yeniden giriş yapabilir.</p></section></div><h2>Yayın ekibi · ${members.length}</h2><div class="writer-list">${members.map((m) => `<div class="writer-row"><span class="avatar">${esc(m.name[0])}</span><div><strong>${esc(m.name)}</strong><small>${esc(m.email)}</small></div><span class="badge">Yazar</span></div>`).join("") || '<p class="empty">Henüz yazar eklenmedi.</p>'}</div></section>`;
}
async function login(email, password) {
  const c = await api("/csrf");
  const r = await fetch("/api/login", {
    method: "POST",
    headers: {
      [c.header]: c.token,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username: email.toLowerCase().trim(),
      password,
    }),
  });
  if (!r.ok) throw Error("E-posta veya şifre yanlış.");
  user = await api("/me");
  saved = new Set((await api("/bookmarks")).map((p) => p.id));
  account();
}
const categoryDescriptions = {
  BLOG: "Gündelik hayattan fikirler, kişisel notlar ve paylaşmaya değer hikâyeler.",
  FILM: "Beyaz perdeden geriye kalanlar: film değerlendirmeleri ve yeni bakış açıları.",
  SERIES:
    "Bir bölümden fazlası: karakterler, hikâyeler ve dizi değerlendirmeleri.",
  HISTORY:
    "Geçmişin izinde: olayları, dönemleri ve aralarındaki bağları keşfet.",
  TECH: "Dijital dünyadan düşünceler, deneyimler ve teknoloji yazıları.",
  SPORT: "Skorların ötesinde: sporun hikâyeleri, yorumları ve heyecanı.",
};
function feedPath(cat = category, term = query) {
  return (
    (cat ? "category/" + cat : term ? "search" : "") +
    (term ? "?q=" + encodeURIComponent(term) : "")
  );
}
async function navigate(path = "", { replace = false, scroll = true } = {}) {
  clearTimeout(searchTimer);
  if (modal.open) modal.close();
  afterLogin = null;
  const url = location.pathname + location.search + (path ? "#" + path : "");
  if (url !== location.pathname + location.search + location.hash)
    history[replace ? "replaceState" : "pushState"](null, "", url);
  await route();
  if (scroll) window.scrollTo(0, 0);
}
function errorView(message) {
  document.title = "Sayfa bilgisi | Satır";
  app.innerHTML = `<section class="empty-state"><span class="empty-icon">↻</span><h1>Bir duraklama oldu.</h1><p>${esc(message)}</p><button class="btn" data-action="retry">Yeniden dene</button> <a class="btn light" href="#">Ana sayfaya dön</a></section>`;
}
function accessView(message, login = true) {
  document.title = login ? "Giriş yap | Satır" : "Erişim bilgisi | Satır";
  app.innerHTML = `<section class="empty-state"><span class="empty-icon">✳</span><h1>${login ? "Kaldığın yerden devam et." : "Burası yazı masası."}</h1><p>${esc(message)}</p>${login ? '<button class="btn" data-action="login">Giriş yap</button>' : '<a class="btn" href="#account">Hesabımı gör</a>'} <a class="btn light" href="#">Ana sayfa</a></section>`;
}
function emptyFeed() {
  const searching = !!query;
  return `<div class="empty-state"><span class="empty-icon">${searching ? "⌕" : "✳"}</span><h3>${searching ? "Bu aramada henüz bir satır yok." : category ? labels[category] + " için ilk hikâye yolda." : "Her hikâye bir ilk satırla başlar."}</h3><p>${searching ? "Başka bir kelime dene veya aramayı temizleyip yazıları keşfet." : "Yayımlanan yazılar burada görünecek. Diğer kategorileri keşfedebilir" + (canWrite() ? " veya ilk yazıyı sen ekleyebilirsin." : ", beğendiklerini okuma listene ekleyebilirsin.")}</p>${searching ? '<button class="btn light" data-action="clear-search">Aramayı temizle</button>' : canWrite() ? '<a class="btn" href="#write">İlk yazıyı oluştur</a>' : category ? '<a class="btn light" href="#">Bütün yazılara dön</a>' : '<a class="btn light" href="#about">Satır’ı tanı</a>'}</div>`;
}
function saveButton(id, full = false) {
  const active = saved.has(id);
  return `<button ${full ? 'class="btn light" data-save-label="true"' : ""} data-save="${id}" aria-pressed="${active}" aria-label="${active ? "Okuma listesinden kaldır" : "Okuma listesine kaydet"}">${full ? (active ? "Kaydedildi ✓" : "Okuma listeme ekle") : active ? "▣" : "♧"}</button>`;
}
function commentsHtml(comments) {
  return (
    comments
      .map(
        (c) =>
          `<div class="comment"><div class="author"><strong>${esc(c.author_name)}</strong> · ${date(c.created_at)}</div><p>${esc(c.body)}</p></div>`,
      )
      .join("") ||
    '<p class="sub">Henüz yorum yok. İlk bakış açısını sen paylaş.</p>'
  );
}
async function toggleSave(id) {
  if (!user) {
    afterLogin = () => toggleSave(id);
    auth();
    return;
  }
  const active = !saved.has(id);
  await api("/bookmarks/" + id, active ? "PUT" : "DELETE");
  active ? saved.add(id) : saved.delete(id);
  for (const b of document.querySelectorAll("[data-save]")) {
    if (b.dataset.save !== id) continue;
    b.setAttribute("aria-pressed", String(active));
    b.setAttribute(
      "aria-label",
      active ? "Okuma listesinden kaldır" : "Okuma listesine kaydet",
    );
    b.textContent = b.dataset.saveLabel
      ? active
        ? "Kaydedildi ✓"
        : "Okuma listeme ekle"
      : active
        ? "▣"
        : "♧";
  }
  toast(active ? "Okuma listene eklendi." : "Okuma listenden çıkarıldı.");
  if (location.hash.split("?")[0] === "#bookmarks") await route();
}
function syncEditor() {
  const f = $("#editor-form");
  if (!f) return;
  const review = ["FILM", "SERIES"].includes(f.elements.category.value);
  for (const label of f.querySelectorAll("[data-review-field]"))
    label.hidden = !review;
  f.elements.workTitle.required = review;
  f.elements.rating.required = review;
}
function updateWordCount() {
  const field = $('#editor-form textarea[name="body"]');
  if ($("#word-count") && field) {
    const count = field.value.trim()
      ? field.value.trim().split(/\s+/).length
      : 0;
    $("#word-count").textContent =
      count + " kelime · " + Math.max(1, Math.ceil(count / 200)) + " dk okuma";
  }
}
function accountPage() {
  if (!user) {
    accessView("Hesap bilgilerini görmek için giriş yap.");
    return;
  }
  document.title = "Hesabım | Satır";
  const roles = { ADMIN: "Yönetici", WRITER: "Yazar", READER: "Okuyucu" };
  app.innerHTML = `<section class="editor info-page"><a class="sub" href="#">← Ana sayfa</a><h1>Merhaba, ${esc(user.name)}.</h1><p class="sub">Satır’daki yerin ve sana açık olan alanlar.</p><dl class="account-details"><div><dt>Ad soyad</dt><dd>${esc(user.name)}</dd></div><div><dt>E-posta</dt><dd>${esc(user.email)}</dd></div><div><dt>Hesap türü</dt><dd><span class="badge">${roles[user.role]}</span></dd></div></dl><div class="article-actions"><a class="btn light" href="#bookmarks">Okuma listem</a>${canWrite() ? '<a class="btn" href="#mine">Yazı masam</a>' : ""}${user.role === "ADMIN" ? '<a class="btn" href="#writers">Yazarları yönet</a>' : ""}<button class="btn light" data-action="logout">Çıkış yap</button></div><p class="notice">${canWrite() ? "Yazı masandan taslak oluşturabilir, kendi yazılarını düzenleyip yayımlayabilirsin." : "Okuyucu olarak yazıları kaydedebilir ve yorum yapabilirsin. Yazar yetkisini yalnızca yönetici verebilir."}</p></section>`;
}
function aboutPage() {
  document.title = "Satır hakkında | Satır";
  app.innerHTML = `<article class="article info-page"><a class="sub" href="#">← Ana sayfa</a><div class="eyebrow article-kicker">SATIR HAKKINDA</div><h1>Bir satır.<br>Bir başka bakış.</h1><p class="summary">Satır; düşünceler, hikâyeler ve izlediklerimiz üzerine konuşmak için bir yayın alanı.</p><h2>Biraz keşfet</h2><div class="topics">${Object.entries(
    labels,
  )
    .map(([k, v]) => `<a href="#category/${k}">${v}</a>`)
    .join(
      "",
    )}</div><h2>Okuyucu olarak</h2><p class="sub">Yazıları hesap açmadan okuyabilirsin. Ücretsiz okuyucu hesabınla beğendiğin yazıları okuma listene ekleyebilir ve değerlendirmelere yorum yapabilirsin.</p><h2>Yazar olarak</h2><p class="sub">Yazar hesaplarını yönetici oluşturur. Yazarlar kendi taslaklarını kaydeder, yazılarını düzenler ve hazır olduklarında yayımlar. Film ve dizi değerlendirmelerinde eser adı, 1–10 puan ve spoiler uyarısı kullanılabilir.</p><h2>Kaydettiğim yazılar nerede?</h2><p class="sub">Giriş yaptıktan sonra üst menüdeki “Okuma listem” bölümünde. Hesap adına basarak hesap bilgilerine ve çıkış düğmesine ulaşabilirsin.</p><div class="article-actions"><a class="btn" href="#">Yazıları keşfet</a>${user ? '<a class="btn light" href="#account">Hesabım</a>' : '<button class="btn light" data-action="register">Okuyucu olarak katıl</button>'}</div></article>`;
}
async function route() {
  const version = ++viewVersion;
  app.setAttribute("aria-busy", "true");
  $("#route-status").hidden = false;
  try {
    const [hash, params = ""] = location.hash.replace(/^#/, "").split("?");
    query = new URLSearchParams(params).get("q") || "";
    if ($("#search").value !== query) $("#search").value = query;
    if (hash.startsWith("post/")) await detail(hash.slice(5), version);
    else if (hash === "mine" || hash === "bookmarks")
      await listing(hash, version);
    else if (hash === "writers") await writers(version);
    else if (hash === "account") accountPage();
    else if (hash === "about") aboutPage();
    else if (hash === "write") editor();
    else if (hash.startsWith("edit/")) {
      const p = await api("/posts/" + hash.slice(5));
      if (version === viewVersion) editor(p);
    } else if (
      hash === "" ||
      hash === "search" ||
      hash.startsWith("category/")
    ) {
      category = hash.startsWith("category/") ? hash.slice(9) : "";
      if (category && !Object.hasOwn(labels, category))
        throw new Error("Bu kategori bulunamadı.");
      await home(false, version);
    } else
      throw new Error(
        "Aradığın sayfa bulunamadı. Ana sayfadan devam edebilirsin.",
      );
  } catch (e) {
    if (version === viewVersion) errorView(e.message);
  } finally {
    if (version === viewVersion) {
      app.setAttribute("aria-busy", "false");
      $("#route-status").hidden = true;
    }
  }
}
document.addEventListener("click", async (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    await navigate(link.getAttribute("href").slice(1));
    return;
  }
  const b = e.target.closest("button");
  if (
    !b ||
    b.disabled ||
    (!b.dataset.action && !b.dataset.save && !b.hasAttribute("data-category"))
  )
    return;
  b.disabled = true;
  try {
    if (b.dataset.save) {
      await toggleSave(b.dataset.save);
      return;
    }
    if (b.hasAttribute("data-category")) {
      await navigate(feedPath(b.dataset.category));
      return;
    }
    switch (b.dataset.action) {
      case "login":
        auth();
        break;
      case "register":
        auth("register");
        break;
      case "close":
        modal.close();
        afterLogin = null;
        break;
      case "write":
        if (!user) {
          afterLogin = () => navigate("write");
          auth();
        } else await navigate("write");
        break;
      case "writers":
        await navigate("writers");
        break;
      case "account":
        await navigate("account");
        break;
      case "mine":
        await navigate("mine");
        break;
      case "bookmarks":
        await navigate("bookmarks");
        break;
      case "discover":
        $(".tabs")?.scrollIntoView({ behavior: "smooth" });
        break;
      case "clear-search":
        await navigate(feedPath(category, ""));
        break;
      case "retry":
        await init();
        break;
      case "edit":
        if (current) await navigate("edit/" + current.id);
        break;
      case "delete":
        if (!current) return;
        modal.dataset.postId = current.id;
        modal.innerHTML =
          '<h2>Bu yazı silinsin mi?</h2><p class="sub">Yazı ve yorumları kalıcı olarak silinecek.</p><p class="error" role="alert"></p><button class="btn" data-action="confirm-delete">Evet, sil</button> <button class="btn light" data-action="close">Vazgeç</button>';
        modal.showModal();
        break;
      case "confirm-delete":
        await api("/posts/" + modal.dataset.postId, "DELETE");
        modal.close();
        await navigate("mine");
        toast("Yazı silindi.");
        break;
      case "logout":
        await api("/logout", "POST");
        user = null;
        saved.clear();
        account();
        await navigate();
        toast("Çıkış yaptın.");
        break;
      case "more": {
        const version = viewVersion;
        const previousPage = page;
        page++;
        try {
          await home(true, version);
        } catch (error) {
          if (version === viewVersion) page = previousPage;
          throw error;
        }
        break;
      }
    }
  } catch (error) {
    const errorEl = modal.open ? modal.querySelector(".error") : null;
    if (errorEl) errorEl.textContent = error.message;
    else toast(error.message);
  } finally {
    b.disabled = false;
  }
});
document.addEventListener("submit", async (e) => {
  if (
    ![
      "auth-form",
      "writer-form",
      "promote-form",
      "editor-form",
      "comment-form",
    ].includes(e.target.id)
  )
    return;
  e.preventDefault();
  const f = e.target;
  if (f.dataset.pending) return;
  f.dataset.pending = "true";
  const data = Object.fromEntries(new FormData(f));
  const submit = e.submitter;
  const buttons = [
    ...f.querySelectorAll('button[type="submit"],button:not([type])'),
  ];
  buttons.forEach((b) => (b.disabled = true));
  const errorEl = f.querySelector(".error");
  if (errorEl) errorEl.textContent = "";
  try {
    if (f.id === "auth-form") {
      if (f.dataset.mode === "register") {
        await api("/register", "POST", data);
        f.dataset.mode = "login";
        if (submit) submit.textContent = "Giriş yap";
      }
      await login(data.email, data.password);
      const pending = afterLogin;
      afterLogin = null;
      modal.close();
      await route();
      if (pending) await pending();
      toast("Hoş geldin, " + user.name + ".");
    } else if (f.id === "writer-form") {
      await api("/admin/writers", "POST", data);
      await writers();
      toast("Yazar hesabı oluşturuldu.");
    } else if (f.id === "promote-form") {
      await api("/admin/writers/promote", "POST", data);
      await writers();
      toast("Okuyucuya yazar yetkisi verildi.");
    } else if (f.id === "editor-form") {
      const review = ["FILM", "SERIES"].includes(data.category);
      const body = {
        ...data,
        title: data.title.trim(),
        summary: data.summary.trim(),
        body: data.body.trim(),
        workTitle: review ? data.workTitle.trim() : "",
        rating: review && data.rating ? Number(data.rating) : null,
        spoiler: review && !!data.spoiler,
        published: submit?.value === "publish",
      };
      if (!body.title || !body.summary || !body.body)
        throw new Error("Başlık, özet ve yazı içeriğini doldur.");
      const p = await api(
        "/posts" + (f.dataset.id ? "/" + f.dataset.id : ""),
        f.dataset.id ? "PUT" : "POST",
        body,
      );
      await navigate("post/" + p.id);
      toast(p.published ? "Yazın yayımlandı." : "Taslağın kaydedildi.");
    } else if (f.id === "comment-form") {
      const postId = current.id;
      if (!data.body.trim())
        throw new Error("Yorumunu yazdıktan sonra paylaşabilirsin.");
      await api("/posts/" + postId + "/comments", "POST", {
        body: data.body.trim(),
      });
      const comments = await api("/posts/" + postId + "/comments");
      if ($("#comment-form") === f) {
        f.reset();
        $("#comments").innerHTML = commentsHtml(comments);
        $("#comment-count").textContent =
          "Satır arası · " + comments.length + " yorum";
      }
      toast("Yorumun eklendi.");
    }
  } catch (error) {
    if (errorEl) errorEl.textContent = error.message;
    else toast(error.message);
  } finally {
    delete f.dataset.pending;
    buttons.forEach((b) => (b.disabled = false));
  }
});
let searchTimer;
$("#search").addEventListener("input", (e) => {
  const value = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const path = location.hash.slice(1).split("?")[0];
    navigate(
      feedPath(path.startsWith("category/") ? path.slice(9) : "", value.trim()),
      { replace: true, scroll: false },
    );
  }, 300);
});
document.addEventListener("change", (e) => {
  if (e.target.matches('#editor-form select[name="category"]')) syncEditor();
});
document.addEventListener("input", (e) => {
  if (e.target.matches('#editor-form textarea[name="body"]')) updateWordCount();
});
modal.addEventListener("cancel", () => {
  afterLogin = null;
});
window.addEventListener("hashchange", () => {
  clearTimeout(searchTimer);
  if (modal.open) modal.close();
  route();
  window.scrollTo(0, 0);
});
init();
