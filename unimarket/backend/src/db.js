const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unimarket',
});

pool.on('error', (e) => console.error('Error en el pool de PostgreSQL:', e.message));

module.exports = pool;
