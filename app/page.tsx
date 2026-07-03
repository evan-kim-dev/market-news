"use client";

import { useState, useEffect, useRef, memo } from "react";
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

function PriceFlasher({ value, children }: { value: any, children: React.ReactNode }) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      const p = parseFloat(String(prevValue.current).replace(/,/g, ''));
      const c = parseFloat(String(value).replace(/,/g, ''));
      
      let isUp = true;
      if (!isNaN(p) && !isNaN(c)) {
         isUp = c >= p;
      }

      setFlash(isUp ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 1000);
      prevValue.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  let flashClass = "transition-all duration-700 ease-out ";
  if (flash === "up") {
    flashClass += "bg-red-500/30 text-red-600 dark:text-red-300 scale-105 rounded px-1.5 py-0.5 -mx-1.5 shadow-[0_0_12px_rgba(239,68,68,0.5)]";
  } else if (flash === "down") {
    flashClass += "bg-blue-500/30 text-blue-600 dark:text-blue-300 scale-105 rounded px-1.5 py-0.5 -mx-1.5 shadow-[0_0_12px_rgba(59,130,246,0.5)]";
  } else {
    flashClass += "bg-transparent scale-100";
  }

  return (
    <span className={`inline-block ${flashClass}`}>
      {children}
    </span>
  );
}

function RealTimeClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) return null;

  const parseParts = (dt: Date, tz: string) => {
    const formatter = new Intl.DateTimeFormat("ko-KR", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(dt);
    const map = parts.reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {} as Record<string, string>);
    return map;
  };

  const seoul = parseParts(time, "Asia/Seoul");
  const ny = parseParts(time, "America/New_York");

  const seoulDay = time.toLocaleString("en-US", { timeZone: "Asia/Seoul", weekday: "short" });
  const seoulHour = parseInt(seoul.hour);
  const seoulMin = parseInt(seoul.minute);
  const seoulWeekend = seoulDay === "Sat" || seoulDay === "Sun";
  const seoulMarketOpen = !seoulWeekend && (
    (seoulHour === 9) || 
    (seoulHour > 9 && seoulHour < 15) || 
    (seoulHour === 15 && seoulMin <= 30)
  );

  const nyDay = time.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short" });
  const nyHour = parseInt(ny.hour);
  const nyMin = parseInt(ny.minute);
  const nyWeekend = nyDay === "Sat" || nyDay === "Sun";
  const nyMarketOpen = !nyWeekend && (
    (nyHour > 9 && nyHour < 16) || 
    (nyHour === 9 && nyMin >= 30)
  );

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 bg-neutral-200/40 dark:bg-neutral-800/40 border border-neutral-300/30 dark:border-white/5 px-5 py-2 rounded-2xl md:rounded-full backdrop-blur-md shadow-sm">
      {/* Seoul Time */}
      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 font-mono select-none">
        <span className="relative flex h-1.5 w-1.5">
          {seoulMarketOpen && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${seoulMarketOpen ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
        </span>
        <span className="text-[10px] text-neutral-450 dark:text-neutral-500 font-sans font-bold">서울</span>
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{seoul.month}.{seoul.day}</span>
        <span className="text-sm font-bold bg-gradient-to-r from-neutral-950 to-neutral-700 dark:from-white dark:to-neutral-300 bg-clip-text text-transparent">
          {seoul.hour}:{seoul.minute}:{seoul.second}
        </span>
        <span className={`text-[8px] px-1 py-0.2 rounded font-sans font-extrabold tracking-tight ${seoulMarketOpen ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-neutral-500/10 text-neutral-500'}`}>
          {seoulMarketOpen ? '장중' : '장외'}
        </span>
      </div>

      {/* Divider */}
      <span className="hidden md:inline text-neutral-300 dark:text-neutral-700 text-xs">|</span>

      {/* New York Time */}
      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 font-mono select-none">
        <span className="relative flex h-1.5 w-1.5">
          {nyMarketOpen && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${nyMarketOpen ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
        </span>
        <span className="text-[10px] text-neutral-455 dark:text-neutral-500 font-sans font-bold">뉴욕</span>
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{ny.month}.{ny.day}</span>
        <span className="text-sm font-bold bg-gradient-to-r from-neutral-950 to-neutral-700 dark:from-white dark:to-neutral-300 bg-clip-text text-transparent">
          {ny.hour}:{ny.minute}:{ny.second}
        </span>
        <span className={`text-[8px] px-1 py-0.2 rounded font-sans font-extrabold tracking-tight ${nyMarketOpen ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-neutral-500/10 text-neutral-500'}`}>
          {nyMarketOpen ? '장중' : '장외'}
        </span>
      </div>
    </div>
  );
}

function CustomAreaChart({ chartData }: { chartData: any }) {
  const { prices, name, ticker, currentPrice, changePercent } = chartData;
  if (!prices || prices.length === 0) {
    return <div className="text-neutral-500 text-xs p-4">차트 데이터가 없습니다.</div>;
  }

  const realPrice = currentPrice !== undefined ? currentPrice : (prices[prices.length - 1] || 0);
  const realChange = changePercent !== undefined ? changePercent : 0;
  const allPrices = [...prices, realPrice];
  const isUp = realChange >= 0;

  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min === 0 ? 1 : max - min;
  
  const pad = range * 0.05;
  const plotMin = min - pad;
  const plotMax = max + pad;
  const plotRange = plotMax - plotMin;

  const width = 500;
  const height = 150;

  const points = allPrices.map((price: number, idx: number) => {
    const x = (idx / (allPrices.length - 1)) * width;
    const y = height - ((price - plotMin) / plotRange) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  const themeColor = isUp ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'; 
  const gradientId = `grad-${ticker.replace(/\./g, '-')}`;

  return (
    <div className="flex-1 w-full h-full flex flex-col justify-between p-4 bg-white/85 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/60 dark:border-white/10 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
      {/* Header Info */}
      <div className="flex justify-between items-start z-10">
        <div className="flex flex-col">
          <span className="text-neutral-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-wider">{name}</span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium tracking-tight">{ticker.split('.')[0]}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-base font-black text-neutral-900 dark:text-white tracking-tight">{realPrice.toLocaleString()}원</span>
          <span className={`text-[11px] font-bold flex items-center gap-0.5 ${isUp ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(realChange).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* SVG Chart Area */}
      <div className="flex-1 min-h-[110px] w-full mt-3 relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeColor} stopOpacity="0.2"/>
              <stop offset="100%" stopColor={themeColor} stopOpacity="0.0"/>
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradientId})`} />
          <path d={pathD} fill="none" stroke={themeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Bottom Range Info */}
      <div className="flex justify-between items-center text-[9px] text-neutral-400 dark:text-neutral-500 font-semibold border-t border-black/5 dark:border-white/5 pt-2 mt-2 z-10">
        <span>최저: {min.toLocaleString()}원</span>
        <span className="text-[8px] bg-neutral-200/50 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-500">1개월 추이</span>
        <span>최고: {max.toLocaleString()}원</span>
      </div>
    </div>
  );
}

function InvestorTrends() {
  const indices = useQuery(api.news.getNaverIndices);

  if (indices === undefined) return <div className="text-neutral-500 py-2 text-xs">투자자 매매동향 로딩 중...</div>;
  if (indices.length === 0) return null;

  return (
    <div className="bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl rounded-2xl p-5 border border-neutral-200 dark:border-white/10 shadow-sm flex flex-col gap-3">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          실시간 투자자별 매매동향
        </h3>
        <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium">단위: 억 원</span>
      </div>

      <div className="flex flex-col gap-4">
        {indices.map((idx: any) => {
          const parseVal = (val: string | undefined) => {
            if (!val) return { num: 0, text: "0", color: "text-neutral-500" };
            const clean = val.replace(/,/g, '');
            const num = parseInt(clean);
            if (num > 0) return { num, text: val, color: "text-red-500 dark:text-red-400" };
            if (num < 0) return { num, text: val, color: "text-blue-500 dark:text-blue-400" };
            return { num, text: "0", color: "text-neutral-500" };
          };

          const ind = parseVal(idx.individual);
          const forg = parseVal(idx.foreign);
          const inst = parseVal(idx.institution);

          return (
            <div key={idx._id} className="p-3 rounded-xl bg-neutral-100/30 dark:bg-neutral-800/20 border border-black/5 dark:border-white/5">
              <div className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-2 border-b border-black/5 dark:border-white/5 pb-1 flex justify-between items-center">
                <span>{idx.name}</span>
                <span className="text-[9px] text-neutral-400 font-normal">실시간 집계</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium">개인</span>
                  <span className={`font-semibold ${ind.color}`}>{ind.text}</span>
                </div>
                <div className="flex flex-col gap-0.5 border-x border-black/5 dark:border-white/5">
                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium">외국인</span>
                  <span className={`font-semibold ${forg.color}`}>{forg.text}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium">기관</span>
                  <span className={`font-semibold ${inst.color}`}>{inst.text}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MarketIndices({ marketMode }: { marketMode: "US" | "KR" }) {
  const metrics = useQuery(api.news.getMarketMetrics);

  if (metrics === undefined) return <div className="text-neutral-500 py-4">지수 데이터를 불러오는 중...</div>;
  if (metrics.length === 0) return <div className="text-neutral-500 py-4">데이터가 없습니다. 우측 상단의 버튼을 눌러주세요.</div>;

  const filteredMetrics = metrics.filter((m: any) => m.session_type === marketMode);

  return (
    <>
      <div className="flex justify-between items-end mb-[-8px]">
        <h2 className="text-lg font-bold bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-400 bg-clip-text text-transparent tracking-tight">
          주요 주가지수 ({marketMode === "US" ? "미국" : "한국"})
        </h2>
        {metrics && metrics.length > 0 && (
          <span className="text-neutral-500 text-xs font-medium bg-neutral-200/50 dark:bg-neutral-800/50 px-2 py-1 rounded-md backdrop-blur-sm">
            마지막 갱신: {new Date(metrics[0]._creationTime).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>
      {filteredMetrics.map((m: any) => {
        const isUp = m.change_percent >= 0;
        const colorClass = isUp ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400";
        return (
          <div key={m.ticker} className="group flex flex-col bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl rounded-2xl p-6 border border-neutral-200 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              {isUp ? (
                <svg className="w-16 h-16 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
              ) : (
                <svg className="w-16 h-16 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/></svg>
              )}
            </div>
            <span className="text-neutral-500 dark:text-neutral-400 font-medium mb-3 text-xs uppercase tracking-widest relative z-10">{m.name}</span>
            <div className="flex items-end justify-between relative z-10">
              <PriceFlasher value={m.current_value}>
                <span className="text-3xl font-bold tracking-tighter text-neutral-900 dark:text-white">{m.current_value.toFixed(2)}</span>
              </PriceFlasher>
              <div className={`text-lg font-semibold tracking-tight mb-1 flex items-center gap-1 ${colorClass}`}>
                {isUp ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
                )}
                <PriceFlasher value={m.change_value}>
                  <span className="mt-0.5">
                    {Math.abs(m.change_value).toFixed(2)} ({isUp ? "+" : ""}{m.change_percent.toFixed(2)}%)
                  </span>
                </PriceFlasher>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function AIAndPopularStocks({ marketMode }: { marketMode: "US" | "KR" }) {
  const popularStocks = useQuery(api.news.getNaverPopularStocks);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* AI Analyst */}
      <section className="lg:col-span-1">
        <GlobalAIBriefing marketMode={marketMode} />
      </section>

      {/* Popular Stocks */}
      <section className="group bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white tracking-tight">📊 거래량 급상승 종목</h2>
          {popularStocks && popularStocks.length > 0 && (
            <span className="text-neutral-500 text-xs font-medium bg-neutral-200/50 dark:bg-neutral-800/50 px-2 py-1 rounded-md backdrop-blur-sm">
              마지막 갱신: {new Date(popularStocks[0]._creationTime).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
        {popularStocks === undefined ? (
          <div className="text-neutral-500 text-sm">데이터를 불러오는 중...</div>
        ) : popularStocks.length === 0 ? (
          <div className="text-neutral-500 text-sm">데이터가 없습니다.</div>
        ) : (
          <div className="flex-1 flex flex-col justify-between gap-2">
            {popularStocks.slice(0, 5).map((stock: any) => {
              let badgeColor = "text-neutral-400 dark:text-neutral-500 bg-neutral-100/50 dark:bg-neutral-850/50";
              let badgeText = "0";
              
              if (stock.rankChange === "NEW") {
                badgeColor = "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20";
                badgeText = "NEW";
              } else if (stock.rankChange && stock.rankChange.startsWith("+")) {
                badgeColor = "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20";
                badgeText = `▲ ${stock.rankChange.substring(1)}`;
              } else if (stock.rankChange && stock.rankChange.startsWith("-")) {
                badgeColor = "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20";
                badgeText = `▼ ${stock.rankChange.substring(1)}`;
              }

              return (
                <div key={stock._id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-100/50 dark:bg-neutral-800/40 border border-transparent dark:border-white/5 transition-colors duration-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 hover:border-neutral-300 dark:hover:border-white/10">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black w-5 text-center ${stock.rank <= 3 ? 'text-blue-500 dark:text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                      {stock.rank}
                    </span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200 tracking-tight">{stock.name}</span>
                  </div>
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeColor} tracking-wider min-w-[45px] text-center`}>
                    {badgeText}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function GlobalAIBriefing({ marketMode }: { marketMode: "US" | "KR" }) {
  const briefing = useQuery(api.news.getLatestBriefing, { session_type: marketMode });

  return (
    <div className="bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-2xl flex flex-col h-[350px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 relative">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="p-4 border-b border-neutral-200/50 dark:border-white/5 shrink-0 bg-neutral-100/50 dark:bg-neutral-800/30 z-10 relative flex justify-between items-center">
        <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          오늘의 AI 시황 브리핑 ({marketMode === "US" ? "미국 시장" : "한국 시장"})
        </h3>
        {briefing && briefing.timestamp && (
          <span className="text-neutral-500 text-[10px] font-medium bg-neutral-200/50 dark:bg-neutral-800/50 px-2 py-1 rounded-md">
            작성: {new Date(briefing.timestamp).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 text-sm relative scrollbar-thin scroll-smooth z-10">
        {briefing === undefined ? (
          <div className="text-neutral-500 text-center mt-10">데이터를 불러오는 중...</div>
        ) : briefing === null ? (
          <div className="text-neutral-500 text-center mt-10">브리핑 데이터가 없습니다. 상단 우측 버튼을 눌러주세요.</div>
        ) : (
          <div className="flex flex-col gap-4 leading-relaxed">
            <div className="flex flex-wrap gap-1.5">
              {briefing.key_takeaways.map((kw: any, i: any) => (
                <span key={i} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-bold tracking-wide border border-blue-200 dark:border-blue-800/50 shadow-sm">
                  {kw}
                </span>
              ))}
            </div>
            <div className="text-neutral-800 dark:text-neutral-200 whitespace-pre-line text-[13px] leading-relaxed">
              {briefing.ai_summary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FloatingChatbot({ marketMode }: { marketMode: "US" | "KR" }) {
  const [isOpen, setIsOpen] = useState(false);
  const briefing = useQuery(api.news.getLatestBriefing, { session_type: marketMode });
  const askQuestion = useAction(api.chat?.askBriefingQuestion);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="w-[340px] sm:w-[380px] h-[480px] bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 border-b border-neutral-200/60 dark:border-white/5 bg-neutral-100/50 dark:bg-neutral-800/40 flex justify-between items-center z-10">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <h3 className="text-xs font-black text-neutral-800 dark:text-neutral-200">AI 애널리스트 챗봇</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs scrollbar-none">
            <div className="bg-neutral-100/80 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 p-3 rounded-2xl rounded-tl-sm self-start max-w-[85%] border border-black/5 dark:border-white/5">
              안녕하세요! 오늘 시황 브리핑에 대해 궁금하신 점을 물어보시면 상세히 답변해 드릴게요! 🤖📈
            </div>

            {messages.map((m, i) => (
              <div 
                key={i} 
                className={`p-3 rounded-2xl max-w-[85%] whitespace-pre-line leading-relaxed border ${
                  m.role === "user" 
                    ? "bg-blue-600 border-blue-700 text-white self-end rounded-tr-sm" 
                    : "bg-white dark:bg-neutral-850 border-neutral-200 dark:border-white/5 text-neutral-800 dark:text-neutral-200 self-start rounded-tl-sm shadow-sm"
                }`}
              >
                {m.content}
              </div>
            ))}
            
            {isLoading && (
              <div className="bg-neutral-100 dark:bg-neutral-800/80 p-3 rounded-2xl rounded-tl-sm self-start border border-black/5 dark:border-white/5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: "0ms"}}></span>
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: "150ms"}}></span>
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: "300ms"}}></span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-neutral-900/50 backdrop-blur-md flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || !briefing}
              placeholder={briefing ? "시황에 대해 질문해보세요..." : "브리핑을 불러오는 중..."}
              className="flex-1 bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50"
            />
            <button 
              type="submit" 
              disabled={isLoading || !briefing || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white w-8 h-8 rounded-full transition-all disabled:opacity-50 disabled:active:scale-100 shadow-md flex items-center justify-center shrink-0"
            >
              <svg className="w-3.5 h-3.5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 relative border border-white/10 group"
      >
        <span className="absolute -inset-1 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 blur opacity-40 group-hover:opacity-75 transition duration-300"></span>
        <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    </div>
  );
}

function NewsFeed({ sessionType, title }: { sessionType: string, title: string }) {
  const news = useQuery(api.news.getNews, { session_type: sessionType });

  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-neutral-200 dark:border-white/10 pb-3 flex justify-between items-center">
        <h2 className="text-xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-400 bg-clip-text text-transparent tracking-tight">{title}</h2>
        <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-200/50 dark:bg-neutral-800/50 px-2 py-1 rounded-md">LIVE</h3>
      </div>
      
      {news === undefined ? (
        <div className="text-neutral-500">뉴스를 불러오는 중...</div>
      ) : news.length === 0 ? (
        <div className="text-neutral-500">뉴스 데이터가 없습니다. 상단 우측 버튼을 눌러주세요.</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {news.slice(0, 15).map((n: any) => (
            <a
              key={n._id}
              href={n.origin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-[4/3] bg-neutral-100 dark:bg-neutral-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-neutral-200 dark:border-white/5"
            >
              {n.image_url ? (
                <img src={n.image_url} alt={n.title} className="absolute inset-0 w-full h-full object-cover opacity-80 dark:opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all duration-700 ease-out" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-900 group-hover:scale-105 transition-transform duration-700" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 p-4 flex flex-col justify-end transform group-hover:-translate-y-1 transition-transform duration-500">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold text-white tracking-wider uppercase bg-white/20 backdrop-blur-md px-2 py-0.5 rounded shadow-sm border border-white/10">{n.source}</span>
                  {n.sub_category && (
                    <span className="text-[10px] font-bold text-blue-200 tracking-wider uppercase bg-blue-900/60 px-2 py-0.5 rounded shadow-sm backdrop-blur-md border border-blue-500/30">
                      {n.sub_category}
                    </span>
                  )}
                </div>
                <h4 className="text-white font-medium leading-snug line-clamp-2 text-sm shadow-sm group-hover:text-blue-100 transition-colors">
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
  const [marketMode, setMarketMode] = useState<"US" | "KR" >("KR");
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const updateRealtimeData = useAction(api.actions.updateRealtimeData);
  const stockCharts = useQuery(api.news.getStockCharts);

  useEffect(() => {
    setMounted(true);
    const kstHour = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul", hour12: false, hour: "numeric" });
    const hour = parseInt(kstHour);
    setMarketMode(hour >= 8 && hour < 17 ? "KR" : "US");

    // Initial fetch on mount
    updateRealtimeData().catch(console.error);

    let intervalId: NodeJS.Timeout;

    // Calculate time until next absolute 30-second mark (:00 or :30)
    const now = new Date();
    const sec = now.getSeconds();
    const ms = now.getMilliseconds();
    const secondsToNextMark = sec < 30 ? (30 - sec) : (60 - sec);
    const msToNextMark = secondsToNextMark * 1000 - ms;

    const timeoutId = setTimeout(() => {
      // Trigger update at the exact 30s/00s mark
      updateRealtimeData().catch(console.error);

      // Start 30-second interval from this aligned mark
      intervalId = setInterval(() => {
        updateRealtimeData().catch(console.error);
      }, 30000);
    }, msToNextMark);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [updateRealtimeData]);

  const tvTheme = mounted && theme === "light" ? "light" : "dark";

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black flex flex-col transition-colors duration-300">
      {/* Ticker Tape */}
      <div className="w-full sticky top-0 z-50 shadow-sm dark:shadow-xl border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-colors duration-300">
        {mounted && (
          <MemoizedTickerTape 
            key={`ticker-${marketMode}-${tvTheme}`}
            colorTheme={tvTheme} 
            displayMode="compact" 
            showSymbolLogo={true} 
            isTransparent={true} 
            symbols={marketMode === "KR" ? KR_SYMBOLS : US_SYMBOLS} 
          />
        )}
      </div>

      <div className="p-6 lg:p-8 max-w-[1800px] w-full mx-auto flex flex-col gap-8">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/40 dark:bg-neutral-900/30 p-3 rounded-2xl border border-neutral-200/50 dark:border-white/5 backdrop-blur-md">
          {/* Sliding Glassmorphic Market Toggle */}
          <div className="relative bg-neutral-200/50 dark:bg-neutral-800/40 p-1 rounded-full border border-neutral-300/30 dark:border-white/5 flex gap-1 shadow-inner backdrop-blur-md">
            <button
              onClick={() => setMarketMode("KR")}
              className={`px-6 py-1.5 rounded-full text-sm font-bold tracking-wide transition-all duration-300 relative z-10 ${
                marketMode === "KR"
                  ? "text-neutral-900 dark:text-black bg-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
              }`}
            >
              🇰🇷 한국 시장
            </button>
            <button
              onClick={() => setMarketMode("US")}
              className={`px-6 py-1.5 rounded-full text-sm font-bold tracking-wide transition-all duration-300 relative z-10 ${
                marketMode === "US"
                  ? "text-neutral-900 dark:text-black bg-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
              }`}
            >
              🇺🇸 미국 시장
            </button>
          </div>

          {/* Real-time Clock */}
          {mounted && <RealTimeClock />}

          <div className="flex items-center gap-3">
            {mounted && <ThemeToggle />}
            <RefreshButton />
          </div>
        </div>

        {/* Top: Indices & Chart & Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-3 flex flex-col gap-4">
            <MarketIndices marketMode={marketMode} />
            {marketMode === "KR" && <InvestorTrends />}
          </section>
          
          {marketMode === "US" ? (
            <>
              <section className="lg:col-span-5 h-[380px] lg:h-[400px] rounded-2xl overflow-hidden bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-white/10 shadow-sm hover:shadow-xl transition-all duration-300">
                {mounted && <MemoizedAdvancedChart key={`chart-us-${tvTheme}`} theme={tvTheme} symbol="NASDAQ:IXIC" autosize />}
              </section>
              <section className="lg:col-span-4 h-[380px] lg:h-[400px] rounded-2xl overflow-hidden bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-white/10 shadow-sm hover:shadow-xl transition-all duration-300">
                {mounted && <MemoizedStockHeatmap key={`heatmap-us-${tvTheme}`} colorTheme={tvTheme} height="100%" width="100%" hasTopBar={false} dataSource="NAS100" />}
              </section>
            </>
          ) : (
            <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-4 min-h-[500px]">
              {stockCharts === undefined ? (
                <div className="sm:col-span-2 text-neutral-500 text-sm py-10 text-center">차트 데이터를 로딩 중...</div>
              ) : stockCharts.length === 0 ? (
                <div className="sm:col-span-2 text-neutral-500 text-sm py-10 text-center">차트 데이터가 없습니다. 우측 상단 갱신 버튼을 눌러주세요.</div>
              ) : (
                stockCharts.map((chart: any) => (
                  <div key={chart._id} className="h-[240px] sm:h-auto flex flex-col">
                    <CustomAreaChart chartData={chart} />
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Middle: Economic Calendar & Global Community */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          <section className="lg:col-span-1 bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden h-[350px] relative shadow-sm hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-[48px] bg-neutral-100/50 dark:bg-neutral-800/30 backdrop-blur-md z-10 flex items-center px-6 border-b border-neutral-200/50 dark:border-white/5">
               <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">주요 경제 캘린더</h3>
            </div>
            <div className="w-full h-[calc(100%+48px)] mt-[-48px]">
              {mounted && <MemoizedEconomicCalendar key={`calendar-${tvTheme}`} colorTheme={tvTheme} locale="kr" width="100%" height="100%" isTransparent={true} />}
            </div>
          </section>
          <section className="lg:col-span-1 bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden h-[350px] relative shadow-sm hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-[48px] bg-neutral-100/50 dark:bg-neutral-800/30 backdrop-blur-md z-10 flex items-center px-6 border-b border-neutral-200/50 dark:border-white/5">
               <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">실시간 글로벌 주요 뉴스</h3>
            </div>
            <div className="w-full h-[calc(100%+48px)] mt-[-48px]">
              {mounted && <MemoizedTimeline key={`timeline-${tvTheme}`} colorTheme={tvTheme} locale="kr" displayMode="compact" width="100%" height="100%" isTransparent={true} />}
            </div>
          </section>
        </div>



        {/* Bottom: US News & KR News */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-4">
          {marketMode === "US" ? (
            <>
              <NewsFeed 
                sessionType="GLOBAL" 
                title="🇺🇸 해외 주요 뉴스" 
              />
              <NewsFeed 
                sessionType="KR" 
                title="🇰🇷 국내 주요 뉴스 (서브)" 
              />
            </>
          ) : (
            <>
              <NewsFeed 
                sessionType="KR" 
                title="🇰🇷 국내 주요 뉴스" 
              />
              <NewsFeed 
                sessionType="GLOBAL" 
                title="🇺🇸 해외 주요 뉴스 (서브)" 
              />
            </>
          )}
        </div>
      </div>

      {/* Floating Action Chatbot */}
      {mounted && <FloatingChatbot marketMode={marketMode} />}
    </div>
  );
}
