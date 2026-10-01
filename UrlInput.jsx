import { motion } from 'framer-motion';
export default function UrlInput({ value, onChange, onSubmit, busy }) {
  const paste = async () => { try { onChange(await navigator.clipboard.readText()); } catch {} };
  return (
    <form onSubmit={onSubmit} className="glass flex items-center gap-2 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-accent">
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="Paste a YouTube, Instagram or Facebook link"
        aria-label="Video link" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base outline-none placeholder:text-white/40" />
      <button type="button" onClick={paste} className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10">Paste</button>
      <motion.button whileTap={{ scale: 0.95 }} disabled={busy || !value.trim()}
        className="rounded-xl bg-accent px-5 py-3 font-semibold disabled:opacity-40">
        {busy ? 'Looking…' : 'Get video'}
      </motion.button>
    </form>
  );
}
