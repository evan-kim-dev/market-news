"use client";

import { useState, useEffect, memo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { TickerTape, AdvancedRealTimeChart, EconomicCalendar, Timeline } from "react-ts-tradingview-widgets";

// Memoize TradingView widgets so they never re-render unless keys change
const MemoizedTickerTape = memo(TickerTape);
const MemoizedAdvancedChart = memo(AdvancedRealTimeChart);
const MemoizedEconomicCalendar = memo(EconomicCalendar);
const MemoizedTimeline = memo(Timeline);

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
      className="px-6 py-2.5 bg-white text-black hover:bg-neutral-200 disabled:opacity-50 rounded-full transition-colors text-sm font-semibold tracking-wide"
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
        <h2 className="text-lg font-semibold text-white tracking-tight">주요 주가지수</h2>
        {metrics && metrics.length > 0 && (
          <span className="text-neutral-500 text-xs font-medium bg-neutral-900 px-2 py-1 rounded">
            마지막 갱신: {new Date(metrics[0]._creationTime).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>
      {metrics.map((m: any) => {
        const isUp = m.change_percent >= 0;
        const colorClass = isUp ? "text-red-500" : "text-blue-500";
        return (
          <div key={m.ticker} className="flex flex-col bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
            <span className="text-neutral-400 font-medium mb-3 text-xs uppercase tracking-widest">{m.name}</span>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold tracking-tighter text-white">{m.current_value.toFixed(2)}</span>
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

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-4 h-full min-h-[250px]">
      <h3 className="text-sm font-medium text-neutral-400">AI 글로벌 시황 분석</h3>
      {briefing === undefined ? (
        <div className="text-neutral-500">브리핑을 불러오는 중...</div>
      ) : briefing === null ? (
        <div className="text-neutral-500">브리핑 데이터가 없습니다. 상단 우측 버튼을 눌러주세요.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {briefing.key_takeaways.map((kw: any, i: any) => (
              <span key={i} className="px-2.5 py-1 bg-neutral-800 text-white rounded-md text-xs font-semibold tracking-wide border border-neutral-700">
                {kw}
              </span>
            ))}
          </div>
          <div className="text-sm leading-relaxed text-neutral-300 font-medium whitespace-pre-line tracking-tight mt-2">
            {briefing.ai_summary}
          </div>
        </>
      )}
    </div>
  );
}

function NewsFeed({ sessionType, title, categories }: { sessionType: string, title: string, categories: {label: string, value: string}[] }) {
  const [category, setCategory] = useState("전체");
  const news = useQuery(api.news.getNews, { session_type: sessionType });
  const filteredNews = category === "전체" ? news : news?.filter((n: any) => n.sub_category === category);

  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-neutral-800 pb-3">
        <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
      </div>
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-medium text-neutral-400">실시간 뉴스 피드</h3>
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors ${category === cat.value ? "bg-white text-black" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
      
      {filteredNews === undefined ? (
        <div className="text-neutral-500">뉴스를 불러오는 중...</div>
      ) : filteredNews.length === 0 ? (
        <div className="text-neutral-500">해당 카테고리의 뉴스 데이터가 없습니다.</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredNews.slice(0, 9).map((n: any) => (
            <a
              key={n._id}
              href={n.origin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-[4/3] bg-neutral-900 rounded-xl overflow-hidden hover:opacity-90 transition-all border border-neutral-800"
            >
              {n.image_url ? (
                <img src={n.image_url} alt={n.title} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="absolute inset-0 p-4 flex flex-col justify-end">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold text-neutral-300 tracking-wider uppercase bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">{n.source}</span>
                  {n.sub_category && (
                    <span className="text-[9px] font-bold text-blue-300 tracking-wider uppercase bg-blue-900/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                      {categories.find(c => c.value === n.sub_category)?.label || n.sub_category}
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

  useEffect(() => {
    const kstHour = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul", hour12: false, hour: "numeric" });
    const hour = parseInt(kstHour);
    setIsKrTime(hour >= 8 && hour < 17);
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Ticker Tape */}
      <div className="w-full sticky top-0 z-50 shadow-xl border-b border-neutral-800 bg-neutral-900">
        <MemoizedTickerTape 
          colorTheme="dark" 
          displayMode="compact" 
          showSymbolLogo={true} 
          isTransparent={true} 
          symbols={isKrTime ? KR_SYMBOLS : US_SYMBOLS} 
        />
      </div>

      <div className="p-6 lg:p-8 max-w-[1800px] w-full mx-auto flex flex-col gap-8">
        {/* Refresh Button */}
        <div className="flex justify-end">
          <RefreshButton />
        </div>

        {/* Top: Indices & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-4 flex flex-col gap-4">
            <MarketIndices />
          </section>
          <section className="lg:col-span-8 h-[380px] lg:h-auto rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800">
            <MemoizedAdvancedChart theme="dark" symbol="NASDAQ:IXIC" autosize />
          </section>
        </div>

        {/* Middle: Global AI, Economic Calendar & Global Community */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          <section className="lg:col-span-1">
            <GlobalAIBriefing />
          </section>
          <section className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden h-[350px]">
            <MemoizedEconomicCalendar colorTheme="dark" locale="kr" width="100%" height="100%" isTransparent={true} />
          </section>
          <section className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden h-[350px]">
            <MemoizedTimeline colorTheme="dark" locale="kr" displayMode="compact" width="100%" height="100%" isTransparent={true} />
          </section>
        </div>

        {/* Bottom: US News & KR News */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-4">
          <NewsFeed 
            sessionType="GLOBAL" 
            title="해외 마켓 주요 뉴스" 
            categories={[
              {label: "전체", value: "전체"}, 
              {label: "국제", value: "World"}, 
              {label: "일반", value: "General"}, 
              {label: "경제", value: "Economy"}
            ]} 
          />
          <NewsFeed 
            sessionType="KR" 
            title="국내 마켓 주요 뉴스" 
            categories={[
              {label: "전체", value: "전체"}, 
              {label: "정치", value: "정치"}, 
              {label: "경제", value: "경제"}, 
              {label: "사회", value: "사회"}, 
              {label: "IT과학", value: "IT과학"}
            ]} 
          />
        </div>
      </div>
    </div>
  );
}
