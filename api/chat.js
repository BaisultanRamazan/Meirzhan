// CodeMaster AI агенті — Vercel serverless функциясы
// Кілт: OPENAI_API_KEY (OpenAI API)

const SYSTEM = `Сен CodeMaster AI агентісің — программалау дағдыларын, алгоритмдік ойлауды және цифрлық сауаттылықты дамытуға арналған оқу ассистентісің.
Қолданушының тілінде (негізінен қазақша) жауап бер.
Қарапайым, мейірімді, педагогикалық тілмен түсіндір; мысал келтір.
Тапсырма сұралса, дайын жауапты бірден берместен алдымен бағыттаушы сұрақ қой немесе кеңес бер, қажет болса соңында шешімді көрсет.
Код үшін \`\`\` блоктарын қолдан.`;

const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Тек POST рұқсат етіледі." });

  let messages = req.body && req.body.messages;
  if (typeof req.body === "string") {
    try { messages = JSON.parse(req.body).messages; } catch { messages = null; }
  }
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "Хабарлама жоқ." });

  messages = messages
    .slice(-MAX_MESSAGES)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!messages.length || messages[messages.length - 1].role !== "user")
    return res.status(400).json({ error: "Соңғы хабарлама қолданушыдан болуы керек." });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey)
    return res.status(500).json({ error: "Серверде API кілті бапталмаған." });

  try {
    const model = process.env.MODEL || "gpt-4o-mini";
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        messages: [{ role: "system", content: SYSTEM }, ...messages],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("OpenAI қатесі:", r.status, JSON.stringify(data));
      return res.status(502).json({ error: "Ассистент жауап бере алмады." });
    }

    const text = data.choices?.[0]?.message?.content || "";
    res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Байланыс қатесі." });
  }
};