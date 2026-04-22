import express from 'express';
const router = express.Router();

router.post('/chat', async (req, res) => {
  const { messages } = req.body;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 512,
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Groq error]', err);
    res.status(500).json({ error: 'Groq request failed' });
  }
});

export default router;