// Vercel serverless function: POST /api/chat
// Powers "Ask Wahj" with Claude when ANTHROPIC_API_KEY is set.
// If this endpoint is missing or fails, the site falls back to its built-in assistant.
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYS = `You are Wahj, the assistant on the website of WAHJORA Digital, an AI-first creative studio in Dubai, UAE, founded by Sameer Shah. Instagram: @wahjora.digital.
What we make: cinematic AI ad films (Reels/TikToks, 10-30s) using the newest AI tools such as Google Gemini, Veo and Lyria, with hand-built editing and original music; plus social strategy, content production, paid social, influencer and creator marketing, and community management. Everything in Arabic and English. AI-made visuals are always labelled as AI.
Prices in AED: Single film AED 249 (one film, 1 round of changes, ready in 72 hours); Launch pack AED 999 (5 films, a different style each, Arabic & English versions, 2 rounds of changes); Always-on AED 1,799 a month (10 films a month, content plan, posting schedule, month to month). No long contracts. Ad spend, if any, is paid by the client directly to the platform.
Our work: concept films made this season (Dubai chocolate AI film, Men's Day, 11.11, White Friday, National Day, a cafe reel, interiors, a fragrance film). They are concepts, not paid client work. We do not have published client case studies yet.
Rules: reply in the same language as the user's last message (Arabic or English). Maximum 3 short sentences, plain text, no markdown, no lists. Never invent facts, clients, results, team members, partnerships or an office address beyond the above; if you don't know, offer a call, Instagram DM or WhatsApp. When it helps the user, navigate the site by ending your reply with exactly one tag: [[go:PAGE]] where PAGE is one of home, services, pricing, work, about, insights, contact. If the user wants to book a call or get in touch, use [[go:contact]].`;

const MAX_MSGS = 12;
const MAX_CHARS = 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Assistant not configured' });

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  let messages = Array.isArray(body?.messages) ? body.messages : [];
  messages = messages
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MSGS)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'Invalid messages' });

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      system: SYS,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages
    });
    if (response.stop_reason === 'refusal') return res.status(200).json({ text: null });
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return res.status(200).json({ text: text || null });
  } catch (err) {
    console.error('chat error', err?.status, err?.message);
    return res.status(502).json({ error: 'Upstream error' });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }
