require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Obtener un producto real
  const { rows } = await pool.query(
    'SELECT id_producto, id_empresa, id_categoria, sku, alerta_stock_enviada, stock_actual, stock_minimo FROM producto LIMIT 1'
  );
  const p = rows[0];
  console.log('Producto base:', p);

  // Simular exactamente el UPDATE del PUT /productos/:id
  const r = await pool.query(
    `UPDATE producto
        SET nombre = $1, marca = $2, modelo = $3, descripcion = $4, precio = $5,
            id_categoria = $6, disponible = $7, sku = $8, numero_serie = $9,
            stock_actual = $10, stock_minimo = $11, unidad = $12, alerta_stock_enviada = $13
      WHERE id_producto = $14 AND id_empresa = $15`,
    [
      'Test Producto',
      null,
      null,
      'descripcion test',
      120.00,
      p.id_categoria,
      true,
      p.sku,
      null,
      p.stock_actual,
      p.stock_minimo,
      'unidad',
      p.alerta_stock_enviada,
      p.id_producto,
      p.id_empresa,
    ]
  );
  console.log('UPDATE OK, rowCount:', r.rowCount);
  await pool.end();
}

main().catch(e => { console.error('ERROR:', e.message, e.stack); pool.end(); });
