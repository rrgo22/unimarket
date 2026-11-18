const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const baseUrl = 'http://localhost:4000/api/auth/registro-empresa';
const documento = path.resolve(__dirname, '..', 'uploads', 'documentos', '1794697721580-b9ac565e87f1ac95.pdf');

async function registrar(i) {
  const form = new FormData();
  form.append('razon_social', `Rendimiento QA ${String(i).padStart(2, '0')} S.R.L.`);
  form.append('nit', `20261114${String(i).padStart(2, '02')}`);
  form.append('whatsapp', `70000${String(100 + i).padStart(3, '0')}`);
  form.append('usuario', `perf001_${String(i).padStart(2, '2')}`);
  form.append('correo', `perf001_${String(i).padStart(2, '2')}@empresa.bo`);
  form.append('contrasena', 'Perf001QA#2026');
  form.append('documento', new Blob([fs.readFileSync(documento)], { type: 'application/pdf' }), 'nit-prueba.pdf');

  const inicio = performance.now();
  const response = await fetch(baseUrl, { method: 'POST', body: form });
  const segundos = (performance.now() - inicio) / 1000;
  let body = {};
  try { body = await response.json(); } catch {}
  return { registro: i, segundos: Number(segundos.toFixed(3)), codigo: response.status, exitoso: response.status === 201, mensaje: body.mensaje || body.error || '' };
}

(async () => {
  const resultados = [];
  for (let i = 1; i <= 10; i += 1) {
    resultados.push(await registrar(i));
  }
  const tiempos = resultados.filter((r) => r.exitoso).map((r) => r.segundos);
  const promedio = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0;
  const maximo = tiempos.length ? Math.max(...tiempos) : 0;
  console.log(JSON.stringify({ resultados, exitosos: tiempos.length, promedio: Number(promedio.toFixed(3)), maximo: Number(maximo.toFixed(3)), todosMenosDe2s: tiempos.length === 10 && maximo <= 2 }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
