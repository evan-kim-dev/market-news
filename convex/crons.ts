import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";

const crons = cronJobs();

// 매 1시간마다 뉴스를 새로 크롤링해서 DB를 업데이트 (API 요금 절약 및 로딩 속도 최적화)
crons.hourly(
  "fetch-and-summarize-news",
  { minuteUTC: 0 },
  api.actions.fetchAndSummarize,
);

export default crons;
