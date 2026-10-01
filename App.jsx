import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SlidingTabs from './components/SlidingTabs.jsx';
import UrlInput from './components/UrlInput.jsx';
import MediaCard from './components/MediaCard.jsx';
import WhatsAppGrid from './components/WhatsAppGrid.jsx';
import { getInfo, prepare, progress } from './api.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rise = i => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.08, type: 'spring', stiffness: 200, damping: 22 } });

export default function App() {
  const [tab, setTab] = useState('link');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState(null);
  const [job, setJob] = useState(null);
  const [s, setS] = useState({ mode: 'video', height: '', format: 'mp3', bitrate: '192' });
  const set = p => setS(o => ({ ...o, ...p }));

  async function lookup(e) {
    e.preventDefault(); setBusy(true); setErr(''); setInfo(null); setJob(null);
    try { setInfo(await getInfo(url.trim())); } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  async function download() {
    setErr(''); setJob({ status: 'running', percent: 0, stage: 'Starting' });
    try {
      const { id } = await prepare({ provider: info.provider, url: url.trim(), type: s.mode, height: s.height, format: s.format, bitrate: s.bitrate });
      for (;;) {
        await sleep(800);
        const p = await progress(id);
        setJob(p);
        if (p.status === 'error') throw new Error(p.error);
        if (p.status === 'done') { window.location.href = '/api/file/' + id; break; }
      }
    } catch (x) { setJob(null); setErr(x.message); }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-10">
      <motion.h1 {...rise(0)} className="text-4xl font-bold leading-tight tracking-tight">Paste a link.<br />Pick the quality.</motion.h1>
      <motion.p {...rise(1)} className="mt-3 text-white/60">YouTube, Instagram and Facebook videos, or your WhatsApp statuses, saved as video or audio.</motion.p>
      <motion.div {...rise(2)} className="mt-6"><SlidingTabs id="tab" value={tab} onChange={setTab}
        items={[{ value: 'link', label: 'From a link' }, { value: 'wa', label: 'WhatsApp status' }]} /></motion.div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          {tab === 'link' ? (
            <>
              <div className="mt-4"><UrlInput value={url} onChange={setUrl} onSubmit={lookup} busy={busy} /></div>
              <AnimatePresence>{err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{err}</motion.p>}</AnimatePresence>
              {info && <MediaCard info={info} s={s} set={set} job={job} onDownload={download} />}
            </>
          ) : <WhatsAppGrid />}
        </motion.div>
      </AnimatePresence>
      <p className="mt-10 text-xs text-white/40">Only save content you own or have permission to download.</p>
    </main>
  );
}
