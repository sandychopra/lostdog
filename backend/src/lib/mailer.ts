import sgMail from "@sendgrid/mail";

export interface EmailMessage {
  subject: string;
  text: string;
}

// Every notification goes to the one configured address (the Google Group in
// production), so the recipient lives in the Mailer, not in each message.
export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `[mailer] (not sent — console mailer)\nSubject: ${message.subject}\n\n${message.text}`,
    );
  }
}

class SendGridMailer implements Mailer {
  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly to: string,
  ) {
    sgMail.setApiKey(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    await sgMail.send({
      to: this.to,
      from: this.from,
      subject: message.subject,
      text: message.text,
    });
  }
}

/**
 * SendGrid only when fully configured and never under `bun test` (which sets
 * NODE_ENV=test), so a developer's real key can't make tests email the Google
 * Group. Anything else falls back to logging.
 */
export function createMailer(env: NodeJS.ProcessEnv = process.env): Mailer {
  const { SENDGRID_API_KEY, EMAIL_FROM, NOTIFICATION_TO, NODE_ENV } = env;
  if (NODE_ENV !== "test" && SENDGRID_API_KEY && EMAIL_FROM && NOTIFICATION_TO) {
    return new SendGridMailer(SENDGRID_API_KEY, EMAIL_FROM, NOTIFICATION_TO);
  }
  return new ConsoleMailer();
}

export const mailer: Mailer = createMailer();
