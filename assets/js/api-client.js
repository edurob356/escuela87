/**
 * CLIENTE SUPABASE — CONEXIÓN DIRECTA DESDE EL FRONTEND
 * Secundaria Técnica No. 87 | Proyecto: krgyqrebnfwzplpayitx
 *
 * Usa @supabase/supabase-js vía CDN ESM. No requiere servidor Express.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Clave pública (anon/publishable) — segura para el frontend
const SUPABASE_URL     = 'https://krgyqrebnfwzplpayitx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Z1CnbY2zxmyjom4dO9YCZw_-t0fLlIM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── 1. LOGIN ALUMNO ─────────────────────────────────────────────────────────
export async function studentLogin(matricula) {
  try {
    const { data, error } = await supabase
      .from('alumnos')
      .select('id, nombre_completo, grado, grupo')
      .or(`matricula.eq.${matricula},nombre_completo.ilike.%${matricula}%`)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      matricula,
      nombre: data.nombre_completo,
      apellidos: '',
      grupos: { grado: data.grado || '0', grupo: data.grupo || '0' }
    };
  } catch (e) { console.error('studentLogin:', e); return null; }
}

// ─── 2. LOGIN STAFF ──────────────────────────────────────────────────────────
export async function staffLogin(email, password) {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('id, nombre, rol, tipo_personal')
      .eq('email', email.toLowerCase())
      .eq('password', password)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (e) { console.error('staffLogin:', e); return null; }
}

// ─── 3. RESUMEN ALUMNO ───────────────────────────────────────────────────────
export async function getStudentSummary(studentId) {
  try {
    const { data: alumno, error: aErr } = await supabase
      .from('alumnos').select('grado, grupo').eq('id', studentId).maybeSingle();
    if (aErr || !alumno) return null;

    const { data: asis } = await supabase
      .from('asistencias').select('status').eq('student_id', studentId);

    const total   = asis?.length || 0;
    const onTime  = asis?.filter(r => r.status === 'A tiempo').length || 0;
    const faltas  = asis?.filter(r => r.status === 'Falta').length || 0;
    const percent = total > 0 ? Math.round((onTime / total) * 100) : 100;

    return {
      attendance_percentage: percent,
      attendance_status: percent > 85 ? 'Excelente' : 'Requiere Atención',
      unjustified_absences: faltas,
      absences_period: 'Este mes',
      group_name: `${alumno.grado}° ${alumno.grupo}`,
      shift_name: 'Turno Matutino',
      grade_level: 'Secundaria'
    };
  } catch (e) { console.error('getStudentSummary:', e); return null; }
}

// ─── 4. ASISTENCIAS DE ALUMNO ────────────────────────────────────────────────
export async function getStudentAttendance(studentId) {
  try {
    const { data, error } = await supabase
      .from('asistencias')
      .select('date, entry_time, status')
      .eq('student_id', studentId)
      .order('date', { ascending: false })
      .limit(5);
    if (error) throw error;
    return data || [];
  } catch (e) { console.error('getStudentAttendance:', e); return []; }
}

// ─── 5. ANUNCIOS ─────────────────────────────────────────────────────────────
export async function getAnnouncements() {
  try {
    const { data, error } = await supabase
      .from('anuncios').select('*').order('created_at', { ascending: false }).limit(10);
    if (error) throw error;
    return data || [];
  } catch (e) { console.error('getAnnouncements:', e); return []; }
}

export async function createAnnouncement(title, content = '') {
  try {
    const { data, error } = await supabase
      .from('anuncios').insert({ title, content }).select().single();
    if (error) throw error;
    return { success: true, anuncio: data };
  } catch (e) { console.error('createAnnouncement:', e); return null; }
}

export async function deleteAnnouncement(id) {
  try {
    const { error } = await supabase.from('anuncios').delete().eq('id', id);
    return !error;
  } catch (e) { console.error('deleteAnnouncement:', e); return false; }
}

// ─── 6. ESTADÍSTICAS GLOBALES ────────────────────────────────────────────────
export async function getStats(grado = 'Todos los Grados') {
  try {
    let q = supabase.from('alumnos').select('*', { count: 'exact', head: true });
    if (grado && grado !== 'Todos los Grados') q = q.ilike('grado', `${grado[0]}°%`);
    const { count: totalAlumnos } = await q;

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data: absData } = await supabase
      .from('asistencias').select('status')
      .gte('date', since.toISOString().split('T')[0]);

    const total      = absData?.length || 0;
    const onTime     = absData?.filter(r => r.status === 'A tiempo' || r.status === 'Retardo').length || 0;
    const absent     = absData?.filter(r => r.status === 'Falta').length || 0;
    const attPercent = total > 0 ? Math.round((onTime / total) * 100) : 100;

    return {
      total_alumnos: totalAlumnos || 0,
      asistencia_promedio: attPercent,
      alumnos_riesgo: absent,
      porcentaje_riesgo: total > 0 ? Math.round((absent / total) * 100) : 0
    };
  } catch (e) { console.error('getStats:', e); return null; }
}

// ─── 7. REPORTES DISCIPLINARIOS ───────────────────────────────────────────────
export async function getReportesDisciplina(studentId = null) {
  try {
    let q = supabase
      .from('reportes_disciplinarios')
      .select('*, alumnos(nombre_completo, grado, grupo)')
      .order('created_at', { ascending: false });
    if (studentId) q = q.eq('student_id', studentId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } catch (e) { console.error('getReportesDisciplina:', e); return []; }
}

export async function createReporteDisciplina(studentId, tipo, descripcion, reportaPor) {
  try {
    const { data, error } = await supabase
      .from('reportes_disciplinarios')
      .insert({ student_id: studentId, tipo, descripcion: descripcion || '', reporta_por: reportaPor || 'Staff' })
      .select().single();
    if (error) throw error;
    return { success: true, reporte: data };
  } catch (e) { console.error('createReporteDisciplina:', e); return null; }
}

// ─── 8. BÚSQUEDA DE ALUMNOS ───────────────────────────────────────────────────
export async function searchStudents(q = '', grado = '', grupo = '') {
  try {
    let query = supabase
      .from('alumnos')
      .select('id, nombre_completo, grado, grupo, matricula')
      .order('nombre_completo').limit(100);
    if (q)     query = query.or(`nombre_completo.ilike.%${q}%,matricula.ilike.%${q}%`);
    if (grado) query = query.ilike('grado', `%${grado}%`);
    if (grupo) query = query.ilike('grupo', grupo);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (e) { console.error('searchStudents:', e); return []; }
}

// ─── 9. CRUD ALUMNOS ──────────────────────────────────────────────────────────
export async function getAlumnos() {
  try {
    const { data, error } = await supabase
      .from('alumnos')
      .select('id, nombre_completo, grado, grupo, matricula')
      .order('nombre_completo');
    if (error) throw error;
    return data || [];
  } catch (e) { console.error('getAlumnos:', e); return []; }
}

export async function deleteAlumno(id) {
  try {
    const { error } = await supabase.from('alumnos').delete().eq('id', id);
    return !error;
  } catch (e) { console.error('deleteAlumno:', e); return false; }
}

// ─── 10. REGISTRAR ASISTENCIA ─────────────────────────────────────────────────
export async function registrarAsistencia(studentId, status) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now   = new Date().toTimeString().split(' ')[0];
    const { data: existing } = await supabase
      .from('asistencias').select('id')
      .eq('student_id', studentId).eq('date', today).maybeSingle();
    if (existing) {
      await supabase.from('asistencias')
        .update({ status, entry_time: now })
        .eq('student_id', studentId).eq('date', today);
    } else {
      await supabase.from('asistencias')
        .insert({ student_id: studentId, date: today, entry_time: now, status });
    }
    return { success: true };
  } catch (e) { console.error('registrarAsistencia:', e); return { success: false, error: e.message }; }
}

// ─── 11. LISTA DE ASISTENCIAS HOY ────────────────────────────────────────────
export async function getAsistenciasHoy(grado = '', grupo = '') {
  try {
    let q = supabase
      .from('alumnos')
      .select('id, nombre_completo, grado, grupo, matricula, asistencias!left(status, entry_time, date)')
      .order('nombre_completo');
    if (grado) q = q.ilike('grado', `%${grado}%`);
    if (grupo) q = q.eq('grupo', grupo);
    const { data, error } = await q;
    if (error) throw error;
    const today = new Date().toISOString().split('T')[0];
    return (data || []).map(a => {
      const hoy = a.asistencias?.find(x => x.date === today);
      return {
        id: a.id,
        nombre_completo: a.nombre_completo,
        grado: a.grado,
        grupo: a.grupo,
        matricula: a.matricula,
        asistencia_hoy: hoy?.status || null,
        entry_time: hoy?.entry_time || null
      };
    });
  } catch (e) { console.error('getAsistenciasHoy:', e); return []; }
}

// ─── 12. ASISTENCIA POR QR ────────────────────────────────────────────────────
export async function registrarAsistenciaQR(codigo) {
  try {
    // Intentar por código de acceso primero, luego por matrícula/nombre
    let student = null;
    const { data: byAcceso } = await supabase
      .from('alumnos').select('id, nombre_completo, grado, grupo')
      .eq('codigo_acceso', codigo).maybeSingle();
    if (byAcceso) {
      student = byAcceso;
    } else {
      const arr = await searchStudents(codigo);
      if (arr.length > 0) student = arr[0];
    }
    if (!student) return { success: false, error: 'Alumno no encontrado' };

    const now    = new Date().toTimeString().split(' ')[0];
    const hour   = parseInt(now.split(':')[0]);
    const minute = parseInt(now.split(':')[1]);
    const status = (hour > 7 || (hour === 7 && minute > 15)) ? 'Retardo' : 'A tiempo';

    const result = await registrarAsistencia(student.id, status);
    return { ...result, student, status, entry_time: now };
  } catch (e) { console.error('registrarAsistenciaQR:', e); return { success: false, error: e.message }; }
}

// ─── 13. SUBIR ALUMNOS DESDE EXCEL (client-side) ─────────────────────────────
// Recibe rows ya parseados por SheetJS (window.XLSX)
export async function uploadAlumnosFromData(rows) {
  let count = 0;
  for (const row of rows) {
    const nombre         = row['Nombre Completo'] || row['nombre'] || row['Estudiante'] || '';
    const grado          = row['Grado']  || row['grado']  || '';
    const grupo          = row['Grupo']  || row['grupo']  || '';
    const matricula      = row['Matricula'] || row['Curp'] || null;
    const codigo_acceso  = row['Codigo'] || row['Nip']    || crypto.randomUUID();
    if (nombre) {
      await supabase.from('alumnos').upsert(
        { nombre_completo: nombre, grado, grupo, matricula, codigo_acceso },
        { onConflict: 'matricula' }
      );
      count++;
    }
  }
  return { success: true, message: `Se procesaron ${count} alumnos del Excel.` };
}
