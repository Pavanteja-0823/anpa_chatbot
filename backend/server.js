import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import multer from "multer";
import mongoose from "mongoose";
import Chat from "./models/Chat.js";
import Knowledge from "./models/Knowledge.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

/* =========================
   🗄️ DATABASE CONNECTION
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
  });

/* =========================
   📁 FILE UPLOAD SETUP
========================= */
const upload = multer({ dest: "uploads/" });

/* =========================
   🧠 SMART RAG FUNCTIONS
========================= */

// Split text into chunks
const createChunks = (text) => {
  const size = 500;
  let chunks = [];

  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }

  return chunks;
};

// Get relevant chunks
const getRelevantChunks = async (query) => {
  try {
    const chunks = await Knowledge.find({
      content: { $regex: query, $options: "i" }
    }).limit(3);

    const matched = chunks.map(c => c.content).join("\n");

    return matched || "No relevant knowledge found.";
  } catch (error) {
    console.error("KNOWLEDGE RETRIEVAL ERROR:", error);
    return "";
  }
};

/* =========================
   📤 UPLOAD API
========================= */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const filePath = req.file.path;
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;

    const chunks = createChunks(extractedText);

    // Save chunks to MongoDB
    const knowledgeEntries = chunks.map(chunk => ({ content: chunk }));
    await Knowledge.insertMany(knowledgeEntries);

    // 🧹 delete uploaded temp file
    fs.unlinkSync(filePath);

    res.json({ message: "PDF processed and saved to database successfully" });

  } catch (error) {
    console.error("PDF ERROR:", error);
    res.status(500).send("Error processing PDF");
  }
});

/* =========================
   🧹 CLEAR CHAT
========================= */
app.post("/clear", async (req, res) => {
  try {
    await Chat.deleteMany({});
    res.json({ message: "Chat history cleared successfully" });
  } catch (error) {
    console.error("CLEAR ERROR:", error);
    res.status(500).send("Error clearing memory");
  }
});

// DEPRECATED: Using MongoDB now

/* =========================
   💬 CHAT API
========================= */
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).send("Message is required");
  }

  try {
    // 1. Fetch last 10 messages for context
    const history = await Chat.find().sort({ timestamp: 1 }).limit(10);
    const memory = history.map(m => ({ role: m.role, content: m.content }));

    // 2. Add current user message
    const currentMemory = [...memory, { role: "user", content: userMessage }];

    // 3. Get relevant knowledge
    const knowledge = await getRelevantChunks(userMessage);

    let systemPrompt = `
You are an AI Tech Support + College Assistant.

Use this knowledge when relevant:
${knowledge}

Rules:
- Format answers clearly
- Use headings with ##
- Use bullet points with -
- Use bold text with **
- Keep answers structured and readable
- Avoid long paragraphs
- Give step-by-step answers
- Ask follow-up questions if useful
`;

    if (userMessage.toLowerCase().includes("slow laptop")) {
      systemPrompt += "\nFocus on fixing performance issues.";
    }

    // 4. Call AI API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          ...currentMemory
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).send(data.error.message);
    }

    const botReply = data.choices[0].message;

    // 5. Save user message and bot reply to DB
    await Chat.create({ role: "user", content: userMessage });
    await Chat.create({ role: botReply.role, content: botReply.content });

    res.json(botReply);

  } catch (error) {
    console.error("CHAT ERROR:", error);
    res.status(500).send(error.message);
  }
});

/* =========================
   🚀 SERVER START
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully!");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.log("The server was NOT started because the database connection failed.");
  });