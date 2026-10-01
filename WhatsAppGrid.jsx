import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { waList } from '../api.js';
export default function WhatsAppGrid() {
  const [files, setFiles] = useState(null), [err, setErr] = useState('');
  useEffect(() => { waList().then(d => setFiles(d.files)).catch(e => setErr(e.message)); }, []);
  if (err) return <p className="mt-6 text-sm text-red-300">{err}</p>;
  if (!files) return <p className="mt-6 text-white/50">Loading statuses…</p>;
  if (!files.length) return <p className="mt-6 text-white/50">No statuses found. Open a status in WhatsApp first, then reload.</p>;
  return (
    <motion.div className="mt-6 grid grid-cols-2 gap-3" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05 } } }}>
      {files.map(f => {
        const u = '/api/whatsapp/file/' + encodeURIComponent(f.name);
        return (
          <motion.div key={f.name} variants={{ h: { opacity: 0, scale: 0.94 }, s: { opacity: 1, scale: 1 } }} className="glass overflow-hidden rounded-xl">
            {f.video ? <video src={u} controls preload="metadata" className="aspect-[3/4] w-full object-cover" />
              : <img src={u} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />}
            <a href={u + '?dl=1'} className="block py-2 text-center text-sm font-medium hover:bg-white/10">Save</a>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
