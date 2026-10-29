import { EXPORT_FORMATS, type ExportFormat } from '../../services/exportService';
import { labelClass, sectionClass } from '../../utils/export/ui';

export function FormatPicker({ value, onChange }: { value: ExportFormat; onChange: (f: ExportFormat) => void }) {
  return (
    <section className={sectionClass}>
      <span className={labelClass}>Format</span>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {EXPORT_FORMATS.map((item) => {
          const active = value === item.key;
          return (
            <button key={item.key} type="button" onClick={() => onChange(item.key)} aria-pressed={active}
              className={`text-left rounded-2xl border p-3 transition cursor-pointer ${
                active ? 'bg-amber-900/60 border-amber-600 text-amber-50'
                       : 'bg-neutral-900 border-amber-900/30 text-amber-200 hover:border-amber-700/60'}`}>
              <div className="flex items-center gap-2 font-semibold text-sm sm:text-base">
                <span aria-hidden className="text-lg">{item.icon}</span>{item.label}
              </div>
              <p className="mt-1 text-[11px] sm:text-xs text-amber-200/50 leading-snug">{item.hint}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}