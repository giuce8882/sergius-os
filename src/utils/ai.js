// Shared AI client — all features use Groq (free, fast, reliable)
import Groq from 'groq-sdk';

const getGroq = () => new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

const MODEL = 'llama-3.3-70b-versatile';
const MODEL_FAST = 'llama-3.1-8b-instant'; // for simple tasks like categorization

// Simple one-shot text generation
export async function generateText(prompt, fast = false) {
  const groq = getGroq();
  const res = await groq.chat.completions.create({
    model: fast ? MODEL_FAST : MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 256
  });
  return res.choices[0].message.content.trim();
}

// Chat with history (for BrainstormChat)
export async function chatCompletion(messages, systemPrompt, maxTokens = 1024) {
  const groq = getGroq();
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    max_tokens: maxTokens
  });
  return res.choices[0].message.content.trim();
}

export { MODEL, MODEL_FAST };
