import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getMarketMetrics = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("market_metrics").collect();
  },
});

export const getLatestBriefing = query({
  args: { session_type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("daily_briefings")
      .filter((q) => q.eq(q.field("session_type"), args.session_type))
      .order("desc")
      .first();
  },
});

export const getNews = query({
  args: { session_type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("original_news")
      .filter((q) => q.eq(q.field("category"), args.session_type))
      .order("desc")
      .take(20);
  },
});

export const saveMarketData = internalMutation({
  args: {
    metrics: v.array(
      v.object({
        ticker: v.string(),
        name: v.string(),
        current_value: v.number(),
        change_value: v.number(),
        change_percent: v.number(),
        session_type: v.string(),
      })
    ),
    news: v.array(
      v.object({
        category: v.string(),
        title: v.string(),
        origin_url: v.string(),
        source: v.string(),
        timestamp: v.string(),
        image_url: v.optional(v.string()),
        sub_category: v.optional(v.string()),
      })
    ),
    briefings: v.array(
      v.object({
        session_type: v.string(),
        ai_summary: v.string(),
        key_takeaways: v.array(v.string()),
        timestamp: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const oldMetrics = await ctx.db.query("market_metrics").collect();
    for (const m of oldMetrics) await ctx.db.delete(m._id);

    for (const m of args.metrics) {
      await ctx.db.insert("market_metrics", m);
    }
    for (const n of args.news) {
      await ctx.db.insert("original_news", n);
    }
    for (const b of args.briefings) {
      await ctx.db.insert("daily_briefings", b);
    }
  },
});

export const saveMetricsOnly = internalMutation({
  args: {
    metrics: v.array(
      v.object({
        ticker: v.string(),
        name: v.string(),
        current_value: v.number(),
        change_value: v.number(),
        change_percent: v.number(),
        session_type: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const oldMetrics = await ctx.db.query("market_metrics").collect();
    for (const m of oldMetrics) await ctx.db.delete(m._id);

    for (const m of args.metrics) {
      await ctx.db.insert("market_metrics", m);
    }
  },
});
