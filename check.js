/**
 * VERIFICACIÓN DE CONEXIÓN A SUPABASE
 *
 * Ejecuta: node check.js
 * Verifica que las variables de entorno y la conexión a Supabase funcionen.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('❌ Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function verificar() {
  console.log('🔗 Conectando a Supabase:', url);

  // Verificar tabla alumnos
  const { data: alumnos, error: errAlumnos } = await supabase
    .from('alumnos')
    .select('id, nombre_completo, grado, grupo')
    .limit(5);

  if (errAlumnos) {
    console.error('❌ Error al leer tabla alumnos:', errAlumnos.message);
  } else {
    console.log(`✅ Tabla alumnos OK — ${alumnos.length} registros (muestra)`);
    alumnos.forEach(a => console.log(`   • ${a.nombre_completo} | ${a.grado}° ${a.grupo}`));
  }

  // Verificar tabla asistencias
  const { count, error: errAsis } = await supabase
    .from('asistencias')
    .select('*', { count: 'exact', head: true });

  if (errAsis) {
    console.error('❌ Error al leer tabla asistencias:', errAsis.message);
  } else {
    console.log(`✅ Tabla asistencias OK — ${count} registros totales`);
  }

  // Verificar tabla anuncios
  const { data: anuncios, error: errAnun } = await supabase
    .from('anuncios')
    .select('id, title')
    .limit(3);

  if (errAnun) {
    console.error('❌ Error al leer tabla anuncios:', errAnun.message);
  } else {
    console.log(`✅ Tabla anuncios OK — ${anuncios.length} registros`);
  }

  console.log('\n🎉 Verificación completa. Supabase conectado correctamente.');
}

verificar().catch(err => {
  console.error('❌ Error inesperado:', err.message);
  process.exit(1);
});
