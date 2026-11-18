-- 004_v4_vista_publica_slugs.sql

-- Llenar slugs nulos por si existieran
UPDATE empresa
   SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(razon_social, '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
 WHERE slug IS NULL OR TRIM(slug) = '';

-- Vista única y centralizada para toda la visibilidad pública de UNIMARKET BO
DROP VIEW IF EXISTS v_empresas_publicas CASCADE;
CREATE VIEW v_empresas_publicas AS
SELECT e.id_empresa,
       e.id_usuario,
       e.razon_social,
       e.slug,
       e.nit,
       COALESCE(e.correo, u.correo) AS correo,
       e.telefono,
       e.whatsapp,
       e.sitio_web,
       e.descripcion,
       e.logo,
       e.portada,
       e.direccion,
       COALESCE(e.ciudad, 'La Paz') AS ciudad,
       e.facebook,
       e.instagram,
       e.tiktok,
       e.estado_verificacion,
       e.codigo_pago,
       e.creado_en,
       s.id_suscripcion,
       s.estado AS suscripcion_estado,
       s.fecha_inicio AS suscripcion_inicio,
       s.fecha_vencimiento AS suscripcion_vencimiento
  FROM empresa e
  JOIN usuario u ON u.id_usuario = e.id_usuario
  JOIN suscripcion s ON s.id_empresa = e.id_empresa
 WHERE e.estado_verificacion IN ('verificado', 'verificada')
   AND e.eliminado_en IS NULL
   AND s.estado = 'activa'
   AND s.fecha_vencimiento >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date;
