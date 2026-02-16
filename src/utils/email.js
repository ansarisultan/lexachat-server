import nodemailer from 'nodemailer';

const normalizeUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
};

const isLikelyApiUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.pathname.startsWith('/api');
  } catch {
    return false;
  }
};

const getClientBaseUrl = () => {
  const candidates = [
    process.env.RESET_PASSWORD_URL_BASE,
    process.env.FRONTEND_URL,
    process.env.CLIENT_APP_URL,
    process.env.WEBSITE_URL,
    process.env.CLIENT_URL,
    process.env.APP_URL,
    ...(process.env.CLIENT_URLS ? process.env.CLIENT_URLS.split(',') : [])
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate);
    if (!normalized) continue;
    if (isLikelyApiUrl(normalized)) continue;
    return normalized;
  }

  if (process.env.NODE_ENV === 'production') {
    const vercelProductionUrl = normalizeUrl(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null
    );
    if (vercelProductionUrl) return vercelProductionUrl;

    const vercelPreviewUrl = normalizeUrl(
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
    );
    if (vercelPreviewUrl) return vercelPreviewUrl;

    return 'https://lexachat-funclexa.vercel.app';
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

export const buildVerifyEmailUrl = (verificationToken) => {
  return `${getClientBaseUrl()}/verify-email/${verificationToken}`;
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildResetPasswordHtml = ({ name, resetUrl }) => {
  const safeName = escapeHtml(name || 'there');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset your password</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1120;font-family:Segoe UI,Arial,sans-serif;color:#e5e7eb;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#111827;border:1px solid #1f2937;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#06b6d4,#22d3ee,#14b8a6);padding:26px 28px;color:#06202a;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;opacity:.85;">FuncLexa Security</div>
                <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;color:#04202b;">Reset Your Password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 14px;font-size:16px;line-height:1.7;">Hi ${safeName},</p>
                <p style="margin:0 0 14px;font-size:16px;line-height:1.7;">
                  We received a request to reset your FuncLexa password. If this was you, tap the button below and you will be back in your workspace in seconds.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
                  <tr>
                    <td align="center" style="border-radius:12px;background:#14b8a6;">
                      <a href="${resetUrl}" style="display:inline-block;padding:14px 24px;color:#06202a;text-decoration:none;font-size:15px;font-weight:700;">Reset Password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#cbd5e1;">
                  This secure link expires in <strong>15 minutes</strong>.
                </p>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#94a3b8;">
                  If you did not request this, you can safely ignore this message. Your account stays protected.
                </p>
                <div style="margin:20px 0 0;padding-top:16px;border-top:1px solid #1f2937;">
                  <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
                    Thank you for building with us. We are glad you are part of FuncLexa.
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const buildVerifyEmailHtml = ({ name, verifyUrl }) => {
  const safeName = escapeHtml(name || 'there');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your email</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1120;font-family:Segoe UI,Arial,sans-serif;color:#e5e7eb;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#111827;border:1px solid #1f2937;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#06b6d4,#22d3ee,#14b8a6);padding:26px 28px;color:#06202a;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;opacity:.85;">FuncLexa Security</div>
                <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;color:#04202b;">Verify Your Email</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 14px;font-size:16px;line-height:1.7;">Hi ${safeName},</p>
                <p style="margin:0 0 14px;font-size:16px;line-height:1.7;">
                  Thanks for signing up for FuncLexa. Please verify your email to activate your account.
                </p>
                <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#cbd5e1;">
                  <strong>Thank you for choosing FuncLexa.</strong>
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
                  <tr>
                    <td align="center" style="border-radius:12px;background:#14b8a6;">
                      <a href="${verifyUrl}" style="display:inline-block;padding:14px 24px;color:#06202a;text-decoration:none;font-size:15px;font-weight:700;">Verify Email</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#cbd5e1;">
                  This secure link expires in <strong>24 hours</strong>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const buildWelcomeHtml = ({ name, websiteUrl }) => {
  const safeName = escapeHtml(name || 'there');
  const safeWebsiteUrl = escapeHtml(websiteUrl || 'https://www.funclexa.me');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to FuncLexa</title>
  </head>
  <body style="margin:0;padding:0;background:#070b14;font-family:Arial,sans-serif;color:#eaf2ff;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#070b14;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0f1728;border:1px solid #1e2b45;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(90deg,#00e5ff,#8b5cf6);">
                <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;">FuncLexa</h1>
                <p style="margin:8px 0 0 0;color:#f6f8ff;font-size:14px;">Build. Learn. Create.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h2 style="margin:0 0 12px 0;font-size:22px;color:#ffffff;">Welcome to the FuncLexa family, ${safeName}</h2>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#cbd5e1;">
                  We are truly grateful to have you here. FuncLexa was built to help creators and developers turn ideas into real products.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#cbd5e1;">
                  Whether you are exploring AI tools, building projects, or learning faster, we are with you on every step.
                </p>
                <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#cbd5e1;">
                  Thank you for trusting us. Your support means everything.
                </p>

                <a href="${safeWebsiteUrl}"
                   style="display:inline-block;padding:12px 18px;border-radius:10px;background:linear-gradient(90deg,#00e5ff,#8b5cf6);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">
                  Visit FuncLexa
                </a>

                <p style="margin:20px 0 0 0;font-size:13px;color:#94a3b8;">
                  Website: <a href="${safeWebsiteUrl}" style="color:#00e5ff;text-decoration:none;">www.funclexa.me</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px 28px;border-top:1px solid #1e2b45;color:#94a3b8;font-size:12px;line-height:1.6;">
                With gratitude,<br/>
                Team FuncLexa
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const subject = 'Reset your FuncLexa password';
  const text = [
    `Hi ${name || 'there'},`,
    '',
    'You requested a password reset for your FuncLexa account.',
    `Reset link: ${resetUrl}`,
    '',
    'This link expires in 15 minutes.',
    'If you did not request this, you can ignore this email.',
    '',
    'Thank you for being with FuncLexa.'
  ].join('\n');
  const html = buildResetPasswordHtml({ name, resetUrl });

  const isProduction = process.env.NODE_ENV === 'production';
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
          text,
          html
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend failed: ${response.status} ${errorText}`);
      }

      return { delivered: true };
    } catch (error) {
      // In production, fail fast to avoid SMTP timeouts when Resend is intended provider.
      if (isProduction) {
        throw error;
      }
      // In non-production, allow SMTP fallback for local testing.
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
      text,
      html
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

export const sendEmailVerificationEmail = async ({ to, name, verifyUrl }) => {
  const subject = 'Verify your FuncLexa email';
  const text = [
    `Hi ${name || 'there'},`,
    '',
    'Welcome to FuncLexa.',
    'Thank you for choosing FuncLexa.',
    `Verify your email: ${verifyUrl}`,
    '',
    'This link expires in 24 hours.'
  ].join('\n');
  const html = buildVerifyEmailHtml({ name, verifyUrl });

  const isProduction = process.env.NODE_ENV === 'production';
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
          text,
          html
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend failed: ${response.status} ${errorText}`);
      }

      return { delivered: true };
    } catch (error) {
      if (isProduction) {
        throw error;
      }
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
      text,
      html
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

export const sendSignupOtpEmail = async ({ to, name, otp }) => {
  const subject = 'Your FuncLexa OTP is here';
  const text = [
    `Hi ${name || 'there'},`,
    '',
    `Your FuncLexa verification code is: ${otp}`,
    '',
    'It expires in 10 minutes.',
    '',
    'Thank you for choosing FuncLexa.',
    '',
    'You are one step away from starting your FuncLexa journey.'
  ].join('\n');
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your signup OTP</title>
  </head>
  <body style="margin:0;padding:20px;background:#070b16;font-family:Segoe UI,Arial,sans-serif;color:#e5e7eb;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#0f172a;border:1px solid #1f2937;border-radius:18px;overflow:hidden;">
      <tr>
        <td style="padding:24px 24px 20px;background:linear-gradient(135deg,#00e5ff,#22d3ee,#7c3aed);">
          <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;color:#06202a;opacity:.9;">FuncLexa Security</div>
          <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;color:#04202b;">Email OTP Verification</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:#e5e7eb;">Hi ${escapeHtml(name || 'there')},</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#cbd5e1;">
            You are almost in. Use this one-time passcode to verify your email and complete signup.
          </p>
          <div style="display:inline-block;padding:12px 18px;border-radius:12px;background:#14b8a6;color:#06202a;font-size:26px;letter-spacing:0.22em;font-weight:800;">
            ${escapeHtml(otp)}
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">This code expires in 10 minutes.</p>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#cbd5e1;"><strong>Thank you for choosing FuncLexa.</strong></p>
          <p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">You are one step away from starting your FuncLexa journey.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const isProduction = process.env.NODE_ENV === 'production';
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
          text,
          html
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend failed: ${response.status} ${errorText}`);
      }

      return { delivered: true };
    } catch (error) {
      if (isProduction) {
        throw error;
      }
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
      text,
      html
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

export const sendWelcomeEmail = async ({ to, name }) => {
  const websiteUrl = normalizeUrl(process.env.WEBSITE_URL) || 'https://www.funclexa.me';
  const subject = 'Welcome to FuncLexa, built for creators like you';
  const text = [
    `Hi ${name || 'there'},`,
    '',
    'Welcome to FuncLexa.',
    'We are truly grateful to have you here.',
    'Your support means everything to us.',
    '',
    `Visit us: ${websiteUrl}`,
    '',
    'With gratitude,',
    'Team FuncLexa'
  ].join('\n');
  const html = buildWelcomeHtml({ name, websiteUrl });

  const isProduction = process.env.NODE_ENV === 'production';
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
          text,
          html
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend failed: ${response.status} ${errorText}`);
      }

      return { delivered: true };
    } catch (error) {
      if (isProduction) {
        throw error;
      }
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
      text,
      html
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
