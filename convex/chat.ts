import { action } from "./_generated/server";
import { v } from "convex/values";

export const askBriefingQuestion = action({
  args: {
    message: v.string(),
    briefingContext: v.string(),
    history: v.array(v.object({ role: v.string(), content: v.string() })),
  },
  handler: async (ctx, args) => {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error("Gemini API Key missing");

    const systemPrompt = `You are an elite financial analyst chatbot embedded in a stock market dashboard. 
Your tone is highly professional, precise, and objective. 
You must answer questions based on the following today's market briefing:
---
${args.briefingContext}
---
If the user asks something outside of this context, use your general financial knowledge, but always prioritize the provided briefing. 
Do not use markdown formatting like bolding or bullet points unless strictly necessary. Keep responses concise (2-4 sentences max).`;

    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood. I am ready to answer financial questions based on the briefing." }] }
    ];

    for (const msg of args.history) {
      contents.push({ role: msg.role === "user" ? "user" : "model", parts: [{ text: msg.content }] });
    }
    
    contents.push({ role: "user", parts: [{ text: args.message }] });

    try {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
      });

      if (!geminiRes.ok) {
        const err = await geminiRes.text();
        console.error("Gemini Chat Error:", err);
        throw new Error("Failed to get response from AI");
      }

      const geminiData = await geminiRes.json();
      return geminiData.candidates[0].content.parts[0].text;
    } catch (e) {
      console.error(e);
      throw new Error("Internal Server Error");
    }
  },
});
