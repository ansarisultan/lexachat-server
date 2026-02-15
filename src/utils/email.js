import nodemailer from 'nodemailer';

const getClientBaseUrl = () => {
  if (process.env.RESET_PASSWORD_URL_BASE) {
    return process.env.RESET_PASSWORD_URL_BASE.replace(/\/+$/, '');
  }

  if (process.env.CLIENT_URL) {
    return process.env.CLIENT_URL.replace(/\/+$/, '');
  }

  if (process.env.CLIENT_URLS) {
    const first = process.env.CLIENT_URLS.split(',').map((u) => u.trim()).find(Boolean);
    if (first) return first.replace(/\/+$/, '');
  }

  return 'http://localhost:5173';
};

const getTransport = () => {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = process.env.SMTP_PORT || process.env.EMAIL_PORT;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!host || !port || !user || !pass) return null;

  const parsedPort = Number(port);
  const isGmail = String(host).toLowerCase() === 'smtp.gmail.com';

  return nodemailer.createTransport({
    host,
    port: parsedPort,
    secure: parsedPort === 465,
    requireTLS: parsedPort === 587,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user,
      pass
    },
    tls: isGmail
      ? {
          servername: 'smtp.gmail.com'
        }
      : undefined
  });
};

export const buildResetUrl = (resetToken) => {
  return `${getClientBaseUrl()}/reset-password/${resetToken}`;
};

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const subject = 'Reset your LexaChat password';
  const text = [
    `Hi ${name || 'there'},`,
    '',
    'You requested a password reset for your LexaChat account.',
    `Reset link: ${resetUrl}`,
    '',
    'This link expires in 15 minutes.',
    'If you did not request this, you can ignore this email.'
  ].join('\n');

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || process.env.EMAIL_FROM;
  if (resendApiKey && resendFrom) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          subject,
          text
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend failed: ${response.status} ${errorText}`);
      }

      return { delivered: true };
    } catch (error) {
      // Fall back to SMTP when Resend is configured but unavailable/misconfigured.
      console.error('Resend delivery failed, falling back to SMTP:', error?.message || error);
    }
  }

  const transport = getTransport();
  if (!transport) {
    return { delivered: false, reason: 'No email provider configured' };
  }

  const from =
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER;

  const sendResult = await Promise.race([
    transport.sendMail({
      from,
      to,
      subject,
      text
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('SMTP send timeout')), 15000);
    })
  ]);

  if (!sendResult) {
    throw new Error('SMTP send failed');
  }

  return { delivered: true };
};
