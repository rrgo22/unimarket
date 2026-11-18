# PRUEBAS DE SOFTWARE – UNIMARKET BO

## 1. Datos generales

| Campo | Información |
|---|---|
| Proyecto | UNIMARKET BO |
| Tipo de sistema | Plataforma web de catálogos digitales multiempresa |
| Arquitectura | React + Vite + Tailwind CSS / Node.js + Express / PostgreSQL |
| Alcance | Registro de empresas, autenticación, verificación de NIT, suscripción, catálogo público, pedidos y reportes |
| Ambiente previsto | Backend `http://localhost:4000`, frontend `http://localhost:5173`, PostgreSQL 15+ |
| Fecha del documento | 2026-11-09 |
| Responsable | Estudiante: ______________________________ |
| Versión evaluada | 2.0 |

## 2. Objetivo y alcance de las pruebas

El objetivo es comprobar que UNIMARKET BO cumple sus requisitos funcionales y no funcionales principales mediante pruebas de caja negra y caja blanca.

La caja negra valida el comportamiento observable desde la interfaz o la API, sin depender de la implementación interna. La caja blanca revisa las decisiones, validaciones, rutas de ejecución, transacciones y condiciones presentes en el código.

El alcance se limita a las funcionalidades documentadas y actualmente identificables en el proyecto:

- registro de una empresa con documento NIT;
- inicio de sesión de administrador y empresa;
- revisión y aprobación de la verificación;
- carga y confirmación del comprobante de suscripción;
- regla de publicación del portal en el catálogo;
- consulta, búsqueda y filtrado del catálogo público;
- generación de pedido por WhatsApp;
- consulta pública de comprobantes;
- registro de reportes de empresas o productos;
- seguridad básica, validaciones, integridad transaccional y rendimiento.

## 3. Requisitos e historias de usuario cubiertos

### 3.1 Requisitos funcionales relacionados con los casos de uso

| Código | Requisito / caso de uso | Fuente |
|---|---|---|
| RF-01 | El representante registra una empresa, sus credenciales, NIT y documento de respaldo. | CUF-07, CUF-08 |
| RF-02 | El usuario puede iniciar sesión según sus credenciales y rol. | RNF-01 |
| RF-03 | El administrador revisa y decide la verificación legal de la empresa. | CUF-16 |
| RF-04 | La empresa envía el comprobante del pago de suscripción. | CUF-14 |
| RF-05 | El administrador confirma el pago y activa la suscripción por 30 días. | CUF-17 |
| RF-06 | Solo una empresa verificada, no eliminada y con suscripción activa aparece públicamente. | Vista `v_empresas_publicas` |
| RF-07 | El visitante consulta y filtra productos y empresas del catálogo. | CUF-01, CUF-04 |
| RF-08 | El comprador genera un pedido trazable y un enlace de contacto por WhatsApp. | CUF-03 |
| RF-09 | El comprador consulta un comprobante mediante un token público temporal. | CUF-05 |
| RF-10 | El comprador registra una denuncia con motivos y descripción. | CUF-06 |

### 3.2 Historias de usuario seleccionadas

**HU-01 – Registro de empresa.** Como representante de una empresa, quiero registrar mis datos, credenciales, NIT y documento legal para solicitar la verificación de mi negocio.

**HU-02 – Publicación del catálogo.** Como administrador, quiero revisar el NIT y confirmar el pago de una empresa para que solo los comercios autorizados se publiquen en el catálogo.

**HU-03 – Exploración y pedido.** Como comprador, quiero buscar productos, revisar sus detalles y enviar un pedido por WhatsApp para contactar al vendedor.

**HU-04 – Reporte de irregularidad.** Como comprador, quiero reportar una empresa o producto para que el administrador pueda revisar el caso.

## 4. Datos de prueba

| Dato | Valor / condición |
|---|---|
| Administrador | Usuario `admin`, contraseña `admin123` |
| Empresa de prueba | Usuario `empresa1`, contraseña `empresa123` |
| Plan | Plan Único, Bs 200 por mes |
| Documento válido | PDF de NIT menor o igual a 5 MB |
| Documento inválido | Archivo que no sea PDF o que supere el límite configurado |
| Empresa nueva | Razón social, NIT, teléfono, WhatsApp, usuario y correo únicos |
| Suscripción inicial | `pendiente_pago` |
| Empresa no publicada | No verificada, eliminada o con suscripción vencida/suspendida |
| Reporte válido | Al menos un motivo y descripción de 10 a 3000 caracteres |

> Los resultados reales, fecha de ejecución, navegador, datos de respuesta y evidencias deben completarse durante la ejecución. En este documento se usa `No ejecutado` para evitar confundir el resultado esperado con una prueba ya realizada.

## 5. Pruebas de caja negra

### 5.1 Plantilla básica de caso de prueba funcional

| ID | Descripción | Requisitos previos | Pasos de prueba | Resultado esperado | Resultado real | Estado |
|---|---|---|---|---|---|---|
| FUN-001 | Registrar una empresa con datos válidos y NIT en PDF | Backend y BD activos; correo y NIT no registrados | Abrir Registro → completar campos válidos → adjuntar PDF → enviar | HTTP 201; se crean usuario, empresa, verificación pendiente y suscripción `pendiente_pago`; se muestra mensaje de espera de revisión | Pendiente de ejecución | No ejecutado |
| FUN-002 | Rechazar registro con campos inválidos | Página de registro disponible | Enviar sin documento, con correo inválido y contraseña menor a 8 caracteres | HTTP 400; se indican los campos que deben corregirse; no se crea información parcial | Pendiente de ejecución | No ejecutado |
| FUN-003 | Evitar duplicidad de NIT, correo o usuario | Existe un registro con esos datos | Registrar otra empresa usando un dato repetido | HTTP 409; se informa el campo duplicado; el segundo registro no se crea | Pendiente de ejecución | No ejecutado |
| FUN-004 | Consultar catálogo público | Existe al menos una empresa visible | Abrir Inicio/Catálogo → consultar productos → aplicar categoría y búsqueda | Se muestran únicamente productos disponibles de empresas verificadas y activas; los filtros actualizan la lista | Pendiente de ejecución | No ejecutado |
| FUN-005 | Generar pedido por WhatsApp | Producto visible con precio y stock | Abrir detalle → indicar cantidad/color → seleccionar Enviar pedido por WhatsApp | Se genera código único `PED-...`, total estimado, detalle de ítems y URL de WhatsApp; el pedido queda registrado | Pendiente de ejecución | No ejecutado |
| FUN-006 | Registrar un reporte válido | Empresa existente | Abrir Reportar → seleccionar motivo → escribir descripción de 10 o más caracteres → enviar | HTTP 201; se registra el reporte con estado `pendiente` y se muestra confirmación | Pendiente de ejecución | No ejecutado |
| FUN-007 | Rechazar reporte incompleto | Empresa existente | Enviar reporte sin motivo o con descripción menor a 10 caracteres | HTTP 400; se informa el dato faltante; no se registra el reporte | Pendiente de ejecución | No ejecutado |
| FUN-008 | Consultar comprobante con token válido | Existe venta con token vigente | Abrir enlace público del comprobante | Se muestran datos del emisor, ítems, totales, estado y opción de PDF | Pendiente de ejecución | No ejecutado |

### 5.2 Plantilla de caso de prueba de inicio de sesión

| ID | Descripción | Credenciales de prueba | Pasos | Resultado esperado | Resultado real | Estado |
|---|---|---|---|---|---|---|
| LOGIN-001 | Inicio de sesión válido de administrador | `admin` / `admin123` | Abrir Login → introducir usuario y contraseña → pulsar Iniciar sesión | Se recibe token JWT y se abre el panel administrativo | Pendiente de ejecución | No ejecutado |
| LOGIN-002 | Inicio de sesión válido de empresa | `empresa1` / `empresa123` | Abrir Login → introducir credenciales → iniciar sesión | Se recibe token JWT y se abre el panel de empresa con su `id_empresa` | Pendiente de ejecución | No ejecutado |
| LOGIN-003 | Rechazar contraseña incorrecta | `admin` / `incorrecta123` | Introducir credenciales → iniciar sesión | HTTP 401 y mensaje de usuario o contraseña incorrectos; no se crea sesión | Pendiente de ejecución | No ejecutado |
| LOGIN-004 | Validar campos obligatorios | Usuario vacío / contraseña vacía | Pulsar Iniciar sesión sin completar campos | HTTP 400 y mensaje solicitando usuario y contraseña | Pendiente de ejecución | No ejecutado |
| LOGIN-005 | Bloquear cuenta inactiva o eliminada | Cuenta marcada como inactiva o eliminada | Intentar iniciar sesión | HTTP 403; se informa que la cuenta está desactivada; no se entrega acceso | Pendiente de ejecución | No ejecutado |
| LOGIN-006 | Limitar intentos repetidos | Cualquier cuenta válida | Realizar más de 20 intentos en 15 minutos desde la misma IP | El servicio responde con límite de intentos y evita el abuso de autenticación | Pendiente de ejecución | No ejecutado |

### 5.3 Plantilla de aceptación del usuario (UAT)

| ID | Historia de usuario | Criterios de aceptación | Pasos | Resultado esperado | Resultado real | Estado |
|---|---|---|---|---|---|---|
| UAT-001 | HU-01: registro de empresa | Se registran datos válidos, NIT y documento; la solicitud queda pendiente | El representante completa Registro y envía el formulario | El sistema confirma la solicitud, muestra espera de revisión y no publica todavía la empresa | Pendiente de ejecución | No ejecutado |
| UAT-002 | HU-02: publicación controlada | Solo una empresa verificada y con pago confirmado debe aparecer | Admin aprueba NIT → empresa sube comprobante → admin confirma pago → visitante consulta catálogo | La suscripción queda activa por 30 días y la empresa aparece en catálogo; antes de ambos pasos permanece oculta | Pendiente de ejecución | No ejecutado |
| UAT-003 | HU-03: exploración y pedido | El comprador puede localizar un producto, revisar precio/stock y contactar al vendedor | Buscar producto → abrir detalle → seleccionar cantidad/color → enviar pedido | Se muestra el pedido estructurado, código correlativo, total y contacto por WhatsApp | Pendiente de ejecución | No ejecutado |
| UAT-004 | HU-04: reporte de irregularidad | El usuario puede reportar con al menos un motivo y detalle suficiente | Abrir Reportar → elegir motivo → describir incidente → enviar | El sistema confirma el reporte y este queda disponible para gestión administrativa | Pendiente de ejecución | No ejecutado |

### 5.4 Plantilla de caso de prueba de integración

| ID | Sistemas involucrados | Punto de integración | Pasos | Resultado esperado | Resultado real | Estado |
|---|---|---|---|---|---|---|
| INT-001 | Frontend Registro + API Auth + PostgreSQL + almacenamiento de archivos + correo | Registro de empresa con NIT | Enviar formulario multipart con PDF → consultar BD → revisar notificación | Usuario, empresa, verificación y suscripción se crean en una transacción; el PDF queda almacenado; se registra/envía notificación | Pendiente de ejecución | No ejecutado |
| INT-002 | Panel Admin + API Admin + PostgreSQL + correo | Aprobación de NIT | Admin abre solicitud → valida checklist → aprueba | Empresa pasa a verificada, se registra fecha de revisión y se genera notificación de aprobación | Pendiente de ejecución | No ejecutado |
| INT-003 | Panel Empresa + API de pagos + almacenamiento + Panel Admin + PostgreSQL | Confirmación de suscripción | Empresa sube comprobante → admin lo consulta → confirma pago | Pago pasa a confirmado; suscripción pasa a activa con 30 días; se registra quién confirmó; se notifica a la empresa | Pendiente de ejecución | No ejecutado |
| INT-004 | Vista pública + API catálogo + vista SQL PostgreSQL | Regla de visibilidad | Consultar catálogo con empresa pendiente, verificada sin pago y activa | Solo el tercer caso es visible; la consulta respeta verificación, borrado lógico, estado activo y fecha de vencimiento | Pendiente de ejecución | No ejecutado |
| INT-005 | Catálogo + API de pedidos + PostgreSQL + WhatsApp + correo | Pedido público | Crear pedido desde ficha → consultar `pedido_whatsapp` e ítems → abrir URL | Pedido e ítems se guardan con total/código; se genera enlace estructurado; se envía aviso a la empresa si está configurado | Pendiente de ejecución | No ejecutado |
| INT-006 | Reporte público + PostgreSQL + Panel Admin | Gestión de denuncia | Registrar reporte → abrir bandeja admin → cambiar estado | El reporte se visualiza con empresa, producto, motivos y descripción; el cambio de estado queda persistido | Pendiente de ejecución | No ejecutado |

### 5.5 Plantilla de caso de prueba de rendimiento

| ID | Guion / escenario | Condiciones de carga | Pasos | Tiempo esperado | Tiempo real | Estado |
|---|---|---|---|---|---|---|
| PERF-001 | Consulta inicial del catálogo | 1 usuario; BD con catálogo de prueba | Solicitar catálogo 10 veces y registrar latencia | P95 menor o igual a 2 s | Pendiente de medición | No ejecutado |
| PERF-002 | Búsqueda y sugerencias | 50 usuarios concurrentes; consultas variadas | Ejecutar búsquedas durante 5 minutos | P95 menor o igual a 2 s; sin errores 5xx | Pendiente de medición | No ejecutado |
| PERF-003 | Carga de categorías con caché | 100 solicitudes concurrentes en 60 s | Solicitar `/api/publico/categorias` repetidamente | P95 menor o igual a 2 s; la respuesta no debe degradarse por encima del límite definido | Pendiente de medición | No ejecutado |
| PERF-004 | Inicio de sesión bajo carga | 20 usuarios concurrentes con credenciales válidas | Ejecutar login concurrente controlado | P95 menor o igual a 3 s; las respuestas válidas mantienen HTTP 200 | Pendiente de medición | No ejecutado |
| PERF-005 | Registro concurrente | 10 registros por IP/hora, datos únicos | Enviar solicitudes válidas e inválidas | Las solicitudes permitidas responden sin error 5xx; al exceder el límite se responde HTTP 429 | Pendiente de medición | No ejecutado |

## 6. Pruebas de caja blanca

Estas pruebas se diseñan a partir de las rutas internas identificadas en el código. El objetivo es cubrir decisiones, validaciones, transacciones y caminos alternativos.

### 6.1 Caminos principales y decisiones

| ID | Unidad revisada | Decisiones/caminos que deben cubrirse | Caso de prueba | Resultado esperado | Estado |
|---|---|---|---|---|---|
| WB-001 | `POST /api/auth/login` | Usuario existe/no existe; contraseña coincide/no coincide; cuenta activa/inactiva | Probar credenciales válidas, inválidas y cuenta desactivada | Se cubren respuestas 200, 401 y 403 sin entregar token incorrecto | No ejecutado |
| WB-002 | `POST /api/auth/registro-empresa` | Validación de datos; existencia de archivo; duplicidad; commit/rollback | Probar formulario válido, sin PDF, NIT duplicado y error de BD | Datos válidos hacen commit; entradas inválidas hacen rollback y no dejan registros parciales | No ejecutado |
| WB-003 | `GET /api/publico/categorias` | Caché presente/ausente/expirada; consulta exitosa/error | Primera consulta, segunda consulta dentro de 60 s y consulta después de expiración | La respuesta cacheada evita una consulta innecesaria y una expiración vuelve a consultar BD | No ejecutado |
| WB-004 | Regla `v_empresas_publicas` | Verificada/no verificada; eliminada/no eliminada; activa/vencida | Crear datos para las ocho combinaciones booleanas | Solo verificada + no eliminada + activa vigente es visible | No ejecutado |
| WB-005 | `POST /api/publico/reportes` | Empresa válida; producto válido o ausente; motivos; longitud de descripción | Probar cada combinación válida e inválida | Se rechazan empresa inválida, motivos vacíos y descripción fuera de rango | No ejecutado |
| WB-006 | Confirmación de pago | Pago pendiente/confirmado/rechazado; meses válidos; suscripción existente | Confirmar pago válido y repetir confirmación | La primera operación activa la suscripción; la repetida no duplica ni corrompe fechas | No ejecutado |

### 6.2 Pruebas de flujo y transacciones

**Camino esperado del registro:** validación → verificación de duplicados → `BEGIN` → insertar usuario → insertar empresa → insertar verificación → insertar suscripción → `COMMIT` → notificación.

**Camino de error:** cualquier error después de `BEGIN` → `ROLLBACK` → eliminación del archivo temporal → respuesta de error.

| ID | Escenario de caja blanca | Condición introducida | Resultado esperado |
|---|---|---|---|
| WB-TX-001 | Error durante inserción de empresa | Forzar una restricción de unicidad después de iniciar transacción | No queda usuario huérfano, ni empresa, ni verificación, ni suscripción |
| WB-TX-002 | Error al enviar correo posterior al commit | Simular SMTP no disponible | La operación principal permanece confirmada; el evento queda registrado o se informa en log; no se revierte la empresa |
| WB-TX-003 | Error en comprobante de pago | Enviar formato o tamaño no permitido | Se rechaza el archivo y no se registra un pago incompleto |
| WB-TX-004 | Aislamiento multiempresa | Usar token de una empresa para consultar/modificar otra | La API usa el `id_empresa` del JWT y rechaza el acceso no autorizado |

### 6.3 Cobertura propuesta

Para la entrega se recomienda registrar, como mínimo:

- cobertura de decisiones de login: 100% de ramas de autenticación;
- cobertura de validaciones del registro: datos correctos, faltantes, formato y duplicados;
- cobertura de la regla de visibilidad: todas las combinaciones de estado relevantes;
- cobertura de transacciones: commit exitoso y rollback por error;
- cobertura de reportes: motivos y límites de descripción;
- cobertura de control de acceso: administrador, empresa y visitante.

## 7. Evidencia automatizada existente

El proyecto incluye el script `backend/scripts/test-flujo-completo.js`. Este script define una validación end-to-end de 11 criterios:

1. plan activo de Bs 200;
2. usuarios de prueba;
3. suscripción activa de la empresa inicial;
4. estructura de la tabla `pago`;
5. estructura de `notificacion_correo`;
6. registro de una empresa;
7. empresa pendiente no visible;
8. aprobación del NIT;
9. empresa aprobada sin pago no visible;
10. carga del comprobante;
11. confirmación del pago y publicación.

Para ejecutarlo con PostgreSQL configurado:

```bash
cd unimarket/backend
node scripts/test-flujo-completo.js
```

El resultado de esta ejecución debe anexarse como captura o copiarse en la columna “Resultado real” de los casos `INT-001` a `INT-004` y `UAT-001` a `UAT-002`. El script crea y elimina datos temporales; aun así, se recomienda ejecutar primero en una base de datos de pruebas.

## 8. Criterios de entrada y salida

### Criterios de entrada

- PostgreSQL disponible y esquema/migraciones aplicados.
- Backend y frontend iniciados sin errores.
- Cuentas de prueba y datos de catálogo preparados.
- Archivos PDF de prueba disponibles.
- Variables de entorno configuradas sin exponer credenciales reales.

### Criterios de salida

- Todos los casos críticos ejecutados.
- No existen defectos críticos abiertos en login, registro, pago o visibilidad pública.
- Las pruebas de integración del flujo principal finalizan correctamente.
- Las pruebas de rendimiento tienen mediciones P95 registradas.
- Los casos rechazados tienen evidencia y descripción del defecto.

## 9. Resumen para la entrega

Las pruebas propuestas cubren el flujo principal de valor de UNIMARKET BO y relacionan los requisitos funcionales, cuatro historias de usuario y los cinco tipos de plantilla solicitados: funcional, inicio de sesión, aceptación del usuario, integración y rendimiento. Además, se incorporan pruebas de caja blanca para validaciones, decisiones, seguridad de roles y transacciones.

El documento queda listo para ejecutar. Antes de presentarlo como resultado final, deben completarse las columnas de resultado real, fecha, evidencia y estado con las pruebas realizadas en el ambiente local.

