import { motion } from 'framer-motion';
export default function ProgressCard({ job }) {
  const done = job.status === 'done', pct = Math.round(job.percent || 0);
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div className={'h-full rounded-full bg-gradient-to-r from-accent via-aqua to-accent ' + (done ? '' : 'shimmer')}
          animate={{ width: pct + '%' }} transition={{ type: 'spring', stiffness: 110, damping: 20 }} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-white/70" role="status">
        {done ? (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ee0cf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M5 12l5 5 9-10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
            </svg>
            <span>Saved {job.name}</span>
          </>
        ) : <span>{job.stage || 'Starting'} {pct}%</span>}
      </div>
    </motion.div>
  );
}
