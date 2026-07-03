import { sql } from "drizzle-orm";
import { db } from "@/db";

// Railway's health check hits this on every deploy (see railway.json).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed: database unreachable", error);
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
