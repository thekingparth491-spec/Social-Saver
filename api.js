const j = async r => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
};
const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(j);
export const getInfo = url => post('/api/info', { url });
export const prepare = body => post('/api/prepare', body);
export const progress = id => fetch('/api/progress/' + id).then(j);
export const waList = () => fetch('/api/whatsapp/list').then(j);
export const fmtSize = b => (!b ? '' : b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.round(b / 1e6) + ' MB');
