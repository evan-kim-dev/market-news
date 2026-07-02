"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import Parser from "rss-parser";

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
      { url: "https://finance.yahoo.com/news/rss", source: "Yahoo Finance", sub_category: "World" },
      { url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?profile=120000000&id=100003114", source: "CNBC", sub_category: "General" },
      { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", source: "WSJ", sub_category: "Economy" },
    ];
    const usNewsTitles: string[] = [];
    for (const feedObj of rssFeeds) {
      try {
        const feed = await parser.parseURL(feedObj.url);
        const items = feed.items.slice(0, 9); // Fetch 9 per feed
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
          const naverRes = await fetch(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(cat + " 뉴스")}&display=30&sort=sim`, {
            headers: {
              "X-Naver-Client-Id": NAVER_CLIENT_ID,
              "X-Naver-Client-Secret": NAVER_CLIENT_SECRET
            }
          });
          const naverData = await naverRes.json();
          if (naverData.items) {
            // 보수/우편향 언론사 필터링 (조중동, 한경, 매경 등 + 매일신문)
            const rightLeaningDomains = ["chosun", "joongang", "donga", "hankyung", "mk.co.kr", "munhwa", "segye", "kmib", "imaeil"];
            
            const filteredItems = naverData.items.filter((item: any) => {
              const url = item.originallink || item.link;
              return rightLeaningDomains.some(domain => url.includes(domain));
            });

            // 필터링된 기사가 너무 적으면 일반 기사 포함, 최대 9개 선택
            const finalItems = filteredItems.length >= 3 ? filteredItems.slice(0, 9) : naverData.items.slice(0, 9);

            await Promise.all(finalItems.map(async (item: any) => {
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

              // 출처 추출
              let sourceName = "Naver News";
              const url = item.originallink || item.link;
              if (url.includes("chosun")) sourceName = "조선일보";
              else if (url.includes("joongang")) sourceName = "중앙일보";
              else if (url.includes("donga")) sourceName = "동아일보";
              else if (url.includes("hankyung")) sourceName = "한국경제";
              else if (url.includes("mk.co.kr")) sourceName = "매일경제";
              else if (url.includes("munhwa")) sourceName = "문화일보";
              else if (url.includes("segye")) sourceName = "세계일보";
              else if (url.includes("kmib")) sourceName = "국민일보";
              else if (url.includes("imaeil")) sourceName = "매일신문";

              news.push({
                category: "KR",
                title: title,
                origin_url: item.link,
                source: sourceName,
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

    // --- 4. Generate Global AI Summary (Gemini) ---
    const allTitles = [...usNewsTitles, ...krNewsTitles];
    
    if (allTitles.length > 0) {
      try {
        const prompt = `You are a top-tier financial analyst. Read the following global news headlines (US and KR) and provide a comprehensive 3-sentence summary of the overall global market trend.
Also provide 3 to 5 key takeaway keywords (hashtags).
Return ONLY valid JSON in this exact format, with no markdown formatting or extra text:
{
  "summary": "3-sentence global market summary in Korean.",
  "keywords": ["#keyword1", "#keyword2", "#keyword3"]
}

Headlines:
${allTitles.join("\n")}
`;
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates[0].content.parts[0].text;
          const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanText);

          briefings.push({
            session_type: "GLOBAL",
            ai_summary: parsed.summary,
            key_takeaways: parsed.keywords,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error("Gemini Global Error:", e);
      }
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
