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

async function notifyRecruiters(application) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CAREERS_EMAIL;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !to || !from) {
    throw new Error('email-not-configured');
  }

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
    application.resume_filename || 'Uploaded to private storage',
    '',
    viewUrl ? 'Open in recruiter dashboard:' : 'Open this application in the recruiter dashboard.',
    viewUrl || ''
  ].filter(function (line, idx, arr) {
    return line !== '' || arr[idx - 1] !== '';
  });

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: from,
    to: [to],
    replyTo: application.email,
    subject: 'New DracoinLabs Application — ' + application.position + ' — ' + application.name,
    text: lines.join('\n')
  });

  if (error) {
    throw new Error(error.message || 'email-send-failed');
  }
}

module.exports = {
  notifyRecruiters: notifyRecruiters,
  applicationUrl: applicationUrl
};
