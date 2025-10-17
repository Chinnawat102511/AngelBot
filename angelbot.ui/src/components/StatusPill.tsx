import React from 'react';

export default function StatusPill({
  ok,
  labelTrue = 'Connected',
  labelFalse = 'Disconnected',
}: {
  ok: boolean;
  labelTrue?: string;
  labelFalse?: string;
}) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ' +
        (ok
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200')
      }
    >
      <span
        className={
          'mr-1 h-1.5 w-1.5 rounded-full ' + (ok ? 'bg-emerald-600' : 'bg-rose-600')
        }
      />
      {ok ? labelTrue : labelFalse}
    </span>
  );
}
