"use client";

import { useState, useEffect, memo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { TickerTape, AdvancedRealTimeChart, EconomicCalendar, Timeline, StockHeatmap } from "react-ts-tradingview-widgets";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "next-themes";

// Memoize TradingView widgets so they never re-render unless keys change
const MemoizedTickerTape = memo(TickerTape);
const MemoizedAdvancedChart = memo(AdvancedRealTimeChart);
const MemoizedEconomicCalendar = memo(EconomicCalendar);
const MemoizedTimeline = memo(Timeline);
const MemoizedStockHeatmap = memo(StockHeatmap);

const US_SYMBOLS = [
  { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
  { proName: "FOREXCOM:NSXUSD", title: "Nasdaq 100" },
  { proName: "NASDAQ:AAPL", title: "Apple" },
  { proName: "NASDAQ:NVDA", title: "NVIDIA" },
  { proName: "NASDAQ:TSLA", title: "Tesla" },
  { proName: "NASDAQ:MSFT", title: "Microsoft" },
  { proName: "NASDAQ:AMZN", title: "Amazon" },
  { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
];

const KR_SYMBOLS = [
  { proName: "FX_IDC:KRWUSD", title: "KRW/USD" },
  { proName: "KRX:005930", title: "삼성전자" },
  { proName: "KRX:000660", title: "SK하이닉스" },
  { proName: "KRX:373220", title: "LG에너지솔루션" },
  { proName: "KRX:207940", title: "삼성바이오로직스" },
  { proName: "KRX:005380", title: "현대차" },
  { proName: "KRX:068270", title: "셀트리온" },
  { proName: "KRX:000270", title: "기아" },
];

function RefreshButton() {
  const fetchAndSummarize = useAction(api.actions.fetchAndSummarize);
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await fetchAndSummarize();
    } catch (e) {
      console.error(e);
      alert("데이터 갱신 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isLoading}
      className="px-6 py-2.5 bg-neutral-900 text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 rounded-full transition-colors text-sm font-semibold tracking-wide"
    >
      {isLoading ? "업데이트 중..." : "최신 데이터 불러오기"}
    </button>
  );
}

function MarketIndices() {
  const metrics = useQuery(api.news.getMarketMetrics);

  if (metrics === undefined) return <div className="text-neutral-500 py-4">지수 데이터를 불러오는 중...</div>;
  if (metrics.length === 0) return <div className="text-neutral-500 py-4">데이터가 없습니다. 우측 상단의 버튼을 눌러주세요.</div>;

  return (
    <>
      <div className="flex justify-between items-end mb-[-8px]">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white tracking-tight">주요 주가지수</h2>
        {metrics && metrics.length > 0 && (
          <span className="text-neutral-500 text-xs font-medium bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded">
            마지막 갱신: {new Date(metrics[0]._creationTime).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>
      {metrics.map((m: any) => {
        const isUp = m.change_percent >= 0;
        const colorClass = isUp ? "text-red-500" : "text-blue-500";
        return (
          <div key={m.ticker} className="flex flex-col bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-500 dark:text-neutral-400 font-medium mb-3 text-xs uppercase tracking-widest">{m.name}</span>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold tracking-tighter text-neutral-900 dark:text-white">{m.current_value.toFixed(2)}</span>
              <div className={`text-lg font-medium tracking-tight mb-1 flex items-center gap-1.5 ${colorClass}`}>
                {isUp ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
                )}
                <span className="mt-0.5">
                  {Math.abs(m.change_value).toFixed(2)} ({isUp ? "+" : ""}{m.change_percent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function GlobalAIBriefing() {
  const briefing = useQuery(api.news.getLatestBriefing, { session_type: "GLOBAL" });
  const askQuestion = useAction(api.chat?.askBriefingQuestion);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !briefing) return;
    
    const userMsg = input.trim();
    setInput("");
    const newHistory = [...messages, { role: "user", content: userMsg }];
    setMessages(newHistory);
    setIsLoading(true);
    
    try {
      if (!api.chat?.askBriefingQuestion) throw new Error("Chat action not ready");
      const response = await askQuestion({
        message: userMsg,
        briefingContext: briefing.ai_summary,
        history: messages
      });
      setMessages([...newHistory, { role: "model", content: response }]);
    } catch (err) {
      console.error(err);
      setMessages([...newHistory, { role: "model", content: "앗, 오류가 발생했습니다. 잠시 후 다시 시도해주세요!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col h-[350px] overflow-hidden shadow-sm">
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50 dark:bg-neutral-900 z-10 relative">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">AI 심층 분석 & 챗봇</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-sm relative scrollbar-thin">
        {briefing === undefined ? (
          <div className="text-neutral-500 text-center mt-10">데이터를 불러오는 중...</div>
        ) : briefing === null ? (
          <div className="text-neutral-500 text-center mt-10">브리핑 데이터가 없습니다. 상단 우측 버튼을 눌러주세요.</div>
        ) : (
          <>
            <div className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 p-4 rounded-2xl rounded-tl-sm self-start max-w-[95%] whitespace-pre-line leading-relaxed shadow-sm">
              <div className="font-bold mb-3 flex items-center gap-1.5 text-blue-500 dark:text-blue-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 13H7v-2h2v2zm0-4H7V5h2v4z"></path></svg>
                오늘의 시황 브리핑
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {briefing.key_takeaways.map((kw: any, i: any) => (
                  <span key={i} className="px-2 py-0.5 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-white rounded text-[10px] font-semibold tracking-wide border border-neutral-200 dark:border-neutral-700 shadow-sm">
                    {kw}
                  </span>
                ))}
              </div>
              {briefing.ai_summary}
            </div>

            {messages.map((m, i) => (
              <div key={i} className={`p-3 rounded-2xl max-w-[90%] whitespace-pre-line leading-relaxed shadow-sm ${m.role === "user" ? "bg-blue-600 text-white self-end rounded-tr-sm" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 self-start rounded-tl-sm"}`}>
                {m.content}
              </div>
            ))}
            
            {isLoading && (
              <div className="bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 p-3 rounded-2xl rounded-tl-sm self-start max-w-[80%] flex items-center gap-2">
                <span className="animate-pulse">분석 중...</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50 dark:bg-neutral-900">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || !briefing}
            placeholder="시황에 대해 질문해보세요..."
            className="flex-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={isLoading || !briefing || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center shrink-0"
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
}

function NewsFeed({ sessionType, title }: { sessionType: string, title: string }) {
  const news = useQuery(api.news.getNews, { session_type: sessionType });

  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-3 flex justify-between items-center">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</h2>
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">실시간 뉴스 피드</h3>
      </div>
      
      {news === undefined ? (
        <div className="text-neutral-500">뉴스를 불러오는 중...</div>
      ) : news.length === 0 ? (
        <div className="text-neutral-500">뉴스 데이터가 없습니다. 상단 우측 버튼을 눌러주세요.</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {news.slice(0, 15).map((n: any) => (
            <a
              key={n._id}
              href={n.origin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-[4/3] bg-neutral-100 dark:bg-neutral-900 rounded-xl overflow-hidden hover:opacity-90 transition-all border border-neutral-200 dark:border-neutral-800 shadow-sm"
            >
              {n.image_url ? (
                <img src={n.image_url} alt={n.title} className="absolute inset-0 w-full h-full object-cover opacity-80 dark:opacity-60 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="absolute inset-0 p-4 flex flex-col justify-end">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold text-neutral-200 dark:text-neutral-300 tracking-wider uppercase bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">{n.source}</span>
                  {n.sub_category && (
                    <span className="text-[9px] font-bold text-blue-200 dark:text-blue-300 tracking-wider uppercase bg-blue-900/60 dark:bg-blue-900/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                      {n.sub_category}
                    </span>
                  )}
                </div>
                <h4 className="text-white font-medium leading-snug line-clamp-2 text-xs shadow-sm">
                  {n.title}
                </h4>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketCommandCenter() {
  const [isKrTime, setIsKrTime] = useState(true);
  const { theme } = useTheme();
  // hydration mismatch 방지를 위해 마운트 체크
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const kstHour = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul", hour12: false, hour: "numeric" });
    const hour = parseInt(kstHour);
    setIsKrTime(hour >= 8 && hour < 17);
  }, []);

  const tvTheme = mounted && theme === "light" ? "light" : "dark";

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black flex flex-col transition-colors duration-300">
      {/* Ticker Tape */}
      <div className="w-full sticky top-0 z-50 shadow-sm dark:shadow-xl border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-colors duration-300">
        {mounted && (
          <MemoizedTickerTape 
            colorTheme={tvTheme} 
            displayMode="compact" 
            showSymbolLogo={true} 
            isTransparent={true} 
            symbols={isKrTime ? KR_SYMBOLS : US_SYMBOLS} 
          />
        )}
      </div>

      <div className="p-6 lg:p-8 max-w-[1800px] w-full mx-auto flex flex-col gap-8">
        {/* Header Actions */}
        <div className="flex justify-end items-center gap-3">
          {mounted && <ThemeToggle />}
          <RefreshButton />
        </div>

        {/* Top: Indices & Chart & Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-3 flex flex-col gap-4">
            <MarketIndices />
          </section>
          <section className="lg:col-span-5 h-[380px] lg:h-auto rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm transition-colors duration-300">
            {mounted && <MemoizedAdvancedChart theme={tvTheme} symbol="NASDAQ:IXIC" autosize />}
          </section>
          <section className="lg:col-span-4 h-[380px] lg:h-auto rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm transition-colors duration-300">
            {mounted && <MemoizedStockHeatmap colorTheme={tvTheme} height="100%" width="100%" hasTopBar={false} />}
          </section>
        </div>

        {/* Middle: Global AI, Economic Calendar & Global Community */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          <section className="lg:col-span-1">
            <GlobalAIBriefing />
          </section>
          <section className="lg:col-span-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden h-[350px] relative shadow-sm transition-colors duration-300">
            <div className="absolute top-0 left-0 right-0 h-[48px] bg-neutral-50 dark:bg-neutral-900 z-10 flex items-center px-6 border-b border-neutral-200 dark:border-neutral-800">
               <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">주요 경제 캘린더</h3>
            </div>
            <div className="w-full h-[calc(100%+48px)] mt-[-48px]">
              {mounted && <MemoizedEconomicCalendar colorTheme={tvTheme} locale="kr" width="100%" height="100%" isTransparent={true} />}
            </div>
          </section>
          <section className="lg:col-span-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden h-[350px] relative shadow-sm transition-colors duration-300">
            <div className="absolute top-0 left-0 right-0 h-[48px] bg-neutral-50 dark:bg-neutral-900 z-10 flex items-center px-6 border-b border-neutral-200 dark:border-neutral-800">
               <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">실시간 글로벌 주요 뉴스</h3>
            </div>
            <div className="w-full h-[calc(100%+48px)] mt-[-48px]">
              {mounted && <MemoizedTimeline colorTheme={tvTheme} locale="kr" displayMode="compact" width="100%" height="100%" isTransparent={true} />}
            </div>
          </section>
        </div>

        {/* Bottom: US News & KR News */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-4">
          <NewsFeed 
            sessionType="GLOBAL" 
            title="해외 주요 뉴스" 
          />
          <NewsFeed 
            sessionType="KR" 
            title="국내 주요 뉴스" 
          />
        </div>
      </div>
    </div>
  );
}
