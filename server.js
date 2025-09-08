import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

const API_KEY = process.env.GEMINI_API_KEY;

app.use(express.static("public"));
app.use(bodyParser.json());

// ---------------- LLM CALL FUNCTION ----------------
async function callLLM(prompt, instruction = null, tools = null) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  if (tools) payload.tools = [{ google_search: {} }];
  if (instruction) payload.systemInstruction = { parts: [{ text: instruction }] };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error calling LLM API: ${response.statusText}`);
    }

    const result = await response.json();
    const text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (!text) throw new Error("No text found in API response.");
    return text;
  } catch (error) {
    console.error("LLM API Error:", error.message);
    return null;
  }
}

// ---------------- ROUTES ----------------
app.get("/", (req, res) => {
  res.send("Interview Bot API is running...");
});

app.post("/api/interview", async (req, res) => {
  const { action } = req.body;

  if (action === "ask_question") {
    const { role, mode, domain, question_number } = req.body;
    const prompt = `You are a professional interviewer for a ${role} role. The interview mode is ${mode}. The domain is ${domain || "general"}. Please ask the next question (Question ${question_number} of 3).`;

    const question = await callLLM(
      prompt,
      "You are a professional and supportive interviewer bot."
    );

    if (!question) return res.status(500).json({ error: "Could not generate a question." });
    return res.json({ question });
  }

  else if (action === "evaluate_answer") {
    const { role, mode, domain, conversation_history } = req.body;
    const user_answer = conversation_history[conversation_history.length - 1].text;
    const last_question = conversation_history[conversation_history.length - 2].text;

    const prompt = `Evaluate the following answer from a candidate for a ${role} role (${mode} mode, domain: ${domain}):\n\nUser's question was: ${last_question}\n\nUser's answer: ${user_answer}\n\nProvide feedback, a score (out of 10), and then ask the next question. Keep the feedback concise and constructive. Use headers '**Feedback:**', '**Score:**', and '**Next Question:**'.`;

    const responseText = await callLLM(
      prompt,
      "You are a professional and supportive interviewer bot."
    );

    if (!responseText) return res.status(500).json({ error: "Could not evaluate the answer." });

    const parts = responseText.split("**Next Question:**");
    const feedback = parts[0].trim();
    const nextQuestion =
      parts.length > 1
        ? parts[1].trim()
        : "End of interview. Please click 'End Interview & Get Summary'.";

    return res.json({ feedback, question: nextQuestion });
  }

  else if (action === "retry_question") {
    const { role, mode, domain } = req.body;

    const prompt = `You are a professional interviewer for a ${role} role. The interview mode is ${mode}. The domain is ${domain || "general"}. The user has asked to retry the last question. Please re-ask your last question.`;

    const question = await callLLM(
      prompt,
      "You are a professional and supportive interviewer bot."
    );

    if (!question) return res.status(500).json({ error: "Could not retry the question." });
    return res.json({ question });
  }

  else if (action === "generate_summary") {
    const { conversation_history } = req.body;
    const prompt = `The interview is over. Based on this conversation history, provide a summary report with:\n1. Areas of Strength\n2. Areas for Improvement\n3. Suggested Resources\n\nConversation:\n${JSON.stringify(conversation_history, null, 2)}`;

    const summary = await callLLM(
      prompt,
      "You are a professional and supportive interviewer bot."
    );

    if (!summary) return res.status(500).json({ error: "Could not generate the summary." });
    return res.json({ summary });
  }

  return res.status(400).json({ error: "Invalid action" });
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
