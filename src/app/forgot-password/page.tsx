import type { Metadata } from "next";
import ForgotPasswordForm from "./ForgotPasswordForm";
import React from "react";

export const metadata: Metadata = {
  title: "Mot de passe oublié – LMNP App",
  description: "Demander un lien de réinitialisation de mot de passe.",
};

export default function Page() {
  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-semibold mb-2">Mot de passe oublié</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Entrez votre adresse email. Si un compte existe, un lien de réinitialisation vous sera envoyé (valide 30 min).
      </p>
      <ForgotPasswordForm />
    </div>
  );
}

