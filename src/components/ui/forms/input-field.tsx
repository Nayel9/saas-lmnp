import React from "react";

type InputVariant = "default" | "ghost" | "contrast";

type InputFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  variant?: InputVariant;
  autoComplete?: string;
};

const variantClasses: Record<InputVariant, string> = {
  default: "bg-bg",
  ghost: "bg-transparent",
  contrast: "bg-white",
};

export function InputField({
  id,
  label,
  type = "text",
  value,
  placeholder,
  disabled = false,
  error,
  onChange,
  className = "",
  variant = "default",
  autoComplete = "off",
}: InputFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`input ${variantClasses[variant]} ${error ? "!border-red-500" : ""} ${className}`}
        autoComplete={autoComplete}
      />
      {error && (
        <p className="text-red-500 text-xs mt-1" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
