-- =====================================================
-- ESCUELA 87 — Setup de Base de Datos en Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- =====================================================

-- 1. Tabla de Alumnos
CREATE TABLE IF NOT EXISTS alumnos (
  id BIGSERIAL PRIMARY KEY,
  nombre_completo VARCHAR(255) NOT NULL,
  matricula VARCHAR(18) UNIQUE,
  codigo_acceso VARCHAR(255),
  grado VARCHAR(50),
  grupo VARCHAR(50)
);

-- 2. Tabla de Staff (Directivos, Prefectos, Tutores)
CREATE TABLE IF NOT EXISTS staff (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nombre VARCHAR(255),
  rol VARCHAR(50),
  tipo_personal VARCHAR(50)
);

-- 3. Tabla de Asistencias
CREATE TABLE IF NOT EXISTS asistencias (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT REFERENCES alumnos(id) ON DELETE CASCADE,
  date DATE,
  entry_time TIME,
  status VARCHAR(50)
);

-- 4. Tabla de Anuncios
CREATE TABLE IF NOT EXISTS anuncios (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Reportes Disciplinarios
CREATE TABLE IF NOT EXISTS reportes_disciplinarios (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT REFERENCES alumnos(id) ON DELETE CASCADE,
  tipo VARCHAR(100) NOT NULL,
  descripcion TEXT,
  reporta_por VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DESACTIVAR Row Level Security (RLS)
-- Necesario para que el backend Express pueda leer/escribir
-- =====================================================
ALTER TABLE alumnos DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE anuncios DISABLE ROW LEVEL SECURITY;
ALTER TABLE reportes_disciplinarios DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Staff de prueba (cambiar contraseñas después)
INSERT INTO staff (email, password, nombre, rol, tipo_personal) VALUES
  ('director', 'director', 'Director General', 'director', 'director'),
  ('prefecto', 'prefecto', 'Prefecto Prueba', 'prefecto', 'prefecto'),
  ('tutor', 'tutor', 'Tutor Prueba', 'tutor', 'tutor')
ON CONFLICT (email) DO NOTHING;

-- Anuncio de bienvenida
INSERT INTO anuncios (title, content)
SELECT 'Bienvenido al Sistema de Gestión Escolar', 'Sistema listo y conectado a Supabase.'
WHERE NOT EXISTS (SELECT 1 FROM anuncios LIMIT 1);

-- =====================================================
-- SISTEMA DE PERIODOS ACADÉMICOS (OPCIONAL)
-- Ejecutar solo si se desea activar el sistema de periodos
-- =====================================================

-- 6. Configuración global del sistema de periodos (una sola fila)
CREATE TABLE IF NOT EXISTS config_periodos (
  id BIGSERIAL PRIMARY KEY,
  activo BOOLEAN DEFAULT FALSE,
  tipo_ciclo VARCHAR(20) DEFAULT 'bimestre',  -- 'bimestre', 'trimestre', 'semestre'
  fecha_inicio_ciclo DATE,                     -- Fecha de inicio del ciclo escolar
  duracion_ciclo_semanas INT DEFAULT 40,       -- Duración total del ciclo en semanas
  num_parciales_por_periodo INT DEFAULT 2,     -- Cuántos parciales por bimestre/trimestre/etc.
  duracion_parcial_semanas INT DEFAULT 4,      -- Duración de cada parcial en semanas
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabla de Parciales
CREATE TABLE IF NOT EXISTS parciales (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,           -- Ej: "1er Bimestre - Parcial 1"
  ciclo_tipo VARCHAR(20),                 -- 'bimestre', 'trimestre', 'semestre'
  numero_ciclo INT,                       -- Ej: 1 = primer bimestre
  numero_parcial INT,                     -- Ej: 1, 2, 3...
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabla de Días Inhábiles / Vacaciones
CREATE TABLE IF NOT EXISTS dias_inhabiles (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  razon VARCHAR(255),                     -- Ej: "Vacaciones de invierno", "Día festivo"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columna parcial_id a asistencias (si no existe)
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS parcial_id BIGINT REFERENCES parciales(id) ON DELETE SET NULL;

-- Desactivar RLS para tablas nuevas
ALTER TABLE config_periodos DISABLE ROW LEVEL SECURITY;
ALTER TABLE parciales DISABLE ROW LEVEL SECURITY;
ALTER TABLE dias_inhabiles DISABLE ROW LEVEL SECURITY;

-- Insertar configuración inicial (desactivada)
INSERT INTO config_periodos (activo, tipo_ciclo, duracion_ciclo_semanas, num_parciales_por_periodo, duracion_parcial_semanas)
SELECT FALSE, 'bimestre', 40, 2, 4
WHERE NOT EXISTS (SELECT 1 FROM config_periodos);
