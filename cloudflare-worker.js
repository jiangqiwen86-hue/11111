/**
 * 直播运营中心安全代理 —— Cloudflare Workers 版
 *
 * 提供两个端点：
 *   POST /chat     —— 转发 DeepSeek API（Key 存在服务端环境变量）
 *   POST /dingtalk —— 转发钉钉机器人 webhook（避开浏览器 CORS）
 *
 * 部署步骤：
 * 1. 注册 Cloudflare 账号（免费），进入 Workers & Pages → 创建 Worker
 * 2. 把本文件内容粘贴到 Worker 编辑器，点击部署
 * 3. 在 Worker「设置 → 变量和机密」里添加环境变量：
 *    - DEEPSEEK_API_KEY  = sk-你的密钥（如果不用 DeepSeek 代理可不设）
 *    - AUTH_TOKEN       = 自定义随机字符串（强烈建议，防他人白嫖）
 * 4. 记下 Worker 的域名（形如 https://xxx.workers.dev），填到看板：
 *    - AI 知识库 → 代理地址（用于 /chat）
 *    - 行动项跟踪 → 钉钉推送配置里也用同一个代理地址（用于 /dingtalk）
 *
 * 安全说明：
 * - DEEPSEEK_API_KEY 只在服务端环境变量，钉钉 webhook+secret 由前端请求时传入（不落服务端）
 * - AUTH_TOKEN 是前端与代理之间的访问口令
 * - 建议给 Worker 绑定自己的域名 + 开启限流
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    // ---- 路由分发 ----
    if (request.method === 'POST' && url.pathname === '/chat') {
      return handleChat(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/dingtalk') {
      return handleDingtalk(request, env);
    }
    return json({ error: { message: 'Not found' } }, 404);
  },
};

// ========== DeepSeek 代理 ==========
async function handleChat(request, env) {
  if (env.AUTH_TOKEN) {
    const token = request.headers.get('X-Auth-Token') || '';
    if (token !== env.AUTH_TOKEN) return json({ error: { message: '未授权访问' } }, 401);
  }
  if (!env.DEEPSEEK_API_KEY) return json({ error: { message: '服务端未配置 DEEPSEEK_API_KEY' } }, 500);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: { message: '请求体格式错误' } }, 400); }
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) return json({ error: { message: '缺少 messages' } }, 400);

  try {
    const dsResp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.DEEPSEEK_API_KEY,
      },
      body: JSON.stringify({
        model: body.model || 'deepseek-chat',
        messages,
        temperature: body.temperature != null ? body.temperature : 0.7,
        max_tokens: body.max_tokens || 2500,
      }),
    });
    const data = await dsResp.json();
    return json(data, dsResp.status);
  } catch (e) {
    return json({ error: { message: '上游调用失败：' + e.message } }, 502);
  }
}

// ========== 钉钉机器人 webhook 代理（避开浏览器 CORS）==========
async function handleDingtalk(request, env) {
  if (env.AUTH_TOKEN) {
    const token = request.headers.get('X-Auth-Token') || '';
    if (token !== env.AUTH_TOKEN) return json({ error: { message: '未授权访问' } }, 401);
  }

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: { message: '请求体格式错误' } }, 400); }
  const { webhook, secret, payload } = body;
  if (!webhook || !payload) return json({ error: { message: '缺少 webhook 或 payload' } }, 400);

  let dingUrl = webhook.trim();
  try {
    // 服务端加签（HMAC-SHA256 + base64 + URL encode），与钉钉官方算法一致
    if (secret && secret.trim()) {
      const t = String(Date.now());
      const sToSign = t + '\n' + secret.trim();
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(secret.trim()), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sToSign));
      const u8 = new Uint8Array(sig);
      let bin = '';
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      const base64 = btoa(bin);
      const sign = encodeURIComponent(base64);
      dingUrl += (dingUrl.indexOf('?') >= 0 ? '&' : '?') + 'timestamp=' + t + '&sign=' + sign;
    }

    const dr = await fetch(dingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await dr.json().catch(() => ({}));
    return json(data, dr.status);
  } catch (e) {
    return json({ error: { message: '转发钉钉失败：' + e.message } }, 502);
  }
}

// ========== 工具函数 ==========
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  });
}
