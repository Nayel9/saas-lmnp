import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type InputVariant = 'default' | 'ghost' | 'contrast'

type PasswordFieldProps = {
  id: string
  label: string
  value: string
  placeholder?: string
  disabled?: boolean
  error?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
  variant?: InputVariant
  autoComplete?: string
}

const variantClasses: Record<InputVariant,string> = {
  default: 'bg-bg',
  ghost: 'bg-transparent',
  contrast: 'bg-white'
};

export function PasswordField({
  id,
  label,
  value,
  placeholder,
  disabled = false,
  error,
  onChange,
  className = '',
  variant = 'default',
  autoComplete = 'off',
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-sm font-medium mb-1">{label}</label>
      <input
        id={id}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`input pr-11 ${variantClasses[variant]} ${error ? '!border-red-500' : ''} ${className}`}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShowPassword(p=>!p)}
        className="absolute top-[43%] -translate-x-10 inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-muted focus-visible:ring-2 ring-[--color-ring] outline-none transition-colors"
        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={showPassword}
        title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      {error && (
        <p className="text-red-500 text-xs mt-1" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
