import React from 'react';

const STYLES = {
  PENDING_APPROVAL: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  REJECTED: 'bg-red-500/10 text-red-400 border border-red-500/30',
  SUSPENDED: 'bg-white/5 text-white/40 border border-white/10',
};

const LABELS = {
  PENDING_APPROVAL: 'Aguardando aprovação',
  ACTIVE: 'Ativo',
  REJECTED: 'Rejeitado',
  SUSPENDED: 'Suspenso',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ${STYLES[status] || STYLES.SUSPENDED}`}>
      {LABELS[status] || status}
    </span>
  );
}
