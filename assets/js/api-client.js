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

    // Verificar si el día es inhábil
    const inhabil = await esDiaInhabil(today);
    if (inhabil) return { success: false, error: 'dia_inhabil', message: inhabil.razon || 'Día inhábil' };

    // Obtener parcial activo para asociarlo
    const parcialActivo = await getParcialActivo();
    const parcialId = parcialActivo?.id || null;

    const { data: existing } = await supabase
      .from('asistencias').select('id')
      .eq('student_id', studentId).eq('date', today).maybeSingle();
    if (existing) {
      await supabase.from('asistencias')
        .update({ status, entry_time: now, parcial_id: parcialId })
        .eq('student_id', studentId).eq('date', today);
    } else {
      await supabase.from('asistencias')
        .insert({ student_id: studentId, date: today, entry_time: now, status, parcial_id: parcialId });
    }
    return { success: true, parcial: parcialActivo };
  } catch (e) { console.error('registrarAsistencia:', e); return { success: false, error: e.message }; }
}

// ─── 14. CONFIG DE PERIODOS ───────────────────────────────────────────────────
export async function getConfigPeriodos() {
  try {
    const { data, error } = await supabase
      .from('config_periodos').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return data || { activo: false, tipo_ciclo: 'bimestre', duracion_ciclo_semanas: 40, num_parciales_por_periodo: 2, duracion_parcial_semanas: 4 };
  } catch (e) { console.error('getConfigPeriodos:', e); return null; }
}

export async function saveConfigPeriodos(cfg) {
  try {
    const { data: existing } = await supabase.from('config_periodos').select('id').limit(1).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('config_periodos')
        .update({ ...cfg, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('config_periodos').insert({ ...cfg });
      if (error) throw error;
    }
    return { success: true };
  } catch (e) { console.error('saveConfigPeriodos:', e); return { success: false, error: e.message }; }
}

// ─── 15. PARCIALES ────────────────────────────────────────────────────────────
export async function getParciales() {
  try {
    const { data, error } = await supabase
      .from('parciales').select('*')
      .order('fecha_inicio', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) { console.error('getParciales:', e); return []; }
}

export async function getParcialActivo() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('parciales').select('*')
      .lte('fecha_inicio', today)
      .gte('fecha_fin', today)
      .eq('activo', true)
      .limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (e) { console.error('getParcialActivo:', e); return null; }
}

export async function createParcial(p) {
  try {
    const { data, error } = await supabase.from('parciales').insert(p).select().single();
    if (error) throw error;
    return { success: true, parcial: data };
  } catch (e) { console.error('createParcial:', e); return { success: false, error: e.message }; }
}

export async function updateParcial(id, p) {
  try {
    const { error } = await supabase.from('parciales').update(p).eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (e) { console.error('updateParcial:', e); return { success: false, error: e.message }; }
}

export async function deleteParcial(id) {
  try {
    const { error } = await supabase.from('parciales').delete().eq('id', id);
    return !error;
  } catch (e) { console.error('deleteParcial:', e); return false; }
}

export async function deleteAllParciales() {
  try {
    const { error } = await supabase.from('parciales').delete().neq('id', 0);
    return !error;
  } catch (e) { console.error('deleteAllParciales:', e); return false; }
}

// Genera automáticamente los parciales a partir de la configuración y los guarda
export async function generarParciales(cfg) {
  try {
    // cfg: { tipo_ciclo, fecha_inicio_ciclo, duracion_ciclo_semanas, num_parciales_por_periodo, duracion_parcial_semanas }
    const cicloNombres = { bimestre: ['1er','2do','3er','4to','5to','6to'], trimestre: ['1er','2do','3er','4to'], semestre: ['1er','2do'] };
    const tipoSingular = { bimestre: 'Bimestre', trimestre: 'Trimestre', semestre: 'Semestre' };
    const semanasDuPeriodo = { bimestre: 8, trimestre: 12, semestre: 18 };

    const semsPorPeriodo = semanasDuPeriodo[cfg.tipo_ciclo] || 8;
    const totalPeriodos  = Math.floor(cfg.duracion_ciclo_semanas / semsPorPeriodo);
    const ms1Day = 86400000;
    const ms7Day = 7 * ms1Day;

    let fechaActual = new Date(cfg.fecha_inicio_ciclo);
    const parciales = [];

    for (let c = 1; c <= totalPeriodos; c++) {
      const semsXParcial = Math.floor(semsPorPeriodo / cfg.num_parciales_por_periodo);
      for (let p = 1; p <= cfg.num_parciales_por_periodo; p++) {
        const durSems = cfg.duracion_parcial_semanas || semsXParcial;
        const fechaInicio = new Date(fechaActual);
        const fechaFin    = new Date(fechaActual.getTime() + durSems * ms7Day - ms1Day);
        parciales.push({
          nombre: `${cicloNombres[cfg.tipo_ciclo]?.[c-1] || c+'°'} ${tipoSingular[cfg.tipo_ciclo]} — Parcial ${p}`,
          ciclo_tipo: cfg.tipo_ciclo,
          numero_ciclo: c,
          numero_parcial: p,
          fecha_inicio: fechaInicio.toISOString().split('T')[0],
          fecha_fin:    fechaFin.toISOString().split('T')[0],
          activo: true
        });
        fechaActual = new Date(fechaFin.getTime() + ms1Day);
      }
    }

    await deleteAllParciales();
    const { error } = await supabase.from('parciales').insert(parciales);
    if (error) throw error;
    return { success: true, total: parciales.length };
  } catch (e) { console.error('generarParciales:', e); return { success: false, error: e.message }; }
}

// ─── 16. DÍAS INHÁBILES ───────────────────────────────────────────────────────
export async function getDiasInhabiles() {
  try {
    const { data, error } = await supabase
      .from('dias_inhabiles').select('*').order('fecha', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) { console.error('getDiasInhabiles:', e); return []; }
}

export async function esDiaInhabil(fecha) {
  try {
    const { data } = await supabase
      .from('dias_inhabiles').select('id, razon').eq('fecha', fecha).maybeSingle();
    return data || null;
  } catch (e) { return null; }
}

export async function createDiaInhabil(fecha, razon = '') {
  try {
    const { data, error } = await supabase
      .from('dias_inhabiles').upsert({ fecha, razon }, { onConflict: 'fecha' }).select().single();
    if (error) throw error;
    return { success: true, dia: data };
  } catch (e) { console.error('createDiaInhabil:', e); return { success: false, error: e.message }; }
}

export async function deleteDiaInhabil(id) {
  try {
    const { error } = await supabase.from('dias_inhabiles').delete().eq('id', id);
    return !error;
  } catch (e) { console.error('deleteDiaInhabil:', e); return false; }
}

// ─── 17. ASISTENCIAS POR PARCIAL ─────────────────────────────────────────────
export async function getAsistenciasPorParcial(parcialId, grado = '', grupo = '') {
  try {
    let q = supabase
      .from('alumnos')
      .select('id, nombre_completo, grado, grupo, matricula, asistencias!left(status, entry_time, date, parcial_id)')
      .order('nombre_completo');
    if (grado) q = q.ilike('grado', `%${grado}%`);
    if (grupo) q = q.eq('grupo', grupo);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(a => {
      const asistsParcial = a.asistencias?.filter(x => String(x.parcial_id) === String(parcialId)) || [];
      const presentes = asistsParcial.filter(x => x.status === 'A tiempo' || x.status === 'Retardo').length;
      const faltas    = asistsParcial.filter(x => x.status === 'Falta').length;
      return {
        id: a.id,
        nombre_completo: a.nombre_completo,
        grado: a.grado,
        grupo: a.grupo,
        matricula: a.matricula,
        presentes,
        faltas,
        total: asistsParcial.length,
        porcentaje: asistsParcial.length > 0 ? Math.round((presentes / asistsParcial.length) * 100) : null
      };
    });
  } catch (e) { console.error('getAsistenciasPorParcial:', e); return []; }
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
    const matricula      = row['Matricula'] || row['matricula'] || null;
    const curp           = row['CURP'] || row['Curp'] || row['curp'] || null;
    const codigo_acceso  = row['Codigo'] || row['Nip'] || crypto.randomUUID();
    if (nombre) {
      await supabase.from('alumnos').upsert(
        { nombre_completo: nombre, grado, grupo, matricula, curp, codigo_acceso },
        { onConflict: 'matricula' }
      );
      count++;
    }
  }
  return { success: true, message: `Se procesaron ${count} alumnos del Excel.` };
}

// ─── 18. LOGIN DE ALUMNO (Matrícula + CURP) ───────────────────────────────────
export async function loginAlumno(matricula, curp) {
  try {
    const { data, error } = await supabase
      .from('alumnos')
      .select('id, nombre_completo, grado, grupo, matricula, curp, codigo_acceso')
      .eq('matricula', matricula.trim().toUpperCase())
      .eq('curp', curp.trim().toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) return { success: false, error: 'Matrícula o CURP incorrectos.' };
    return { success: true, alumno: data };
  } catch (e) { console.error('loginAlumno:', e); return { success: false, error: e.message }; }
}

// ─── 19. MIS ASISTENCIAS (vista del alumno) ───────────────────────────────────
export async function getMisAsistencias(alumnoId) {
  try {
    const { data, error } = await supabase
      .from('asistencias')
      .select('id, date, entry_time, status, parcial_id, parciales(nombre, fecha_inicio, fecha_fin)')
      .eq('student_id', alumnoId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) { console.error('getMisAsistencias:', e); return []; }
}

