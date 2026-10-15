import type { Status } from '../../hooks/export/useExportActions';

export function StatusBanner({ status }: { status: Status }) {
  if (!status) return null;
  const tone = status.type === 'ok'
    ? 'border-emerald-900/30 bg-emerald-950/30 text-emerald-300'
    : 'border-red-900/40 bg-red-950/30 text-red-200';
  return <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${tone}`}>{status.text}</div>;
}