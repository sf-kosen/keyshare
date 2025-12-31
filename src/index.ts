import { DurableObject } from "cloudflare:workers";

export interface Env {
  STORE: DurableObjectNamespace;
}

const TEXT_LIMIT = 10000;
const TTL_DEFAULT = 600;
const TTL_MIN = 60;
const TTL_MAX = 7 * 86400;

function clampTtl(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return TTL_DEFAULT;
  const ttl = Math.floor(num);
  if (ttl < TTL_MIN) return TTL_MIN;
  if (ttl > TTL_MAX) return TTL_MAX;
  return ttl;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function renderHomePage(): Response {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>keyshare</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: light;
      --ink: #1c1c1a;
      --muted: #5e5e58;
      --accent: #1f7a5a;
      --accent-2: #f2a65a;
      --bg: #faf7f1;
      --card: #ffffff;
      --stroke: #e4e0d7;
      --shadow: 0 22px 50px rgba(30, 30, 25, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Zen Kaku Gothic New", "BIZ UDPGothic", "Hiragino Kaku Gothic ProN", sans-serif;
      color: var(--ink);
      background: radial-gradient(circle at 10% 10%, #e9f5ef 0%, transparent 45%),
        radial-gradient(circle at 90% 0%, #fff1de 0%, transparent 48%),
        var(--bg);
      min-height: 100vh;
    }
    body::before {
      content: "";
      position: fixed;
      top: -120px;
      right: -80px;
      width: 260px;
      height: 260px;
      background: rgba(242, 166, 90, 0.25);
      filter: blur(0);
      border-radius: 50%;
      z-index: -1;
    }
    main {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 20px 64px;
    }
    header {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 28px;
      animation: rise 0.6s ease;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 12px;
      color: var(--accent);
      font-weight: 600;
    }
    h1 {
      font-size: clamp(28px, 4vw, 38px);
      margin: 0;
    }
    .lead {
      color: var(--muted);
      margin: 0;
      font-size: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      margin-bottom: 18px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--stroke);
      border-radius: 16px;
      padding: 20px;
      box-shadow: var(--shadow);
      animation: rise 0.6s ease;
    }
    .card h2 {
      margin: 0 0 12px;
      font-size: 18px;
    }
    label {
      display: block;
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 6px;
    }
    textarea,
    input,
    select {
      width: 100%;
      padding: 12px 12px;
      border-radius: 12px;
      border: 1px solid var(--stroke);
      background: #fff;
      font-family: inherit;
      font-size: 15px;
    }
    textarea {
      min-height: 150px;
      resize: vertical;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: end;
      margin-top: 12px;
    }
    button {
      border: none;
      border-radius: 12px;
      padding: 12px 16px;
      font-weight: 600;
      background: var(--accent);
      color: #fff;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    button:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(31, 122, 90, 0.25); }
    button.secondary { background: #3b3b33; }
    .status {
      min-height: 1.2em;
      margin-top: 10px;
      color: var(--accent);
      font-size: 14px;
    }
    .status[data-state="error"] { color: #b6402c; }
    .output {
      display: grid;
      gap: 10px;
    }
    .output input {
      background: #fdfcf9;
    }
    .output .copy-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
    }
    .note {
      font-size: 13px;
      color: var(--muted);
      background: #fff6e6;
      border-radius: 10px;
      padding: 10px 12px;
      border: 1px dashed #f0d4a7;
    }
    .danger {
      border: 1px solid #f0c1b6;
    }
    .danger h2 {
      color: #b6402c;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 720px) {
      .row { grid-template-columns: 1fr; }
      button { width: 100%; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">Keyshare</div>
      <h1>短文を、かんたんに共有</h1>
      <p class="lead">URLで渡すだけ。削除は作成者だけができる設計です。</p>
    </header>

    <section class="grid">
      <div class="card">
        <h2>共有を作る</h2>
        <form id="create-form">
          <label for="text">本文</label>
          <textarea id="text" name="text" maxlength="10000" placeholder="ここに共有したい内容を入力"></textarea>
          <div class="row">
            <div>
              <label for="ttl">期限</label>
              <select id="ttl" name="ttl">
                <option value="600" selected>10分</option>
                <option value="3600">1時間</option>
                <option value="86400">1日</option>
                <option value="604800">7日</option>
              </select>
            </div>
            <button type="submit" id="create-btn">共有リンクを作成</button>
          </div>
        </form>
        <div id="create-status" class="status"></div>
      </div>

      <div class="card output" id="output" hidden>
        <h2>共有リンク</h2>
        <div class="copy-row">
          <input id="share-url" readonly />
          <button type="button" class="secondary" id="copy-share">コピー</button>
        </div>
        <h2>削除トークン</h2>
        <div class="copy-row">
          <input id="delete-token-value" readonly />
          <button type="button" class="secondary" id="copy-delete">コピー</button>
        </div>
        <div class="note">削除トークンは作成者だけが保管してください。共有リンクには含めないでください。</div>
      </div>
    </section>

    <section class="card danger">
      <h2>削除する</h2>
      <form id="delete-form">
        <label for="delete-id">ID</label>
        <input id="delete-id" name="delete-id" placeholder="共有URLまたはID" />
        <label for="delete-token-input">削除トークン</label>
        <input id="delete-token-input" name="delete-token" placeholder="共有作成時の削除トークン" />
        <div class="row">
          <span class="note">IDと削除トークンが一致すると削除されます。</span>
          <button type="submit">削除する</button>
        </div>
      </form>
      <div id="delete-status" class="status"></div>
    </section>
  </main>

  <script>
    const createForm = document.getElementById("create-form");
    const deleteForm = document.getElementById("delete-form");
    const createStatus = document.getElementById("create-status");
    const deleteStatus = document.getElementById("delete-status");
    const output = document.getElementById("output");
    const shareUrl = document.getElementById("share-url");
    const deleteTokenValue = document.getElementById("delete-token-value");
    const deleteIdInput = document.getElementById("delete-id");
    const deleteTokenInput = document.getElementById("delete-token-input");
    const createBtn = document.getElementById("create-btn");

    function setStatus(el, message, ok) {
      if (!el) return;
      el.textContent = message || "";
      el.dataset.state = ok ? "ok" : "error";
    }

    async function copyText(value) {
      if (!value) return false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
        } else {
          const temp = document.createElement("textarea");
          temp.value = value;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand("copy");
          temp.remove();
        }
        return true;
      } catch {
        return false;
      }
    }

    document.getElementById("copy-share").addEventListener("click", async () => {
      const ok = await copyText(shareUrl.value);
      setStatus(createStatus, ok ? "共有リンクをコピーしました。" : "コピーに失敗しました。", ok);
    });

    document.getElementById("copy-delete").addEventListener("click", async () => {
      const ok = await copyText(deleteTokenValue.value);
      setStatus(createStatus, ok ? "削除トークンをコピーしました。" : "コピーに失敗しました。", ok);
    });

    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = document.getElementById("text").value.trim();
      const ttl = Number(document.getElementById("ttl").value);
      if (!text) {
        setStatus(createStatus, "本文を入力してください。", false);
        return;
      }

      setStatus(createStatus, "作成中...", true);
      createBtn.disabled = true;

      try {
        const res = await fetch("/api/new", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: text, ttlSeconds: ttl })
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const message = payload && payload.error ? payload.error : "作成に失敗しました。";
          setStatus(createStatus, message, false);
          return;
        }

        shareUrl.value = payload.viewUrl || "";
        deleteTokenValue.value = payload.deleteToken || "";
        deleteIdInput.value = payload.id || "";
        deleteTokenInput.value = payload.deleteToken || "";
        output.hidden = false;
        setStatus(createStatus, "共有リンクを作成しました。", true);
      } catch {
        setStatus(createStatus, "通信に失敗しました。", false);
      } finally {
        createBtn.disabled = false;
      }
    });

    deleteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      let id = deleteIdInput.value.trim();
      const token = deleteTokenInput.value.trim();
      if (id.includes("/s/")) {
        try {
          const parsed = new URL(id);
          const candidate = parsed.pathname.split("/s/")[1];
          if (candidate) {
            id = candidate;
          }
        } catch {
          // ignore parse errors and use the raw input
        }
      }
      if (!id || !token) {
        setStatus(deleteStatus, "IDと削除トークンを入力してください。", false);
        return;
      }

      setStatus(deleteStatus, "削除中...", true);

      try {
        const res = await fetch("/api/delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: id, deleteToken: token })
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const message = payload && payload.error ? payload.error : "削除に失敗しました。";
          setStatus(deleteStatus, message, false);
          return;
        }
        setStatus(deleteStatus, "削除しました。", true);
      } catch {
        setStatus(deleteStatus, "通信に失敗しました。", false);
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function renderSharePage(text: string, expiresAt: number): Response {
  const safeText = escapeHtml(text);
  const expiresLabel = new Date(expiresAt).toLocaleString("ja-JP");
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>共有メモ</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: light;
      --ink: #1c1c1a;
      --muted: #5e5e58;
      --accent: #1f7a5a;
      --bg: #faf7f1;
      --card: #ffffff;
      --stroke: #e4e0d7;
      --shadow: 0 18px 36px rgba(30, 30, 25, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Zen Kaku Gothic New", "BIZ UDPGothic", "Hiragino Kaku Gothic ProN", sans-serif;
      color: var(--ink);
      background: radial-gradient(circle at 10% 10%, #e9f5ef 0%, transparent 45%), var(--bg);
      min-height: 100vh;
    }
    .wrap {
      max-width: 760px;
      margin: 48px auto;
      padding: 0 20px;
    }
    h1 { font-size: 22px; margin: 0 0 12px; }
    pre {
      background: var(--card);
      border: 1px solid var(--stroke);
      border-radius: 14px;
      padding: 16px;
      white-space: pre-wrap;
      word-break: break-word;
      box-shadow: var(--shadow);
    }
    button {
      padding: 10px 16px;
      border-radius: 10px;
      border: none;
      background: var(--accent);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
    small { display: block; margin-top: 12px; color: var(--muted); }
    #status { margin-top: 8px; color: var(--accent); min-height: 1em; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>共有された内容</h1>
    <pre id="text">${safeText}</pre>
    <button id="copy">コピー</button>
    <div id="status"></div>
    <small>期限: ${expiresLabel}</small>
  </div>
  <script>
    const button = document.getElementById("copy");
    const status = document.getElementById("status");
    const textEl = document.getElementById("text");

    button.addEventListener("click", async () => {
      const value = textEl.innerText;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
        } else {
          const temp = document.createElement("textarea");
          temp.value = value;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand("copy");
          temp.remove();
        }
        status.textContent = "コピーしました。";
      } catch {
        status.textContent = "コピーに失敗しました。";
      }
      setTimeout(() => { status.textContent = ""; }, 2000);
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function renderErrorPage(title: string, message: string, status: number): Response {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: light;
      --ink: #1c1c1a;
      --muted: #5e5e58;
      --bg: #faf7f1;
      --card: #ffffff;
      --stroke: #e4e0d7;
      --shadow: 0 18px 36px rgba(30, 30, 25, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Zen Kaku Gothic New", "BIZ UDPGothic", "Hiragino Kaku Gothic ProN", sans-serif;
      color: var(--ink);
      background: radial-gradient(circle at 10% 10%, #e9f5ef 0%, transparent 45%), var(--bg);
      min-height: 100vh;
    }
    .wrap { max-width: 760px; margin: 48px auto; padding: 0 20px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p {
      background: var(--card);
      border: 1px solid var(--stroke);
      border-radius: 14px;
      padding: 16px;
      box-shadow: var(--shadow);
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function methodNotAllowed(): Response {
  return new Response("Method not allowed", { status: 405 });
}

async function handleNew(request: Request, env: Env, origin: string): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();

  let data: any;
  try {
    data = await request.json();
  } catch {
    return errorResponse("JSONが不正です", 400);
  }

  const text = typeof data?.text === "string" ? data.text : "";
  if (!text.trim()) return errorResponse("本文が必要です", 400);
  if (text.length > TEXT_LIMIT) return errorResponse("本文が長すぎます", 400);

  const ttlSeconds = clampTtl(data?.ttlSeconds);
  const id = crypto.randomUUID();
  const deleteToken = crypto.randomUUID();

  const stub = env.STORE.get(env.STORE.idFromName("primary"));
  const createRes = await stub.fetch("https://store/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, text, ttlSeconds, deleteToken }),
  });

  if (!createRes.ok) {
    const message = await createRes.text();
    return new Response(message || "作成に失敗しました", { status: createRes.status });
  }

  const payload = await createRes.json();
  return jsonResponse({
    id,
    viewUrl: `${origin}/s/${id}`,
    deleteToken,
    expiresAt: payload.expiresAt,
  });
}

async function handleDelete(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();

  let data: any;
  try {
    data = await request.json();
  } catch {
    return errorResponse("JSONが不正です", 400);
  }

  const id = typeof data?.id === "string" ? data.id : "";
  const deleteToken = typeof data?.deleteToken === "string" ? data.deleteToken : "";
  if (!id || !deleteToken) return errorResponse("IDと削除トークンが必要です", 400);

  const stub = env.STORE.get(env.STORE.idFromName("primary"));
  const res = await stub.fetch("https://store/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, deleteToken }),
  });

  if (!res.ok) {
    const message = await res.text();
    return new Response(message || "削除に失敗しました", { status: res.status });
  }

  return jsonResponse({ ok: true });
}

async function handleShare(request: Request, env: Env, id: string): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed();
  if (!id) return renderErrorPage("見つかりません", "指定の共有は見つかりませんでした。", 404);

  const stub = env.STORE.get(env.STORE.idFromName("primary"));
  const res = await stub.fetch(`https://store/get?id=${encodeURIComponent(id)}`);

  if (res.status === 404) {
    return renderErrorPage("見つかりません", "指定の共有は見つかりませんでした。", 404);
  }
  if (res.status === 410) {
    return renderErrorPage("期限切れ", "この共有は期限切れです。", 410);
  }
  if (!res.ok) {
    return renderErrorPage("エラー", "読み込みに失敗しました。", 500);
  }

  const payload = await res.json();
  return renderSharePage(payload.text, payload.expiresAt);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return renderHomePage();
    }

    if (url.pathname === "/api/new") {
      return handleNew(request, env, url.origin);
    }

    if (url.pathname === "/api/delete") {
      return handleDelete(request, env);
    }

    if (url.pathname.startsWith("/s/")) {
      const id = decodeURIComponent(url.pathname.slice(3));
      return handleShare(request, env, id);
    }

    return new Response("Not found", { status: 404 });
  },
};

export class KeyshareStore extends DurableObject<Env> {
  private sql: any;
  private init: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.init = this.ensureSchema();
  }

  private async ensureSchema(): Promise<void> {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        delete_token TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_expires ON snippets(expires_at);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    await this.init;
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/create") {
      const data = await request.json();
      const id = typeof data?.id === "string" ? data.id : "";
      const text = typeof data?.text === "string" ? data.text : "";
      const deleteToken = typeof data?.deleteToken === "string" ? data.deleteToken : "";
      const ttlSeconds = clampTtl(data?.ttlSeconds);
      if (!id || !text || !deleteToken) return new Response("入力が不正です", { status: 400 });

      const now = Date.now();
      const expiresAt = now + ttlSeconds * 1000;

      this.sql.exec(
        "INSERT INTO snippets (id, text, expires_at, delete_token, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        id,
        text,
        expiresAt,
        deleteToken,
        now
      );

      await this.rescheduleAlarm();
      return jsonResponse({ ok: true, expiresAt });
    }

    if (request.method === "GET" && url.pathname === "/get") {
      const id = url.searchParams.get("id") || "";
      if (!id) return new Response("見つかりません", { status: 404 });

      const row = this.sql.exec(
        "SELECT text, expires_at FROM snippets WHERE id = ?1",
        id
      ).toArray()[0];

      if (!row) return new Response("見つかりません", { status: 404 });

      const now = Date.now();
      if (row.expires_at <= now) {
        this.sql.exec("DELETE FROM snippets WHERE id = ?1", id);
        await this.rescheduleAlarm();
        return new Response("期限切れ", { status: 410 });
      }

      return jsonResponse({ text: row.text, expiresAt: row.expires_at });
    }

    if (request.method === "POST" && url.pathname === "/delete") {
      const data = await request.json();
      const id = typeof data?.id === "string" ? data.id : "";
      const deleteToken = typeof data?.deleteToken === "string" ? data.deleteToken : "";
      if (!id || !deleteToken) return new Response("入力が不正です", { status: 400 });

      const row = this.sql.exec(
        "SELECT delete_token FROM snippets WHERE id = ?1",
        id
      ).toArray()[0];

      if (!row) return new Response("見つかりません", { status: 404 });
      if (row.delete_token !== deleteToken) return new Response("削除トークンが違います", { status: 403 });

      this.sql.exec("DELETE FROM snippets WHERE id = ?1", id);
      await this.rescheduleAlarm();
      return jsonResponse({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.init;
    const now = Date.now();
    this.sql.exec("DELETE FROM snippets WHERE expires_at <= ?1", now);
    await this.rescheduleAlarm();
  }

  private async rescheduleAlarm(): Promise<void> {
    const next = this.sql.exec(
      "SELECT MIN(expires_at) AS t FROM snippets"
    ).toArray()[0]?.t;

    if (next) {
      await this.ctx.storage.setAlarm(Number(next));
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }
}

