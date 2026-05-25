import { supabase } from './assets/js/api-client.js';

async function test() {
  const { data, error } = await supabase
    .from('alumnos')
    .select('*')
    .or(`matricula.ilike.%ROVE080828HNLBZDA4%,curp.ilike.%ROVE080828HNLBZDA4%`);
  console.log(JSON.stringify({ data, error }, null, 2));
}
test();
