import { AnimatePresence, motion } from 'framer-motion';
import SlidingTabs from './SlidingTabs.jsx';
import ChipGroup from './ChipGroup.jsx';
import ProgressCard from './ProgressCard.jsx';
import { fmtSize } from '../api.js';

export default function MediaCard({ info, s, set, job, onDownload }) {
  const qualities = [{ value: '', label: 'Best', hint: 'highest available' },
    ...info.qualities.map(q => ({ value: q.height, label: q.height + 'p', hint: fmtSize(q.size) && '~' + fmtSize(q.size) }))];
  const running = job && job.status !== 'done';
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="glass mt-6 overflow-hidden rounded-2xl">
      {info.thumbnail && <img src={info.thumbnail} alt="" referrerPolicy="no-referrer" className="aspect-video w-full object-cover" />}
      <div className="p-5">
        <h2 className="text-lg font-semibold leading-snug">{info.title}</h2>
        <p className="mt-1 text-sm text-white/50">{info.uploader} on {info.platform}</p>
        {info.provider === 'apify' && <p className="mt-2 rounded-lg bg-aqua/10 px-3 py-2 text-xs text-aqua">Loaded through the Apify fallback. Files save in their original format, so audio format and bitrate don't apply.</p>}
        <div className="mt-4"><SlidingTabs id="mode" value={s.mode} onChange={v => set({ mode: v })}
          items={[{ value: 'video', label: 'Video' }, { value: 'audio', label: 'Audio' }]} /></div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={s.mode} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="mt-4 space-y-4">
            {s.mode === 'video'
              ? <ChipGroup id="q" items={qualities} value={s.height} onChange={v => set({ height: v })} />
              : <>
                <ChipGroup id="f" value={s.format} onChange={v => set({ format: v })} items={['mp3', 'm4a', 'opus', 'wav'].map(v => ({ value: v, label: v }))} />
                <ChipGroup id="b" value={s.bitrate} onChange={v => set({ bitrate: v })} items={['64', '128', '192', '256', '320'].map(v => ({ value: v, label: v, hint: 'kbps' }))} />
              </>}
          </motion.div>
        </AnimatePresence>
        <motion.button whileTap={{ scale: 0.97 }} disabled={running} onClick={onDownload}
          className="mt-5 w-full rounded-xl bg-accent py-3 font-semibold disabled:opacity-50">
          {running ? 'Working…' : s.mode === 'video' ? 'Download video' : 'Download audio'}
        </motion.button>
        {job && <ProgressCard job={job} />}
      </div>
    </motion.section>
  );
}
