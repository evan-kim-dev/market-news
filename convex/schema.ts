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
    timestamp: v.optional(v.string()),
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
  naver_popular_stocks: defineTable({
    rank: v.number(),
    name: v.string(),
    rankChange: v.optional(v.string()),
  }),
  naver_indices: defineTable({
    name: v.string(),
    closePrice: v.string(),
    compareToPreviousClosePrice: v.string(),
    fluctuationsRatio: v.string(),
    accumulatedTradingVolume: v.string(),
    accumulatedTradingValue: v.string(),
    individual: v.optional(v.string()),
    foreign: v.optional(v.string()),
    institution: v.optional(v.string()),
  }),
  stock_charts: defineTable({
    ticker: v.string(),
    name: v.string(),
    prices: v.array(v.number()),
    timestamps: v.array(v.number()),
    currentPrice: v.optional(v.number()),
    changePercent: v.optional(v.number()),
  }),
});
