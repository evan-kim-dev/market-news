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

    const oldNews = await ctx.db.query("original_news").collect();
    for (const n of oldNews) await ctx.db.delete(n._id);

    const oldBriefings = await ctx.db.query("daily_briefings").collect();
    for (const b of oldBriefings) await ctx.db.delete(b._id);

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

export const getNaverIndices = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("naver_indices").collect();
  },
});

export const getNaverPopularStocks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("naver_popular_stocks").order("asc").collect();
  },
});

export const saveNaverData = internalMutation({
  args: {
    indices: v.array(
      v.object({
        name: v.string(),
        closePrice: v.string(),
        compareToPreviousClosePrice: v.string(),
        fluctuationsRatio: v.string(),
        accumulatedTradingVolume: v.string(),
        accumulatedTradingValue: v.string(),
        individual: v.optional(v.string()),
        foreign: v.optional(v.string()),
        institution: v.optional(v.string()),
      })
    ),
    popularStocks: v.array(
      v.object({
        rank: v.number(),
        name: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const oldIndices = await ctx.db.query("naver_indices").collect();
    for (const i of oldIndices) await ctx.db.delete(i._id);

    const oldStocks = await ctx.db.query("naver_popular_stocks").collect();
    
    // Map previous ranks
    const oldRanksByName = new Map<string, number>();
    for (const s of oldStocks) {
      oldRanksByName.set(s.name, s.rank);
    }

    for (const s of oldStocks) await ctx.db.delete(s._id);

    for (const i of args.indices) {
      await ctx.db.insert("naver_indices", i);
    }
    for (const s of args.popularStocks) {
      const prevRank = oldRanksByName.get(s.name);
      let rankChange = "NEW";
      if (prevRank !== undefined) {
        const change = prevRank - s.rank; // e.g. prev=3, current=1 -> +2
        if (change > 0) rankChange = `+${change}`;
        else if (change < 0) rankChange = `${change}`;
        else rankChange = "0";
      }
      await ctx.db.insert("naver_popular_stocks", {
        rank: s.rank,
        name: s.name,
        rankChange,
      });
    }
  },
});

export const saveStockCharts = internalMutation({
  args: {
    charts: v.array(
      v.object({
        ticker: v.string(),
        name: v.string(),
        prices: v.array(v.number()),
        timestamps: v.array(v.number()),
        currentPrice: v.optional(v.number()),
        changePercent: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const oldCharts = await ctx.db.query("stock_charts").collect();
    for (const c of oldCharts) await ctx.db.delete(c._id);

    for (const c of args.charts) {
      await ctx.db.insert("stock_charts", c);
    }
  },
});

export const getStockCharts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stock_charts").collect();
  },
});
