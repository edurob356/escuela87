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
