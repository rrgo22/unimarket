const pool = require('../src/db');
async function run() {
  const c1 = await pool.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'verificacion'::regclass");
  console.log('VERIFICACION CONSTRAINTS:', c1.rows);
  const c2 = await pool.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'empresa'::regclass");
  console.log('EMPRESA CONSTRAINTS:', c2.rows.filter(r => r.conname.includes('verif') || r.conname.includes('estado')));
  const c3 = await pool.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'suscripcion'::regclass");
  console.log('SUSCRIPCION CONSTRAINTS:', c3.rows.filter(r => r.conname.includes('estado')));
  await pool.end();
}
run();
