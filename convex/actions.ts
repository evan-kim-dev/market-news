"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import Parser from "rss-parser";

/** Blocklist of domains that return generic/logo images instead of article thumbnails */
const OG_BLOCKLIST = [
  "google.com", "gstatic.com", "googleapis.com",
  "googleusercontent.com", "ggpht.com",
];

/** Fetch og:image from article page (best-effort, 4-second timeout, follows redirects) */
async function fetchOgImage(url: string): Promise<string | undefined> {
  try {
    // Skip Google News redirect URLs — they never return article OG images
    if (url.includes("news.google.com")) return undefined;

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(tid);
    if (!res.ok) return undefined;

    // Only parse HTML responses
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return undefined;

    const html = await res.text();

    // Try og:image first, then twitter:image as fallback
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    if (!match) return undefined;

    const imgUrl = match[1];

    // Filter out blocklisted domains (Google logos, generic CDN images)
    try {
      const hostname = new URL(imgUrl).hostname;
      if (OG_BLOCKLIST.some((blocked) => hostname.includes(blocked))) return undefined;
    } catch {
      return undefined;
    }

    return imgUrl;
  } catch {
    return undefined;
  }
}

export const fetchAndSummarize = action({
  args: {},
  handler: async (ctx) => {
    const metrics: any[] = [];
    const news: any[] = [];
    const briefings: any[] = [];
    
    // --- 1. Fetch Market Metrics (Yahoo Finance) ---
    try {
      const symbols = [
        { ticker: "^GSPC", name: "S&P 500", session: "US" },
        { ticker: "^IXIC", name: "NASDAQ", session: "US" },
        { ticker: "^DJI", name: "Dow Jones", session: "US" },
        { ticker: "^KS11", name: "KOSPI", session: "KR" },
        { ticker: "^KQ11", name: "KOSDAQ", session: "KR" },
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
      { url: "https://news.google.com/rss/search?q=economy+OR+finance+OR+markets+when:24h&hl=en-US&gl=US&ceid=US:en", source: "Global Finance", sub_category: "경제" },
      { url: "https://news.google.com/rss/search?q=politics+when:24h&hl=en-US&gl=US&ceid=US:en", source: "Global Politics", sub_category: "정치" },
    ];
    const usNewsTitles: string[] = [];
    for (const feedObj of rssFeeds) {
      try {
        const feed = await parser.parseURL(feedObj.url);
        const items = feed.items.slice(0, 8);

        // Try RSS media/enclosure first, then fall back to OG scrape
        const imagePromises = items.map(async (item) => {
          if (item.media && item.media.$ && item.media.$.url) return item.media.$.url as string;
          if (item.enclosure && item.enclosure.url) return item.enclosure.url as string;
          return fetchOgImage(item.link || feedObj.url);
        });
        const images = await Promise.all(imagePromises);

        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          news.push({
            category: "GLOBAL",
            title: item.title || "No Title",
            origin_url: item.link || feedObj.url,
            source: feedObj.source,
            timestamp: item.pubDate || new Date().toISOString(),
            image_url: images[idx],
            sub_category: feedObj.sub_category,
          });
          if (item.title) usNewsTitles.push(item.title);
        }
      } catch (e) {
        console.error(`RSS fetch error for ${feedObj.url}:`, e);
      }
    }

    // --- 3. Fetch KR News (Google News RSS) ---
    const krNewsTitles: string[] = [];
    const krFeeds = [
      { url: "https://news.google.com/rss/headlines/section/topic/POLITICS?hl=ko&gl=KR&ceid=KR:ko", source: "Google News", sub_category: "정치" },
      { url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko", source: "Google News", sub_category: "경제" }
    ];
    
    for (const feedObj of krFeeds) {
      try {
        const feed = await parser.parseURL(feedObj.url);
        const topItems = feed.items.slice(0, 8);
        
        // Fetch OG images concurrently
        const ogImages = await Promise.all(
          topItems.map((item) => {
            const link = item.link || feedObj.url;
            return fetchOgImage(link);
          })
        );

        for (let idx = 0; idx < topItems.length; idx++) {
          const item = topItems[idx];
          const fullTitle = item.title || "No Title";
          const titleParts = fullTitle.split(" - ");
          let sourceName = feedObj.source;
          let title = fullTitle;
          if (titleParts.length > 1) {
            sourceName = titleParts.pop() || sourceName;
            title = titleParts.join(" - ");
          }
          news.push({
            category: "KR",
            title: title,
            origin_url: item.link || feedObj.url,
            source: sourceName,
            timestamp: item.pubDate || new Date().toISOString(),
            image_url: ogImages[idx],
            sub_category: feedObj.sub_category,
          });
          if (title) krNewsTitles.push(title);
        }
      } catch (e) {
        console.error(`Google News RSS fetch error for ${feedObj.url}:`, e);
      }
    }

    // --- 4. Generate AI Summaries (Gemini) ---
    const briefingTargets = [
      { type: "US", titles: usNewsTitles, name: "미국(글로벌)" },
      { type: "KR", titles: krNewsTitles, name: "한국" },
    ];

    for (const target of briefingTargets) {
      if (target.titles.length > 0) {
        try {
          const prompt = `You are a top-tier financial analyst. Read the following ${target.name} news headlines and provide a comprehensive 3-sentence summary of the overall market trend in Korean.
CRITICAL: You MUST base your summary STRICTLY and ONLY on the provided headlines below. DO NOT include any outside knowledge, past events, or hallucinated facts.
Also provide 3 to 5 key takeaway keywords (hashtags).
Return ONLY valid JSON in this exact format, with no markdown formatting or extra text:
{
  "summary": "3-sentence market summary in Korean.",
  "keywords": ["#keyword1", "#keyword2", "#keyword3"]
}

Headlines:
${target.titles.join("\n")}
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
              session_type: target.type,
              ai_summary: parsed.summary,
              key_takeaways: parsed.keywords,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error(`Gemini ${target.type} Error:`, e);
        }
      }
    }

    // --- 5. Fetch Naver Finance Data ---
    const naverIndices: any[] = [];
    const naverPopularStocks: any[] = [];
    try {
      // 5.0 Scrape investor trends (개인, 외인, 기관 매수세)
      let trends = {
        KOSPI: { individual: undefined, foreign: undefined, institution: undefined },
        KOSDAQ: { individual: undefined, foreign: undefined, institution: undefined }
      };
      try {
        const siseRes = await fetch("https://finance.naver.com/sise/");
        const siseBuf = await siseRes.arrayBuffer();
        const siseHtml = new TextDecoder("euc-kr").decode(siseBuf);

        const parseTrendHtml = (id: string) => {
          const idx = siseHtml.indexOf(`class="t" id="${id}"`);
          if (idx === -1) return {};
          const end = siseHtml.indexOf('</ul>', idx);
          const chunk = siseHtml.substring(idx, end + 5);
          
          const resObj: any = {};
          const regex = /<span class="tit">([^<]+)<\/span><span class="val (up|dn)"><em>([^<]+)<\/em>억<\/span>/g;
          let match;
          while ((match = regex.exec(chunk)) !== null) {
            const type = match[1];
            const val = match[3];
            if (type === "개인") resObj.individual = val;
            else if (type === "외국인") resObj.foreign = val;
            else if (type === "기관") resObj.institution = val;
          }
          return resObj;
        };

        trends.KOSPI = parseTrendHtml("tab_sel1_deal_trend") as any;
        trends.KOSDAQ = parseTrendHtml("tab_sel2_deal_trend") as any;
      } catch (e) {
        console.error("Error scraping investor trends in fetchAndSummarize:", e);
      }

      // 5.1 KOSPI & KOSDAQ Detailed Indices
      const indices = ["KOSPI", "KOSDAQ"];
      for (const idx of indices) {
        try {
          const res = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/index/${idx}`);
          const data = await res.json();
          if (data && data.datas && data.datas.length > 0) {
            const info = data.datas[0];
            const tr = (trends as any)[idx] || {};
            naverIndices.push({
              name: idx,
              closePrice: info.closePrice,
              compareToPreviousClosePrice: info.compareToPreviousClosePrice,
              fluctuationsRatio: info.fluctuationsRatio,
              accumulatedTradingVolume: info.accumulatedTradingVolume,
              accumulatedTradingValue: info.accumulatedTradingValue,
              individual: tr.individual,
              foreign: tr.foreign,
              institution: tr.institution,
            });
          }
        } catch (e) {
          console.error(`Naver Finance Index Error (${idx}):`, e);
        }
      }

      // 5.2 Volume Surge Stocks Top 5
      try {
        const res = await fetch("https://finance.naver.com/sise/sise_quant_high.naver");
        const arrayBuffer = await res.arrayBuffer();
        const decoder = new TextDecoder("euc-kr");
        const html = decoder.decode(arrayBuffer);
        const regex = /<a href="\/item\/main\.naver\?code=[0-9]+" class="tltle">([^<]+)<\/a>/g;
        let match;
        let rank = 1;
        while ((match = regex.exec(html)) !== null && rank <= 5) {
          naverPopularStocks.push({
            rank,
            name: match[1],
          });
          rank++;
        }
      } catch (e) {
        console.error("Naver Popular Stocks Error:", e);
      }
    } catch (e) {
      console.error("Naver Finance Fetch Error:", e);
    }

    // --- 6. Save Data ---
    await ctx.runMutation(internal.news.saveMarketData, {
      metrics,
      news,
      briefings,
    });
    
    await ctx.runMutation(internal.news.saveNaverData, {
      indices: naverIndices,
      popularStocks: naverPopularStocks,
    });
  },
});

export const updateRealtimeData = action({
  args: {},
  handler: async (ctx) => {
    const symbols = [
      { ticker: "^GSPC", name: "S&P 500", session: "US" },
      { ticker: "^IXIC", name: "NASDAQ", session: "US" },
      { ticker: "^DJI", name: "Dow Jones", session: "US" },
      { ticker: "^KS11", name: "KOSPI", session: "KR" },
      { ticker: "^KQ11", name: "KOSDAQ", session: "KR" },
    ];
    const metricsPromises = symbols.map(async (s) => {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.ticker}?interval=1d`);
        const data = await res.json();
        if (data.chart.result && data.chart.result.length > 0) {
          const meta = data.chart.result[0].meta;
          const current_value = meta.regularMarketPrice;
          const prev_close = meta.chartPreviousClose;
          const change_value = current_value - prev_close;
          const change_percent = (change_value / prev_close) * 100;
          return {
            ticker: s.ticker,
            name: s.name,
            current_value,
            change_value,
            change_percent,
            session_type: s.session,
          };
        }
      } catch (e) {
        console.error(`Error fetching ${s.ticker}:`, e);
      }
      return null;
    });

    const metricsResults = await Promise.all(metricsPromises);
    const metrics = metricsResults.filter((m): m is any => m !== null);
    await ctx.runMutation(internal.news.saveMetricsOnly, { metrics });

    // 2. Update Naver Finance Data (KOSPI/KOSDAQ Indices & Popular Stocks)
    const naverIndices: any[] = [];
    const naverPopularStocks: any[] = [];
    try {
      // 2.0 Scrape investor trends (개인, 외인, 기관 매수세)
      let trends = {
        KOSPI: { individual: undefined, foreign: undefined, institution: undefined },
        KOSDAQ: { individual: undefined, foreign: undefined, institution: undefined }
      };
      try {
        const siseRes = await fetch("https://finance.naver.com/sise/");
        const siseBuf = await siseRes.arrayBuffer();
        const siseHtml = new TextDecoder("euc-kr").decode(siseBuf);

        const parseTrendHtml = (id: string) => {
          const idx = siseHtml.indexOf(`class="t" id="${id}"`);
          if (idx === -1) return {};
          const end = siseHtml.indexOf('</ul>', idx);
          const chunk = siseHtml.substring(idx, end + 5);
          
          const resObj: any = {};
          const regex = /<span class="tit">([^<]+)<\/span><span class="val (up|dn)"><em>([^<]+)<\/em>억<\/span>/g;
          let match;
          while ((match = regex.exec(chunk)) !== null) {
            const type = match[1];
            const val = match[3];
            if (type === "개인") resObj.individual = val;
            else if (type === "외국인") resObj.foreign = val;
            else if (type === "기관") resObj.institution = val;
          }
          return resObj;
        };

        trends.KOSPI = parseTrendHtml("tab_sel1_deal_trend") as any;
        trends.KOSDAQ = parseTrendHtml("tab_sel2_deal_trend") as any;
      } catch (e) {
        console.error("Error scraping investor trends in updateRealtimeData:", e);
      }

      const indices = ["KOSPI", "KOSDAQ"];
      for (const idx of indices) {
        try {
          const res = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/index/${idx}`);
          const data = await res.json();
          if (data && data.datas && data.datas.length > 0) {
            const info = data.datas[0];
            const tr = (trends as any)[idx] || {};
            naverIndices.push({
              name: idx,
              closePrice: info.closePrice,
              compareToPreviousClosePrice: info.compareToPreviousClosePrice,
              fluctuationsRatio: info.fluctuationsRatio,
              accumulatedTradingVolume: info.accumulatedTradingVolume,
              accumulatedTradingValue: info.accumulatedTradingValue,
              individual: tr.individual,
              foreign: tr.foreign,
              institution: tr.institution,
            });
          }
        } catch (e) {
          console.error(`Naver Finance Index Error (${idx}):`, e);
        }
      }

      try {
        const res = await fetch("https://finance.naver.com/sise/sise_quant_high.naver");
        const arrayBuffer = await res.arrayBuffer();
        const decoder = new TextDecoder("euc-kr");
        const html = decoder.decode(arrayBuffer);
        const regex = /<a href="\/item\/main\.naver\?code=[0-9]+" class="tltle">([^<]+)<\/a>/g;
        let match;
        let rank = 1;
        while ((match = regex.exec(html)) !== null && rank <= 5) {
          naverPopularStocks.push({
            rank,
            name: match[1],
          });
          rank++;
        }
      } catch (e) {
        console.error("Naver Popular Stocks Error:", e);
      }
    } catch (e) {
      console.error("Naver Finance Fetch Error:", e);
    }

    await ctx.runMutation(internal.news.saveNaverData, {
      indices: naverIndices,
      popularStocks: naverPopularStocks,
    });

    // 3. Fetch Stock Historical Charts for Samsung, Hynix, Hyundai, Celltrion (Free 1-Month Area Charts)
    const stockTickers = [
      { ticker: "005930.KS", name: "삼성전자", code: "005930" },
      { ticker: "000660.KS", name: "SK하이닉스", code: "000660" },
      { ticker: "005380.KS", name: "현대차", code: "005380" },
      { ticker: "068270.KS", name: "셀트리온", code: "068270" },
    ];

    // Fetch Naver real-time stock prices
    const naverPricesMap = new Map<string, { currentPrice: number, changePercent: number }>();
    try {
      const naverRes = await fetch("https://polling.finance.naver.com/api/realtime/domestic/stock/005930,000660,005380,068270");
      const naverJson = await naverRes.json();
      if (naverJson && naverJson.datas) {
        for (const stock of naverJson.datas) {
          naverPricesMap.set(stock.itemCode, {
            currentPrice: parseFloat(stock.closePriceRaw),
            changePercent: parseFloat(stock.fluctuationsRatioRaw),
          });
        }
      }
    } catch (e) {
      console.error("Error fetching Naver real-time stock prices in actions:", e);
    }

    const chartsPromises = stockTickers.map(async (item) => {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${item.ticker}?range=1mo&interval=1d`);
        const data = await res.json();
        if (data.chart.result && data.chart.result.length > 0) {
          const result = data.chart.result[0];
          const rawPrices = result.indicators.quote[0].close || [];
          const rawTimestamps = result.timestamp || [];
          const prices: number[] = [];
          const timestamps: number[] = [];
          
          for (let i = 0; i < rawPrices.length; i++) {
            if (rawPrices[i] !== null && rawPrices[i] !== undefined && rawTimestamps[i] !== undefined) {
              prices.push(rawPrices[i]);
              timestamps.push(rawTimestamps[i]);
            }
          }

          const naverData = naverPricesMap.get(item.code) || { 
            currentPrice: prices[prices.length - 1] || 0, 
            changePercent: 0 
          };

          return {
            ticker: item.ticker,
            name: item.name,
            prices,
            timestamps,
            currentPrice: naverData.currentPrice,
            changePercent: naverData.changePercent,
          };
        }
      } catch (e) {
        console.error(`Error fetching historical chart for ${item.ticker}:`, e);
      }
      return null;
    });

    const chartsResults = await Promise.all(chartsPromises);
    const charts = chartsResults.filter((c): c is any => c !== null);
    if (charts.length > 0) {
      await ctx.runMutation(internal.news.saveStockCharts, { charts });
    }
  }
});
