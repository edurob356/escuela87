/**
 * NUEVO CLIENTE API - CONEXIÓN POSTGRESQL LOCAL
 * Este archivo reemplaza a supabase-client.js
 */
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';

// 1. Login de Alumno
export async function studentLogin(matricula, codigoAcceso) {
  try {
    const res = await fetch(`${API_URL}/login/student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matricula, codigoAcceso })
    });
    const data = await res.json();
    return data.success ? data.user : null;
  } catch (error) {
    console.error("Error en studentLogin:", error);
    return null;
  }
}

// 1.1 Login de Personal (Director, Prefecto, Tutor)
export async function staffLogin(email, password) {
  try {
    const res = await fetch(`${API_URL}/login/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    return data.success ? data.user : null;
  } catch (error) {
    console.error("Error en staffLogin:", error);
    return null;
  }
}

// 2. Obtener resumen de estudiante
export async function getStudentSummary(studentId) {
  try {
    const res = await fetch(`${API_URL}/alumnos/${studentId}/resumen`);
    if (!res.ok) throw new Error("Network response was not ok");
    return await res.json();
  } catch (error) {
    console.error("Error en getStudentSummary:", error);
    return null;
  }
}

// 3. Obtener últimas asistencias
export async function getStudentAttendance(studentId) {
  try {
    const res = await fetch(`${API_URL}/alumnos/${studentId}/asistencias`);
    if (!res.ok) throw new Error("Network response was not ok");
    return await res.json();
  } catch (error) {
    console.error("Error en getStudentAttendance:", error);
    return [];
  }
}

// 4. Obtener avisos vigentes
export async function getAnnouncements() {
  try {
    const res = await fetch(`${API_URL}/anuncios`);
    if (!res.ok) throw new Error("Network response was not ok");
    return await res.json();
  } catch (error) {
    console.error("Error en getAnnouncements:", error);
    return [];
  }
}

export async function createAnnouncement(title, content="") {
  try {
    const res = await fetch(`${API_URL}/anuncios`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content })
    });
    return await res.json();
  } catch(e) {
    console.error("Error en createAnnouncement:", e);
    return null;
  }
}

export async function deleteAnnouncement(id) {
  try {
    const res = await fetch(`${API_URL}/anuncios/${id}`, { method: "DELETE" });
    return res.ok;
  } catch(e) {
    console.error("Error en deleteAnnouncement:", e);
    return false;
  }
}
export async function getStats(grado = 'Todos los Grados') {
  try {
    const url = grado && grado !== 'Todos los Grados'
      ? `${API_URL}/stats/reportes?grado=${encodeURIComponent(grado)}`
      : `${API_URL}/stats/reportes`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    return await res.json();
  } catch (e) {
    console.error('Error en getStats:', e);
    return null;
  }
}

export async function getReportesDisciplina(studentId = null) {
  try {
    let url = `${API_URL}/reportes-disciplina`;
    if(studentId) url += `?student_id=${studentId}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Network error");
    return await res.json();
  } catch(e) {
    console.error("Error en getReportesDisciplina", e);
    return [];
  }
}

// Búsqueda de alumnos por nombre/matrícula y filtros de grado/grupo
export async function searchStudents(q = '', grado = '', grupo = '') {
  try {
    const params = new URLSearchParams();
    if (q)     params.set('q', q);
    if (grado) params.set('grado', grado);
    if (grupo) params.set('grupo', grupo);
    const res = await fetch(`${API_URL}/search/alumnos?${params.toString()}`);
    if (!res.ok) throw new Error('Network error');
    return await res.json();
  } catch (e) {
    console.error('Error en searchStudents:', e);
    return [];
  }
}

export async function createReporteDisciplina(studentId, tipo, descripcion, reportaPor) {
  try {
    const res = await fetch(`${API_URL}/reportes-disciplina`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, tipo, descripcion, reporta_por: reportaPor })
    });
    return await res.json();
  } catch(e) {
    console.error("Error en createReporteDisciplina", e);
    return null;
  }
}
