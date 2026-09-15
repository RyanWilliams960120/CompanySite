const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { appBaseUrl } = require('./http');

function dash(value) {
  return value ? String(value) : 'Not provided';
}

function applicationUrl(id) {
  const base = appBaseUrl();
  if (!base || !id) return '';
  return base + '/admin/application?id=' + encodeURIComponent(id);
}

function messageContent(application) {
  const viewUrl = applicationUrl(application.id);
  const submitted = application.created_at
    ? new Date(application.created_at).toISOString()
    : new Date().toISOString();

  const lines = [
    'DRACOIN LABS',
    'NEW JOB APPLICATION',
    '',
    'Application ID:',
    application.id,
    '',
    'Submitted:',
    submitted,
    '',
    'Position:',
    application.position,
    '',
    'Candidate:',
    application.name,
    '',
    'Email:',
    application.email,
    '',
    'Phone:',
    dash(application.phone),
    '',
    'Location:',
    dash(application.location),
    '',
    'LinkedIn:',
    dash(application.linkedin),
    '',
    'GitHub:',
    dash(application.github),
    '',
    'Portfolio:',
    dash(application.portfolio),
    '',
    'Years of Experience:',
    String(application.experience_years),
    '',
    'Employment Type:',
    dash(application.employment_type),
    '',
    'Compensation Expectations:',
    dash(application.compensation),
    '',
    'Availability:',
    dash(application.availability),
    '',
    'Cover Letter:',
    application.cover_letter || 'Not provided',
    '',
    'Resume:',
    application.resume_filename || 'Attached',
    '',
    viewUrl ? 'Open in recruiter dashboard:' : 'Open this application in the recruiter dashboard.',
    viewUrl || ''
  ].filter(function (line, idx, arr) {
    return line !== '' || arr[idx - 1] !== '';
  });

  return {
    subject: 'New Dracoin Labs Application — ' + application.position + ' — ' + application.name,
    text: lines.join('\n'),
    replyTo: application.email
  };
}

function env(name) {
  return String(process.env[name] || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '');
}

function inboxAddress() {
  return normalizeMailbox(env('CAREERS_EMAIL') || env('CONTACT_EMAIL') || env('EMAIL_USER'));
}

function normalizeMailbox(address) {
  return String(address || '')
    .trim()
    .replace(/@dracoinlabs\.com\b/ig, '@dracoinlabs.org');
}

function fromHeader(user) {
  const configured = normalizeMailbox(env('EMAIL_FROM'));
  if (configured && configured.indexOf(user) !== -1) return configured;
  return '"Dracoin Labs" <' + user + '>';
}

function smtpPorts() {
  const preferred = Number(env('EMAIL_PORT') || 465);
  const ports = [];
  function add(port) {
    if (ports.indexOf(port) === -1) ports.push(port);
  }
  add(preferred);
  add(465);
  add(587);
  return ports;
}

async function sendSmtp(mail) {
  const host = env('EMAIL_HOST');
  const user = env('EMAIL_USER');
  const pass = env('EMAIL_PASSWORD');
  const to = normalizeMailbox(mail.to || inboxAddress());
  if (!host || !user || !pass || !to) {
    throw new Error('email-not-configured');
  }

  const ports = smtpPorts();
  let lastErr;
  for (let i = 0; i < ports.length; i++) {
    const port = ports[i];
    try {
      const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: { user: user, pass: pass },
        connectionTimeout: 12000,
        greetingTimeout: 12000,
        socketTimeout: 20000,
        disableFileAccess: true,
        disableUrlAccess: true
      });
      const info = await transporter.sendMail({
        from: fromHeader(user),
        to: to,
        replyTo: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments || [],
        envelope: { from: user, to: Array.isArray(to) ? to : [to] }
      });
      if (info.rejected && info.rejected.length) {
        throw new Error('smtp-rejected:' + info.rejected.join(','));
      }
      return info;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('email-send-failed');
}

async function sendWithSmtp(to, application) {
  const msg = messageContent(application);
  const attachments = [];
  if (application.resumeBuffer && application.resumeBuffer.length) {
    attachments.push({
      filename: application.resume_filename || 'resume.pdf',
      content: application.resumeBuffer,
      contentType: application.resumeContentType || 'application/octet-stream'
    });
  }
  await sendSmtp({
    to: to,
    replyTo: msg.replyTo,
    subject: msg.subject,
    text: msg.text,
    attachments: attachments
  });
}

async function sendWithResend(to, application) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error('resend-not-configured');
  }

  const msg = messageContent(application);
  const attachments = [];
  if (application.resumeBuffer && application.resumeBuffer.length) {
    attachments.push({
      filename: application.resume_filename || 'resume.pdf',
      content: application.resumeBuffer.toString('base64'),
      contentType: application.resumeContentType || 'application/octet-stream'
    });
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: from,
    to: [to],
    replyTo: msg.replyTo,
    subject: msg.subject,
    text: msg.text,
    attachments: attachments
  });

  if (error) {
    throw new Error(error.message || 'email-send-failed');
  }
}

async function notifyRecruiters(application) {
  const to = inboxAddress();
  if (!to) {
    throw new Error('email-not-configured');
  }

  if (env('EMAIL_HOST') && env('EMAIL_USER') && env('EMAIL_PASSWORD')) {
    try {
      await sendWithSmtp(to, application);
      return;
    } catch (err) {
      if (application.resumeBuffer && application.resumeBuffer.length) {
        const withoutCv = Object.assign({}, application, { resumeBuffer: null });
        await sendWithSmtp(to, withoutCv);
        return;
      }
      throw err;
    }
  }

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    await sendWithResend(to, application);
    return;
  }

  throw new Error('email-not-configured');
}

async function sendPlainMail(mail) {
  const to = mail.to || inboxAddress();
  const host = env('EMAIL_HOST');
  const user = env('EMAIL_USER');
  const pass = env('EMAIL_PASSWORD');

  if (host && user && pass && to) {
    await sendSmtp({
      to: to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments
    });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  if (apiKey && resendFrom && to) {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: resendFrom,
      to: [to],
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text
    });
    if (error) throw new Error(error.message || 'email-send-failed');
    return;
  }

  throw new Error('email-not-configured');
}

async function notifyContact(fields) {
  const lines = [
    'DRACOIN LABS',
    'WEBSITE CONTACT MESSAGE',
    '',
    'Name:',
    fields.name,
    '',
    'Email:',
    fields.email,
    '',
    'Company / project:',
    dash(fields.company),
    '',
    'Service interest:',
    dash(fields.service),
    '',
    'Message:',
    fields.message || 'Not provided'
  ].join('\n');

  const html = [
    '<p><strong>New website contact message</strong></p>',
    '<p><strong>Name:</strong> ' + escapeHtml(fields.name) + '<br>',
    '<strong>Email:</strong> ' + escapeHtml(fields.email) + '<br>',
    '<strong>Company / project:</strong> ' + escapeHtml(dash(fields.company)) + '<br>',
    '<strong>Service interest:</strong> ' + escapeHtml(dash(fields.service)) + '</p>',
    '<p><strong>Message:</strong><br>' + escapeHtml(fields.message || 'Not provided').replace(/\n/g, '<br>') + '</p>'
  ].join('');

  await sendPlainMail({
    replyTo: fields.email,
    subject: 'Website contact: ' + fields.name,
    text: lines,
    html: html
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  notifyRecruiters: notifyRecruiters,
  notifyContact: notifyContact,
  applicationUrl: applicationUrl
};
