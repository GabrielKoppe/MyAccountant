import { render } from "@react-email/components";
import type { ReactElement } from "react";

import { env } from "@/lib/env";
import { logger } from "@/server/logger";
import { transporter } from "./client";

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
      const info = await transporter.sendMail({
        from: env.EMAIL_FROM,
        to: recipients.join(", "),
        subject,
        html,
        text,
      });

      log.info({ to: maskedRecipients, subject, messageId: info.messageId }, "Email sent");
      return { ok: true, id: info.messageId };
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
