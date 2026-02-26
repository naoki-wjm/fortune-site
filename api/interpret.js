import Anthropic from '@anthropic-ai/sdk';

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
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Claude API error:', error.message);
    return res.status(500).json({ error: 'LLM API call failed' });
  }
}
