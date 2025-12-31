# keyshare

短文を期限付きで共有するための最小実装です。Cloudflare Workers と SQLite-backed Durable Objects を使い、作成者だけが削除できるよう deleteToken を発行します。

## 仕様（最小）
- 共有作成: `POST /api/new` で `text` と `ttlSeconds` を受け取り、`viewUrl` と `deleteToken` を返す（削除URLは発行しない）
- 閲覧: `GET /s/:id` で表示とコピー。期限切れは 410、存在しない場合は 404
- 削除: `POST /api/delete` に `id` と `deleteToken` を送ると削除
- `ttlSeconds` は `60..604800` に丸め（未指定は 600）
- `deleteToken` は作成者のみが保持し、共有リンクには含めない

## 使い方（ブラウザ）
- `/` にアクセスして本文と期限を入力し、「共有リンクを作成」を押す
- 表示された共有URLを相手に渡す
- 削除は同じ画面の「削除する」で共有URLまたはIDと削除トークンを入力

## API
### POST /api/new
入力:
```json
{ "text": "hello", "ttlSeconds": 600 }
```
出力:
```json
{ "id": "...", "viewUrl": "...", "deleteToken": "...", "expiresAt": 1700000000000 }
```

### GET /s/:id
HTML で表示とコピー。

### POST /api/delete
入力:
```json
{ "id": "...", "deleteToken": "..." }
```

## データ
`snippets(id, text, expires_at, delete_token, created_at)` を SQLite-backed Durable Object に保存。

## 期限管理
- 既定: Alarm で「次に期限が来る時刻」に起動し期限切れを削除
- GET 時にも期限切れを検出して削除（lazy cleanup）

## 開発
```
wrangler dev
```

## ファイル
- `wrangler.toml`
- `src/index.ts`

## ライセンス
MIT

