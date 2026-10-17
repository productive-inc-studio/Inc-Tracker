// LINE webhook: tells you a group's ID so it can be put in the LINE_GROUP_ID secret.
// The bot replies with the ID when it joins a group, or when someone types "groupid" in the group.
// Replies need a reply token that only LINE can issue, so forged requests cannot make the bot talk;
// if LINE_CHANNEL_SECRET is set the request signature is verified as well.

const enc = new TextEncoder()

async function validSignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)))
  return btoa(String.fromCharCode(...mac)) === signature
}

type LineEvent = {
  type: string
  replyToken?: string
  source?: { type: 'user' | 'group' | 'room'; groupId?: string; roomId?: string }
  message?: { type: string; text?: string }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  const body = await req.text()

  const secret = Deno.env.get('LINE_CHANNEL_SECRET')
  if (secret && !(await validSignature(body, req.headers.get('x-line-signature'), secret))) {
    return new Response('bad signature', { status: 401 })
  }
  const token = Deno.env.get('LINE_CHANNEL_TOKEN')
  if (!token) return new Response('ok') // nothing we can reply with yet

  let events: LineEvent[] = []
  try {
    events = JSON.parse(body).events ?? []
  } catch {
    return new Response('ok')
  }

  for (const e of events) {
    const id = e.source?.groupId ?? e.source?.roomId
    if (!id || !e.replyToken) continue
    const asked = e.type === 'message' && e.message?.type === 'text' && /^\s*(groupid|group id|ไอดีกลุ่ม)\s*$/i.test(e.message.text ?? '')
    if (e.type !== 'join' && !asked) continue
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        replyToken: e.replyToken,
        messages: [
          { type: 'text', text: `👋 WorkTracker พร้อมส่งแจ้งเตือนเข้ากลุ่มนี้\n\nGroup ID ของกลุ่มนี้คือ` },
          { type: 'text', text: id },
          { type: 'text', text: 'นำค่านี้ไปใส่ใน Supabase → Edge Functions → Secrets ชื่อ LINE_GROUP_ID' },
        ],
      }),
    })
  }
  // LINE expects 200 for every delivery, including the "Verify" button's empty test
  return new Response('ok')
})
