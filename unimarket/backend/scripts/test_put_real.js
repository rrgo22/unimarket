// Test de diagnóstico: hace exactamente lo que hace el frontend al guardar
require('dotenv').config();

// Primero obtener un token de empresa
async function main() {
  const base = 'http://localhost:4000/api';
  
  // Login
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'empresa@test.com', contrasena: 'test123' }),
  });
  
  if (!loginRes.ok) {
    const e = await loginRes.json();
    console.log('Login falló (esperado si no existe ese usuario), probando con credenciales del .env...');
    // Intentar leer credenciales del env
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'OK' : 'FALTA');
    
    // Consultar directamente qué empresa existe
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await pool.query(
      `SELECT u.correo, e.id_empresa, e.razon_social FROM empresa e JOIN usuario u ON u.id_usuario = e.id_usuario LIMIT 3`
    );
    console.log('Empresas en DB:', rows);
    await pool.end();
    return;
  }
  
  const { token } = await loginRes.json();
  console.log('Login OK, token:', token?.slice(0, 20) + '...');

  // Obtener productos de la empresa
  const prodsRes = await fetch(`${base}/empresa/productos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const prods = await prodsRes.json();
  console.log('Productos:', prods.length, '| Primero:', prods[0]?.nombre, 'id:', prods[0]?.id_producto);

  if (!prods.length) { console.log('Sin productos'); return; }
  const prod = prods[0];

  // Simular el PUT como FormData
  const FormData = require('form-data');
  const form = new FormData();
  form.append('nombre', prod.nombre);
  form.append('marca', prod.marca || '');
  form.append('modelo', prod.modelo || '');
  form.append('descripcion', prod.descripcion || '');
  form.append('precio', String(prod.precio));
  form.append('id_categoria', String(prod.id_categoria));
  form.append('disponible', String(prod.disponible));
  form.append('sku', prod.sku || '');
  form.append('numero_serie', prod.numero_serie || '');
  form.append('stock_actual', String(prod.stock_actual));
  form.append('stock_minimo', String(prod.stock_minimo));
  form.append('unidad', prod.unidad || 'unidad');

  const putRes = await fetch(`${base}/empresa/productos/${prod.id_producto}`, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${token}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  const putData = await putRes.json();
  console.log('\n=== PUT /productos/:id ===');
  console.log('Status:', putRes.status);
  console.log('Response:', JSON.stringify(putData, null, 2));
}

main().catch(e => console.error('FATAL:', e.message));
