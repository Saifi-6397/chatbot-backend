import express from "express";
import { runAgent } from "../langchain/agent.js";

const router = express.Router();
router.post("/chat", async (req, res) => {
  try {
    const { message, chatHistory = [], location = null } = req.body;
    if (!message) {
      return res.status(400).json({ 
        error: "Message required!" 
      });
    }
    console.log("👤 User:", message);
    console.log("📍 Location:", location);

    // LangChain Agent call karo
    const reply = await runAgent(message, chatHistory, location);
    console.log("🤖 Bot:", reply);
    res.json({ reply });

  } catch (error) {
    console.error("Route Error:", error);
    res.status(500).json({ 
      error: "Server error!" 
    });
  }
});

export default router;