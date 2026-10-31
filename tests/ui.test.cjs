const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../src/main/resources/static");
const code = fs
  .readFileSync(path.join(root, "app.js"), "utf8")
  .replace(/init\(\);\s*$/, "");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const writer = {
  id: "writer",
  name: "Test Yazar",
  email: "writer@example.test",
  role: "WRITER",
};
const reader = {
  id: "reader",
  name: "Test Okur",
  email: "reader@example.test",
  role: "READER",
};
const sample = {
  id: "post-one",
  author_id: "writer",
  author_name: "Test Yazar",
  title: "Deneme yazısı",
  summary: "Kısa özet",
  body: "İçerik metni",
  category: "BLOG",
  work_title: "",
  rating: null,
  spoiler: false,
  published: true,
  created_at: "2026-10-28T08:00:00Z",
};
const tick = () => new Promise((r) => setImmediate(r));
async function settle() {
  await tick();
  await tick();
}
function setup(t) {
  const dom = new JSDOM(html, {
      url: "http://localhost:8080/",
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.fetch = async () => new Response(null, { status: 204 });
  w.eval(
    code +
      `;window.check={realApi:api,route,navigate,editor,detail,home,accountPage,feedPath,init,setUser:u=>{user=u;account()},setApi:f=>{api=f},getPage:()=>page,isSaved:id=>saved.has(id)};`,
  );
  w.check.setApi(async (url) =>
    url === "/csrf"
      ? { header: "X-CSRF-TOKEN", token: "test" }
      : url.includes("/comments")
        ? []
        : url.startsWith("/posts/")
          ? { ...sample }
          : [],
  );
  w.check.setUser(null);
  t.after(() => w.close());
  return { w, h: w.check, d: w.document };
}
function fillEditor(d) {
  d.querySelector("[name=title]").value = "Yeni başlık";
  d.querySelector("[name=summary]").value = "Yeni özet";
  d.querySelector("[name=body]").value = "Yeni içerik";
}
function submit(w, form, button) {
  form.dispatchEvent(
    new w.SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
      ...(button ? { submitter: button } : {}),
    }),
  );
}

test("Üst ve alt Satır logosu aynı sayfadayken bile aramayı temizler", async (t) => {
  const { h, d, w } = setup(t);
  await h.navigate("search?q=bulunmayan");
  assert.equal(d.querySelector("#search").value, "bulunmayan");
  d.querySelector("header .logo").click();
  await settle();
  assert.equal(w.location.hash, "");
  assert.equal(d.querySelector("#search").value, "");
  assert.ok(d.querySelector(".hero"));
  await h.navigate("category/HISTORY?q=tarih");
  d.querySelector("footer .logo").click();
  await settle();
  assert.equal(w.location.hash, "");
  assert.equal(d.querySelector("#search").value, "");
});
test("Altı kategori düğmesi doğru adrese ve API filtresine gider", async (t) => {
  const { h, d, w } = setup(t),
    calls = [];
  h.setApi(async (url) => {
    calls.push(url);
    return [];
  });
  await h.route();
  for (const cat of ["BLOG", "FILM", "SERIES", "HISTORY", "TECH", "SPORT"]) {
    d.querySelector(`[data-category="${cat}"]`).click();
    await settle();
    assert.equal(w.location.hash, "#category/" + cat);
    assert.ok(calls.at(-1).includes("category=" + cat));
    assert.equal(
      d.querySelector(`[data-category="${cat}"]`).getAttribute("aria-pressed"),
      "true",
    );
  }
});
test("Arama kategori içinde kalır ve temizleme düğmesi çalışır", async (t) => {
  const { h, d, w } = setup(t);
  await h.navigate("category/TECH?q=telefon");
  assert.equal(d.querySelector("#search").value, "telefon");
  d.querySelector("[data-action=clear-search]").click();
  await settle();
  assert.equal(w.location.hash, "#category/TECH");
  assert.equal(d.querySelector("#search").value, "");
});
test("Logo, bekleyen arama zamanlayıcısının ana sayfayı geri değiştirmesini engeller", async (t) => {
  const { h, d, w } = setup(t);
  await h.route();
  const search = d.querySelector("#search");
  search.value = "eski sorgu";
  search.dispatchEvent(new w.Event("input"));
  d.querySelector("header .logo").click();
  await new Promise((r) => setTimeout(r, 360));
  assert.equal(w.location.hash, "");
  assert.equal(search.value, "");
});
test("Kaydet/kaldır yorum taslağını korur ve düğmenin durumunu günceller", async (t) => {
  const { h, d } = setup(t);
  h.setUser(reader);
  await h.navigate("post/post-one");
  const field = d.querySelector("#comment-form textarea");
  field.value = "Göndermediğim yorum";
  const button = d.querySelector("[data-save]");
  button.click();
  await settle();
  assert.equal(field.value, "Göndermediğim yorum");
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.ok(h.isSaved("post-one"));
  button.click();
  await settle();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(field.value, "Göndermediğim yorum");
});
test("Taslak kartında çalışmayan kaydet düğmesi gösterilmez", async (t) => {
  const { h, d } = setup(t);
  h.setUser(writer);
  h.setApi(async () => [{ ...sample, published: false }]);
  await h.navigate("mine");
  assert.equal(d.querySelectorAll("[data-save]").length, 0);
});
test("Film ve dizi alanları yalnız ilgili kategorilerde görünür ve zorunludur", (t) => {
  const { h, d, w } = setup(t);
  h.setUser(writer);
  h.editor();
  const f = d.querySelector("#editor-form");
  assert.equal(f.elements.workTitle.required, false);
  assert.equal(f.querySelector("[data-review-field]").hidden, true);
  for (const c of ["FILM", "SERIES"]) {
    f.elements.category.value = c;
    f.elements.category.dispatchEvent(new w.Event("change", { bubbles: true }));
    assert.equal(f.elements.rating.required, true);
    assert.equal(f.querySelector("[data-review-field]").hidden, false);
  }
  f.elements.category.value = "HISTORY";
  f.elements.category.dispatchEvent(new w.Event("change", { bubbles: true }));
  assert.equal(f.elements.rating.required, false);
});
test("Düzenlenen aynı yazı yayımlandıktan sonra yeni içerikle açılır", async (t) => {
  const { h, d, w } = setup(t);
  h.setUser(writer);
  let post = { ...sample };
  h.setApi(async (url, method, data) => {
    if (method === "PUT") {
      post = { ...post, ...data };
      return post;
    }
    return url.endsWith("/comments") ? [] : post;
  });
  await h.navigate("edit/post-one");
  fillEditor(d);
  submit(
    w,
    d.querySelector("#editor-form"),
    d.querySelector("button[value=publish]"),
  );
  await settle();
  assert.equal(w.location.hash, "#post/post-one");
  assert.equal(d.querySelector(".article h1").textContent, "Yeni başlık");
  assert.equal(d.querySelector(".body").textContent, "Yeni içerik");
});
test("Enter ile gönderim taslak olarak kaydeder, boş submitter hata üretmez", async (t) => {
  const { h, d, w } = setup(t);
  h.setUser(writer);
  let payload;
  h.setApi(async (url, method, data) => {
    if (method === "POST") {
      payload = data;
      return { ...sample, ...data };
    }
    return url.endsWith("/comments") ? [] : { ...sample, ...payload };
  });
  await h.navigate("write");
  fillEditor(d);
  submit(w, d.querySelector("#editor-form"));
  await settle();
  assert.equal(payload.published, false);
  assert.equal(w.location.hash, "#post/post-one");
});
test("Doğrudan korumalı adresler eski sayfayı bırakmaz ve okuyucu editöre giremez", async (t) => {
  const { h, d } = setup(t);
  await h.navigate("mine");
  assert.ok(d.querySelector("[data-action=login]"));
  assert.equal(d.querySelector("#editor-form"), null);
  h.setUser(reader);
  await h.navigate("write");
  assert.match(d.querySelector("#app").textContent, /yalnızca yönetici/);
  assert.equal(d.querySelector("#editor-form"), null);
  await h.navigate("writers");
  assert.match(d.querySelector("#app").textContent, /yalnızca yöneticiye/);
});
test("Yazar başka bir yazarın içeriğini düzenleyen formu göremez", (t) => {
  const { h, d } = setup(t);
  h.setUser(writer);
  h.editor({ ...sample, author_id: "someone-else" });
  assert.equal(d.querySelector("#editor-form"), null);
  assert.match(d.querySelector("#app").textContent, /kendi yazılarını/);
});
test("Yavaş eski API yanıtı son açılan sayfanın üzerine yazamaz", async (t) => {
  const { h, d } = setup(t);
  let resolve;
  h.setApi(() => new Promise((r) => (resolve = r)));
  const old = h.navigate("category/BLOG");
  await tick();
  await h.navigate("about");
  resolve([]);
  await old;
  assert.match(d.title, /Satır hakkında/);
  assert.ok(d.querySelector(".info-page"));
});
test("Yorum gönderimi yalnız yorum alanını yeniler ve formu temizler", async (t) => {
  const { h, d, w } = setup(t);
  h.setUser(reader);
  let added = false;
  h.setApi(async (url, method) => {
    if (method === "POST") {
      added = true;
      return null;
    }
    return url.endsWith("/comments")
      ? added
        ? [
            {
              author_name: "Okur",
              body: "Yeni yorum",
              created_at: sample.created_at,
            },
          ]
        : []
      : sample;
  });
  await h.navigate("post/post-one");
  const f = d.querySelector("#comment-form"),
    body = f.elements.body;
  body.value = "Yeni yorum";
  submit(w, f, f.querySelector("button"));
  await settle();
  assert.equal(d.querySelector("#comment-form"), f);
  assert.equal(body.value, "");
  assert.match(d.querySelector("#comments").textContent, /Yeni yorum/);
  assert.match(d.querySelector("#comment-count").textContent, /1 yorum/);
});
test("Çift tıklama iki kaydetme isteği üretmez", async (t) => {
  const { h, d } = setup(t);
  h.setUser(reader);
  await h.navigate("post/post-one");
  let calls = 0,
    resolve;
  h.setApi(() => {
    calls++;
    return new Promise((r) => (resolve = r));
  });
  const b = d.querySelector("[data-save]");
  b.click();
  b.click();
  assert.equal(calls, 1);
  resolve(null);
  await settle();
  assert.equal(b.disabled, false);
});
test("Oturumsuz kaydetme girişten sonra istenen yazıyı kaydeder", async (t) => {
  const { h, d, w } = setup(t);
  let puts = 0;
  h.setApi(async (url, method) => {
    if (method === "PUT") {
      puts++;
      return null;
    }
    if (url === "/me") return reader;
    if (url === "/csrf") return { header: "X-CSRF-TOKEN", token: "x" };
    return url === "/bookmarks" || url.endsWith("/comments") ? [] : sample;
  });
  await h.navigate("post/post-one");
  d.querySelector("[data-save]").click();
  await settle();
  assert.equal(d.querySelector("#modal").open, true);
  const f = d.querySelector("#auth-form");
  f.elements.email.value = "reader@example.test";
  f.elements.password.value = "example-password";
  submit(w, f, f.querySelector("button"));
  await settle();
  assert.equal(puts, 1);
  assert.ok(h.isSaved("post-one"));
  assert.equal(d.querySelector("#modal").open, false);
});
test("Hesap adı hesap sayfasını açar, çıkış açık bir düğmeyle yapılır", async (t) => {
  const { h, d, w } = setup(t);
  h.setUser(reader);
  await h.route();
  d.querySelector("[data-action=account]").click();
  await settle();
  assert.equal(w.location.hash, "#account");
  assert.match(d.querySelector("#app").textContent, /reader@example.test/);
  d.querySelector("#app [data-action=logout]").click();
  await settle();
  assert.equal(w.location.hash, "");
  assert.ok(d.querySelector("#account [data-action=login]"));
});
test("Başarısız sayfalama sayfa numarasını atlamaz", async (t) => {
  const { h, d } = setup(t);
  const posts = Array.from({ length: 20 }, (_, i) => ({
    ...sample,
    id: "id" + i,
  }));
  let fail = true,
    nextCalls = [];
  h.setApi(async (url) => {
    if (url.includes("page=1")) {
      nextCalls.push(url);
      if (fail) throw Error("Ağ hatası");
      return [];
    }
    return posts;
  });
  await h.route();
  d.querySelector("[data-action=more]").click();
  await settle();
  assert.equal(h.getPage(), 0);
  fail = false;
  d.querySelector("[data-action=more]").click();
  await settle();
  assert.equal(h.getPage(), 1);
  assert.equal(nextCalls.length, 2);
  assert.equal(d.querySelectorAll(".post-card").length, 20);
});
test("Bilinmeyen adres hata sayfasından ana sayfaya dönebilir", async (t) => {
  const { h, d, w } = setup(t);
  await h.navigate("not-a-page");
  assert.match(
    d.querySelector("#app").textContent,
    /Aradığın sayfa bulunamadı/,
  );
  d.querySelector('#app a[href="#"]').click();
  await settle();
  assert.equal(w.location.hash, "");
  assert.ok(d.querySelector(".hero"));
});

test("Süresi biten oturum arayüzde giriş düğmesini geri getirir", async (t) => {
  const { h, d, w } = setup(t);
  h.setUser(writer);
  w.fetch = async () =>
    new Response("{}", {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  await assert.rejects(h.realApi("/mine"), /giriş yap/);
  assert.ok(d.querySelector("#account [data-action=login]"));
  assert.equal(d.querySelector("#account [data-action=write]"), null);
});

test("Bağlantı hatasındaki Yeniden dene düğmesi başarılı yüklemeyi geri getirir", async (t) => {
  const { h, d } = setup(t);
  let failed = true;
  h.setApi(async (url) => {
    if (failed) throw Error("Sunucuya bağlanılamadı.");
    return url === "/me" ? {} : [];
  });
  await h.init();
  assert.ok(d.querySelector("[data-action=retry]"));
  failed = false;
  d.querySelector("[data-action=retry]").click();
  await settle();
  assert.ok(d.querySelector(".hero"));
  assert.equal(d.querySelector("[data-action=retry]"), null);
});

test("Eski sayfalama isteğinin hatası yeni sayfanın numarasını değiştirmez", async (t) => {
  const { h, d } = setup(t);
  const posts = Array.from({ length: 20 }, (_, i) => ({
    ...sample,
    id: "id" + i,
  }));
  let rejectOld;
  h.setApi(async (url) =>
    url.includes("page=1")
      ? new Promise((resolve, reject) => (rejectOld = reject))
      : posts,
  );
  await h.route();
  d.querySelector("[data-action=more]").click();
  await tick();
  await h.navigate("category/TECH");
  assert.equal(h.getPage(), 0);
  rejectOld(Error("Önceki isteğin bağlantısı kesildi"));
  await settle();
  assert.equal(h.getPage(), 0);
  assert.match(d.title, /Teknoloji/);
});

test("Okumaya devam et yalnız başka yayımlanmış yazıları gösterir ve başlıkları güvenle işler", async (t) => {
  const { h, d } = setup(t);
  h.setApi(async (url) => {
    if (url.includes("/comments")) return [];
    if (url.startsWith("/posts?"))
      return [
        sample,
        { ...sample, id: "next", title: "<img src=x onerror=alert(1)>" },
        { ...sample, id: "draft", published: false },
      ];
    return sample;
  });
  await h.navigate("post/post-one");
  await settle();
  const box = d.querySelector("#related-posts");
  assert.equal(box.hidden, false);
  assert.equal(box.querySelectorAll("a").length, 1);
  assert.equal(box.querySelector("a").getAttribute("href"), "#post/next");
  assert.equal(box.querySelector("img"), null);
  assert.match(box.textContent, /<img/);
});
test("Yavaş ilgili yazılar yanıtı yeni sayfayı değiştirmez", async (t) => {
  const { h, d } = setup(t);
  let complete;
  h.setApi(async (url) => {
    if (url.includes("/comments")) return [];
    if (url.startsWith("/posts?"))
      return new Promise((resolve) => {
        complete = resolve;
      });
    return sample;
  });
  await h.navigate("post/post-one");
  await h.navigate("about");
  complete([{ ...sample, id: "next" }]);
  await settle();
  assert.match(d.title, /Satır hakkında/);
  assert.equal(d.querySelector("#related-posts"), null);
});
test("İlgili yazılar bağlantısı çalışmasa da ana yazı ve yorumlar okunabilir", async (t) => {
  const { h, d } = setup(t);
  h.setApi(async (url) => {
    if (url.includes("/comments")) return [];
    if (url.startsWith("/posts?")) throw Error("Bağlantı hatası");
    return sample;
  });
  await h.navigate("post/post-one");
  await settle();
  assert.equal(d.querySelector(".article h1").textContent, sample.title);
  assert.ok(d.querySelector("#comment-count"));
  assert.equal(d.querySelector("#related-posts").hidden, true);
});
