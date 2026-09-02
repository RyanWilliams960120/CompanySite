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
    'DRACOINLABS',
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
    application.resume_filename || 'Stored with the application record',
    '',
    viewUrl ? 'Open in recruiter dashboard:' : 'Open this application in the recruiter dashboard.',
    viewUrl || ''
  ].filter(function (line, idx, arr) {
    return line !== '' || arr[idx - 1] !== '';
  });

  return {
    subject: 'New DracoinLabs Application — ' + application.position + ' — ' + application.name,
    text: lines.join('\n'),
    replyTo: application.email
  };
}

async function sendWithSmtp(to, application) {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  const from = process.env.EMAIL_FROM || user;
  const port = Number(process.env.EMAIL_PORT || 465);
  if (!host || !user || !pass || !from) {
    throw new Error('smtp-not-configured');
  }

  const msg = messageContent(application);
  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: { user: user, pass: pass },
    disableFileAccess: true,
    disableUrlAccess: true
  });

  await transporter.sendMail({
    from: from,
    to: to,
    replyTo: msg.replyTo,
    subject: msg.subject,
    text: msg.text
  });
}

async function sendWithResend(to, application) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error('resend-not-configured');
  }

  const msg = messageContent(application);
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: from,
    to: [to],
    replyTo: msg.replyTo,
    subject: msg.subject,
    text: msg.text
  });

  if (error) {
    throw new Error(error.message || 'email-send-failed');
  }
}

async function notifyRecruiters(application) {
  const to = process.env.CAREERS_EMAIL;
  if (!to) {
    throw new Error('email-not-configured');
  }

  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    await sendWithSmtp(to, application);
    return;
  }

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    await sendWithResend(to, application);
    return;
  }

  throw new Error('email-not-configured');
}

module.exports = {
  notifyRecruiters: notifyRecruiters,
  applicationUrl: applicationUrl
};
