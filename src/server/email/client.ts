import { env } from "@/lib/env";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function parseEmailFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: "MyAccountant", email: from.trim() };
}

export async function sendEmail(options: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ messageId: string }> {
  const sender = parseEmailFrom(env.EMAIL_FROM);

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender,
      to: options.to.map((email) => ({ email })),
      subject: options.subject,
      htmlContent: options.html,
      textContent: options.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo API ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { messageId: string };
  return data;
}
