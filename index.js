// ゼロヨンバトル みんなのランキング（ベスト10）
// GET  /top    → ランキングを返す
// POST /submit → 走りを登録して、ベスト10に入ったら順位を返す
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { ...CORS, "Content-Type": "application/json" } });

// 送られてきた走りが本物らしいか確かめる（ありえない記録ははじく）
function check(e) {
  if (!e || typeof e !== "object") return null;
  const n = String(e.n || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const f = Number(e.f);
  if (!n || !isFinite(f) || f < 6 || f > 30) return null;
  const m = e.m === "I" || e.m === "A" ? e.m : e.m === "H" ? "H" : null;
  if (!m) return null;
  const s = Array.isArray(e.s) ? e.s.slice(0, 400).map(x => Math.round(Number(x))) : null;
  if (!s || s.length < f * 10 - 3 || s.length > f * 10 + 3) return null;
  for (let i = 0; i < s.length; i++) {
    if (!isFinite(s[i]) || s[i] < 0) return null;
    if (i > 0 && (s[i] < s[i - 1] || s[i] - s[i - 1] > 130)) return null; // 0.1秒で13m以上（470km/h超）は無理
  }
  if (s[s.length - 1] < 4000) return null;
  const nums = (a, lo, hi) => Array.isArray(a) ? a.slice(0, 400).map(x => Math.max(lo, Math.min(hi, Math.round(Number(x) || 0)))) : [];
  const trap = Math.max(0, Math.min(450, Math.round(Number(e.trap) || 0)));
  return { n, f: Math.round(f * 1000) / 1000, m, b: e.b ? 1 : 0, trap, s, r: nums(e.r, 0, 1200), g: nums(e.g, 0, 6),
    d: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), id: Math.random().toString(36).slice(2, 10) };
}

// ランキングを1か所にしまっておく所（Durable Object）
export class Rank {
  constructor(ctx, env) { this.ctx = ctx; }
  async fetch(request) {
    const url = new URL(request.url);
    let list = (await this.ctx.storage.get("top")) || [];
    if (request.method === "GET") return json({ list });
    if (request.method === "POST" && url.pathname.endsWith("/submit")) {
      let e;
      try { e = JSON.parse(await request.text()); } catch (err) { return json({ error: "bad json" }, 400); }
      const v = check(e);
      if (!v) return json({ error: "invalid run" }, 400);
      list.push(v);
      list.sort((a, b) => a.f - b.f);
      list = list.slice(0, 10);
      await this.ctx.storage.put("top", list);
      return json({ rank: list.indexOf(v) + 1, list });
    }
    return json({ error: "not found" }, 404);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === "/top" || url.pathname === "/submit") {
      const stub = env.RANK.get(env.RANK.idFromName("main"));
      return stub.fetch(request);
    }
    return new Response("OK rank", { headers: CORS });
  },
};
