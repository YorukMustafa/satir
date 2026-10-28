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
  current = null;
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
  setTimeout(() => ($("#toast").style.display = "none"), 3000);
}
async function api(url, method = "GET", data) {
  const headers = {};
  if (!["GET", "HEAD"].includes(method)) {
    csrf = await fetch("/api/csrf").then((r) => r.json());
    headers[csrf.header] = csrf.token;
  }
  if (data) headers["Content-Type"] = "application/json";
  const r = await fetch("/api" + url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!r.ok) {
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
    app.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}
function account() {
  $("#account").innerHTML = user
    ? `<button data-action="bookmarks">Okuma listem</button>${canWrite() ? '<button data-action="mine">Yazılarım</button><button class="btn" data-action="write">＋ Yazı yaz</button>' : ""}${user.role === "ADMIN" ? '<button data-action="writers">Yazarlar</button>' : ""}<button data-action="logout" title="Çıkış yap">${esc(user.name.split(" ")[0])} ↗</button>`
    : '<button data-action="login">Giriş yap</button><button class="btn dark" data-action="register">Aramıza katıl ↗</button>';
}
function card(p) {
  return `<article class="post-card"><div><div class="author"><span class="avatar">${esc(p.author_name[0])}</span>${esc(p.author_name)}${p.published ? "" : " · Taslak"}</div><a href="#post/${p.id}"><h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p></a><div class="meta"><span class="badge">${labels[p.category]}</span><span>${date(p.created_at)} · ${read(p.body)} dk okuma</span>${p.rating ? `<span>★ ${p.rating}/10</span>` : ""}<button data-save="${p.id}" aria-label="Okuma listesine kaydet">${saved.has(p.id) ? "▣" : "♧"}</button></div></div><a class="thumb ${p.category.toLowerCase()}" href="#post/${p.id}" aria-label="${esc(p.title)}"><span class="symbol">${p.category === "FILM" ? "◉" : p.category === "SERIES" ? "▥" : "✳"}</span><small>${labels[p.category]} / satır</small></a></article>`;
}
function hero() {
  return `<section class="hero"><div><div class="eyebrow"><span class="dot"></span> KELİMELERİN BULUŞTUĞU YER</div><h1>Hikâyenin bir de<br><em>senin tarafın var.</em></h1><p class="lead">Aklından geçenleri yaz. İzlediklerinin izini sür.<br>İyi hikâyeler, paylaşılınca çoğalır.</p><button class="btn dark" data-action="${canWrite() ? "write" : "discover"}">${canWrite() ? "Kendi satırını yaz" : "Hikâyeleri keşfet"} <span>↗</span></button></div><div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="orbit two"></div><span class="star">✳</span><div class="art-card"><b>Bir<br>satır.</b><i></i><i></i><i></i></div><div class="ticket">Ve yeni bir bakış.</div><div class="art-note">OKU. DÜŞÜN. PAYLAŞ.</div></div></section>`;
}
async function home(append = false) {
  if (!append) page = 0;
  const data = await api(
    "/posts?q=" +
      encodeURIComponent(query) +
      "&category=" +
      category +
      "&page=" +
      page,
  );
  if (!append) feed = [];
  feed.push(...data);
  app.innerHTML =
    hero() +
    `<div class="layout"><section><div class="tabs">${[
      ["", "Senin için"],
      ["BLOG", "Blog"],
      ["FILM", "Filmler"],
      ["SERIES", "Diziler"],
      ["HISTORY", "Tarih"],
      ["TECH", "Teknoloji"],
      ["SPORT", "Spor"],
    ]
      .map(
        ([v, l]) =>
          `<button class="${category === v ? "active" : ""}" data-category="${v}">${l}</button>`,
      )
      .join(
        "",
      )}</div>${query ? `<p class="sub">“${esc(query)}” için sonuçlar</p>` : ""}<div>${feed.length ? feed.map(card).join("") : '<div class="empty">Henüz burada bir yazı yok.<br>Yazarlarımızın yeni hikâyeleri yakında burada.</div>'}</div>${data.length === 20 ? '<button class="btn light loadmore" data-action="more">Daha fazla yazı</button>' : ""}</section><aside><section class="aside-section"><h3>Yeni satırlarda</h3>${
      feed
        .slice(0, 3)
        .map(
          (p, i) =>
            `<a class="rank" href="#post/${p.id}"><span>0${i + 1}</span><div><b>${esc(p.title)}</b><small>${esc(p.author_name)} · ${labels[p.category]}</small></div></a>`,
        )
        .join("") ||
      '<p class="sub">Yeni yazılar yayımlandıkça burada görünecek.</p>'
    }</section><section class="aside-section"><h3>Biraz keşfet</h3><div class="topics"><button data-category="FILM">Sinema</button><button data-category="SERIES">Dizi dünyası</button><button data-category="BLOG">Blog</button><button data-category="HISTORY">Tarih</button><button data-category="TECH">Teknoloji</button><button data-category="SPORT">Spor</button><button data-category="">Tüm hikâyeler ↗</button></div></section><section class="invite"><div class="eyebrow">SENİN SESİN, SENİN ALANIN</div><h3>Bir satırla başlar.</h3><p>Bir filmden geriye kalan his, bir fikrin ilk kıvılcımı… Burada hepsine yer var.</p><button class="btn light" data-action="${canWrite() ? "write" : user ? "bookmarks" : "register"}">${canWrite() ? "Yazmaya başla" : user ? "Okuma listem" : "Okuyucu olarak katıl"} ↗</button></section></aside></div>`;
  document.title = category
    ? labels[category] + " | Satır"
    : "Satır — Hikâyenin bir de senin tarafın var.";
}
async function detail(id) {
  current = await api("/posts/" + id);
  const p = current;
  const comments = await api("/posts/" + id + "/comments");
  app.innerHTML = `<article class="article"><a class="sub" href="#">← Bütün yazılar</a><div class="eyebrow article-kicker">${labels[p.category].toUpperCase()}</div><h1>${esc(p.title)}</h1><p class="summary">${esc(p.summary)}</p><div class="author"><span class="avatar">${esc(p.author_name[0])}</span>${esc(p.author_name)} · ${date(p.created_at)} · ${read(p.body)} dk okuma ${p.published ? "" : "· Taslak"}</div>${p.rating ? `<div class="review-box"><b>${p.rating}<small>/10</small></b><span>${esc(p.work_title)}<br><small>${labels[p.category]} değerlendirmesi</small></span></div>` : ""}${p.spoiler ? '<p class="spoiler">⚑ Bu değerlendirme olay örgüsü hakkında spoiler içeriyor.</p>' : ""}<div class="body">${esc(p.body)}</div><div class="article-actions">${p.published ? `<button class="btn light" data-save="${p.id}">${saved.has(p.id) ? "Kaydedildi ✓" : "Okuma listeme ekle"}</button>` : ""}${canWrite() && user?.id === p.author_id ? `<button class="btn" data-action="edit">Düzenle</button><button class="btn light" data-action="delete">Yazıyı sil</button>` : ""}</div>${p.published ? `<h2>Satır arası · ${comments.length} yorum</h2>${comments.map((c) => `<div class="comment"><div class="author"><strong>${esc(c.author_name)}</strong> · ${date(c.created_at)}</div><p>${esc(c.body)}</p></div>`).join("")}${user ? '<form id="comment-form"><label>Sen ne düşünüyorsun?<textarea name="body" maxlength="2000" required rows="3" placeholder="Sohbete bir satır ekle..."></textarea></label><button class="btn">Yorumu paylaş</button></form>' : '<button class="btn light" data-action="login">Yorum yapmak için giriş yap</button>'}` : ""}</article>`;
}
async function listing(kind) {
  if (!user) {
    auth();
    return;
  }
  const posts = await api(kind === "mine" ? "/mine" : "/bookmarks");
  app.innerHTML = `<h2 class="section-title">${kind === "mine" ? "Yazı masam" : "Okuma listem"}</h2><p class="sub">${kind === "mine" ? "Taslakların, düşüncelerin ve yayımladığın hikâyelerin." : "Kendine ayırdığın bir sonraki okuma molası."}</p>${kind === "mine" ? '<button class="btn" data-action="write">＋ Yeni yazı</button>' : ""}<div class="article">${posts.map(card).join("") || '<p class="empty">Henüz burada bir yazı yok.</p>'}</div>`;
}
function editor(p = {}) {
  if (!user) {
    auth();
    return;
  }
  if (!canWrite()) {
    toast("Yazı yayımlama yetkisini yalnızca yönetici verebilir.");
    return;
  }
  app.innerHTML = `<section class="editor"><a class="sub" href="#mine">← Yazı masam</a><h1>${p.id ? "Satırlarına geri dön." : "Boş bir sayfa, yeni bir hikâye."}</h1><form id="editor-form" data-id="${p.id || ""}"><label>Başlık<input name="title" required maxlength="180" value="${esc(p.title || "")}" placeholder="Hikâyenin adı..."></label><div class="row"><label>Yazı türü<select name="category">${Object.entries(
    labels,
  )
    .map(
      ([k, v]) =>
        `<option value="${k}" ${p.category === k ? "selected" : ""}>${v}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Eser adı (film/dizi için)<input name="workTitle" maxlength="160" value="${esc(p.work_title || "")}" placeholder="Hangi yapımı değerlendiriyorsun?"></label><label>Puan<select name="rating"><option value="">Puan yok</option>${Array.from({ length: 10 }, (_, i) => `<option ${p.rating === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label></div><label>Kısa özet<textarea name="summary" rows="2" maxlength="400" required placeholder="Okuru ilk satırda yakala...">${esc(p.summary || "")}</textarea></label><label>Yazın<textarea name="body" rows="17" maxlength="100000" required placeholder="İçinden geldiği gibi yaz...">${esc(p.body || "")}</textarea></label><label class="check"><input type="checkbox" name="spoiler" ${p.spoiler ? "checked" : ""}> Spoiler içeriyor</label><p class="error" id="form-error"></p><div class="row"><button class="btn light" name="intent" value="draft">Taslak olarak kaydet</button><button class="btn" name="intent" value="publish">${p.published ? "Güncelle ve yayımla" : "Yayımla"} ↗</button></div></form></section>`;
  window.scrollTo(0, 0);
}
function auth(mode = "login") {
  modal.innerHTML = `<button class="close" data-action="close" aria-label="Kapat">×</button><div class="logo">satır<span>✳</span></div><h2>${mode === "login" ? "Yeniden merhaba." : "Senin hikâyen burada."}</h2><p class="sub">${mode === "login" ? "Kaldığın satırdan devam et." : "Okumak, yazmak ve yeni bakış açıları keşfetmek için katıl."}</p><form id="auth-form" data-mode="${mode}">${mode === "register" ? '<label>Adın<input name="name" required maxlength="80" autocomplete="name"></label>' : ""}<label>E-posta<input type="email" name="email" required maxlength="254" autocomplete="email"></label><label>Şifre<input type="password" name="password" required minlength="${mode === "register" ? 10 : 1}" maxlength="72" autocomplete="${mode === "register" ? "new-password" : "current-password"}"></label>${mode === "register" ? '<small class="sub">Okuyucu hesabıyla keşfet, kaydet ve yorum yap. Yazar hesaplarını yalnızca yönetici oluşturur. Şifren en az 10 karakter olmalı.</small>' : ""}<p class="error" id="auth-error"></p><button class="btn">${mode === "login" ? "Giriş yap" : "Hesap oluştur"}</button></form><button class="switch" data-action="${mode === "login" ? "register" : "login"}">${mode === "login" ? "Henüz hesabın yok mu? Aramıza katıl." : "Zaten hesabın var mı? Giriş yap."}</button>`;
  if (!modal.open) modal.showModal();
}
async function writers() {
  if (user?.role !== "ADMIN") {
    app.innerHTML =
      '<div class="empty">Bu bölüm yalnızca yöneticiye açık.<br><a href="#">Ana sayfaya dön</a></div>';
    return;
  }
  const members = await api("/admin/writers");
  app.innerHTML = `<section class="editor admin-page"><a class="sub" href="#">← Ana sayfa</a><div class="eyebrow article-kicker">YÖNETİCİ PANELİ</div><h1>Yazarlar</h1><p class="sub">Yayın ekibini buradan oluştur. Yazarlar kendi yazılarını ekleyip düzenleyebilir; hesap yönetimine erişemez.</p><div class="admin-grid"><section class="admin-box"><h2>Yeni yazar ekle</h2><form id="writer-form"><label>Ad soyad<input name="name" required maxlength="80" autocomplete="off"></label><label>E-posta<input name="email" type="email" required maxlength="254" autocomplete="off"></label><label>İlk şifre<input name="password" type="password" required minlength="10" maxlength="72" autocomplete="new-password"></label><p class="sub">Giriş bilgilerini yazara güvenli bir kanaldan ilet. Bu işlem e-posta göndermez.</p><p class="error"></p><button class="btn">Yazar hesabı oluştur</button></form></section><section class="admin-box"><h2>Okuyucuyu yazar yap</h2><p class="sub">Zaten kayıtlı bir okuyucuya mevcut hesabıyla yazma yetkisi ver.</p><form id="promote-form"><label>Okuyucunun e-postası<input name="email" type="email" required maxlength="254"></label><p class="error"></p><button class="btn light">Yazar yetkisi ver</button></form><p class="sub">Kullanıcı menüsünün güncellenmesi için yeniden giriş yapabilir.</p></section></div><h2>Yayın ekibi · ${members.length}</h2><div class="writer-list">${members.map((m) => `<div class="writer-row"><span class="avatar">${esc(m.name[0])}</span><div><strong>${esc(m.name)}</strong><small>${esc(m.email)}</small></div><span class="badge">Yazar</span></div>`).join("") || '<p class="empty">Henüz yazar eklenmedi.</p>'}</div></section>`;
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
async function route() {
  try {
    const hash = location.hash.slice(1);
    if (hash.startsWith("post/")) await detail(hash.slice(5));
    else if (hash === "mine" || hash === "bookmarks") await listing(hash);
    else if (hash === "writers") await writers();
    else if (hash.startsWith("category/")) {
      category = hash.slice(9);
      if (!labels[category]) throw new Error("Kategori bulunamadı.");
      await home();
    } else if (hash === "write") editor();
    else if (hash.startsWith("edit/"))
      editor(await api("/posts/" + hash.slice(5)));
    else {
      category = "";
      await home();
    }
  } catch (e) {
    app.innerHTML = `<div class="empty">${esc(e.message)}<br><a href="#">Ana sayfaya dön</a></div>`;
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.save) {
      if (!user) {
        auth();
        return;
      }
      const id = b.dataset.save;
      await api("/bookmarks/" + id, saved.has(id) ? "DELETE" : "PUT");
      saved.has(id) ? saved.delete(id) : saved.add(id);
      toast(
        saved.has(id) ? "Okuma listene eklendi." : "Okuma listenden çıkarıldı.",
      );
      await route();
      return;
    }
    if (b.hasAttribute("data-category")) {
      category = b.dataset.category;
      page = 0;
      const next = category ? "#category/" + category : "";
      if (location.hash !== next) location.hash = next;
      else await home();
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
        break;
      case "write":
        if (!user) auth();
        else if (!canWrite())
          toast("Yazar yetkisini yalnızca yönetici verebilir.");
        else {
          if (location.hash === "#write") editor();
          else location.hash = "write";
        }
        break;
      case "writers":
        location.hash = "writers";
        break;
      case "discover":
        document.querySelector(".tabs")?.scrollIntoView({ behavior: "smooth" });
        break;
      case "mine":
        location.hash = "mine";
        break;
      case "bookmarks":
        location.hash = "bookmarks";
        break;
      case "edit":
        location.hash = "edit/" + current.id;
        break;
      case "delete":
        modal.innerHTML =
          '<h2>Bu yazı silinsin mi?</h2><p class="sub">Yazı ve yorumları kalıcı olarak silinecek.</p><button class="btn" data-action="confirm-delete">Evet, sil</button> <button class="btn light" data-action="close">Vazgeç</button>';
        modal.showModal();
        break;
      case "confirm-delete":
        await api("/posts/" + current.id, "DELETE");
        modal.close();
        location.hash = "mine";
        toast("Yazı silindi.");
        break;
      case "logout":
        await api("/logout", "POST");
        user = null;
        saved.clear();
        account();
        location.hash = "";
        await home();
        toast("Çıkış yaptın.");
        break;
      case "more":
        page++;
        await home(true);
        break;
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target,
    data = Object.fromEntries(new FormData(f));
  const submit = e.submitter;
  if (submit) submit.disabled = true;
  try {
    if (f.id === "auth-form") {
      if (f.dataset.mode === "register") await api("/register", "POST", data);
      await login(data.email, data.password);
      modal.close();
      await route();
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
      const body = {
        ...data,
        rating: data.rating ? Number(data.rating) : null,
        spoiler: !!data.spoiler,
        published: submit.value === "publish",
      };
      const p = await api(
        "/posts" + (f.dataset.id ? "/" + f.dataset.id : ""),
        f.dataset.id ? "PUT" : "POST",
        body,
      );
      location.hash = "post/" + p.id;
      toast(p.published ? "Yazın yayımlandı." : "Taslağın kaydedildi.");
    } else if (f.id === "comment-form") {
      await api("/posts/" + current.id + "/comments", "POST", data);
      await detail(current.id);
      toast("Yorumun eklendi.");
    }
  } catch (err) {
    const el = f.querySelector(".error");
    if (el) el.textContent = err.message;
    else toast(err.message);
  } finally {
    if (submit) submit.disabled = false;
  }
});
let timer;
$("#search").addEventListener("input", (e) => {
  query = e.target.value;
  page = 0;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (location.hash) location.hash = "";
    else route();
  }, 300);
});
window.addEventListener("hashchange", () => {
  page = 0;
  route();
  window.scrollTo(0, 0);
});
init();
