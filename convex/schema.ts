import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  market_metrics: defineTable({
    ticker: v.string(),
    name: v.string(),
    current_value: v.number(),
    change_value: v.number(),
    change_percent: v.number(),
    session_type: v.string(), // "US" or "KR"
  }),
  daily_briefings: defineTable({
    session_type: v.string(), // "US" or "KR"
    ai_summary: v.string(),
    key_takeaways: v.array(v.string()),
  }),
  original_news: defineTable({
    category: v.string(), // "US" or "KR"
    title: v.string(),
    origin_url: v.string(),
    source: v.string(),
    timestamp: v.string(),
    image_url: v.optional(v.string()),
    sub_category: v.optional(v.string()),
  }),
});
