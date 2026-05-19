-- Agregar columna CURP a la tabla alumnos
-- Ejecutar en: Supabase → SQL Editor → New Query

ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS curp VARCHAR(18);

-- Índice para búsqueda rápida por matrícula + curp (login)
CREATE INDEX IF NOT EXISTS idx_alumnos_matricula ON alumnos (matricula);
