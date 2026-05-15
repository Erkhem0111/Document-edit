// lib/sms.ts — SMS provider abstraction
export async function sendSMS(phone: string, message: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER || "console";

  if (provider === "console") {
    console.log(`\n📱 SMS → ${phone}\n${message}\n`);
    return;
  }
  if (provider === "twilio") return sendViaTwilio(phone, message);
  if (provider === "infobip") return sendViaInfobip(phone, message);

  throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
}

async function sendViaTwilio(to: string, body: string) {
  const {
    TWILIO_ACCOUNT_SID: sid,
    TWILIO_AUTH_TOKEN: token,
    TWILIO_PHONE_NUMBER: from,
  } = process.env;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from!, Body: body }).toString(),
    },
  );
  if (!res.ok) throw new Error(`Twilio: ${(await res.json()).message}`);
}

async function sendViaInfobip(to: string, text: string) {
  const res = await fetch(
    `https://${process.env.INFOBIP_BASE_URL}/sms/2/text/advanced`,
    {
      method: "POST",
      headers: {
        Authorization: `App ${process.env.INFOBIP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ destinations: [{ to }], from: "Auth", text }],
      }),
    },
  );
  if (!res.ok) throw new Error(`Infobip: ${JSON.stringify(await res.json())}`);
}
