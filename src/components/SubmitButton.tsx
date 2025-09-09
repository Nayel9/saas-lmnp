"use client";
import React from "react";
import { useFormStatus } from "react-dom";

export function Spinner({
  className = "inline-block w-3 h-3 mr-2 animate-spin",
}: {
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  className = "btn",
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending && <Spinner />}
      {pending ? pendingLabel || "Patientez…" : children}
    </button>
  );
}
