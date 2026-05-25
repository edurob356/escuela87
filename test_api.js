const url = 'https://krgyqrebnfwzplpayitx.supabase.co/rest/v1/alumnos?select=*&or=(matricula.eq.ROVE080828HNLBZDA4,curp.eq.ROVE080828HNLBZDA4)';
const key = 'sb_publishable_Z1CnbY2zxmyjom4dO9YCZw_-t0fLlIM';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d, null, 2)))
.catch(console.error);
