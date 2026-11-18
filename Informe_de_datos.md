# INFORME TÉCNICO Y DE DATOS DEL SISTEMA: UNIMARKET BO
**Plataforma Integral de Comercio B2B / B2C con Directorio y Catálogo de Empresas Verificadas**  
*Documento de Arquitectura, Base de Datos, Casos de Uso y Especificación Técnica*  
*Versión del Sistema:* 2.0 (Edición 2026) • *Estado:* En Producción Local

---

## ÍNDICE GENERAL
1. [Aclaración Tecnológica: ¿Es un Framework o qué tecnología usa?](#1-aclaración-tecnológica-es-un-framework-o-qué-tecnología-usa)
2. [Explicación y Funcionamiento Integral del Sistema](#2-explicación-y-funcionamiento-integral-del-sistema)
3. [Base de Datos Actual Completa (Diccionario y Esquema Físico)](#3-base-de-datos-actual-completa)
4. [Casos de Uso Funcionales (CUF)](#4-casos-de-uso-funcionales-cuf)
5. [Requisitos y Casos de Uso No Funcionales (RNF)](#5-requisitos-y-casos-de-uso-no-funcionales-rnf)

---

## 1. ACLARACIÓN TECNOLÓGICA: ¿ES UN FRAMEWORK O QUÉ TECNOLOGÍA USA?

### 1.1 ¿Es un Framework?
**No es un único framework monolítico.**  
Sistemas tradicionales como Django (Python), Ruby on Rails (Ruby) o Laravel (PHP) son frameworks "todo en uno" (Full-Stack monolitos).  
**UNIMARKET BO** utiliza una **Arquitectura Cliente-Servidor Desacoplada (Decoupled Single Page Application + RESTful API)** basada en el estándar industrial conocido como **Stack PERN** (PostgreSQL, Express.js, React, Node.js).

En esta arquitectura existen **dos aplicaciones independientes que cooperan**:
1. **Frontend (Cliente Web / SPA):** Desarrollado con la librería **React**, compilado y empaquetado con **Vite**, y estilizado con **Tailwind CSS**. Corre en el navegador del usuario.
2. **Backend (Servidor de API REST):** Desarrollado en **Node.js** utilizando el microframework web **Express.js**, conectado directamente a una base de datos relacional **PostgreSQL**.

---

### 1.2 Detalle de la Pila Tecnológica (Tech Stack)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CAPA CLIENTE (FRONTEND - SPA)                        │
│  React 18  •  Vite 5  •  Tailwind CSS 3  •  React Router 6             │
│  Framer Motion (Animaciones) • Lucide React (Iconos) • Sonner (Toasts) │
└────────────────────────────────────▲───────────────────────────────────┘
                                     │ JSON vía HTTPS / REST
┌────────────────────────────────────▼───────────────────────────────────┐
│                   CAPA SERVIDOR (BACKEND - API REST)                   │
│  Node.js (Runtime)  •  Express.js 4 (Servidor HTTP / Rutas)            │
│  JWT + bcryptjs (Seguridad)  •  Multer (Uploads)  •  PDFKit (Ventas)   │
│  Nodemailer (Correos SMTP)   •  Node-Cron (Vencimientos automáticos)   │
└────────────────────────────────────▲───────────────────────────────────┘
                                     │ Driver nativo 'pg' (Pool SQL)
┌────────────────────────────────────▼───────────────────────────────────┐
│               CAPA DE DATOS (BASE DE DATOS RELACIONAL)                 │
│  PostgreSQL 15+ (3FN, Índices B-Tree/GIN, Extensiones unaccent, trgm)  │
└────────────────────────────────────────────────────────────────────────┘
```

#### A. Tecnologías del Frontend
* **React 18:** Biblioteca declarativa para interfaces de usuario basada en componentes reutilizables, hooks (`useState`, `useEffect`, `useMemo`, `useCallback`) y renderizado reactivo del DOM virtual.
* **Vite 5:** Herramienta de compilación y empaquetado (build tool) de última generación, reemplazo moderno de Webpack, con soporte nativo de módulos ES (ESM) y recarga rápida en caliente (HMR).
* **Tailwind CSS 3:** Framework CSS de utilidad first-party que permite construir interfaces responsivas, modernas y fluidas en modo oscuro con paleta institucional.
* **React Router DOM 6:** Gestor de navegación y rutas en el cliente sin recarga de página (Single Page Application).
* **Framer Motion:** Biblioteca de animaciones declarativas para transiciones de modales, alertas y microinteracciones de tarjetas.
* **Lucide React:** Biblioteca de iconografía vectorial SVG liviana y estilizada.
* **Sonner:** Sistema de notificaciones toast flotantes con alta visibilidad y soporte para temas oscuros.

#### B. Tecnologías del Backend
* **Node.js (v20+):** Entorno de ejecución JavaScript asíncrono y no bloqueante para el servidor.
* **Express.js 4:** Framework web minimalista para crear endpoints REST organizados por rutas (`auth`, `publico`, `empresa`, `admin`).
* **pg (node-postgres):** Driver oficial de PostgreSQL para Node.js con Connection Pooling optimizado y consultas SQL parametrizadas directas (sin ORM intermediario como Prisma o Sequelize, lo que asegura máximo rendimiento y control fino de transacciones).
* **JSON Web Tokens (jsonwebtoken - JWT):** Autenticación sin estado (stateless) para sesiones de usuarios, garantizando escalabilidad y seguridad con caducidad programada.
* **bcryptjs:** Algoritmo criptográfico de hashing unidireccional con salt para almacenar contraseñas de forma segura.
* **Helmet:** Middleware de seguridad que configura cabeceras HTTP de protección (XSS, Clickjacking, MIME sniffing, HSTS).
* **Cors:** Middleware de control de acceso para autorizar peticiones únicamente desde orígenes permitidos.
* **Express-rate-limit:** Mecanismo contra ataques de fuerza bruta y DoS en endpoints críticos (búsqueda predictiva y autenticación).
* **Multer:** Gestor de subida de archivos multipart/form-data con validación estricta de tipo MIME, tamaño y almacenamiento seguro en disco para NITs, logos, portadas y comprobantes.
* **PDFKit:** Motor de generación programática de documentos PDF vectoriales para notas de venta oficiales y reportes comerciales con cálculo de subtotales, totales y conversión de números a formato literal.
* **Nodemailer:** Cliente SMTP transaccional para notificaciones automáticas por correo electrónico (verificación aprobada/observada, pago acreditado, suspensión y stock bajo).
* **Node-cron:** Planificador de cron jobs en segundo plano que corre a las 08:00 AM para verificar suscripciones vencidas y enviar recordatorios.

#### C. Tecnologías de la Base de Datos
* **PostgreSQL 15+:** RDBMS relacional que implementa integridad referencial (claves primarias, foráneas, restricciones `CHECK`, `UNIQUE` y cascadas).
* **Extensiones PostgreSQL integradas:**
  * `unaccent`: Permite búsquedas textuales insensibles a tildes (ej. buscar "electrónica" encuentra "electronica" y viceversa).
  * `pg_trgm`: Operadores de trigramas para búsqueda difusa (fuzzy search) y tolerancia a errores ortográficos menores.

---

## 2. EXPLICACIÓN Y FUNCIONAMIENTO INTEGRAL DEL SISTEMA

### 2.1 Propósito y Filosofía del Sistema
**UNIMARKET BO** resuelve el problema de la desconfianza y la informalidad en el comercio digital boliviano. La plataforma no permite que cualquier persona suba productos anónimamente; en su lugar, implementa un **"Círculo de Confianza Verificado"**:

1. **Filtro Legal Preventivo (Onboarding):** Toda empresa debe registrarse con su Número de Identificación Tributaria (NIT) y subir su certificado tributario digital. El Administrador revisa el documento bajo un estricto checklist de 3 puntos (NIT válido, razón social coincidente, documento vigente).
2. **Sostenibilidad y Seriedad (Suscripción):** Para exhibir productos y tienda pública, la empresa debe abonar una suscripción mensual (Bs 200). El pago se realiza vía QR o transferencia y el Administrador concilia el comprobante bancario.
3. **Catálogo y Pedido Rápido por WhatsApp:** Los compradores acceden a un catálogo limpio, rápido y filtrable. Cada producto ofrece selección de variantes de color, cálculo automático de precio por volumen (escala mayorista) y generación de pedidos con enlace directo a WhatsApp.
4. **Cierre de Confianza (Reportes y Control):** Si un comercio incumple entregas, comercializa productos falsos o comete irregularidades, los compradores pueden pulsar el botón **"Reportar"** (en el portal o en el modal del producto). El Administrador recibe la alerta, puede abrir un chat directo con la empresa para exigir descargos y tiene la potestad de **suspender preventivamente o definitivamente a la empresa**, retirándola del catálogo de inmediato.

---

### 2.2 Flujo de Funcionamiento por Módulos

```
                                    ┌───────────────────────┐
                                    │  Visitante / Usuario  │
                                    └───────────┬───────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
      [Explora Catálogo]              [Visita Portal Tienda]          [Reporta Anomalía]
      • Filtros de Categoría          • Portada, Logo, Redes         • Checkbox motivos
      • Búsqueda tolerante            • Catálogo exclusivo           • Detalle del caso
      • Selector de volumen/color     • Botón oficial WhatsApp       • Datos contacto
                 │                              │                              │
                 ▼                              ▼                              ▼
      [Genera Pedido WhatsApp]        [Consulta Comprobante]         [Bandeja Admin Reportes]
      • Código correlativo            • Verificación pública         • Contacto directo WA
      • Registro en base de datos     • Estado de emisión            • Sanción / Suspensión
```

#### A. Módulo Público (Compradores)
* **Buscador predictivo:** Entrada rápida con autocompletado en tiempo real de productos, marcas, modelos y empresas.
* **Directorio de categorías y marcas:** Filtros combinables con recuento de productos disponibles.
* **Ficha de Producto Dinámica:** Galería de imágenes, disponibilidad en tiempo real, visualización de colores con muestras hex, tabla desplegable de precios por volumen y calculadora de subtotal.
* **Checkout por WhatsApp:** Crea un registro en `pedido_whatsapp` con código correlativo único (ej. `PED-0001`) y abre WhatsApp con un mensaje estructurado con el desglose de productos, cantidades, colores y monto total estimado.
* **Comprobante público de venta:** Permite verificar la validez de cualquier venta mediante su ID y año.
* **Módulo de Reportes:** Permite denunciar comercios fraudulentos o incumplimientos comerciales.

#### B. Módulo de Empresa (Vendedores)
* **Gestión de Perfil:** Personalización de razón social, slug amigable, dirección, departamento (La Paz, Santa Cruz, etc.), teléfono, WhatsApp, descripción y subida de logo y banner de portada.
* **Control de Inventario y Productos:** Creación de productos con SKU automático o manual, número de serie, control de stock mínimo con disparo de alertas por correo, unidad de medida, galería de hasta 4 imágenes, variantes de color y escalas de descuento por volumen.
* **Kardex de Movimientos:** Historial inmutable de entradas, salidas por venta, ajustes de stock y anulaciones.
* **Punto de Venta / Facturación Interna:** Registro de ventas a clientes (con CI/NIT), desglose de ítems, cálculo automático del total en literal y descarga inmediata del comprobante en PDF con diseño formal.
* **Bandeja de Pedidos WhatsApp:** Visualización de pedidos entrantes generados desde la web pública, con estados (*enviado*, *visto*, *confirmado*, *cancelado*).
* **Gestión de Suscripción:** Descarga del código QR oficial para pago, subida de comprobante de depósito y seguimiento del estado de la suscripción.

#### C. Módulo de Administración General
* **Revisión de Verificaciones (NIT):** Semáforo de SLA (menos de 24h, alerta a las 24h, crítico a las 48h), visor de documentos PDF subidos, checklist interactivo y botones de Aprobación, Observación o Rechazo con envío automático de correos con plantilla HTML.
* **Gestión de Pagos:** Validación de depósitos de suscripción por QR o transferencia bancaria, activación automática de suscripción por 30 días adicionales por mes pagado y registro del usuario confirmador.
* **Supervisión de Empresas:** Control de estados de verificación y suscripción, posibilidad de suspender empresas manualmente y papelera de reciclaje con borrado lógico (soft-delete) para conservar integridad histórica y permitir restauración.
* **Gestión de Categorías:** Creación, edición y eliminación de categorías (con reasignación de productos existentes) y revisión de solicitudes de categorías propuestas por las empresas.
* **Gestión y Control de Marcas:** Panel centralizado donde se auditan todas las marcas que las empresas asignan a sus productos. Permite marcar cualquier marca como **Prohibida** (por motivos legales o de piratería), impidiendo su registro en productos y ocultándola del catálogo público.
* **Bandeja de Reportes de Usuarios:** Recepción de denuncias de consumidores. Ofrece botón directo de **"Contactar por WhatsApp"** con plantilla formal de requerimiento de descargos y botón de **"Suspender Empresa"** para salvaguardar la confianza de la comunidad.

---

## 3. BASE DE DATOS ACTUAL COMPLETA

A continuación se detalla la estructura física completa de las **23 tablas y 1 vista pública** que componen la base de datos `unimarket` en PostgreSQL:

### 3.1 Tablas del Sistema de Usuarios, Empresas y Verificación

#### Tabla: `usuario`
Almacena las credenciales de acceso para administradores y representantes de empresas.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_usuario` | SERIAL | NO | PRIMARY KEY | Identificador único del usuario |
| `nombre` | VARCHAR(120) | NO | | Nombre completo del usuario |
| `usuario` | VARCHAR(50) | NO | UNIQUE | Nombre de usuario para login |
| `correo` | VARCHAR(120) | NO | UNIQUE | Correo electrónico principal |
| `contrasena_hash` | VARCHAR(100) | NO | | Hash seguro bcrypt de la contraseña |
| `rol` | VARCHAR(20) | NO | CHECK (`rol IN ('administrador','empresa')`) | Rol del usuario en el sistema |
| `activo` | BOOLEAN | NO | DEFAULT TRUE | Estado lógico del usuario |
| `creado_en` | TIMESTAMP | NO | DEFAULT NOW() | Fecha de registro en el sistema |

#### Tabla: `empresa`
Entidad central que representa a cada negocio o persona jurídica registrada en la plataforma.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_empresa` | SERIAL | NO | PRIMARY KEY | Identificador de la empresa |
| `id_usuario` | INT | NO | UNIQUE, REFERENCES `usuario(id_usuario)` | Usuario propietario de la cuenta |
| `razon_social` | VARCHAR(150) | NO | | Razón social legal de la empresa |
| `razon_social_norm` | VARCHAR(150) | SÍ | | Razón social normalizada para unicidad |
| `slug` | VARCHAR(80) | SÍ | UNIQUE | Identificador URL amigable (ej: `/tienda/mi-empresa`) |
| `nit` | VARCHAR(15) | SÍ | | Número de Identificación Tributaria |
| `codigo_pago` | VARCHAR(20) | SÍ | | Código único para referencia de pagos |
| `telefono` | VARCHAR(20) | SÍ | | Teléfono fijo o alternativo |
| `whatsapp` | VARCHAR(20) | SÍ | | Número de WhatsApp oficial para ventas |
| `correo` | VARCHAR(120) | SÍ | | Correo de contacto comercial |
| `sitio_web` | VARCHAR(200) | SÍ | | URL del portal web propio |
| `descripcion` | TEXT | SÍ | | Descripción institucional de la empresa |
| `logo` | VARCHAR(200) | SÍ | | Nombre de archivo del logo subido |
| `portada` | VARCHAR(200) | SÍ | | Nombre de archivo del banner de portada |
| `direccion` | VARCHAR(200) | SÍ | | Dirección física del establecimiento |
| `ciudad` | VARCHAR(50) | NO | DEFAULT 'La Paz' | Departamento sede en Bolivia |
| `facebook` | VARCHAR(200) | SÍ | | Enlace a página oficial de Facebook |
| `instagram` | VARCHAR(200) | SÍ | | Enlace a cuenta oficial de Instagram |
| `tiktok` | VARCHAR(200) | SÍ | | Enlace a cuenta oficial de TikTok |
| `estado_verificacion`| VARCHAR(20) | NO | DEFAULT 'pendiente' | Estado legal (`pendiente`, `verificado`, `observado`, `rechazado`) |
| `eliminado_en` | TIMESTAMP | SÍ | NULL | Fecha de envío a la papelera (Borrado lógico) |
| `eliminado_por` | INT | SÍ | REFERENCES `usuario(id_usuario)` | Admin que envió la empresa a papelera |
| `motivo_eliminacion` | TEXT | SÍ | | Motivo del borrado lógico |
| `creado_en` | TIMESTAMP | NO | DEFAULT NOW() | Fecha de alta en la plataforma |

#### Tabla: `verificacion`
Historial de solicitudes y dictámenes de verificación de NIT.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_verificacion` | SERIAL | NO | PRIMARY KEY | Identificador de la verificación |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa solicitante |
| `estado` | VARCHAR(20) | NO | DEFAULT 'pendiente' | Estado (`pendiente`, `aprobado`, `rechazado`, `observado`) |
| `documento` | VARCHAR(200) | SÍ | | Nombre de archivo PDF del certificado NIT |
| `observacion` | TEXT | SÍ | | Motivo de observación o rechazo |
| `fecha_solicitud` | TIMESTAMP | NO | DEFAULT NOW() | Fecha y hora en que se envió el trámite |
| `fecha_revision` | TIMESTAMP | SÍ | | Fecha y hora del dictamen del admin |

---

### 3.2 Tablas del Sistema de Planes, Pagos y Suscripción

#### Tabla: `plan`
Configuración de planes de suscripción para empresas.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_plan` | SERIAL | NO | PRIMARY KEY | Identificador del plan |
| `nombre` | VARCHAR(80) | NO | | Nombre comercial (ej: 'Plan Mensual Verificado') |
| `precio` | NUMERIC(12,2)| NO | DEFAULT 200.00, CHECK (`precio >= 0`) | Tarifa oficial de suscripción |
| `moneda` | VARCHAR(10) | NO | DEFAULT 'Bs' | Símbolo de moneda nacional |
| `periodo` | VARCHAR(20) | NO | DEFAULT 'mes' | Periodicidad del plan |
| `descripcion` | TEXT | SÍ | | Descripción de alcances del plan |
| `activo` | BOOLEAN | NO | DEFAULT TRUE | Disponibilidad comercial |
| `beneficios` | JSONB | NO | DEFAULT '[]'::jsonb | Lista estructurada de características |

#### Tabla: `suscripcion`
Control de vigencia y estado operativo de la empresa en la plataforma.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_suscripcion` | SERIAL | NO | PRIMARY KEY | Identificador de suscripción |
| `id_empresa` | INT | NO | UNIQUE, REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa asociada |
| `estado` | VARCHAR(20) | NO | DEFAULT 'pendiente_pago', CHECK IN (...) | Estado (`pendiente_pago`, `en_revision`, `activa`, `vencida`, `suspendida`) |
| `fecha_inicio` | DATE | NO | DEFAULT CURRENT_DATE | Fecha de activación inicial |
| `fecha_vencimiento`| DATE | NO | DEFAULT (CURRENT_DATE + 30) | Fecha límite de vigencia activa |

#### Tabla: `pago`
Registro de transferencias y pagos por QR para membresías.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_pago` | SERIAL | NO | PRIMARY KEY | Identificador del pago |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa que efectuó el pago |
| `monto` | NUMERIC(12,2)| NO | DEFAULT 200.00, CHECK (`monto >= 0`) | Monto abonado en Bolivianos |
| `metodo` | VARCHAR(20) | NO | | Método (`qr`, `transferencia`, `efectivo`) |
| `referencia` | VARCHAR(100) | SÍ | | Número de transacción o referencia bancaria |
| `banco` | VARCHAR(80) | SÍ | | Entidad financiera de origen |
| `comprobante` | VARCHAR(200) | SÍ | | Nombre de archivo del voucher/recibo |
| `estado` | VARCHAR(20) | NO | DEFAULT 'en_revision' | Estado (`pendiente`, `en_revision`, `confirmado`, `rechazado`) |
| `observacion` | TEXT | SÍ | | Nota del admin en caso de rechazo |
| `meses` | INT | NO | DEFAULT 1, CHECK (`meses >= 1`) | Cantidad de meses cubiertos |
| `fecha` | TIMESTAMP | NO | DEFAULT NOW() | Fecha en que se cargó el comprobante |
| `fecha_pago` | TIMESTAMP | SÍ | DEFAULT NOW() | Fecha declarada de la transacción |
| `es_demo` | BOOLEAN | NO | DEFAULT FALSE | Bandera para pruebas de desarrollo |
| `confirmado_por` | INT | SÍ | REFERENCES `usuario(id_usuario)` | Admin que verificó la acreditación |
| `fecha_confirmacion`|TIMESTAMP| SÍ | | Momento exacto de acreditación |

---

### 3.3 Tablas de Catálogo, Marcas y Productos

#### Tabla: `categoria`
Clasificación temática de productos y rubros.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_categoria` | SERIAL | NO | PRIMARY KEY | Identificador de categoría |
| `nombre` | VARCHAR(80) | NO | UNIQUE | Nombre de la categoría (ej: 'Electrónica') |

#### Tabla: `solicitud_categoria`
Rubros solicitados por las empresas para evaluación del administrador.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_solicitud` | SERIAL | NO | PRIMARY KEY | Identificador de la solicitud |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa que solicita la categoría |
| `nombre` | VARCHAR(80) | NO | | Nombre sugerido para el rubro |
| `estado` | VARCHAR(20) | NO | DEFAULT 'pendiente' | Estado (`pendiente`, `aprobada`, `rechazada`) |
| `motivo_rechazo` | TEXT | SÍ | | Motivo si la propuesta fue declinada |
| `revisado_por` | INT | SÍ | REFERENCES `usuario(id_usuario)` | Administrador evaluador |
| `fecha_revision` | TIMESTAMP | SÍ | | Fecha de resolución |
| `creado_en` | TIMESTAMP | NO | DEFAULT NOW() | Fecha de registro de la sugerencia |

#### Tabla: `marca_prohibida` *(Nueva - Control de Legalidad)*
Lista negra central de marcas bloqueadas por el administrador para evitar réplicas no autorizadas o piratería.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_marca_prohibida`| SERIAL | NO | PRIMARY KEY | Identificador de restricción |
| `nombre` | VARCHAR(80) | NO | UNIQUE | Nombre de la marca prohibida |
| `motivo` | TEXT | SÍ | | Justificación legal o comercial del bloqueo |
| `creado_en` | TIMESTAMP | NO | DEFAULT NOW() | Fecha en que se ingresó a la lista negra |

#### Tabla: `producto`
Artículos comercializados por las empresas.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_producto` | SERIAL | NO | PRIMARY KEY | Identificador del producto |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE RESTRICT | Empresa propietaria del ítem |
| `id_categoria` | INT | NO | REFERENCES `categoria(id_categoria)` ON DELETE RESTRICT | Categoría asignada |
| `nombre` | VARCHAR(150) | NO | | Nombre comercial del producto |
| `marca` | VARCHAR(80) | SÍ | | Marca del fabricante |
| `modelo` | VARCHAR(80) | SÍ | | Modelo o versión específica |
| `sku` | VARCHAR(60) | SÍ | | Código de referencia / SKU interno |
| `numero_serie` | VARCHAR(100) | SÍ | | Número de serie para equipos de alto valor |
| `descripcion` | TEXT | SÍ | | Ficha técnica y detalle del producto |
| `precio` | NUMERIC(12,2)| NO | CHECK (`precio >= 0`) | Precio unitario base en Bs |
| `disponible` | BOOLEAN | NO | DEFAULT TRUE | Interruptor de visibilidad comercial |
| `stock_actual` | INT | NO | DEFAULT 0, CHECK (`stock_actual >= 0`) | Existencias reales en almacén |
| `stock_minimo` | INT | NO | DEFAULT 20, CHECK (`stock_minimo >= 0`)| Umbral para advertencias de escasez |
| `unidad` | VARCHAR(30) | NO | DEFAULT 'unidad' | Unidad física (unidad, caja, pieza, kg) |
| `alerta_stock_enviada`|BOOLEAN | NO | DEFAULT FALSE | Evita spam de alertas por stock bajo |
| `cantidad_minima`| INT | NO | DEFAULT 1, CHECK (`cantidad_minima >= 1`) | Mínimo de compra permitido |
| `unidad_venta` | VARCHAR(40) | NO | DEFAULT 'unidad' | Modalidad de venta (unidad, paquete) |
| `unidades_por_paquete`|INT | SÍ | | Unidades contenidas si se vende en pack |
| `color_unico` | VARCHAR(60) | SÍ | | Nombre del color si el producto no tiene variantes |
| `colores_disponibles`|JSONB | NO | DEFAULT '[]'::jsonb | Respaldo JSON de colores |
| `creado_en` | TIMESTAMP | NO | DEFAULT NOW() | Fecha de creación del producto |

#### Tabla: `imagen_producto`
Galería multimedia por producto (hasta 4 imágenes).
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_imagen` | SERIAL | NO | PRIMARY KEY | Identificador de la imagen |
| `id_producto` | INT | NO | REFERENCES `producto(id_producto)` ON DELETE CASCADE | Producto al que pertenece |
| `ruta` | VARCHAR(200) | NO | | Nombre de archivo de la fotografía |
| `orden` | INT | NO | DEFAULT 0 | Posición en la galería visual |

#### Tabla: `producto_color`
Variantes cromáticas activas para selección del comprador.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | PRIMARY KEY | Identificador de la variante de color |
| `id_producto` | INT | NO | REFERENCES `producto(id_producto)` ON DELETE CASCADE | Producto asociado |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa propietaria |
| `nombre` | VARCHAR(60) | NO | | Nombre del color (ej: 'Negro Mate') |
| `codigo_hex` | VARCHAR(10) | SÍ | | Código de color HTML/HEX (ej: '#1E293B') |
| `stock` | INT | SÍ | | Existencias específicas de esta variante |
| `activo` | BOOLEAN | NO | DEFAULT TRUE | Disponibilidad para selección |

#### Tabla: `producto_precio_escala`
Tarifas con descuento por cantidad (ventas por mayor).
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_escala` | SERIAL | NO | PRIMARY KEY | Identificador de la escala |
| `id_producto` | INT | NO | REFERENCES `producto(id_producto)` ON DELETE CASCADE | Producto asociado |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa propietaria |
| `desde_unidades`| INT | NO | CHECK (`desde_unidades >= 1`) | Cantidad mínima requerida |
| `precio_unitario`|NUMERIC(12,2)|NO | CHECK (`precio_unitario >= 0`) | Tarifa unitaria aplicable en este rango |
| `etiqueta` | VARCHAR(80) | SÍ | | Rótulo (ej: 'Por mayor (docena)') |

---

### 3.4 Tablas de Inventario, Ventas y Clientes

#### Tabla: `movimiento_stock`
Kardex inmutable para trazabilidad de existencias.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_movimiento` | SERIAL | NO | PRIMARY KEY | Identificador del movimiento |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa involucrada |
| `id_producto` | INT | NO | REFERENCES `producto(id_producto)` ON DELETE CASCADE | Producto ajustado |
| `tipo` | VARCHAR(30) | NO | CHECK (`tipo IN ('entrada','salida_venta','ajuste','anulacion')`) | Naturaleza del movimiento |
| `cantidad` | INT | NO | | Unidades variadas |
| `stock_anterior`| INT | NO | DEFAULT 0 | Existencia antes de la operación |
| `stock_resultante`|INT | NO | CHECK (`stock_resultante >= 0`) | Existencia posterior al movimiento |
| `referencia` | VARCHAR(100) | SÍ | | Identificador de orden o venta |
| `nota` | TEXT | SÍ | | Justificación o detalle |
| `fecha` | TIMESTAMP | NO | DEFAULT NOW() | Fecha y hora exacta |
| `id_usuario` | INT | SÍ | REFERENCES `usuario(id_usuario)` | Usuario que realizó el cambio |

#### Tabla: `cliente`
Directorio de compradores habituales de cada empresa.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_cliente` | SERIAL | NO | PRIMARY KEY | Identificador de cliente |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa que lo registró |
| `nombre` | VARCHAR(150) | NO | | Nombre o Razón Social del cliente |
| `nit_ci` | VARCHAR(30) | NO | | Número de Carnet o NIT |
| `telefono` | VARCHAR(30) | SÍ | | Teléfono de contacto |
| `correo` | VARCHAR(120) | SÍ | | Correo para comprobantes |
| `direccion` | VARCHAR(200) | SÍ | | Domicilio o dirección de despacho |
| `creado_en` | TIMESTAMP | NO | DEFAULT NOW() | Fecha de alta |

#### Tabla: `venta`
Notas de entrega / recibos de venta generados por las empresas.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_venta` | SERIAL | NO | PRIMARY KEY | Identificador de la venta |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa emisora |
| `numero` | INT | NO | | Correlativo numérico secuencial |
| `numero_formato`| VARCHAR(20) | NO | | Formato formateado (ej: 'VTA-2026-0001') |
| `anio` | INT | NO | DEFAULT EXTRACT(YEAR FROM CURRENT_DATE) | Año fiscal de emisión |
| `fecha` | TIMESTAMP | NO | DEFAULT NOW() | Momento de la emisión |
| `id_cliente` | INT | SÍ | REFERENCES `cliente(id_cliente)` | Cliente vinculado opcional |
| `nombre_cliente`| VARCHAR(150) | NO | | Nombre grabado del comprador |
| `nit_ci_cliente`| VARCHAR(30) | NO | | Identificación tributaria grabada |
| `metodo_pago` | VARCHAR(30) | NO | CHECK IN (`efectivo`, `qr`, `transferencia`, `tarjeta`, `otro`) | Modalidad de cobro |
| `subtotal` | NUMERIC(12,2)| NO | CHECK (`subtotal >= 0`) | Importe bruto |
| `descuento` | NUMERIC(12,2)| NO | DEFAULT 0.00, CHECK (`descuento >= 0`) | Descuento total aplicado |
| `total` | NUMERIC(12,2)| NO | CHECK (`total >= 0`) | Importe neto cobrado en Bs |
| `total_literal` | VARCHAR(250) | SÍ | | Total expresado en letras (para PDF) |
| `observaciones` | TEXT | SÍ | | Notas adicionales |
| `estado` | VARCHAR(20) | NO | DEFAULT 'emitida', CHECK (`estado IN ('emitida','anulada')`) | Condición de validez |
| `anulada_en` | TIMESTAMP | SÍ | | Fecha de anulación si aplica |
| `motivo_anulacion`|TEXT | SÍ | | Justificación de la anulación |
| `creado_por` | INT | SÍ | REFERENCES `usuario(id_usuario)` | Usuario que emitió la nota |
| `creado_en` | TIMESTAMP | NO | DEFAULT NOW() | Timestamp de persistencia |

#### Tabla: `venta_item`
Detalle de artículos comprendidos en cada venta.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_venta_item` | SERIAL | NO | PRIMARY KEY | Identificador del ítem |
| `id_venta` | INT | NO | REFERENCES `venta(id_venta)` ON DELETE CASCADE | Venta asociada |
| `id_producto` | INT | SÍ | REFERENCES `producto(id_producto)` ON DELETE RESTRICT | Producto vendido |
| `descripcion` | VARCHAR(200) | NO | | Nombre histórico del ítem vendido |
| `sku` | VARCHAR(60) | SÍ | | SKU histórico |
| `cantidad` | INT | NO | CHECK (`cantidad > 0`) | Unidades comercializadas |
| `precio_unitario`|NUMERIC(12,2)|NO | CHECK (`precio_unitario >= 0`) | Precio unitario acordado |
| `descuento_item`|NUMERIC(12,2)|NO | DEFAULT 0.00, CHECK (`descuento_item >= 0`)| Rebaja en esta línea |
| `subtotal` | NUMERIC(12,2)| NO | CHECK (`subtotal >= 0`) | Importe neto de la línea |

---

### 3.5 Tablas de Pedidos por WhatsApp, Reportes y Auditoría

#### Tabla: `pedido_whatsapp`
Pedidos formulados desde la vista pública del catálogo antes de saltar a WhatsApp.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | PRIMARY KEY | Identificador del pedido |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa proveedora |
| `codigo` | VARCHAR(20) | NO | UNIQUE | Código de rastreo (ej: `PED-0001`) |
| `nombre_cliente`| VARCHAR(150) | SÍ | | Nombre provisto por el comprador |
| `ciudad` | VARCHAR(100) | SÍ | | Ciudad de destino declarada |
| `total_estimado`|NUMERIC(12,2)|NO | DEFAULT 0, CHECK (`total_estimado >= 0`) | Monto total cotizado |
| `estado` | VARCHAR(20) | NO | DEFAULT 'enviado', CHECK IN (`enviado`,`visto`,`confirmado`,`cancelado`) | Estado del pedido |
| `creado_en` | TIMESTAMP | NO | DEFAULT NOW() | Fecha de confección del pedido |

#### Tabla: `pedido_whatsapp_item`
Líneas de pedido con selección de color y modalidad de empaque.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_item` | SERIAL | NO | PRIMARY KEY | Identificador de línea |
| `id_pedido` | INT | NO | REFERENCES `pedido_whatsapp(id)` ON DELETE CASCADE | Pedido padre |
| `id_producto` | INT | SÍ | REFERENCES `producto(id_producto)` ON DELETE SET NULL | Producto cotizado |
| `descripcion` | VARCHAR(200) | NO | | Nombre del producto |
| `sku` | VARCHAR(60) | SÍ | | SKU de referencia |
| `cantidad_total`| INT | NO | CHECK (`cantidad_total >= 1`) | Unidades totales solicitadas |
| `desglose_colores`|JSONB | NO | DEFAULT '[]'::jsonb | Variantes de color desglosadas |
| `modo` | VARCHAR(30) | NO | DEFAULT 'unidad' | Modalidad ('unidad', 'paquete') |
| `precio_unitario`|NUMERIC(12,2)|NO | CHECK (`precio_unitario >= 0`) | Precio acordado por volumen |
| `subtotal` | NUMERIC(12,2)| NO | CHECK (`subtotal >= 0`) | Monto estimado de la línea |

#### Tabla: `reporte` *(Nueva - Círculo de Confianza)*
Denuncias de usuarios contra empresas por presunto fraude o incumplimientos.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_reporte` | SERIAL | NO | PRIMARY KEY | Identificador único del reporte |
| `id_empresa` | INT | NO | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa reportada |
| `id_producto` | INT | SÍ | REFERENCES `producto(id_producto)` ON DELETE SET NULL | Producto implicado (opcional) |
| `motivos` | JSONB | NO | DEFAULT '[]'::jsonb | Lista de motivos marcados con checkbox |
| `descripcion` | TEXT | NO | | Narrativa detallada del incidente |
| `nombre_denunciante`|VARCHAR(120)|SÍ | | Nombre o iniciales del denunciante |
| `contacto_denunciante`|VARCHAR(120)|SÍ | | Teléfono/WhatsApp/Email del denunciante |
| `estado` | VARCHAR(20) | NO | DEFAULT 'pendiente', CHECK IN (`pendiente`,`en_revision`,`sancionado`,`desestimado`,`resuelto`) | Estado de atención |
| `notas_admin` | TEXT | SÍ | | Observaciones internas del administrador |
| `creado_en` | TIMESTAMP | NO | DEFAULT NOW() | Fecha de interposición del reclamo |
| `resuelto_en` | TIMESTAMP | SÍ | | Fecha de cierre o sanción del caso |

#### Tabla: `notificacion_correo`
Bitácora de auditoría de correos SMTP despachados.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_notificacion`| SERIAL | NO | PRIMARY KEY | Identificador de notificación |
| `id_empresa` | INT | SÍ | REFERENCES `empresa(id_empresa)` ON DELETE CASCADE | Empresa destinataria |
| `tipo` | VARCHAR(50) | NO | | Tipo (`verificacion_aprobada`, `suscripcion_suspendida`, etc.) |
| `destino` | VARCHAR(120) | NO | | Correo electrónico receptor |
| `asunto` | VARCHAR(250) | SÍ | | Encabezado del mensaje |
| `estado` | VARCHAR(20) | NO | CHECK (`estado IN ('enviado','fallido')`) | Resultado de entrega |
| `error` | TEXT | SÍ | | Traza de error en caso de fallo |
| `intentos` | INT | NO | DEFAULT 1 | Intentos de entrega |
| `fecha` | TIMESTAMP | NO | DEFAULT NOW() | Momento de despacho |

#### Tabla: `auditoria`
Registro general de eventos sensibles del sistema.
| Columna | Tipo de Dato | Nulo | Restricciones / Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_auditoria` | SERIAL | NO | PRIMARY KEY | Identificador de auditoría |
| `id_usuario` | INT | SÍ | REFERENCES `usuario(id_usuario)` ON DELETE SET NULL | Operador responsable |
| `accion` | VARCHAR(80) | NO | | Acción ejecutada (ej: 'eliminar_empresa') |
| `entidad` | VARCHAR(50) | NO | | Entidad afectada (ej: 'empresa') |
| `id_entidad` | INT | SÍ | | ID del registro intervenido |
| `detalle` | TEXT | SÍ | | Resumen del evento |
| `fecha` | TIMESTAMP | NO | DEFAULT NOW() | Fecha de registro |

#### Vista Centralizada: `v_empresas_publicas`
Vista de base de datos que encapsula la regla de oro de visibilidad pública de UNIMARKET BO.
```sql
CREATE VIEW v_empresas_publicas AS
SELECT e.id_empresa, e.id_usuario, e.razon_social, e.slug, e.nit,
       COALESCE(e.correo, u.correo) AS correo, e.telefono, e.whatsapp,
       e.sitio_web, e.descripcion, e.logo, e.portada, e.direccion,
       COALESCE(e.ciudad, 'La Paz') AS ciudad, e.facebook, e.instagram,
       e.tiktok, e.estado_verificacion, e.codigo_pago, e.creado_en,
       s.id_suscripcion, s.estado AS suscripcion_estado,
       s.fecha_inicio AS suscripcion_inicio, s.fecha_vencimiento AS suscripcion_vencimiento
  FROM empresa e
  JOIN usuario u ON u.id_usuario = e.id_usuario
  JOIN suscripcion s ON s.id_empresa = e.id_empresa
 WHERE e.estado_verificacion IN ('verificado', 'verificada')
   AND e.eliminado_en IS NULL
   AND s.estado = 'activa'
   AND s.fecha_vencimiento >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date;
```
> **Regla de Negocio:** Una empresa solo aparece en el catálogo público si cumple tres condiciones simultáneas: **está verificada**, **no está en la papelera** y **cuenta con suscripción activa no vencida**.

---

## 4. CASOS DE USO FUNCIONALES (CUF)

### 4.1 Módulo Público / Comprador

* **CUF-01: Exploración del Catálogo General y Búsqueda Tolerante**
  * **Actor:** Comprador / Visitante general.
  * **Descripción:** El usuario visualiza la lista paginada de productos disponibles de empresas verificadas. Permite búsqueda predictiva insensible a acentos (`unaccent`) y con coincidencia por similitud (`pg_trgm`).
  * **Filtros:** Por categoría, marca (excluyendo marcas prohibidas), rango de precios (mín/máx) y ordenamiento (más recientes, menor/mayor precio, alfabético).

* **CUF-02: Visualización de Ficha de Producto Dinámica**
  * **Actor:** Comprador / Visitante general.
  * **Descripción:** Modal interactivo con galería de imágenes en alta resolución, indicador de stock en tiempo real (disponible, stock bajo, agotado), selector de colores con paleta visual, tabla de precios escalonados por volumen y datos del comercio vendedor.

* **CUF-03: Configuración de Pedido y Contacto por WhatsApp**
  * **Actor:** Comprador / Visitante general.
  * **Descripción:** El usuario configura las cantidades deseadas (unidades o paquetes) y variantes de color. Al presionar "Enviar pedido por WhatsApp", el sistema persiste un registro trazable en `pedido_whatsapp` con un código correlativo único (ej: `PED-0042`) y redirige a la API de WhatsApp con un mensaje estructurado con el desglose formal de la compra.

* **CUF-04: Consulta de Perfil Público de Empresa (Tienda Virtual)**
  * **Actor:** Comprador / Visitante general.
  * **Descripción:** Acceso mediante URL amigable (`/tienda/:slug`) a la fachada institucional de la empresa. Muestra banner de portada, logotipo, insignia de verificación legal, redes sociales, teléfono, ubicación y el catálogo filtrable exclusivo de dicha empresa.

* **CUF-05: Verificación Pública de Comprobantes de Venta**
  * **Actor:** Comprador / Cliente.
  * **Descripción:** Mediante el enlace o código impreso en una nota de venta oficial (`/comprobante/:id`), el cliente consulta en línea la validez del documento, datos fiscales del emisor, desglose de ítems, totales en cifras y en literal, y estado de la transacción (emitida o anulada).

* **CUF-06: Reportar Empresa o Producto por Irregularidades (Círculo de Confianza)**
  * **Actor:** Comprador / Usuario afectado.
  * **Descripción:** Botón accesible desde el portal de la empresa y la ficha de cada producto. Despliega un formulario para tiquear uno o varios motivos (falta de entrega, falsificación, estafa, publicidad engañosa, etc.), describir el reclamo y adjuntar datos opcionales de contacto. El reporte queda registrado en la base de datos y genera una alerta inmediata en la bandeja del administrador.

---

### 4.2 Módulo de Empresa Vendedora

* **CUF-07: Registro y Onboarding de Empresa**
  * **Actor:** Representante de la Empresa.
  * **Descripción:** Formulario en dos pasos donde se captura la razón social, usuario, correo, contraseña, NIT y departamento sede. Se crea la cuenta y se asigna el rol `empresa`.

* **CUF-08: Carga de Documentación Legal para Verificación**
  * **Actor:** Representante de la Empresa.
  * **Descripción:** Subida del certificado digital de NIT en formato PDF o imagen. El sistema registra la fecha y notifica a la administración para el proceso de validación jurídica.

* **CUF-09: Gestión de Perfil Comercial y Canales Oficiales**
  * **Actor:** Representante de la Empresa.
  * **Descripción:** Actualización de logotipo, portada corporativa, dirección física, biografía comercial y enlaces oficiales a redes sociales (Facebook, Instagram, TikTok, Sitio Web).

* **CUF-10: Carga y Mantenimiento de Productos con Variantes**
  * **Actor:** Representante de la Empresa.
  * **Descripción:** Alta, edición y desactivación de productos. Incluye generación de SKU automático, número de serie, control de existencias, asignación de categoría, especificación de marca (validando que no esté en la lista de marcas prohibidas), carga de hasta 4 imágenes, agregado de variantes de color y configuración de escalas de precio por volumen.

* **CUF-11: Control de Inventario y Kardex Automatizado**
  * **Actor:** Representante de la Empresa.
  * **Descripción:** Registro inmutable de movimientos de almacén (entradas por compra, salidas por venta, ajustes de inventario y devoluciones por anulación). Notificación por correo electrónico cuando el stock desciende por debajo del umbral mínimo configurado.

* **CUF-12: Emisión y Anulación de Notas de Venta con PDF Oficial**
  * **Actor:** Representante de la Empresa.
  * **Descripción:** Registro de ventas seleccionando clientes existentes o creando nuevos. El sistema descuenta stock automáticamente, calcula importes con descuento, genera el número correlativo anual y emite una nota de venta en formato PDF descargable e imprimible con diseño profesional. Permite anular ventas restaurando el stock al almacén.

* **CUF-13: Recepción y Seguimiento de Pedidos WhatsApp**
  * **Actor:** Representante de la Empresa.
  * **Descripción:** Bandeja administrativa donde la empresa consulta los pedidos originados en la web pública, visualiza el desglose de productos y cambia su estado (*visto*, *confirmado*, *cancelado*).

* **CUF-14: Gestión y Acreditación de Suscripción**
  * **Actor:** Representante de la Empresa.
  * **Descripción:** Acceso a los datos bancarios y al código QR oficial de UNIMARKET BO para el pago mensual (Bs 200). Permite subir el comprobante de depósito indicando banco, número de referencia y meses abonados.

* **CUF-15: Solicitud de Nuevas Categorías**
  * **Actor:** Representante de la Empresa.
  * **Descripción:** Envío de propuestas de nuevos rubros o categorías comerciales hacia la administración cuando un producto no encaja en las existentes.

---

### 4.3 Módulo de Administración General

* **CUF-16: Revisión Legal de NIT con Checklist y SLA**
  * **Actor:** Administrador de la Plataforma.
  * **Descripción:** Bandeja de solicitudes de verificación organizadas por SLA de respuesta (menos de 24h, alerta de 24h a 48h, crítico mayor a 48h). Permite visualizar el PDF del documento tributario, completar un checklist obligatorio de 3 puntos (NIT verificado, Razón Social coincidente, Documento vigente) y dictaminar: Aprobado (activa verificación y genera código de pago), Observado (solicita corrección) o Rechazado (con motivo formal).

* **CUF-17: Conciliación y Confirmación de Pagos**
  * **Actor:** Administrador de la Plataforma.
  * **Descripción:** Bandeja de pagos pendientes donde el admin inspecciona el comprobante bancario, verifica el importe, confirma la acreditación (lo que extiende la suscripción 30 días por mes pagado de forma automática) o rechaza el comprobante con observaciones.

* **CUF-18: Gestión de Empresas y Suscripciones**
  * **Actor:** Administrador de la Plataforma.
  * **Descripción:** Tabla general de comercios registrados, estado de verificación, fecha de vencimiento y estado de suscripción. Permite suspender manualmente empresas que violen normativas.

* **CUF-19: Papelera de Reciclaje y Borrado Lógico (Soft-Delete)**
  * **Actor:** Administrador de la Plataforma.
  * **Descripción:** Permite dar de baja empresas sin eliminar físicamente sus ventas ni su historial. Las empresas eliminadas se trasladan a una papelera central con motivo y fecha, desde donde pueden ser restauradas o purgadas definitivamente.

* **CUF-20: Gestión de Categorías y Solicitudes de Rubros**
  * **Actor:** Administrador de la Plataforma.
  * **Descripción:** Creación y edición de categorías maestras. Al eliminar una categoría con productos asociados, el sistema exige reasignar obligatoriamente los productos a otra categoría destino. Aprobación y rechazo de solicitudes de categorías propuestas por las empresas.

* **CUF-21: Gestión y Prohibición de Marcas (Blacklist de Marcas)**
  * **Actor:** Administrador de la Plataforma.
  * **Descripción:** Panel de auditoría de todas las marcas registradas en el sistema, mostrando cantidad de productos y empresas que las utilizan. Permite marcar cualquier marca como **Prohibida** con un motivo formal (ej: piratería, marcas protegidas), impidiendo su uso futuro y ocultando los productos afectados del catálogo público. Incluye opción para prohibir marcas preventivamente.

* **CUF-22: Bandeja de Reportes de Usuarios y Contacto Oficial WhatsApp**
  * **Actor:** Administrador de la Plataforma.
  * **Descripción:** Recepción y gestión de denuncias emitidas por compradores. Muestra la empresa, producto, motivos tiqueados y relato del hecho. Incluye:
    1. **Botón "Contactar por WhatsApp":** Abre un chat directo con la empresa cargando un mensaje oficial pre-redactado que exige descargos y advertencias de sanción, cambiando el estado del reporte a "En revisión".
    2. **Botón "Suspender Empresa":** Sanciona a la empresa, cambiando su suscripción a `suspendida`, sacándola a ella y a sus productos del catálogo público de inmediato.
    3. **Gestión de Estado:** Permite registrar notas internas y marcar el caso como *Resuelto* o *Desestimado*.

---

## 5. REQUISITOS Y CASOS DE USO NO FUNCIONALES (RNF)

* **RNF-01: Seguridad, Autenticación y Autorización (RBAC)**
  * Autenticación basada en tokens JWT firmados criptográficamente con tiempo de expiración (8 horas).
  * Almacenamiento de contraseñas mediante función hash unidireccional `bcryptjs` con 10 rondas de salting.
  * Control de acceso basado en roles (`administrador`, `empresa`). Las rutas privadas validan el rol y extraen el `id_empresa` directamente del token firmado para evitar suplantaciones (IDOR).
  * Cabeceras de seguridad activadas mediante `Helmet` y protección contra inyección SQL asegurada mediante consultas 100% parametrizadas en el driver PostgreSQL.

* **RNF-02: Rendimiento, Tolerancia y Optimización de Consultas**
  * Búsqueda en catálogo optimizada con índices B-Tree en campos clave (`id_empresa`, `id_categoria`, `precio`, `estado`) e índices GIN de trigramas (`pg_trgm`) para concordancia difusa y búsqueda ultrarrápida.
  * Búsqueda fonética y libre de tildes gracias a la extensión `unaccent`.
  * Mecanismo de caché en memoria con TTL de 30 a 60 segundos en endpoints públicos de alta concurrencia (`/categorias`, `/marcas`, `/sugerencias`).
  * Paginación en servidor con límite estricto de 12 productos por página para reducir el payload transferido.

* **RNF-03: Disponibilidad, Tareas en Segundo Plano e Integridad Referencial**
  * El sistema opera de forma ininterrumpida. A las 08:00 AM (hora boliviana `America/La_Paz`), un cron job programado con `node-cron` evalúa vencimientos de suscripciones y transiciona estados de `activa` a `vencida`.
  * Integridad referencial estricta: operaciones de borrado de dependencias críticas protegidas con cláusulas `ON DELETE RESTRICT` (ej: no se puede eliminar una categoría ni una empresa si tiene ventas o productos registrados).
  * Soporte transaccional ACID (`BEGIN`, `COMMIT`, `ROLLBACK`) en creación de productos, registro de ventas, anulación de comprobantes y suspensiones por reportes.

* **RNF-04: Usabilidad, Accesibilidad y Experiencia Visual (UX/UI)**
  * Interfaz de usuario adaptativa (Mobile-First / Responsive) con Tailwind CSS, optimizada para smartphones, tablets y monitores de escritorio.
  * Modo oscuro de alto contraste con tipografía moderna `Inter`, microanimaciones suaves mediante `Framer Motion` y confirmación visual inmediata mediante toasts flotantes (`Sonner`).
  * Formularios con validación en tiempo real en frontend y saneamiento estricto en backend.

* **RNF-05: Mantenibilidad y Trazabilidad de Auditoría**
  * Estructura modular y limpia con separación de responsabilidades: controladores de rutas (`routes`), lógica de normalización y reglas de negocio (`utils`), plantillas de correo (`servicios`) y migraciones versionadas e idempotentes en SQL puro (`migrations`).
  * Identificador único por petición (`X-Request-Id`) en Express para facilitar el debugging en logs de servidor ante eventuales errores 500.
