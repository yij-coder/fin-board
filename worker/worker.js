// Cloudflare Worker：接收期貨部位截圖，呼叫 Claude 視覺辨識，回傳結構化 JSON
// 部署後把 Worker 網址貼到追繳試算頁的「截圖自動辨識」欄位。
// 需設定環境變數（Secret）：ANTHROPIC_API_KEY

const MODEL = "claude-opus-4-8"; // 想省錢可改 "claude-haiku-4-5"

const PROMPT =
  "You are extracting a Taiwan futures broker open-positions table (未平倉部位) " +
  "from a screenshot. Return every position row. For each row extract: " +
  "name (商品名稱, e.g. 聯電期07), side (\"buy\" for 買進, \"sell\" for 賣出), " +
  "lots (口數, integer), avg (成交均價, number), mkt (市價/市場價, number). " +
  "Numbers must be plain numbers with no commas or units. If a cell is unreadable use 0. " +
  "Only include actual position rows, not totals or headers.";

const SCHEMA = {
  type: "object",
  properties: {
    positions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          side: { type: "string", enum: ["buy", "sell"] },
          lots: { type: "number" },
          avg: { type: "number" },
          mkt: { type: "number" },
        },
        required: ["name", "side", "lots", "avg", "mkt"],
        additionalProperties: false,
      },
    },
  },
  required: ["positions"],
  additionalProperties: false,
};

// 股票融資/融券 整戶擔保維持率畫面
const MARGIN_PROMPT =
  "You are extracting a Taiwan stock margin (融資/融券) whole-account " +
  "collateral-maintenance screen from a screenshot. Return these aggregate totals " +
  "as plain numbers (no commas or units; use 0 if a value is absent): " +
  "fin_collateral (融資擔保品市值), fin_loan (融資總額 or 融資金額), " +
  "short_collateral (融券擔保品市值), short_amount (融券總額 or 融券保證金), " +
  "pledge (抵繳保證品市值/抵繳金額). " +
  "Prefer the whole-account (整戶/合計/小計) figures when shown; if the screen only " +
  "lists per-stock rows, sum the relevant columns into these totals.";

const MARGIN_SCHEMA = {
  type: "object",
  properties: {
    fin_collateral: { type: "number" },
    fin_loan: { type: "number" },
    short_collateral: { type: "number" },
    short_amount: { type: "number" },
    pledge: { type: "number" },
  },
  required: ["fin_collateral", "fin_loan", "short_collateral", "short_amount", "pledge"],
  additionalProperties: false,
};

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return new Response("POST only", { status: 405, headers: cors });

    try {
      const { image, media_type, kind } = await request.json();
      if (!image)
        return json({ error: "missing image" }, 400, cors);
      const isMargin = kind === "margin";
      const prompt = isMargin ? MARGIN_PROMPT : PROMPT;
      const schema = isMargin ? MARGIN_SCHEMA : SCHEMA;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: media_type || "image/png",
                    data: image,
                  },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
          output_config: { format: { type: "json_schema", schema: schema } },
        }),
      });

      const data = await resp.json();
      if (data.type === "error")
        return json({ error: data.error?.message || "api error" }, 502, cors);

      const text = (data.content || []).find((b) => b.type === "text")?.text || "{}";
      // text 已是符合 SCHEMA 的 JSON 字串
      return new Response(text, {
        headers: { ...cors, "content-type": "application/json" },
      });
    } catch (e) {
      return json({ error: String(e) }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
