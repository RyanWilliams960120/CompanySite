const MAX_RESUME_BYTES = 2 * 1024 * 1024;

function detectResume(buffer, filename, mime) {
  if (!buffer || !buffer.length) return null;
  const name = String(filename || '').toLowerCase();
  const claimed = String(mime || '').toLowerCase();
  const pdf = buffer.length >= 4 && buffer.slice(0, 4).toString('latin1') === '%PDF';
  const ole = buffer.length >= 4 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
  const zip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;

  if (pdf && (name.endsWith('.pdf') || claimed === 'application/pdf')) {
    return { filename: 'resume.pdf', contentType: 'application/pdf', extension: 'pdf' };
  }
  if (ole && (name.endsWith('.doc') || claimed === 'application/msword')) {
    return { filename: 'resume.doc', contentType: 'application/msword', extension: 'doc' };
  }
  if (zip && (
    name.endsWith('.docx') ||
    claimed === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )) {
    return {
      filename: 'resume.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx'
    };
  }
  return null;
}

function safeResumeName(original, extension) {
  const ext = String(extension || 'pdf').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'pdf';
  const base = String(original || 'resume')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\0/g, '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80);
  const stem = (base.replace(/\.[^.]+$/, '') || 'resume').slice(0, 60);
  return stem + '.' + ext;
}

function contentDisposition(filename) {
  const ascii = String(filename || 'resume.pdf').replace(/[^\w.\-]+/g, '_');
  return 'attachment; filename="' + ascii + '"';
}

module.exports = {
  MAX_RESUME_BYTES: MAX_RESUME_BYTES,
  detectResume: detectResume,
  safeResumeName: safeResumeName,
  contentDisposition: contentDisposition
};
