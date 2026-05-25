import { env } from '../env.js';

/**
 * Thin MSG91 client.
 *  - If MSG91_AUTH_KEY is not set, every method falls back to logging the message
 *    to stdout so local development continues to work without external dependencies.
 *  - In production, set MSG91_AUTH_KEY plus the relevant template IDs.
 */

type MsgResult = { ok: true; provider: 'msg91' | 'console'; reqId?: string };

async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authkey: env.msg91.authKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`MSG91 ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Send a 6-digit numeric OTP to a phone number. Returns the code so we can hash + persist it. */
export async function sendOtp(phone: string, code: string, purpose: string): Promise<MsgResult> {
  if (!env.msg91.authKey || !env.msg91.otpTemplateId) {
    console.log(`[otp:console] → ${phone} (${purpose}) code=${code}`);
    return { ok: true, provider: 'console' };
  }
  const r = await postJson('https://control.msg91.com/api/v5/otp', {
    template_id: env.msg91.otpTemplateId,
    mobile: phone.replace(/^\+/, ''),
    otp: code,
    otp_length: code.length,
  });
  return { ok: true, provider: 'msg91', reqId: r.request_id };
}

/** Send a transactional WhatsApp message via MSG91. */
export async function sendWhatsApp(phone: string, title: string, body: string): Promise<MsgResult> {
  if (!env.msg91.authKey || !env.msg91.waTemplateId) {
    console.log(`[whatsapp:console] → ${phone}: ${title}\n${body}`);
    return { ok: true, provider: 'console' };
  }
  const r = await postJson('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
    integrated_number: env.msg91.senderId,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: env.msg91.waTemplateId,
        language: { code: 'en', policy: 'deterministic' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: title }, { type: 'text', text: body }] },
        ],
      },
      to: phone.replace(/^\+/, ''),
    },
  });
  return { ok: true, provider: 'msg91', reqId: r.request_id };
}
