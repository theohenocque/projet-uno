module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production-uno-secret-key',
  JWT_EXPIRES_IN: '24h',
  BCRYPT_ROUNDS: 10,
  DB_PATH: './server/db/uno.sqlite'
};
