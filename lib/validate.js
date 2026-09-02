function oneLine(value, max) {
  return String(value || '')
    .replace(/[\r\n\0]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 200);
}

function multiline(value, max) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\0/g, '')
    .slice(0, max || 500);
}

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeIlike(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

module.exports = {
  oneLine: oneLine,
  multiline: multiline,
  isHttpUrl: isHttpUrl,
  isEmail: isEmail,
  escapeIlike: escapeIlike
};
