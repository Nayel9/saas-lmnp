import type { Metadata } from "next";
import ResetPasswordForm from "./ResetPasswordForm";
import React, { Suspense } from "react";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe – LMNP App",
  description: "Définir un nouveau mot de passe après demande de réinitialisation",
};

export default function Page() {
  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-semibold mb-2">Réinitialiser le mot de passe</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Choisissez un nouveau mot de passe (minimum 8 caractères).
      </p>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
