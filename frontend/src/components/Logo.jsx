import React from 'react';
import { Boxes } from 'lucide-react';

export default function Logo({ size = 'md' }) {
  const sizes = {
    sm: { icon: 16, text: 'text-sm' },
    md: { icon: 20, text: 'text-lg' },
    lg: { icon: 28, text: 'text-2xl' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2 select-none">
      <div className="flex items-center justify-center rounded-md bg-accent/10 border border-accent/30 p-1.5">
        <Boxes size={s.icon} className="text-accent" strokeWidth={2.25} />
      </div>
      <span className={`font-display font-semibold tracking-tight text-white ${s.text}`}>
        Cura<span className="text-accent">Labs</span>3D
      </span>
    </div>
  );
}
