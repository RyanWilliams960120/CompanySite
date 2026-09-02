const { neon } = require('@neondatabase/serverless');

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ''
  ).trim();
}

function getSql() {
  const url = databaseUrl();
  if (!url) return null;
  return neon(url);
}

async function query(sql, text, values) {
  if (typeof sql.query === 'function') {
    return sql.query(text, values || []);
  }
  return sql(text, values || []);
}

function asBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    if (value.indexOf('\\x') === 0 || value.indexOf('\\\\x') === 0) {
      return Buffer.from(value.replace(/^\\+x/i, ''), 'hex');
    }
    if (/^[0-9a-f]+$/i.test(value) && value.length % 2 === 0) {
      return Buffer.from(value, 'hex');
    }
    try {
      return Buffer.from(value, 'base64');
    } catch (err) {
      return null;
    }
  }
  if (value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }
  return null;
}

module.exports = {
  databaseUrl: databaseUrl,
  getSql: getSql,
  asBuffer: asBuffer,
  query: query
};
