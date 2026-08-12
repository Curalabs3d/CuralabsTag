import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Campo de senha com botão de mostrar/ocultar. Aceita as mesmas props de
// um <input>, além de label/className opcionais para se encaixar nos
// formulários existentes sem duplicar essa lógica em cada tela.
export default function PasswordField({ label, value, onChange, placeholder = '••••••••', required, minLength, autoComplete }) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      {label && <label className="label-field">{label}</label>}
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="input-field pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
          tabIndex={-1}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
