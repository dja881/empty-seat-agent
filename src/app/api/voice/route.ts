import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";

// Free-tier ElevenLabs keys can't use library voices; fall back to a built-in one.
const FALLBACK_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah

async function tts(text: string, voice: string) {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
}

/** The agent's voice. Each line is generated once and cached in Supabase Storage. */
export async function POST(req: Request) {
  const { text } = await req.json();
  if (typeof text !== "string" || !text.trim() || text.length > 600) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const voice = process.env.ELEVENLABS_VOICE_ID || FALLBACK_VOICE;
  const key = `${crypto.createHash("sha1").update(`${voice}|${text}`).digest("hex")}.mp3`;
  const url = db.storage.from("voice").getPublicUrl(key).data.publicUrl;

  const cached = await fetch(url, { method: "HEAD" });
  if (cached.ok) return NextResponse.json({ url, cached: true });

  let res = await tts(text, voice);
  if (res.status === 402 || res.status === 401) res = await tts(text, FALLBACK_VOICE);
  if (!res.ok) return NextResponse.json({ error: `voice unavailable (${res.status})` }, { status: 502 });

  const audio = Buffer.from(await res.arrayBuffer());
  const up = await db.storage.from("voice").upload(key, audio, { contentType: "audio/mpeg", upsert: true });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  return NextResponse.json({ url, cached: false });
}
