import Anthropic from '@anthropic-ai/sdk';

// Hobbyプランでは最大60秒
export const maxDuration = 60;

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, password, model } = req.body;

  // パスワードチェック（二重防御）
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && password !== sitePassword) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const ALLOWED_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6'];
    const selectedModel = ALLOWED_MODELS.includes(model) ? model : 'claude-opus-4-6';

    const stream = client.messages.stream({
      model: selectedModel,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    // SSEヘッダーを設定してストリーミング開始
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Claude API error:', error.message);
    // SSEヘッダー送信前のエラーならJSONで返す
    if (!res.headersSent) {
      return res.status(500).json({ error: 'LLM API call failed' });
    }
    res.write(`data: ${JSON.stringify({ error: 'LLM API call failed' })}\n\n`);
    res.end();
  }
}
