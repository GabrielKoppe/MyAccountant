import { render } from "@react-email/components";
import type { ReactElement } from "react";

import { env } from "@/lib/env";
import { logger } from "@/server/logger";
import { resend } from "./client";

const log = logger.child({ module: "email-service" });

export type EmailTemplate<TProps> = {
  subject: string | ((props: TProps) => string);
  Component: (props: TProps) => ReactElement;
};

type SendEmailOptions<TProps> = {
  to: string | string[];
  template: EmailTemplate<TProps>;
  props: TProps;
  throwOnError?: boolean;
};

export const emailService = {
  async send<TProps>(options: SendEmailOptions<TProps>): Promise<{ ok: boolean; id?: string }> {
    const { to, template, props, throwOnError = false } = options;

    const subject =
      typeof template.subject === "function" ? template.subject(props) : template.subject;

    const element = template.Component(props);
    const html = await render(element);
    const text = await render(element, { plainText: true });

    const recipients = Array.isArray(to) ? to : [to];
    const maskedRecipients = recipients.map(maskEmail);

    try {
      const result = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: recipients,
        subject,
        html,
        text,
      });

      if (result.error) {
        log.warn(
          { to: maskedRecipients, subject, error: result.error },
          "Email send failed (resend error)",
        );
        if (throwOnError) throw new Error(`Email send failed: ${result.error.message}`);
        return { ok: false };
      }

      log.info({ to: maskedRecipients, subject, emailId: result.data?.id }, "Email sent");
      return { ok: true, id: result.data?.id };
    } catch (err) {
      log.error({ err, to: maskedRecipients, subject }, "Email send threw");
      if (throwOnError) throw err;
      return { ok: false };
    }
  },
};

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "[invalid]";
  return `${name.charAt(0)}***@${domain}`;
}
