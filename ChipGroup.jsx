import { motion } from 'framer-motion';
// Option chips; the selection ring glides between chips
export default function ChipGroup({ id, items, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(it => {
        const on = String(it.value) === String(value);
        return (
          <button key={it.value} onClick={() => onChange(String(it.value))} aria-pressed={on}
            className="glass relative rounded-lg px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-aqua">
            {on && <motion.span layoutId={id} className="absolute inset-0 rounded-lg border-2 border-aqua bg-aqua/10"
              transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
            <span className="relative block font-medium">{it.label}</span>
            {it.hint && <span className="relative block text-xs text-white/50">{it.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
