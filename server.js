require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Directorio temporal para uploads (Vercel usa /tmp)
const uploadDir = process.env.VERCEL ? "/tmp/uploads" : "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// Cliente Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ ERROR: Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY");
}

const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_KEY || 'placeholder-key'
);
console.log("✅ Supabase client inicializado:", SUPABASE_URL);

// ========================
// ENDPOINTS
// ========================

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Servidor conectado a Supabase." });
});

// 1. LOGIN STAFF
app.post("/api/login/staff", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase
      .from("staff")
      .select("id, nombre, rol, tipo_personal")
      .eq("email", email.toLowerCase())
      .eq("password", password)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    res.json({ success: true, user: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. LOGIN ALUMNO
app.post("/api/login/student", async (req, res) => {
  try {
    const { matricula } = req.body;
    const { data, error } = await supabase
      .from("alumnos")
      .select("id, nombre_completo, grado, grupo")
      .or(`matricula.eq.${matricula},nombre_completo.ilike.%${matricula}%`)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(401).json({ success: false, message: "Alumno no encontrado." });

    res.json({
      success: true,
      user: {
        id: data.id,
        matricula,
        nombre: data.nombre_completo,
        apellidos: "",
        grupos: { grado: data.grado || "0", grupo: data.grupo || "0" }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. ANUNCIOS
app.get("/api/anuncios", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("anuncios")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/anuncios", async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: "Título requerido" });
    const { data, error } = await supabase
      .from("anuncios")
      .insert({ title, content: content || "" })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, anuncio: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/anuncios/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("anuncios").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. RESUMEN ALUMNO
app.get("/api/alumnos/:id/resumen", async (req, res) => {
  try {
    const studentId = Number(req.params.id) || 0;
    const { data: alumno, error: aErr } = await supabase
      .from("alumnos")
      .select("grado, grupo")
      .eq("id", studentId)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

    const { data: asistencias, error: asErr } = await supabase
      .from("asistencias")
      .select("status")
      .eq("student_id", studentId);
    if (asErr) throw asErr;

    const total = asistencias?.length || 0;
    const onTime = asistencias?.filter(r => r.status === "A tiempo").length || 0;
    const faltas = asistencias?.filter(r => r.status === "Falta").length || 0;
    const percent = total > 0 ? Math.round((onTime / total) * 100) : 100;

    res.json({
      attendance_percentage: percent,
      attendance_status: percent > 85 ? "Excelente" : "Requiere Atención",
      unjustified_absences: faltas,
      absences_period: "Este mes",
      group_name: `${alumno.grado}° ${alumno.grupo}`,
      shift_name: "Turno Matutino",
      grade_level: "Secundaria"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. ASISTENCIAS ALUMNO
app.get("/api/alumnos/:id/asistencias", async (req, res) => {
  try {
    const studentId = Number(req.params.id) || 0;
    const { data, error } = await supabase
      .from("asistencias")
      .select("date, entry_time, status")
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .limit(5);
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. BÚSQUEDA ALUMNOS
app.get("/api/search/alumnos", async (req, res) => {
  try {
    const { q, grado, grupo } = req.query;
    if (!q && !grado && !grupo) return res.json([]);

    let query = supabase
      .from("alumnos")
      .select("id, nombre_completo, grado, grupo, matricula")
      .order("nombre_completo")
      .limit(100);

    if (q) query = query.or(`nombre_completo.ilike.%${q}%,matricula.ilike.%${q}%`);
    if (grado) query = query.ilike("grado", `%${grado}%`);
    if (grupo) query = query.ilike("grupo", grupo);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. ESTADÍSTICAS GLOBALES
app.get("/api/stats/reportes", async (req, res) => {
  try {
    const { grado } = req.query;

    let alumnosQuery = supabase.from("alumnos").select("*", { count: "exact", head: true });
    if (grado && grado !== "Todos los Grados") alumnosQuery = alumnosQuery.ilike("grado", `${grado[0]}°%`);
    const { count: totalAlumnos } = await alumnosQuery;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: absData } = await supabase
      .from("asistencias")
      .select("status")
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

    const totalEntries = absData?.length || 0;
    const onTimeCount = absData?.filter(r => r.status === "A tiempo" || r.status === "Retardo").length || 0;
    const absentCount = absData?.filter(r => r.status === "Falta").length || 0;
    const attPercent = totalEntries > 0 ? Math.round((onTimeCount / totalEntries) * 100) : 100;

    res.json({
      total_alumnos: totalAlumnos || 0,
      asistencia_promedio: attPercent,
      alumnos_riesgo: absentCount,
      porcentaje_riesgo: totalEntries > 0 ? Math.round((absentCount / totalEntries) * 100) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. REPORTES DISCIPLINARIOS
app.get("/api/reportes-disciplina", async (req, res) => {
  try {
    const { student_id } = req.query;
    let query = supabase
      .from("reportes_disciplinarios")
      .select("*, alumnos(nombre_completo, grado, grupo)")
      .order("created_at", { ascending: false });
    if (student_id) query = query.eq("student_id", student_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reportes-disciplina", async (req, res) => {
  try {
    const { student_id, tipo, descripcion, reporta_por } = req.body;
    if (!student_id || !tipo) return res.status(400).json({ error: "Estudiante y tipo requeridos" });
    const { data, error } = await supabase
      .from("reportes_disciplinarios")
      .insert({ student_id, tipo, descripcion: descripcion || "", reporta_por: reporta_por || "Staff" })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, reporte: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. ALUMNOS CRUD
app.get("/api/alumnos", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("alumnos")
      .select("id, nombre_completo, grado, grupo, matricula")
      .order("nombre_completo");
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/alumnos", async (req, res) => {
  try {
    const { nombre_completo, grado, grupo, matricula } = req.body;
    if (!nombre_completo) return res.status(400).json({ error: "El nombre es requerido" });
    const { data, error } = await supabase
      .from("alumnos")
      .insert({
        nombre_completo,
        grado: grado || "",
        grupo: grupo || "",
        matricula: matricula || null,
        codigo_acceso: require("crypto").randomUUID()
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return res.status(400).json({ error: "Ya existe un alumno con esa matrícula." });
      throw error;
    }
    res.json({ success: true, alumno: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/alumnos/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("alumnos").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. UPLOAD EXCEL
app.post("/api/upload-alumnos", upload.single("archivo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo." });
  try {
    const workbook = xlsx.read(fs.readFileSync(req.file.path), { type: "buffer" });
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let insertCounts = 0;
    for (const row of data) {
      const nombre = row["Nombre Completo"] || row["nombre"] || row["Estudiante"] || "";
      const grado = row["Grado"] || row["grado"] || "";
      const grupo = row["Grupo"] || row["grupo"] || "";
      const matricula = row["Matricula"] || row["Curp"] || null;
      const codigo_acceso = row["Codigo"] || row["Nip"] || require("crypto").randomUUID();
      if (nombre) {
        await supabase.from("alumnos").upsert(
          { nombre_completo: nombre, grado, grupo, matricula, codigo_acceso },
          { onConflict: "matricula" }
        );
        insertCounts++;
      }
    }
    res.json({ success: true, message: `Se procesaron ${insertCounts} alumnos del Excel.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. ASISTENCIAS
app.post("/api/asistencias", async (req, res) => {
  try {
    const { student_id, status } = req.body;
    if (!student_id || !status) return res.status(400).json({ error: "student_id y status requeridos" });
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toTimeString().split(" ")[0];

    const { data: existing } = await supabase
      .from("asistencias")
      .select("id")
      .eq("student_id", student_id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      await supabase.from("asistencias").update({ status, entry_time: now })
        .eq("student_id", student_id).eq("date", today);
    } else {
      await supabase.from("asistencias").insert({ student_id, date: today, entry_time: now, status });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/asistencias/qr", async (req, res) => {
  try {
    const { codigo_acceso } = req.body;
    if (!codigo_acceso) return res.status(400).json({ error: "Código QR no detectado" });

    const { data: student, error: sErr } = await supabase
      .from("alumnos")
      .select("id, nombre_completo, grado, grupo")
      .eq("codigo_acceso", codigo_acceso)
      .maybeSingle();
    if (sErr || !student) return res.status(404).json({ error: "Código QR inválido" });

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toTimeString().split(" ")[0];
    const hour = parseInt(now.split(":")[0]);
    const minute = parseInt(now.split(":")[1]);
    const status = hour > 7 || (hour === 7 && minute > 15) ? "Retardo" : "A tiempo";

    const { data: existing } = await supabase
      .from("asistencias").select("id")
      .eq("student_id", student.id).eq("date", today).maybeSingle();

    if (existing) {
      await supabase.from("asistencias").update({ status, entry_time: now })
        .eq("student_id", student.id).eq("date", today);
    } else {
      await supabase.from("asistencias").insert({ student_id: student.id, date: today, entry_time: now, status });
    }

    res.json({ success: true, student, status, entry_time: now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/asistencias/hoy", async (req, res) => {
  try {
    const { grado, grupo } = req.query;
    let query = supabase
      .from("alumnos")
      .select(`id, nombre_completo, grado, grupo, matricula, asistencias!left(status, entry_time, date)`)
      .order("nombre_completo");

    if (grado) query = query.ilike("grado", `%${grado}%`);
    if (grupo) query = query.eq("grupo", grupo);

    const { data, error } = await query;
    if (error) throw error;

    const today = new Date().toISOString().split("T")[0];
    const result = (data || []).map(a => {
      const asistenciaHoy = a.asistencias?.find(x => x.date === today);
      return {
        id: a.id,
        nombre_completo: a.nombre_completo,
        grado: a.grado,
        grupo: a.grupo,
        matricula: a.matricula,
        asistencia_hoy: asistenciaHoy?.status || null,
        entry_time: asistenciaHoy?.entry_time || null
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor local o exportar para Vercel
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  });
}

module.exports = app;
