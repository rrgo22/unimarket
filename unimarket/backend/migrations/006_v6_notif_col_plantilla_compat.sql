-- 006_v6_notif_col_plantilla_compat.sql

-- Garantizar compatibilidad con columna plantilla o tipo
ALTER TABLE notificacion_correo ADD COLUMN IF NOT EXISTS tipo VARCHAR(50);
ALTER TABLE notificacion_correo ADD COLUMN IF NOT EXISTS plantilla VARCHAR(50);

-- Sincronizar valores existentes
UPDATE notificacion_correo SET plantilla = tipo WHERE plantilla IS NULL AND tipo IS NOT NULL;
UPDATE notificacion_correo SET tipo = plantilla WHERE tipo IS NULL AND plantilla IS NOT NULL;

-- Trigger para mantener ambas columnas en sincronía bidireccional permanente
CREATE OR REPLACE FUNCTION fn_sync_notificacion_tipo_plantilla()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo IS NOT NULL AND NEW.plantilla IS NULL THEN
    NEW.plantilla := NEW.tipo;
  ELSIF NEW.plantilla IS NOT NULL AND NEW.tipo IS NULL THEN
    NEW.tipo := NEW.plantilla;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_notificacion_tipo_plantilla ON notificacion_correo;
CREATE TRIGGER trg_sync_notificacion_tipo_plantilla
BEFORE INSERT OR UPDATE ON notificacion_correo
FOR EACH ROW EXECUTE FUNCTION fn_sync_notificacion_tipo_plantilla();
