import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
const convex = new ConvexHttpClient(convexUrl);

export async function GET(request: Request) {
  // Vercel Cron 보안 통과를 위해 CRON_SECRET 확인
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Convex의 HTTP Action 대신, Next.js API 라우트에서 Convex 클라이언트로 직접 Action 실행
    await convex.action(api.actions.fetchAndSummarize);
    return NextResponse.json({ success: true, message: "Market data updated successfully via cron" });
  } catch (error) {
    console.error("Cron execution error:", error);
    return NextResponse.json({ error: "Failed to update market data" }, { status: 500 });
  }
}
