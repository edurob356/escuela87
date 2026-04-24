require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (HTML, CSS, JS del frontend)
app.use(express.static(path.join(__dirname)));

// Directorio para temporal uploads
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}
const upload = multer({ dest: "uploads/" });

// Configuración de la conexión PostgreSQL usando variables del archivo .env o Supabase
const pool = process.env.DATABASE_URL 
  ? new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Requerido por Supabase/Vercel
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASS,
      port: process.env.DB_PORT,
    });

pool.connect(async (err, client, release) => {
  if (err) {
    console.error("Error reconectando a PostgreSQL (pgAdmin):", err.stack);
  } else {
    console.log(`✅ Conectado exitosamente a la base de datos PostgreSQL: ${process.env.DB_NAME}`);
    try {
      // 1. Alumnos
      await client.query(`
        CREATE TABLE IF NOT EXISTS alumnos (
          id SERIAL PRIMARY KEY,
          nombre_completo VARCHAR(255) NOT NULL,
          matricula VARCHAR(18) UNIQUE, -- Equivalente a CURP o Matrícula
          codigo_acceso VARCHAR(255),
          grado VARCHAR(50),
          grupo VARCHAR(50)
        )
      `);
      // 2. Staff (Directores, Prefectos, Tutores)
      await client.query(`
        CREATE TABLE IF NOT EXISTS staff (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          nombre VARCHAR(255),
          rol VARCHAR(50),
          tipo_personal VARCHAR(50)
        )
      `);
      // 3. Asistencias
      await client.query(`
        CREATE TABLE IF NOT EXISTS asistencias (
          id SERIAL PRIMARY KEY,
          student_id INTEGER REFERENCES alumnos(id),
          date DATE,
          entry_time TIME,
          status VARCHAR(50)
        )
      `);
      // 4. Anuncios
      await client.query(`
        CREATE TABLE IF NOT EXISTS anuncios (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255),
          content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
      CREATE TABLE IF NOT EXISTS reportes_disciplinarios (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
        tipo VARCHAR(100) NOT NULL,
        descripcion TEXT,
        reporta_por VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
      // 5. Insertar staff inicial de prueba si no existe
      await client.query(`
        INSERT INTO staff (email, password, nombre, rol, tipo_personal) VALUES 
        ('director', 'director', 'Director Prueba', 'director', 'director'),
        ('prefecto', 'prefecto', 'Prefecto Prueba', 'prefecto', 'prefecto'),
        ('tutor', 'tutor', 'Tutor Prueba', 'tutor', 'tutor')
        ON CONFLICT (email) DO NOTHING;
      `);
      // 6. Insertar anuncio base si no hay
      await client.query(`
        INSERT INTO anuncios (title, content) 
        SELECT 'Bienvenido a la nueva plataforma', 'Hemos migrado exitosamente a PostgreSQL local.' 
        WHERE NOT EXISTS (SELECT 1 FROM anuncios LIMIT 1);
      `);

      console.log("✅ Tablas de DB aseguradas: alumnos, staff, asistencias, anuncios.");
    } catch (e) {
      console.error("Error inicializando tablas:", e);
    } finally {
      release();
    }
  }
});

// ========================
// ENDPOINTS
// ========================

// Endpoint de prueba para comprobar que el backend funciona
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Servidor conectado a PostgreSQL exitosamente." });
});

// 1. LOGIN STAFF
app.post("/api/login/staff", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      "SELECT id, nombre, rol, tipo_personal FROM staff WHERE email = $1 AND password = $2",
      [email.toLowerCase(), password]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. LOGIN ALUMNO
app.post("/api/login/student", async (req, res) => {
  try {
    const { matricula, codigoAcceso } = req.body;
    // Búsqueda estricta por nombre o matrícula en PostgreSQL
    const result = await pool.query(
      "SELECT id, nombre_completo as nombre, grado, grupo FROM alumnos WHERE matricula = $1 OR nombre_completo ILIKE $2 LIMIT 1",
      [matricula, `%${matricula}%`]
    );
    
    if (result.rows.length > 0) {
      const dbAlum = result.rows[0];
      res.json({ success: true, user: {
        id: dbAlum.id,
        matricula: matricula,
        nombre: dbAlum.nombre,
        apellidos: '',
        grupos: { grado: dbAlum.grado || "0", grupo: dbAlum.grupo || "0" }
      }});
    } else {
      res.status(401).json({ success: false, message: "Nombre o Matrícula incorrectos. El estudiante no existe en la base de datos." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. OBTENER AVISOS
app.get("/api/anuncios", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM anuncios ORDER BY created_at DESC LIMIT 10");
    res.json(result.rows); // Puede regresar un arreglo vacío si la DB no tiene anuncios.
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.1 CREAR AVISO
app.post("/api/anuncios", async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: "Título requerido" });
    const result = await pool.query(
      "INSERT INTO anuncios (title, content) VALUES ($1, $2) RETURNING *",
      [title, content || ""]
    );
    res.json({ success: true, anuncio: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.2 ELIMINAR AVISO
app.delete("/api/anuncios/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM anuncios WHERE id = $1", [id]);
    res.json({ success: true });
  } catch(error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. RESUMEN ESTUDIANTE 100% REAL DE DB
app.get("/api/alumnos/:id/resumen", async (req, res) => {
  try {
    const studentId = Number(req.params.id) || 0;
    const result = await pool.query(
      "SELECT grado || '° ' || grupo as group_name, 'Turno Matutino' as shift_name FROM alumnos WHERE id = $1",
      [studentId]
    );

    if (result.rows.length === 0) {
       return res.status(404).json({ error: "Alumno no encontrado" });
    }

    const absQuery = await pool.query(
      "SELECT status, count(*) FROM asistencias WHERE student_id = $1 GROUP BY status",
      [studentId]
    );

    let total = 0;
    let onTime = 0;
    let faltas = 0;
    absQuery.rows.forEach(r => {
       const conteo = parseInt(r.count);
       total += conteo;
       if (r.status === 'A tiempo') onTime += conteo;
       if (r.status === 'Falta') faltas += conteo;
    });

    const percent = total > 0 ? Math.round((onTime / total) * 100) : 100;

    res.json({
      attendance_percentage: percent,
      attendance_status: percent > 85 ? "Excelente" : "Requiere Atención",
      unjustified_absences: faltas,
      absences_period: "Este mes",
      group_name: result.rows[0].group_name,
      shift_name: result.rows[0].shift_name,
      grade_level: "Secundaria"
    });
  } catch(error) {
     res.status(500).json({ error: error.message });
  }
});

// 8. REPORTES DISCIPLINARIOS
app.get("/api/reportes-disciplina", async (req, res) => {
  try {
    const { student_id } = req.query;
    let sql = `
      SELECT r.*, a.nombre_completo, a.grado, a.grupo 
      FROM reportes_disciplinarios r 
      JOIN alumnos a ON r.student_id = a.id 
      ORDER BY r.created_at DESC
    `;
    let args = [];
    if(student_id) {
        sql = `
          SELECT r.*, a.nombre_completo, a.grado, a.grupo 
          FROM reportes_disciplinarios r 
          JOIN alumnos a ON r.student_id = a.id 
          WHERE r.student_id = $1
          ORDER BY r.created_at DESC
        `;
        args = [student_id];
    }
    const result = await pool.query(sql, args);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reportes-disciplina", async (req, res) => {
  try {
    const { student_id, tipo, descripcion, reporta_por } = req.body;
    if (!student_id || !tipo) return res.status(400).json({ error: "Estudiante y tipo requeridos" });
    
    const result = await pool.query(
      "INSERT INTO reportes_disciplinarios (student_id, tipo, descripcion, reporta_por) VALUES ($1, $2, $3, $4) RETURNING *",
      [student_id, tipo, descripcion || "", reporta_por || "Staff"]
    );
    res.json({ success: true, reporte: result.rows[0] });
  } catch(error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. ASISTENCIAS ESTUDIANTE (ESTRICTO DB)
app.get("/api/alumnos/:id/asistencias", async (req, res) => {
  try {
    const studentId = Number(req.params.id) || 0;
    const result = await pool.query(
      "SELECT date, entry_time, status FROM asistencias WHERE student_id = $1 ORDER BY date DESC LIMIT 5",
      [studentId]
    );
    res.json(result.rows); // Retorna vacio estricto si no hay asistencias reales
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. BUSQUEDA AVANZADA ALUMNOS
app.get("/api/search/alumnos", async (req, res) => {
  try {
    const { q, grado, grupo } = req.query;
    let queryArgs = [];
    let queryConditions = [];

    if (q) {
      queryArgs.push(`%${q}%`);
      queryConditions.push(`(nombre_completo ILIKE $${queryArgs.length} OR matricula ILIKE $${queryArgs.length})`);
    }
    if (grado) {
      queryArgs.push(`${grado}%`); // e.g. "1°"
      queryConditions.push(`grado ILIKE $${queryArgs.length}`);
    }
    if (grupo) {
      queryArgs.push(grupo);
      queryConditions.push(`grupo ILIKE $${queryArgs.length}`);
    }

    let whereClause = queryConditions.length > 0 ? "WHERE " + queryConditions.join(" AND ") : "";
    // Aseguramos que empieze limpio limitando resultados a menos que haya condicion específica
    if(queryConditions.length === 0) return res.json([]); 

    const sqlStr = `SELECT id, nombre_completo, grado, grupo, matricula FROM alumnos ${whereClause} ORDER BY nombre_completo ASC LIMIT 100`;
    const result = await pool.query(sqlStr, queryArgs);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. REPORTES / ESTADÍSTICAS GLOBALES O POR GRADO
app.get("/api/stats/reportes", async (req, res) => {
  try {
    const { grado } = req.query;
    
    // Obtener total alumnos
    let totalQuery = "SELECT count(id) as total FROM alumnos";
    let totalArgs = [];
    if (grado && grado !== "Todos los Grados") {
       totalArgs.push(`${grado.split("")[0]}°%`);
       totalQuery += " WHERE grado ILIKE $1";
    }
    const totalRes = await pool.query(totalQuery, totalArgs);
    const totalAlumnos = parseInt(totalRes.rows[0].total) || 0;

    // Obtener desglose status asistencias hoy
    const today = new Date().toISOString().split('T')[0];
    let absStr = "SELECT status, count(*) FROM asistencias a JOIN alumnos al ON a.student_id = al.id WHERE a.date >= CURRENT_DATE - INTERVAL '30 days'";
    let absArgs = [];
    if (grado && grado !== "Todos los Grados") {
       absArgs.push(`${grado.split("")[0]}°%`);
       absStr += " AND al.grado ILIKE $1";
    }
    absStr += " GROUP BY status";

    const absRes = await pool.query(absStr, absArgs);
    let onTimeCount = 0;
    let absentCount = 0;
    let totalEntries = 0;

    absRes.rows.forEach(r => {
        let n = parseInt(r.count);
        totalEntries += n;
        if(r.status === 'A tiempo' || r.status === 'Retardo') onTimeCount += n;
        if(r.status === 'Falta') absentCount += n;
    });

    const attPercent = totalEntries > 0 ? Math.round((onTimeCount / totalEntries) * 100) : 100;
    const diff = 100 - attPercent;

    res.json({
        total_alumnos: totalAlumnos,
        asistencia_promedio: attPercent,
        alumnos_riesgo: totalEntries > 0 ? absentCount : 0,
        porcentaje_riesgo: totalEntries > 0 ? Math.round((absentCount / totalEntries) * 100) : 0,
    });
  } catch(error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para importar excel de estudiantes
app.post("/api/upload-alumnos", upload.single("archivo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo." });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let insertCounts = 0;
    for (const row of data) {
      const nombre = row["Nombre Completo"] || row["nombre"] || row["Estudiante"] || "";
      const grado = row["Grado"] || row["grado"] || "";
      const grupo = row["Grupo"] || row["grupo"] || "";
      const matricula = row["Matricula"] || row["Curp"] || null;
      const codigoAcceso = row["Codigo"] || row["Nip"] || null;

      if (nombre) {
        await pool.query(
          "INSERT INTO alumnos (nombre_completo, grado, grupo, matricula, codigo_acceso) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (matricula) DO NOTHING",
          [nombre, grado, grupo, matricula, codigoAcceso]
        );
        insertCounts++;
      }
    }
    res.json({ success: true, message: `Se insertaron/verificaron ${insertCounts} alumnos desde el Excel exitosamente.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alumnos - Agregar un solo alumno
app.post("/api/alumnos", async (req, res) => {
  try {
    const { nombre_completo, grado, grupo, matricula } = req.body;
    if (!nombre_completo) return res.status(400).json({ error: "El nombre es requerido" });
    
    const crypto = require("crypto");
    const codigoAcceso = crypto.randomUUID();
    
    const result = await pool.query(
      "INSERT INTO alumnos (nombre_completo, grado, grupo, matricula, codigo_acceso) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [nombre_completo, grado || "", grupo || "", matricula || null, codigoAcceso]
    );
    res.json({ success: true, alumno: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      res.status(400).json({ error: "Ya existe un alumno con esa matrícula." });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// GET /api/alumnos - Lista completa de alumnos
app.get("/api/alumnos", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, nombre_completo, grado, grupo, matricula FROM alumnos ORDER BY nombre_completo ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/alumnos/:id - Eliminar alumno
app.delete("/api/alumnos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM alumnos WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/asistencias - Registrar asistencia de un alumno
app.post("/api/asistencias", async (req, res) => {
  try {
    const { student_id, status } = req.body;
    if (!student_id || !status) return res.status(400).json({ error: "student_id y status requeridos" });
    const today = new Date().toISOString().split('T')[0];
    const now   = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
    // Upsert: si ya existe asistencia hoy, actualiza; si no, inserta
    const existing = await pool.query(
      "SELECT id FROM asistencias WHERE student_id = $1 AND date = $2",
      [student_id, today]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        "UPDATE asistencias SET status = $1, entry_time = $2 WHERE student_id = $3 AND date = $4",
        [status, now, student_id, today]
      );
    } else {
      await pool.query(
        "INSERT INTO asistencias (student_id, date, entry_time, status) VALUES ($1, $2, $3, $4)",
        [student_id, today, now, status]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/asistencias/qr - Registrar asistencia mediante código QR
app.post("/api/asistencias/qr", async (req, res) => {
  try {
    const { codigo_acceso } = req.body;
    if (!codigo_acceso) return res.status(400).json({ error: "Código QR no detectado" });
    
    const alResult = await pool.query("SELECT id, nombre_completo, grado, grupo FROM alumnos WHERE codigo_acceso = $1 LIMIT 1", [codigo_acceso]);
    if (alResult.rows.length === 0) {
      return res.status(404).json({ error: "Código QR inválido o alumno no encontrado" });
    }
    
    const student = alResult.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const now   = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
    
    const hour = parseInt(now.split(':')[0]);
    const minute = parseInt(now.split(':')[1]);
    let status = "A tiempo";
    if (hour > 7 || (hour === 7 && minute > 15)) {
      status = "Retardo";
    }

    const existing = await pool.query(
      "SELECT id FROM asistencias WHERE student_id = $1 AND date = $2",
      [student.id, today]
    );
    
    if (existing.rows.length > 0) {
      await pool.query(
        "UPDATE asistencias SET status = $1, entry_time = $2 WHERE student_id = $3 AND date = $4",
        [status, now, student.id, today]
      );
    } else {
      await pool.query(
        "INSERT INTO asistencias (student_id, date, entry_time, status) VALUES ($1, $2, $3, $4)",
        [student.id, today, now, status]
      );
    }
    
    res.json({ success: true, student, status, entry_time: now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/asistencias/hoy - Pase de lista del día (todos los alumnos + su estado hoy)
app.get("/api/asistencias/hoy", async (req, res) => {
  try {
    const { grado, grupo } = req.query;
    let conditions = [];
    let args = [];
    if (grado) { args.push(`%${grado}%`); conditions.push(`a.grado ILIKE $${args.length}`); }
    if (grupo) { args.push(grupo);        conditions.push(`a.grupo = $${args.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const sql = `
      SELECT a.id, a.nombre_completo, a.grado, a.grupo, a.matricula,
             asi.status as asistencia_hoy, asi.entry_time
      FROM alumnos a
      LEFT JOIN asistencias asi ON asi.student_id = a.id AND asi.date = CURRENT_DATE
      ${where}
      ORDER BY a.nombre_completo ASC
    `;
    const result = await pool.query(sql, args);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Iniciar servidor local o exportar para Vercel
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, async () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  });
}

// Requerido por Vercel para Serverless Functions
module.exports = app;
