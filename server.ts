import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { fetchAndIndexContent, getKnowledgeContext } from "./src/lib/scraper.js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  let ai: GoogleGenAI;
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
  }

  // Fetch or get existing knowledge context
  let websiteContext = "";
  try {
    websiteContext = await getKnowledgeContext() || "";
    if (!websiteContext) {
      console.log("Fetching knowledge base on startup...");
      const knowledge = await fetchAndIndexContent();
      websiteContext = knowledge.content;
    } else {
      console.log("Loaded existing knowledge base.");
    }
  } catch (err) {
    console.error("Failed to load or fetch knowledge base:", err);
  }

  // Add an endpoint to manually trigger a sync
  app.post("/api/sync-knowledge", async (req, res) => {
    try {
      const knowledge = await fetchAndIndexContent();
      websiteContext = knowledge.content;
      res.json({ success: true, message: "Knowledge base synced successfully." });
    } catch (error) {
      console.error("Error syncing knowledge:", error);
      res.status(500).json({ error: "Failed to sync knowledge." });
    }
  });

  const SYSTEM_INSTRUCTION = `You are the official AI assistant for Brackenfell Gas (brackenfellgas.co.za). 
You are specialized in providing information about gas supply, cylinder sizes, delivery services, and LPG installations in the Brackenfell area. 

Core Information about Brackenfell Gas:
- We are LPGSA and SAQCC registered commercial and domestic installers (SAQCC# 2786).
- We specialize in the installation, servicing and repairs of: Gas water heaters (gas geysers), Gas hobs, stoves, grillers, boiling tables, etc., Gas heaters, fireplaces/braais. Any appliance that runs on LPGas.
- Main Product Categories: Appliances, Braai accessories (Grids, In-a-bag, Sekelbos wood, Ember Makers), Camping gear, Gas Cylinders, Gas Orders & Deliveries, Shop Online, Gas Installations, Maintenance, Servicing.
- Use Google Search to look up specific product prices, details, or store hours on brackenfellgas.co.za if asked.

Here is some indexed content directly from the website:
---
${websiteContext}
---

Direct users to the website (brackenfellgas.co.za) for full details or to make a purchase. Keep your answers concise, professional, and friendly.`;

  // Endpoint for generating a response stream from Gemini

  app.post("/api/chat", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: "Gemini client is not initialized. Please check API key." });
      }

      const { history, message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required." });
      }

      const contents = [];
      if (history && Array.isArray(history)) {
        for (const msg of history) {
          contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          });
        }
      }

      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Error generating chat response:", error);
      const isQuota = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("exceeded your current quota");
      if (isQuota) {
        res.status(429).json({ error: "The AI service is currently experiencing high demand or has exceeded its quota. Please try again later." });
      } else {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
