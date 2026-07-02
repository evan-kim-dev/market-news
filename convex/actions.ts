"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import Parser from "rss-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const fetchAndSummarize = action({
  args: {},
  handler: async (ctx) => {
    const metrics: any[] = [];
    const news: any[] = [];
    const briefings: any[] = [];
    
    // --- 1. Fetch Market Metrics (Yahoo Finance) ---
    try {
      const symbols = [
        { ticker: "^DJI", name: "Dow Jones", session: "US" },
        { ticker: "^IXIC", name: "NASDAQ", session: "US" },
        { ticker: "^KS11", name: "KOSPI", session: "KR" },
      ];
      for (const s of symbols) {
        try {
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.ticker}?interval=1d`);
          const data = await res.json();
          if (data.chart.result && data.chart.result.length > 0) {
            const meta = data.chart.result[0].meta;
            const current_value = meta.regularMarketPrice;
            const prev_close = meta.chartPreviousClose;
            const change_value = current_value - prev_close;
            const change_percent = (change_value / prev_close) * 100;
            metrics.push({
              ticker: s.ticker,
              name: s.name,
              current_value,
              change_value,
              change_percent,
              session_type: s.session,
            });
          }
        } catch (e) {
          console.error(`Error fetching ${s.ticker}:`, e);
        }
      }
    } catch (e) {
      console.error("Yahoo Finance fetch error:", e);
    }

    // --- 2. Fetch US News (RSS) ---
    const parser = new Parser({
      customFields: {
        item: [
          ['media:content', 'media'],
          ['enclosure', 'enclosure']
        ]
      }
    });
    const rssFeeds = [
      { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", source: "NYT", sub_category: "World" },
      { url: "http://rss.cnn.com/rss/edition.rss", source: "CNN", sub_category: "General" },
      { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", source: "WSJ", sub_category: "Economy" },
    ];
    const usNewsTitles: string[] = [];
    for (const feedObj of rssFeeds) {
      try {
        const feed = await parser.parseURL(feedObj.url);
        const items = feed.items.slice(0, 5); // 5 per feed = 15 total
        for (const item of items) {
          let image_url = undefined;
          if (item.media && item.media.$ && item.media.$.url) {
            image_url = item.media.$.url;
          } else if (item.enclosure && item.enclosure.url) {
            image_url = item.enclosure.url;
          }
          news.push({
            category: "US",
            title: item.title || "No Title",
            origin_url: item.link || feedObj.url,
            source: feedObj.source,
            timestamp: item.pubDate || new Date().toISOString(),
            image_url,
            sub_category: feedObj.sub_category,
          });
          if (item.title) usNewsTitles.push(item.title);
        }
      } catch (e) {
        console.error(`RSS fetch error for ${feedObj.url}:`, e);
      }
    }

    // --- 3. Fetch KR News (Naver API) ---
    const krNewsTitles: string[] = [];
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
    
    if (NAVER_CLIENT_ID && NAVER_CLIENT_SECRET) {
      const krCategories = ["정치", "경제", "사회", "IT과학"];
      for (const cat of krCategories) {
        try {
          const naverRes = await fetch(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(cat + " 뉴스")}&display=5&sort=sim`, {
            headers: {
              "X-Naver-Client-Id": NAVER_CLIENT_ID,
              "X-Naver-Client-Secret": NAVER_CLIENT_SECRET
            }
          });
          const naverData = await naverRes.json();
          if (naverData.items) {
            await Promise.all(naverData.items.map(async (item: any) => {
              const title = item.title.replace(/<[^>]*>?/g, '').replace(/&quot;/g, '"');
              let image_url = undefined;
              try {
                const htmlRes = await fetch(item.link, { signal: AbortSignal.timeout(3000) });
                const html = await htmlRes.text();
                const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
                if (match && match[1]) {
                  image_url = match[1];
                }
              } catch (e) {
                // Ignore silent timeouts
              }
              news.push({
                category: "KR",
                title: title,
                origin_url: item.link,
                source: "Naver News",
                timestamp: new Date(item.pubDate).toISOString(),
                image_url,
                sub_category: cat,
              });
              krNewsTitles.push(title);
            }));
          }
        } catch (e) {
          console.error(`Naver API error for ${cat}:`, e);
        }
      }
    } else {
      console.warn("Naver API keys missing");
    }

          });
        }
      } catch (e) {
        console.error("Gemini KR Error:", e);
      }
    } else {
      console.warn("Gemini API key missing");
    }

    // --- 5. Save Data ---
    await ctx.runMutation(internal.news.saveMarketData, {
      metrics,
      news,
      briefings,
    });
  },
});

export const updateMetricsOnly = action({
  args: {},
  handler: async (ctx) => {
    const metrics: any[] = [];
    const symbols = [
      { ticker: "^DJI", name: "Dow Jones", session: "US" },
      { ticker: "^IXIC", name: "NASDAQ", session: "US" },
      { ticker: "^KS11", name: "KOSPI", session: "KR" },
    ];
    for (const s of symbols) {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.ticker}?interval=1d`);
        const data = await res.json();
        if (data.chart.result && data.chart.result.length > 0) {
          const meta = data.chart.result[0].meta;
          const current_value = meta.regularMarketPrice;
          const prev_close = meta.chartPreviousClose;
          const change_value = current_value - prev_close;
          const change_percent = (change_value / prev_close) * 100;
          metrics.push({
            ticker: s.ticker,
            name: s.name,
            current_value,
            change_value,
            change_percent,
            session_type: s.session,
          });
        }
      } catch (e) {
        console.error(`Error fetching ${s.ticker}:`, e);
      }
    }
    await ctx.runMutation(internal.news.saveMetricsOnly, { metrics });
  }
});
