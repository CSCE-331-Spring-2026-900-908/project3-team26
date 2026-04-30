// Chat proxy route: /api/chat
// Forwards the conversation history from the kiosk's Order Help widget to the
// Groq API (OpenAI-compatible) and streams the reply back to the frontend.
// Requires GROQ_API_KEY in the environment.
// Keeping the API key server-side prevents the browser bundle from exposing it.
import express from 'express';
const router = express.Router();

// POST /api/chat — expects { messages: [{role, content}, ...] } in the request body.
// Passes the full conversation to Groq so the assistant maintains context across turns.
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
