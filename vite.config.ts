import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function extractProxyPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'rfq-extract-proxy',
    configureServer(server) {
      server.middlewares.use('/api/extract', async (req, res, next) => {
        if (req.method === 'GET') {
          const configured = Boolean(env.LLM_API_KEY?.trim());
          sendJson(res, 200, { configured, model: env.LLM_MODEL || 'gpt-4o-mini' });
          return;
        }
        if (req.method !== 'POST') {
          next();
          return;
        }

        const apiKey = env.LLM_API_KEY?.trim();
        if (!apiKey) {
          sendJson(res, 501, {
            configured: false,
            error: '服务端未配置 LLM_API_KEY，当前可使用内置本地引擎或浏览器会话密钥。',
          });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const baseUrl = (env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
          const model = env.LLM_MODEL || 'gpt-4o-mini';

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
              messages: body.messages,
            }),
          });

          const data = await upstream.json();
          sendJson(res, upstream.status, data);
        } catch (err) {
          sendJson(res, 502, {
            error: err instanceof Error ? err.message : 'LLM upstream request failed',
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), extractProxyPlugin(env)],
  };
});
