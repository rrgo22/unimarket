// Generación de comprobantes de venta y reportes en PDF con PDFKit
// Formatos soportados: Ticket (80mm) y Hoja A4 estándar.
const PDFDocument = require('pdfkit');

/**
 * Formatea un número como moneda en bolivianos (ej. "250.00")
 */
function formatearBs(val) {
  return Number(val || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formatea fecha ISO o Date a DD/MM/AAAA HH:mm
 */
function formatearFecha(f) {
  if (!f) return '';
  const d = new Date(f);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${anio} ${hora}:${min}`;
}

/**
 * Genera el PDF de comprobante de venta (A4 o Ticket 80mm) y lo envía al stream 'res'
 */
function generarPdfVenta({ venta, empresa, formato = 'a4', stream }) {
  const esTicket = formato === 'ticket';

  // Configuración del documento según formato
  const doc = esTicket
    ? new PDFDocument({
        size: [226.77, 841.89], // 80mm de ancho (~226.77 pt), altura dinámica
        margins: { top: 12, bottom: 16, left: 12, right: 12 },
      })
    : new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 45, right: 45 },
      });

  doc.pipe(stream);

  if (esTicket) {
    generarTicketVenta(doc, venta, empresa);
  } else {
    generarA4Venta(doc, venta, empresa);
  }

  doc.end();
}

/**
 * Renderizado de Ticket Térmico 80mm
 */
function generarTicketVenta(doc, venta, empresa) {
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Encabezado
  doc.fontSize(12).font('Helvetica-Bold').text(empresa.razon_social.toUpperCase(), { align: 'center' });
  doc.fontSize(8).font('Helvetica').moveDown(0.2);
  if (empresa.nit) doc.text(`NIT: ${empresa.nit}`, { align: 'center' });
  if (empresa.telefono || empresa.whatsapp) {
    doc.text(`Tel: ${empresa.telefono || empresa.whatsapp}`, { align: 'center' });
  }
  if (empresa.direccion) doc.text(empresa.direccion, { align: 'center' });

  doc.moveDown(0.5);
  doc.fontSize(7).text('------------------------------------------------------------', { align: 'center' });
  doc.fontSize(10).font('Helvetica-Bold').text('COMPROBANTE DE VENTA', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`N° ${String(venta.correlativo).padStart(6, '0')}`, { align: 'center' });
  if (venta.estado === 'anulada') {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('red').text('** VENTA ANULADA **', { align: 'center' }).fillColor('black');
  }
  doc.fontSize(7).text('------------------------------------------------------------', { align: 'center' });

  // Metadatos
  doc.fontSize(8).font('Helvetica');
  doc.text(`Fecha: ${formatearFecha(venta.fecha)}`);
  doc.text(`Canal: ${venta.canal === 'whatsapp' ? 'Venta por WhatsApp' : 'Mostrador / Local'}`);
  doc.text(`Pago: ${capitalizarPalabra(venta.metodo_pago)}`);

  doc.moveDown(0.4);
  doc.text(`Cliente: ${venta.cliente_nombre || 'Cliente general'}`);
  if (venta.cliente_nit) doc.text(`NIT/CI: ${venta.cliente_nit}`);
  if (venta.cliente_telefono) doc.text(`Tel: ${venta.cliente_telefono}`);

  doc.moveDown(0.4);
  doc.fontSize(7).text('------------------------------------------------------------', { align: 'center' });
  doc.fontSize(8).font('Helvetica-Bold');
  doc.text('DETALLE DE PRODUCTOS');
  doc.fontSize(7).text('------------------------------------------------------------', { align: 'center' });

  // Items
  doc.font('Helvetica');
  (venta.items || []).forEach((item) => {
    const cant = item.cantidad;
    const precio = formatearBs(item.precio_unitario);
    const sub = formatearBs(item.subtotal);

    doc.fontSize(8).font('Helvetica-Bold').text(item.nombre);
    if (item.sku) {
      doc.fontSize(7).font('Helvetica').text(`SKU: ${item.sku}`);
    }
    doc.fontSize(8).font('Helvetica').text(`${cant} x Bs. ${precio} = Bs. ${sub}`);
    doc.moveDown(0.3);
  });

  doc.fontSize(7).text('------------------------------------------------------------', { align: 'center' });
  doc.moveDown(0.3);

  // Totales
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(`TOTAL: Bs. ${formatearBs(venta.total)}`, { align: 'right' });
  doc.moveDown(0.2);

  if (venta.total_literal) {
    doc.fontSize(7.5).font('Helvetica-Oblique').text(`Son: ${venta.total_literal}`);
  }

  doc.moveDown(0.6);
  doc.fontSize(7).font('Helvetica').text('------------------------------------------------------------', { align: 'center' });
  doc.fontSize(7).font('Helvetica-Oblique').text('Documento interno de control y entrega. No reemplaza a la factura fiscal del SIN.', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(8).font('Helvetica-Bold').text('¡Gracias por su preferencia!', { align: 'center' });
  doc.fontSize(7).font('Helvetica').text('UNIMARKET BO · Plataforma Empresarial', { align: 'center' });
}

/**
 * Renderizado de Hoja A4 Profesional
 */
function generarA4Venta(doc, venta, empresa) {
  const margenIzq = 45;
  const margenDer = 550;
  const anchoContenido = margenDer - margenIzq;

  // Barra de acento superior
  doc.rect(margenIzq, 35, anchoContenido, 4).fill('#4F46E5');

  // Encabezado principal: Datos empresa a la izquierda, Box de comprobante a la derecha
  doc.fillColor('#0F172A');
  doc.fontSize(16).font('Helvetica-Bold').text(empresa.razon_social, margenIzq, 50, { width: 300 });

  doc.fontSize(9).font('Helvetica').fillColor('#475569');
  let yEmp = 72;
  if (empresa.nit) {
    doc.text(`NIT: ${empresa.nit}`, margenIzq, yEmp);
    yEmp += 13;
  }
  if (empresa.direccion) {
    doc.text(`Dirección: ${empresa.direccion}`, margenIzq, yEmp, { width: 280 });
    yEmp += 13;
  }
  if (empresa.telefono || empresa.whatsapp) {
    doc.text(`Tel / WhatsApp: ${empresa.telefono || empresa.whatsapp}`, margenIzq, yEmp);
    yEmp += 13;
  }
  if (empresa.correo) {
    doc.text(`Correo: ${empresa.correo}`, margenIzq, yEmp);
  }

  // Caja de Comprobante (Derecha)
  const boxX = 360;
  const boxY = 48;
  const boxW = 190;
  const boxH = 78;

  doc.rect(boxX, boxY, boxW, boxH).fillAndStroke('#F8FAFC', '#CBD5E1');

  doc.fillColor('#1E293B').fontSize(11).font('Helvetica-Bold')
    .text('COMPROBANTE DE VENTA', boxX, boxY + 10, { width: boxW, align: 'center' });
  doc.fillColor('#4F46E5').fontSize(14).font('Helvetica-Bold')
    .text(`N° ${String(venta.correlativo).padStart(6, '0')}`, boxX, boxY + 28, { width: boxW, align: 'center' });
  doc.fillColor('#64748B').fontSize(8.5).font('Helvetica')
    .text(`Fecha: ${formatearFecha(venta.fecha)}`, boxX, boxY + 48, { width: boxW, align: 'center' });
  doc.text(`Canal: ${venta.canal === 'whatsapp' ? 'WhatsApp' : 'Local'} · Pago: ${capitalizarPalabra(venta.metodo_pago)}`, boxX, boxY + 61, { width: boxW, align: 'center' });

  if (venta.estado === 'anulada') {
    doc.rect(boxX, boxY + boxH + 4, boxW, 18).fill('#FEE2E2');
    doc.fillColor('#DC2626').fontSize(9).font('Helvetica-Bold')
      .text('VENTA ANULADA', boxX, boxY + boxH + 8, { width: boxW, align: 'center' });
  }

  // Sección Datos del Cliente
  const yCli = 145;
  doc.rect(margenIzq, yCli, anchoContenido, 48).fillAndStroke('#F1F5F9', '#E2E8F0');
  doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('DATOS DEL CLIENTE', margenIzq + 12, yCli + 8);

  doc.font('Helvetica').fontSize(8.5).fillColor('#0F172A');
  doc.text(`Señor(es): ${venta.cliente_nombre || 'Cliente General'}`, margenIzq + 12, yCli + 22);
  doc.text(`NIT / CI: ${venta.cliente_nit || 'S/N'}`, margenIzq + 12, yCli + 34);

  doc.text(`Teléfono: ${venta.cliente_telefono || 'No registrado'}`, margenIzq + 260, yCli + 22);
  doc.text(`Dirección: ${venta.cliente_direccion || 'No especificada'}`, margenIzq + 260, yCli + 34, { width: 230 });

  // Tabla de Productos
  let yTabla = 208;
  doc.rect(margenIzq, yTabla, anchoContenido, 22).fill('#4F46E5');
  doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
  doc.text('ÍTEM', margenIzq + 8, yTabla + 6);
  doc.text('DESCRIPCIÓN', margenIzq + 40, yTabla + 6);
  doc.text('SKU', margenIzq + 240, yTabla + 6);
  doc.text('CANTIDAD', margenIzq + 320, yTabla + 6, { width: 60, align: 'right' });
  doc.text('P. UNIT (Bs.)', margenIzq + 390, yTabla + 6, { width: 55, align: 'right' });
  doc.text('SUBTOTAL (Bs.)', margenIzq + 445, yTabla + 6, { width: 55, align: 'right' });

  yTabla += 22;
  doc.font('Helvetica').fontSize(8.5).fillColor('#1E293B');

  (venta.items || []).forEach((item, index) => {
    const fondoFila = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    doc.rect(margenIzq, yTabla, anchoContenido, 20).fill(fondoFila);
    doc.fillColor('#1E293B');

    doc.text(String(index + 1), margenIzq + 8, yTabla + 5);
    doc.text(item.nombre || 'Producto', margenIzq + 40, yTabla + 5, { width: 195, lineBreak: false });
    doc.text(item.sku || '-', margenIzq + 240, yTabla + 5);
    doc.text(String(item.cantidad), margenIzq + 320, yTabla + 5, { width: 60, align: 'right' });
    doc.text(formatearBs(item.precio_unitario), margenIzq + 390, yTabla + 5, { width: 55, align: 'right' });
    doc.text(formatearBs(item.subtotal), margenIzq + 445, yTabla + 5, { width: 55, align: 'right' });

    yTabla += 20;
  });

  // Línea divisoria inferior de la tabla
  doc.rect(margenIzq, yTabla, anchoContenido, 1).fill('#CBD5E1');
  yTabla += 8;

  // Sección de Totales y Literal
  const yTotales = yTabla;
  // Literal a la izquierda
  doc.rect(margenIzq, yTotales, 320, 50).fillAndStroke('#F8FAFC', '#E2E8F0');
  doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('SON:', margenIzq + 10, yTotales + 8);
  doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Oblique')
    .text(venta.total_literal || `${formatearBs(venta.total)} bolivianos`, margenIzq + 10, yTotales + 22, { width: 300 });

  // Caja de Total Numérico a la derecha
  const totalBoxX = margenIzq + 335;
  const totalBoxW = anchoContenido - 335;
  doc.rect(totalBoxX, yTotales, totalBoxW, 50).fillAndStroke('#EEF2FF', '#C7D2FE');
  doc.fillColor('#3730A3').fontSize(9).font('Helvetica-Bold')
    .text('TOTAL A PAGAR', totalBoxX, yTotales + 10, { width: totalBoxW, align: 'center' });
  doc.fillColor('#4F46E5').fontSize(16).font('Helvetica-Bold')
    .text(`Bs. ${formatearBs(venta.total)}`, totalBoxX, yTotales + 24, { width: totalBoxW, align: 'center' });

  // Notas o motivo de anulación
  let yNotas = yTotales + 60;
  if (venta.estado === 'anulada' && venta.motivo_anulacion) {
    doc.rect(margenIzq, yNotas, anchoContenido, 28).fillAndStroke('#FEF2F2', '#FECACA');
    doc.fillColor('#991B1B').fontSize(8).font('Helvetica-Bold')
      .text(`MOTIVO DE ANULACIÓN: ${venta.motivo_anulacion}`, margenIzq + 10, yNotas + 8);
    yNotas += 34;
  } else if (venta.notas) {
    doc.rect(margenIzq, yNotas, anchoContenido, 28).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#475569').fontSize(8).font('Helvetica')
      .text(`Observaciones: ${venta.notas}`, margenIzq + 10, yNotas + 8);
    yNotas += 34;
  }

  // Aviso y Disclaimer legal
  const yAviso = 750;
  doc.rect(margenIzq, yAviso, anchoContenido, 36).fillAndStroke('#FFFBEB', '#FDE68A');
  doc.fillColor('#92400E').fontSize(7.5).font('Helvetica-Bold')
    .text('NOTA IMPORTANTE Y AVISO LEGAL', margenIzq + 10, yAviso + 7);
  doc.font('Helvetica').fontSize(7).fillColor('#78350F')
    .text(
      'Este documento es una Nota de Venta y Entrega interna generada mediante la plataforma UNIMARKET BO. ' +
      'No constituye ni reemplaza a la factura fiscal oficial emitida conforme a la normativa del Servicio de Impuestos Nacionales (SIN).',
      margenIzq + 10,
      yAviso + 18,
      { width: anchoContenido - 20 }
    );

  // Pie de página
  doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
    .text('UNIMARKET BO · Sistema de Gestión Comercial para Empresas Bolivianas · https://unimarket.bo', margenIzq, 800, { width: anchoContenido, align: 'center' });
}

/**
 * Genera PDF para el reporte comercial de la empresa
 */
function generarPdfReporte({ resumen, empresa, desde, hasta, stream }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 45, right: 45 },
  });
  doc.pipe(stream);

  const margenIzq = 45;
  const margenDer = 550;
  const anchoContenido = margenDer - margenIzq;

  // Barra de acento
  doc.rect(margenIzq, 35, anchoContenido, 4).fill('#4F46E5');

  // Encabezado
  doc.fillColor('#0F172A').fontSize(16).font('Helvetica-Bold')
    .text('REPORTE EJECUTIVO DE VENTAS E INVENTARIO', margenIzq, 48);
  doc.fillColor('#4F46E5').fontSize(11).font('Helvetica-Bold')
    .text(empresa.razon_social, margenIzq, 70);
  doc.fillColor('#64748B').fontSize(8.5).font('Helvetica')
    .text(`NIT: ${empresa.nit || 'S/N'} · Generado: ${formatearFecha(new Date())}`, margenIzq, 85);
  doc.text(`Período: ${desde || 'Inicio'} hasta ${hasta || 'Hoy'}`, margenIzq, 98);

  // Tarjetas KPI resumen
  const yKpi = 120;
  const kpiW = (anchoContenido - 30) / 4;

  const kpis = [
    { label: 'Ventas Totales', valor: String(resumen.total_ventas || 0), sub: 'Transacciones emitidas' },
    { label: 'Ingresos Totales', valor: `Bs. ${formatearBs(resumen.ingresos_totales)}`, sub: 'Monto total percibido' },
    { label: 'Productos Vendidos', valor: String(resumen.total_unidades_vendidas || 0), sub: 'Unidades entregadas' },
    { label: 'Alertas Stock', valor: String(resumen.stock_bajo_count || 0), sub: 'Productos stock bajo/agotado' },
  ];

  kpis.forEach((kpi, i) => {
    const x = margenIzq + i * (kpiW + 10);
    doc.rect(x, yKpi, kpiW, 55).fillAndStroke('#F8FAFC', '#CBD5E1');
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold').text(kpi.label, x + 8, yKpi + 8);
    doc.fillColor('#1E293B').fontSize(12).font('Helvetica-Bold').text(kpi.valor, x + 8, yKpi + 22, { width: kpiW - 16 });
    doc.fillColor('#94A3B8').fontSize(6.5).font('Helvetica').text(kpi.sub, x + 8, yKpi + 42, { width: kpiW - 16 });
  });

  // Sección Top Productos Vendidos
  let ySec = 195;
  doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('Top Productos Más Vendidos', margenIzq, ySec);
  ySec += 18;

  doc.rect(margenIzq, ySec, anchoContenido, 18).fill('#4F46E5');
  doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
  doc.text('PRODUCTO', margenIzq + 8, ySec + 5);
  doc.text('SKU', margenIzq + 230, ySec + 5);
  doc.text('UNID. VENDIDAS', margenIzq + 320, ySec + 5, { width: 70, align: 'right' });
  doc.text('TOTAL RECAUDADO', margenIzq + 410, ySec + 5, { width: 90, align: 'right' });
  ySec += 18;

  const topProds = resumen.top_productos || [];
  if (topProds.length === 0) {
    doc.rect(margenIzq, ySec, anchoContenido, 20).fill('#FFFFFF');
    doc.fillColor('#64748B').fontSize(8).font('Helvetica-Oblique').text('No se registraron ventas en el período seleccionado', margenIzq + 8, ySec + 6);
    ySec += 20;
  } else {
    topProds.forEach((p, idx) => {
      doc.rect(margenIzq, ySec, anchoContenido, 18).fill(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
      doc.fillColor('#1E293B').fontSize(8).font('Helvetica');
      doc.text(p.nombre, margenIzq + 8, ySec + 4, { width: 215, lineBreak: false });
      doc.text(p.sku || '-', margenIzq + 230, ySec + 4);
      doc.text(String(p.unidades_vendidas), margenIzq + 320, ySec + 4, { width: 70, align: 'right' });
      doc.text(`Bs. ${formatearBs(p.total_recaudado)}`, margenIzq + 410, ySec + 4, { width: 90, align: 'right' });
      ySec += 18;
    });
  }

  // Sección Estado de Inventario y Stock Crítico
  ySec += 20;
  doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('Productos con Stock Bajo o Crítico', margenIzq, ySec);
  ySec += 18;

  doc.rect(margenIzq, ySec, anchoContenido, 18).fill('#EF4444');
  doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
  doc.text('PRODUCTO', margenIzq + 8, ySec + 5);
  doc.text('SKU', margenIzq + 230, ySec + 5);
  doc.text('STOCK ACTUAL', margenIzq + 320, ySec + 5, { width: 70, align: 'right' });
  doc.text('STOCK MÍNIMO', margenIzq + 410, ySec + 5, { width: 70, align: 'right' });
  doc.text('ESTADO', margenIzq + 485, ySec + 5, { width: 40, align: 'center' });
  ySec += 18;

  const prodsBajo = resumen.productos_stock_bajo || [];
  if (prodsBajo.length === 0) {
    doc.rect(margenIzq, ySec, anchoContenido, 20).fill('#FFFFFF');
    doc.fillColor('#10B981').fontSize(8).font('Helvetica-Bold').text('Todos los productos cuentan con niveles de stock óptimos', margenIzq + 8, ySec + 6);
    ySec += 20;
  } else {
    prodsBajo.forEach((p, idx) => {
      doc.rect(margenIzq, ySec, anchoContenido, 18).fill(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
      doc.fillColor('#1E293B').fontSize(8).font('Helvetica');
      doc.text(p.nombre, margenIzq + 8, ySec + 4, { width: 215, lineBreak: false });
      doc.text(p.sku || '-', margenIzq + 230, ySec + 4);
      doc.text(`${p.stock_actual} ${p.unidad || 'u'}`, margenIzq + 320, ySec + 4, { width: 70, align: 'right' });
      doc.text(`${p.stock_minimo} ${p.unidad || 'u'}`, margenIzq + 410, ySec + 4, { width: 70, align: 'right' });
      const esAgotado = p.stock_actual <= 0;
      doc.fillColor(esAgotado ? '#DC2626' : '#D97706').font('Helvetica-Bold')
        .text(esAgotado ? 'Agotado' : 'Bajo', margenIzq + 485, ySec + 4, { width: 40, align: 'center' });
      ySec += 18;
    });
  }

  // Footer
  doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
    .text('UNIMARKET BO · Reporte emitido automáticamente desde el panel de control · https://unimarket.bo', margenIzq, 800, { width: anchoContenido, align: 'center' });

  doc.end();
}

/**
 * Genera PDF de Inventario (Completo o Filtrado por Stock Bajo)
 */
function generarPdfInventario({ productos = [], empresa = {}, soloBajo = false, stream }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 45, right: 45 },
  });

  doc.pipe(stream);

  const margenIzq = 45;
  const margenDer = 550;
  const anchoContenido = margenDer - margenIzq;

  // Barra de acento
  doc.rect(margenIzq, 35, anchoContenido, 4).fill(soloBajo ? '#EF4444' : '#4F46E5');

  // Encabezado
  const titulo = soloBajo
    ? 'REPORTE DE PRODUCTOS CON STOCK BAJO O AGOTADO'
    : 'REPORTE GENERAL DE INVENTARIO Y EXISTENCIAS';

  doc.fillColor('#0F172A').fontSize(15).font('Helvetica-Bold')
    .text(titulo, margenIzq, 48);
  doc.fillColor(soloBajo ? '#EF4444' : '#4F46E5').fontSize(11).font('Helvetica-Bold')
    .text(empresa.razon_social || 'EMPRESA', margenIzq, 70);
  doc.fillColor('#64748B').fontSize(8.5).font('Helvetica')
    .text(`NIT: ${empresa.nit || 'S/N'} · Generado: ${formatearFecha(new Date())}`, margenIzq, 85);

  // Totales
  let totalItems = productos.length;
  let totalUnidades = 0;
  let valorTotal = 0;
  let agotados = 0;

  productos.forEach((p) => {
    const stock = parseInt(p.stock_actual, 10) || 0;
    const precio = parseFloat(p.precio) || 0;
    totalUnidades += stock;
    valorTotal += stock * precio;
    if (stock <= 0) agotados++;
  });

  const yKpi = 108;
  const kpiW = (anchoContenido - 30) / 4;
  const kpis = [
    { label: 'Total Productos', valor: String(totalItems) },
    { label: 'Unidades en Stock', valor: String(totalUnidades) },
    { label: 'Valor Inventario', valor: `Bs. ${formatearBs(valorTotal)}` },
    { label: 'Productos Agotados', valor: String(agotados) },
  ];

  kpis.forEach((kpi, i) => {
    const x = margenIzq + i * (kpiW + 10);
    doc.rect(x, yKpi, kpiW, 46).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold').text(kpi.label, x + 8, yKpi + 8);
    doc.fillColor('#1E293B').fontSize(11.5).font('Helvetica-Bold').text(kpi.valor, x + 8, yKpi + 22, { width: kpiW - 16 });
  });

  // Tabla
  let ySec = 170;
  doc.rect(margenIzq, ySec, anchoContenido, 18).fill(soloBajo ? '#DC2626' : '#4338CA');
  doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
  doc.text('PRODUCTO', margenIzq + 8, ySec + 5);
  doc.text('SKU', margenIzq + 195, ySec + 5);
  doc.text('STOCK', margenIzq + 265, ySec + 5, { width: 50, align: 'right' });
  doc.text('MÍN', margenIzq + 320, ySec + 5, { width: 35, align: 'right' });
  doc.text('P. UNIT.', margenIzq + 360, ySec + 5, { width: 55, align: 'right' });
  doc.text('VALOR TOTAL', margenIzq + 420, ySec + 5, { width: 60, align: 'right' });
  doc.text('ESTADO', margenIzq + 485, ySec + 5, { width: 40, align: 'center' });
  ySec += 18;

  if (productos.length === 0) {
    doc.rect(margenIzq, ySec, anchoContenido, 20).fill('#FFFFFF');
    doc.fillColor('#64748B').fontSize(8).font('Helvetica-Oblique').text('No se encontraron registros de inventario.', margenIzq + 8, ySec + 6);
  } else {
    productos.forEach((p, idx) => {
      if (ySec > 760) {
        doc.addPage();
        ySec = 40;
        doc.rect(margenIzq, ySec, anchoContenido, 18).fill(soloBajo ? '#DC2626' : '#4338CA');
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
        doc.text('PRODUCTO', margenIzq + 8, ySec + 5);
        doc.text('SKU', margenIzq + 195, ySec + 5);
        doc.text('STOCK', margenIzq + 265, ySec + 5, { width: 50, align: 'right' });
        doc.text('MÍN', margenIzq + 320, ySec + 5, { width: 35, align: 'right' });
        doc.text('P. UNIT.', margenIzq + 360, ySec + 5, { width: 55, align: 'right' });
        doc.text('VALOR TOTAL', margenIzq + 420, ySec + 5, { width: 60, align: 'right' });
        doc.text('ESTADO', margenIzq + 485, ySec + 5, { width: 40, align: 'center' });
        ySec += 18;
      }

      const stock = parseInt(p.stock_actual, 10) || 0;
      const min = parseInt(p.stock_minimo, 10) || 20;
      const precio = parseFloat(p.precio) || 0;
      const valItem = stock * precio;
      const esAgotado = stock <= 0;
      const esBajo = stock <= min;

      doc.rect(margenIzq, ySec, anchoContenido, 18).fill(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
      doc.fillColor('#1E293B').fontSize(8).font('Helvetica');
      doc.text(p.nombre, margenIzq + 8, ySec + 4, { width: 180, lineBreak: false });
      doc.text(p.sku || '-', margenIzq + 195, ySec + 4, { width: 65, lineBreak: false });
      doc.text(String(stock), margenIzq + 265, ySec + 4, { width: 50, align: 'right' });
      doc.text(String(min), margenIzq + 320, ySec + 4, { width: 35, align: 'right' });
      doc.text(`Bs. ${formatearBs(precio)}`, margenIzq + 360, ySec + 4, { width: 55, align: 'right' });
      doc.text(`Bs. ${formatearBs(valItem)}`, margenIzq + 420, ySec + 4, { width: 60, align: 'right' });

      doc.fillColor(esAgotado ? '#DC2626' : esBajo ? '#D97706' : '#059669').font('Helvetica-Bold')
        .text(esAgotado ? 'Agotado' : esBajo ? 'Bajo' : 'OK', margenIzq + 485, ySec + 4, { width: 40, align: 'center' });
      ySec += 18;
    });
  }

  // Footer
  doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
    .text('UNIMARKET BO · Sistema de Gestión de Inventarios y Catálogos · https://unimarket.bo', margenIzq, 800, { width: anchoContenido, align: 'center' });

  doc.end();
}

function capitalizarPalabra(str) {
  if (!str) return '';
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

module.exports = {
  generarPdfVenta,
  generarPdfReporte,
  generarPdfInventario,
  formatearBs,
  formatearFecha,
};
