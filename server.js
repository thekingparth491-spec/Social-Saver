const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const PORT = process.env.PORT || 3000;
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG = process.env.FFMPEG_PATH || '';
const WA_DIR = process.env.WA_STATUS_DIR || '';
const ALLOWED = [
  'youtube.com', 'youtu.be', 'instagram.com',
  'facebook.com', 'fb.watch', 'fb.com'
];

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(['/api/info', '/api/prepare'], rateLimit({ windowMs: 60_000, max: Number(process.env.RATE_LIMIT || 20) }));
app.use(express.static(path.join(__dirname, 'public')));

function platformOf(raw) {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.replace(/^(www|m|web|mbasic)\./, '');
    const hit = ALLOWED.find(d => host === d || host.endsWith('.' + d));
    if (!hit) return null;
    if (hit.includes('youtu')) return 'youtube';
    if (hit.includes('insta')) return 'instagram';
    return 'facebook';
  } catch { return null; }
}

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(YTDLP, args);
    let out = '', err = '';
    p.stdout.on('data', d => (out += d));
    p.stderr.on('data', d => (err += d));
    p.on('error', e => reject(new Error('yt-dlp not found. Install it and set YTDLP_PATH.')));
    p.on('close', c => (c === 0 ? resolve(out) : reject(new Error(err.split('\n').filter(Boolean).pop() || 'yt-dlp failed'))));
  });
}

const safeName = s => (s || 'video').replace(/[^\w\- ]+/g, '').trim().slice(0, 80) || 'video';

// Health
app.get('/api/health', (_, res) => {
  const f = spawn(FFMPEG ? path.join(FFMPEG, 'ffmpeg') : 'ffmpeg', ['-version']);
  let has = true;
  f.on('error', () => { has = false; res.json({ ok: true, ffmpeg: false, whatsapp: !!WA_DIR }); });
  f.on('close', c => has && res.json({ ok: true, ffmpeg: c === 0, whatsapp: !!WA_DIR }));
});

// Fallback provider: Apify actor andryerica/all-video-downloader (used only if yt-dlp fails)
const APIFY_TOKEN = process.env.APIFY_TOKEN || '';
const APIFY_BASE = process.env.APIFY_BASE || 'https://api.apify.com/v2';
const apifyCache = new Map();

async function apifyInfo(url) {
  const r = await fetch(`${APIFY_BASE}/acts/andryerica~all-video-downloader/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, max_formats: 20 })
  });
  if (!r.ok) throw new Error('Apify fallback failed (' + r.status + ').');
  const items = await r.json();
  const it = Array.isArray(items) ? items[0] : items;
  if (!it) throw new Error('Apify fallback returned no data.');
  const formats = (it.formats || []).filter(f => f && /^https?:\/\//.test(f.url || ''));
  if (!formats.length && /^https?:\/\//.test(it.url || '')) formats.push({ url: it.url, ext: it.ext || 'mp4', height: it.height, acodec: 'aac' });
  if (!formats.length) throw new Error('Apify fallback found no downloadable formats.');
  return { ...it, formats };
}

function pickApify(formats, type, h) {
  const sizeOf = f => f.tbr || f.abr || 0;
  if (type === 'audio') {
    const a = formats.filter(f => f.vcodec === 'none' || (!f.height && f.acodec && f.acodec !== 'none'));
    return (a.length ? a : formats).sort((x, y) => sizeOf(y) - sizeOf(x))[0];
  }
  const withH = formats.filter(f => f.height && (!h || f.height <= h));
  const prog = withH.filter(f => f.acodec && f.acodec !== 'none');
  return (prog.length ? prog : withH.length ? withH : formats).sort((x, y) => (y.height || 0) - (x.height || 0) || sizeOf(y) - sizeOf(x))[0];
}

// Video metadata
app.post('/api/info', async (req, res) => {
  const url = (req.body && req.body.url || '').trim();
  const platform = platformOf(url);
  if (!platform) return res.status(400).json({ error: 'Unsupported or invalid URL.' });
  try {
    const j = JSON.parse(await run(['-J', '--no-playlist', '--no-warnings', url]));
    const fs_ = f => f.filesize || f.filesize_approx || 0;
    const byH = {};
    let audioSize = 0;
    for (const f of j.formats || []) {
      if (f.vcodec && f.vcodec !== 'none' && f.height) byH[f.height] = Math.max(byH[f.height] || 0, fs_(f));
      else if (f.acodec && f.acodec !== 'none') audioSize = Math.max(audioSize, fs_(f));
    }
    const qualities = Object.keys(byH).map(Number).sort((a, b) => b - a)
      .map(h => ({ height: h, size: byH[h] ? byH[h] + audioSize : 0 }));
    res.json({ platform, provider: 'yt-dlp', title: j.title, thumbnail: j.thumbnail, duration: j.duration, uploader: j.uploader, qualities });
  } catch (e) {
    if (!APIFY_TOKEN) return res.status(502).json({ error: e.message });
    try {
      const it = await apifyInfo(url);
      apifyCache.set(url, { it, at: Date.now() });
      setTimeout(() => apifyCache.delete(url), 20 * 60_000);
      const byH = {};
      for (const f of it.formats) if (f.height) byH[f.height] = Math.max(byH[f.height] || 0, f.filesize || f.filesize_approx || 0);
      const qualities = Object.keys(byH).map(Number).sort((a, b) => b - a).map(h => ({ height: h, size: byH[h] }));
      res.json({ platform, provider: 'apify', title: it.title, thumbnail: it.thumbnail, duration: it.duration, uploader: it.uploader || it.channel, qualities });
    } catch (e2) { res.status(502).json({ error: e.message + ' (fallback: ' + e2.message + ')' }); }
  }
});

// Download jobs: POST /api/prepare -> poll /api/progress/:id -> GET /api/file/:id
const TMP = path.join(os.tmpdir(), 'socialsave');
fs.mkdirSync(TMP, { recursive: true });
const jobs = new Map();

app.post('/api/prepare', (req, res) => {
  const { url = '', type = 'video', height, format = 'mp3', bitrate = '192', provider } = req.body || {};
  if (!platformOf(url)) return res.status(400).json({ error: 'Unsupported or invalid URL.' });
  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(TMP, id);
  fs.mkdirSync(dir);
  const args = ['--no-playlist', '--no-warnings', '--newline', '--windows-filenames',
    '-o', path.join(dir, '%(title).80s.%(ext)s')];
  if (FFMPEG) args.push('--ffmpeg-location', FFMPEG);
  if (type === 'audio') {
    const fmt = ['mp3', 'm4a', 'opus', 'wav'].includes(format) ? format : 'mp3';
    const br = ['64', '128', '192', '256', '320'].includes(String(bitrate)) ? bitrate + 'K' : '192K';
    args.push('-f', 'bestaudio/best', '-x', '--audio-format', fmt, '--audio-quality', br);
  } else {
    const h = parseInt(height, 10);
    const cap = h ? `[height<=${h}]` : '';
    args.push('-f', `bv*${cap}+ba/b${cap}/b`, '--merge-output-format', 'mp4');
  }
  args.push(url);
  const job = { status: 'running', percent: 0, stage: 'Downloading', dir };
  jobs.set(id, job);
  setTimeout(() => { jobs.delete(id); fs.rm(dir, { recursive: true, force: true }, () => {}); }, 20 * 60_000);
  if (provider === 'apify' && apifyCache.has(url)) {
    const { it } = apifyCache.get(url);
    const f = pickApify(it.formats, type, parseInt(height, 10));
    const name = safeName(it.title) + '.' + (f.ext || (type === 'audio' ? 'm4a' : 'mp4'));
    const file = path.join(dir, name);
    let got = 0;
    fetch(f.url).then(async r => {
      if (!r.ok || !r.body) throw new Error('Source returned ' + r.status);
      const total = Number(r.headers.get('content-length')) || 0;
      const counter = new Transform({ transform(c, _, cb) { got += c.length; if (total) job.percent = Math.min(99, got / total * 100); cb(null, c); } });
      await pipeline(Readable.fromWeb(r.body), counter, fs.createWriteStream(file));
      Object.assign(job, { status: 'done', percent: 100, file, name });
    }).catch(e => { job.status = 'error'; job.error = e.message; });
    return res.json({ id });
  }
  const p = spawn(YTDLP, args);
  let err = '';
  p.stdout.on('data', d => {
    const m = String(d).match(/\[download\]\s+([\d.]+)%/g);
    if (m) job.percent = Math.min(99, parseFloat(m[m.length - 1].match(/([\d.]+)%/)[1]));
    if (/\[(Merger|ExtractAudio|VideoConvertor|ffmpeg)\]/.test(d)) { job.stage = 'Converting'; job.percent = 99; }
  });
  p.stderr.on('data', d => (err += d));
  p.on('error', () => { job.status = 'error'; job.error = 'yt-dlp not found. Install it and set YTDLP_PATH.'; });
  p.on('close', code => {
    if (job.status === 'error') return;
    const file = fs.readdirSync(dir).find(f => !f.endsWith('.part') && !f.endsWith('.ytdl'));
    if (code === 0 && file) { job.status = 'done'; job.percent = 100; job.file = path.join(dir, file); job.name = file; }
    else { job.status = 'error'; job.error = err.split('\n').filter(Boolean).pop() || 'Download failed.'; }
  });
  res.json({ id });
});

app.get('/api/progress/:id', (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: 'Job expired.' });
  res.json({ status: j.status, percent: j.percent, stage: j.stage, error: j.error, name: j.name });
});

app.get('/api/file/:id', (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j || j.status !== 'done') return res.status(404).json({ error: 'File not ready.' });
  res.download(j.file, j.name);
});

// WhatsApp status (local folder)
const waOk = f => /\.(mp4|jpg|jpeg|png|gif)$/i.test(f);
app.get('/api/whatsapp/list', (_, res) => {
  if (!WA_DIR) return res.status(501).json({ error: 'Set WA_STATUS_DIR in .env to enable WhatsApp status.' });
  try {
    const files = fs.readdirSync(WA_DIR).filter(waOk).map(name => {
      const s = fs.statSync(path.join(WA_DIR, name));
      return { name, size: s.size, modified: s.mtimeMs, video: /\.mp4$/i.test(name) };
    }).sort((a, b) => b.modified - a.modified);
    res.json({ files });
  } catch (e) { res.status(500).json({ error: 'Cannot read WA_STATUS_DIR: ' + e.message }); }
});
app.get('/api/whatsapp/file/:name', (req, res) => {
  if (!WA_DIR) return res.status(501).json({ error: 'WhatsApp folder not configured.' });
  const name = path.basename(req.params.name);
  if (!waOk(name)) return res.status(400).json({ error: 'Bad file type.' });
  const full = path.join(WA_DIR, name);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Not found.' });
  if (req.query.dl) return res.download(full);
  res.sendFile(full);
});

app.listen(PORT, () => console.log(`SocialSave running on http://localhost:${PORT}`));
