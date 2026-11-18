require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');
const {
  generarPdfVenta,
  generarPdfReporte,
  generarPdfInventario,
} = require('../src/utils/pdf');
const { numeroALiteral } = require('../src/utils/normalizar');

async function probarPdfs() {
  console.log('========================================================================');
  console.log('             GENERACIÓN DE PDFs DE PRUEBA - UNIMARKET BO                ');
  console.log('========================================================================\n');

  const dirTmp = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(dirTmp)) {
    fs.mkdirSync(dirTmp, { recursive: true });
  }

  // 1. Obtener datos reales de Tecno Andina S.R.L.
  const { rows: empRows } = await pool.query(
    `SELECT e.*, u.usuario, u.correo AS usuario_correo
       FROM empresa e
       JOIN usuario u ON u.id_usuario = e.id_usuario
      WHERE e.nit = $1`,
    ['1023456789']
  );

  if (!empRows.length) {
    console.error('ERROR: No se encontró Tecno Andina S.R.L. en la BD.');
    process.exit(1);
  }

  const empresa = empRows[0];

  // 2. Obtener productos reales de Tecno Andina
  const { rows: prods } = await pool.query(
    `SELECT p.*, c.nombre AS categoria
       FROM producto p
       JOIN categoria c ON c.id_categoria = p.id_categoria
      WHERE p.id_empresa = $1
      ORDER BY p.id_producto ASC`,
    [empresa.id_empresa]
  );

  console.log(`Empresa: ${empresa.razon_social} (NIT: ${empresa.nit})`);
  console.log(`Productos en catálogo: ${prods.length}\n`);

  // A) Comprobante de Venta de Ejemplo (A4)
  const itemsVenta = prods.slice(0, 3).map((p, idx) => {
    const cant = idx + 1;
    const precio = parseFloat(p.precio) || 100;
    const sub = cant * precio;
    return {
      id_producto: p.id_producto,
      nombre: p.nombre,
      sku: p.sku || `TEC-000${idx + 1}`,
      unidad: p.unidad || 'unidad',
      cantidad: cant,
      precio_unitario: precio,
      descuento: 0,
      subtotal: sub,
    };
  });

  const totalCalculado = itemsVenta.reduce((acc, it) => acc + it.subtotal, 0);
  const ventaEjemplo = {
    id_venta: 1,
    correlativo: 'VTA-2026-000001',
    fecha: new Date(),
    metodo_pago: 'qr',
    canal: 'whatsapp',
    subtotal: totalCalculado,
    descuento: 0,
    total: totalCalculado,
    total_literal: numeroALiteral(totalCalculado),
    cliente_nombre: 'Ing. Carlos Mendoza Rivera',
    cliente_nit: '4567891012',
    cliente_telefono: '77213456',
    cliente_direccion: 'Calle México #1420, La Paz',
    observaciones: 'Venta acordada por WhatsApp. Entrega en oficina con garantía de 1 año.',
    estado: 'emitida',
    items: itemsVenta,
  };

  const pathVentaA4 = path.join(dirTmp, 'comprobante_venta_ejemplo_a4.pdf');
  const streamA4 = fs.createWriteStream(pathVentaA4);
  generarPdfVenta({ venta: ventaEjemplo, empresa, formato: 'a4', stream: streamA4 });

  await new Promise((r) => streamA4.on('finish', r));
  console.log(`[OK] Generado Comprobante A4: ${pathVentaA4} (${fs.statSync(pathVentaA4).size} bytes)`);

  // B) Comprobante de Venta de Ejemplo (Ticket 80mm)
  const pathVentaTicket = path.join(dirTmp, 'comprobante_venta_ejemplo_ticket.pdf');
  const streamTicket = fs.createWriteStream(pathVentaTicket);
  generarPdfVenta({ venta: ventaEjemplo, empresa, formato: 'ticket', stream: streamTicket });

  await new Promise((r) => streamTicket.on('finish', r));
  console.log(`[OK] Generado Comprobante Ticket 80mm: ${pathVentaTicket} (${fs.statSync(pathVentaTicket).size} bytes)`);

  // C) Reporte Ejecutivo de Ventas (A4)
  const resumenVentas = {
    total_ventas: 14,
    ingresos_totales: 6420.00,
    total_unidades_vendidas: 28,
    stock_bajo_count: prods.filter((p) => p.stock_actual <= p.stock_minimo).length,
    top_productos: prods.slice(0, 5).map((p, idx) => ({
      nombre: p.nombre,
      sku: p.sku || `TEC-000${idx + 1}`,
      unidades_vendidas: (5 - idx) * 3,
      total_recaudado: (5 - idx) * 3 * parseFloat(p.precio),
    })),
    productos_stock_bajo: prods.filter((p) => p.stock_actual <= p.stock_minimo),
  };

  const pathReporteVentas = path.join(dirTmp, 'reporte_ventas.pdf');
  const streamReporte = fs.createWriteStream(pathReporteVentas);
  generarPdfReporte({
    resumen: resumenVentas,
    empresa,
    desde: '2026-10-01',
    hasta: '2026-10-31',
    stream: streamReporte,
  });

  await new Promise((r) => streamReporte.on('finish', r));
  console.log(`[OK] Generado Reporte de Ventas: ${pathReporteVentas} (${fs.statSync(pathReporteVentas).size} bytes)`);

  // D) Reporte General de Inventario (A4)
  const pathInventario = path.join(dirTmp, 'reporte_inventario.pdf');
  const streamInv = fs.createWriteStream(pathInventario);
  generarPdfInventario({
    productos: prods,
    empresa,
    soloBajo: false,
    stream: streamInv,
  });

  await new Promise((r) => streamInv.on('finish', r));
  console.log(`[OK] Generado Reporte de Inventario General: ${pathInventario} (${fs.statSync(pathInventario).size} bytes)`);

  // E) Reporte de Stock Bajo (A4)
  const prodsStockBajo = prods.filter((p) => p.stock_actual <= p.stock_minimo);
  const pathStockBajo = path.join(dirTmp, 'reporte_stock_bajo.pdf');
  const streamBajo = fs.createWriteStream(pathStockBajo);
  generarPdfInventario({
    productos: prodsStockBajo.length ? prodsStockBajo : prods.slice(0, 2),
    empresa,
    soloBajo: true,
    stream: streamBajo,
  });

  await new Promise((r) => streamBajo.on('finish', r));
  console.log(`[OK] Generado Reporte de Stock Bajo: ${pathStockBajo} (${fs.statSync(pathStockBajo).size} bytes)`);

  console.log('\n========================================================================');
  console.log('ÉXITO: Todos los PDFs fueron generados con datos reales de la BD en backend/tmp/');
  console.log('========================================================================\n');

  await pool.end();
}

probarPdfs().catch((err) => {
  console.error('Error generando PDFs:', err);
  process.exit(1);
});
