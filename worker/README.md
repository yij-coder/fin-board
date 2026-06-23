# 截圖自動辨識後端（Cloudflare Worker）

這個 Worker 接收期貨「未平倉部位」截圖，呼叫 Claude 視覺辨識，回傳結構化 JSON，給追繳試算頁自動帶入。

API 金鑰只放在 Worker（不會出現在網頁），所以不會外洩。

## 你需要
- 一個 Cloudflare 帳號（免費方案就夠）
- 一把 Anthropic API 金鑰（按用量計費，一張截圖大約幾分錢）
  - 申請：<https://console.anthropic.com> → API Keys

## 部署步驟（網頁介面，最簡單）
1. 登入 Cloudflare → 左側 **Workers & Pages** → **Create application** → **Create Worker**。
2. 取個名字（例如 `margin-ocr`）→ **Deploy**。
3. 部署後按 **Edit code**，把整個編輯器內容刪掉，貼上本資料夾的 `worker.js`，再按 **Deploy**。
4. 回到該 Worker 的 **Settings → Variables and Secrets** →
   新增一個 **Secret**：
   - Name：`ANTHROPIC_API_KEY`
   - Value：你的 Anthropic 金鑰（`sk-ant-...`）
   - 存檔。
5. 複製這個 Worker 的網址（像 `https://margin-ocr.你的帳號.workers.dev`）。

## 在 App 設定
打開追繳試算頁 → 切到「多檔部位」→ 在「📷 截圖自動辨識」欄位貼上上面的 Worker 網址。
之後按「📷 上傳截圖自動帶入」選一張部位截圖，就會自動填入各檔，再核對數字即可。

## 用 wrangler 部署（進階，選用）
```bash
npm i -g wrangler
wrangler login
wrangler deploy worker.js --name margin-ocr --compatibility-date 2024-01-01
wrangler secret put ANTHROPIC_API_KEY   # 貼上金鑰
```

## 費用與備註
- 預設模型 `claude-opus-4-8`（準度高）。想更省可在 `worker.js` 把 `MODEL` 改成 `claude-haiku-4-5`。
- 辨識仍可能有誤，帶入後請務必核對口數、均價、市價。
