"use client";

import React from "react";

type Props = {
  password: string;
  className?: string;
};

export function PasswordStrengthMeter({ password, className }: Props) {
  const getStrength = (password: string) => {
    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    return score;
  };

  const strength = getStrength(password);
  const percent = (strength / 5) * 100;
  const getColor = () => {
    if (percent < 40) return "bg-red-500";
    if (percent < 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="mt-1">
      <div className={`h-2 w-full bg-gray-200 rounded ${className}`}>
        <div
          className={`h-2 rounded transition-all duration-300 ${getColor()}`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
      <p className="text-xs mt-1 text-muted-foreground">
        Robustesse :{" "}
        <strong>
          {strength <= 1 ? "Très faible" : strength <= 3 ? "Moyenne" : "Forte"}
        </strong>
      </p>
    </div>
  );
}
