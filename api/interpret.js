import Anthropic from '@anthropic-ai/sdk';

// Hobbyプランでは最大60秒
export const maxDuration = 60;

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, password } = req.body;

  // パスワードチェック（二重防御）
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && password !== sitePassword) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    // ストリーミングで受け取ってタイムアウトを回避
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const finalMessage = await stream.finalMessage();

    const text = finalMessage.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Claude API error:', error.message);
    return res.status(500).json({ error: 'LLM API call failed' });
  }
}
