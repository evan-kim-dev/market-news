import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const askBriefingQuestion = action({
  args: {
    message: v.string(),
    briefingContext: v.string(),
    history: v.array(v.object({ role: v.string(), content: v.string() })),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const systemInstruction = `당신은 글로벌/국내 금융 및 경제 시황 분석 전문가 AI 챗봇입니다. 
아래 제공된 '현재 시황 브리핑 컨텍스트'를 최우선으로 참고하여 사용자의 질문에 심층적이고 전문적이며 통찰력 있는 답변을 제공하십시오.
모든 답변은 한국어로 작성하며, 필요 시 글머리기호 등 마크다운 형식을 사용하여 가독성을 높여주세요.

[현재 시황 브리핑 컨텍스트]
${args.briefingContext}`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction
    });
    
    const contents = [];
    // Convert history
    for (const msg of args.history) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      });
    }
    
    // Add new message
    contents.push({
      role: "user",
      parts: [{ text: args.message }]
    });

    const response = await model.generateContent({
      contents,
      generationConfig: { temperature: 0.7 }
    });

    return response.response.text();
  }
});
