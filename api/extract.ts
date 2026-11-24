interface ServerlessReq {
  method?: string;
  body?: unknown;
}

interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  json: (payload: unknown) => void;
}

export default async function handler(req: ServerlessReq, res: ServerlessRes): Promise<void> {
  if (req.method === 'GET') {
    const configured = Boolean(process.env.LLM_API_KEY?.trim());
    res.status(200).json({ configured, model: process.env.LLM_MODEL || 'gpt-4o-mini' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    res.status(501).json({
      configured: false,
      error: '服务端未配置 LLM_API_KEY，当前请使用内置本地引擎或会话内 BYOK 设置。',
    });
    return;
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Record<string, unknown>) || {};
    const baseUrl = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';

    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: payload.messages,
      }),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'LLM upstream request failed',
    });
  }
}
