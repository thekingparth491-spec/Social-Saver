import { motion } from 'framer-motion';
// Segmented control with a spring-animated active pill (shared layout animation)
export default function SlidingTabs({ id, items, value, onChange }) {
  return (
    <div role="tablist" className="glass relative flex rounded-xl p-1">
      {items.map(it => {
        const on = it.value === value;
        return (
          <button key={it.value} role="tab" aria-selected={on} onClick={() => onChange(it.value)}
            className="relative flex-1 rounded-lg px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-aqua">
            {on && <motion.span layoutId={id} className="absolute inset-0 rounded-lg bg-accent"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span className={'relative ' + (on ? 'text-white' : 'text-white/60')}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
