import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    let body: { campaignId?: string; type?: "impression" | "click" };
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      body = JSON.parse(text);
    }

    const { campaignId, type } = body;
    if (!campaignId || typeof campaignId !== "string") {
      return NextResponse.json({ error: "Mangler campaignId" }, { status: 400 });
    }

    if (type === "click") {
      await db.adCampaign.update({
        where: { id: campaignId },
        data: { klik: { increment: 1 } },
      });
    } else {
      await db.adCampaign.update({
        where: { id: campaignId },
        data: { visninger: { increment: 1 } },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fejl ved ad tracking:", error);
    return NextResponse.json({ error: "Intern fejl" }, { status: 500 });
  }
}
