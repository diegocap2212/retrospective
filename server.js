import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env for local development
if (fs.existsSync(path.join(__dirname, ".env"))) {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, ".env"), "utf-8");
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && !process.env[key]) process.env[key] = value;
      }
    });
  } catch (err) {
    console.error("Erro ao ler .env:", err);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Gemini AI proxy — keeps the API key server-side
app.post("/api/ai", async (req, res) => {
  const { prompt } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "GEMINI_API_KEY não configurado no servidor." });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Resposta inválida da API do Gemini.");
    res.json({ text });
  } catch (error) {
    console.error("Erro na integração com Gemini:", error);
    res.status(500).json({ error: "Falha ao gerar insights via Gemini." });
  }
});

// Serve static assets in local dev/production
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Retrospective Server running at http://localhost:${PORT}`);
});

export default app;
