-- =====================================================
-- PERIODOS ACADÉMICOS — Solo ejecutar si ya tienes las
-- tablas base (alumnos, staff, asistencias, etc.)
-- Pega SOLO este bloque en Supabase → SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS config_periodos (
  id BIGSERIAL PRIMARY KEY,
  activo BOOLEAN DEFAULT FALSE,
  tipo_ciclo VARCHAR(20) DEFAULT 'bimestre',
  fecha_inicio_ciclo DATE,
  duracion_ciclo_semanas INT DEFAULT 40,
  num_parciales_por_periodo INT DEFAULT 2,
  duracion_parcial_semanas INT DEFAULT 4,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parciales (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  ciclo_tipo VARCHAR(20),
  numero_ciclo INT,
  numero_parcial INT,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dias_inhabiles (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  razon VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS parcial_id BIGINT REFERENCES parciales(id) ON DELETE SET NULL;

ALTER TABLE config_periodos DISABLE ROW LEVEL SECURITY;
ALTER TABLE parciales DISABLE ROW LEVEL SECURITY;
ALTER TABLE dias_inhabiles DISABLE ROW LEVEL SECURITY;

INSERT INTO config_periodos (activo, tipo_ciclo, duracion_ciclo_semanas, num_parciales_por_periodo, duracion_parcial_semanas)
SELECT FALSE, 'bimestre', 40, 2, 4
WHERE NOT EXISTS (SELECT 1 FROM config_periodos);
