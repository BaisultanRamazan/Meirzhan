// CodeMaster AI агенті — Vercel serverless функциясы
// Кілт: AI_GATEWAY_API_KEY (Vercel AI Gateway) НЕМЕСЕ ANTHROPIC_API_KEY (Anthropic Console)

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

  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!gatewayKey && !anthropicKey)
    return res.status(500).json({ error: "Серверде API кілті бапталмаған." });

  try {
    let text;
    if (gatewayKey) {
      // Vercel AI Gateway (OpenAI-үйлесімді)
      const model = process.env.MODEL || "anthropic/claude-haiku-5.5";
      const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
          messages: [{ role: "system", content: SYSTEM }, ...messages],
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        console.error("Gateway қатесі:", r.status, JSON.stringify(data));
        return res.status(502).json({ error: "Ассистент жауап бере алмады." });
      }
      text = data.choices[0].message.content;
    } else {
      // Anthropic API тікелей
      const model = process.env.MODEL || "claude-haiku-5-5";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, max_tokens: 1000, system: SYSTEM, messages }),
      });
      const data = await r.json();
      if (!r.ok) {
        console.error("Anthropic қатесі:", r.status, JSON.stringify(data));
        return res.status(502).json({ error: "Ассистент жауап бере алмады." });
      }
      text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    }
    res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Байланыс қатесі." });
  }
};
