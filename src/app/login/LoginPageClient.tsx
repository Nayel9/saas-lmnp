"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { z } from "zod";
import { InputField } from "@/components/ui/forms/input-field";
import { PasswordField } from "@/components/ui/forms/password-field";
import { PasswordStrengthMeter } from "@/components/ui/forms/password-strength-meter";
import SignupVerifyModal from "@/components/auth/SignupVerifyModal";
import { FcGoogle } from "react-icons/fc";
import { FaLinkedin } from "react-icons/fa6";
import TWSpinner from "@/components/ui/loader/spinner";

type Mode = "login" | "signup";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Min 8 caractères"),
});
const signupSchema = loginSchema
  .extend({
    confirmPassword: z.string().min(8, "Min 8 caractères"),
    firstName: z.string().min(1, "Requis").max(50),
    lastName: z.string().min(1, "Requis").max(60),
    phone: z
      .string()
      .trim()
      .min(5, "Requis")
      .max(30)
      .regex(/^[+0-9 ()-]*$/, "Format invalide"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas",
  });

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  global?: string;
  terms?: string; // ajout
}

export default function LoginPageClient() {
  const router = useRouter();
  const { status } = useSession();
  const search = useSearchParams();
  const verifiedParam = search?.get("verified");

  const [mode, setMode] = useState<Mode>("login");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [resent, setResent] = useState(false);
  const [honeyValue, setHoneyValue] = useState("");
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false); // ajout état
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && !showVerifyModal)
      router.replace("/dashboard");
  }, [status, router, showVerifyModal]);

  useEffect(() => {
    if (search?.get("forceVerify") === "1") {
      setShowVerifyModal(true);
    }
  }, [search]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === "website") {
      setHoneyValue(value);
      return;
    }
    setFormData((f) => ({ ...f, [id]: value }));
    if (errors[id as keyof FormErrors])
      setErrors((prev) => ({ ...prev, [id]: undefined }));
    if (emailNotVerified) setEmailNotVerified(false);
    setSuccessMessage(null);
  };

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});
      setEmailNotVerified(false);
      setSuccessMessage(null);
      setIsBusy(true);

      try {
        if (honeyValue) {
          // Honeypot
          setTimeout(() => {
            router.push("/");
          }, 1200);
          return;
        }

        if (mode === "signup") {
          const parsed = signupSchema.safeParse(formData);
          if (!parsed.success) {
            const fieldErrors = parsed.error.flatten().fieldErrors;
            setErrors({
              email: fieldErrors.email?.[0],
              password: fieldErrors.password?.[0],
              confirmPassword: fieldErrors.confirmPassword?.[0],
              firstName: fieldErrors.firstName?.[0],
              lastName: fieldErrors.lastName?.[0],
              phone: fieldErrors.phone?.[0],
            });
            return;
          }
          if (!acceptTerms) {
            setErrors({
              terms: "Vous devez accepter les conditions pour créer un compte.",
            });
            return;
          }
          await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              firstName: formData.firstName,
              lastName: formData.lastName,
              phone: formData.phone,
              acceptTerms: true,
            }),
          });
          setShowVerifyModal(true);
          setFormData((f) => ({ ...f, password: "", confirmPassword: "" }));
        } else {
          const parsed = loginSchema.safeParse(formData);
          if (!parsed.success) {
            const fieldErrors = parsed.error.flatten().fieldErrors;
            setErrors({
              email: fieldErrors.email?.[0],
              password: fieldErrors.password?.[0],
            });
            return;
          }
          const res = await signIn("credentials", {
            email: formData.email,
            password: formData.password,
            redirect: false,
          });
          if (res?.error) {
            if (res.error === "EMAIL_NOT_VERIFIED") {
              setEmailNotVerified(true);
              setErrors({ global: "Votre email n'est pas vérifié." });
            } else {
              setErrors({ global: "Identifiants invalides" });
            }
            return;
          }
          router.push("/dashboard");
        }
      } catch {
        setErrors({ global: "Erreur serveur" });
      } finally {
        setIsBusy(false);
      }
    },
    [formData, honeyValue, mode, router, acceptTerms],
  );

  const resend = async () => {
    if (resent || !formData.email) return;
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });
      setResent(true);
      setErrors({ global: "Si un compte existe, un email a été envoyé." });
    } catch {
      /* ignore */
    }
  };

  const handleGoogleSignIn = async () => {
    setIsBusy(true);
    try {
      await signIn("google", { callbackUrl: "/auth/pending?to=/dashboard" });
    } catch (error) {
      console.error("Google sign-in failed:", error);
    } finally {
      setIsBusy(false);
    }
  };

  const handleLinkedInSignIn = async () => {
    setIsBusy(true);
    try {
      await signIn("linkedin", { callbackUrl: "/auth/pending?to=/dashboard" });
    } catch (error) {
      console.error("LinkedIn sign-in failed:", error);
    } finally {
      setIsBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  const showStrength = mode === "signup";

  return (
    <main
      id="main"
      className="min-h-screen flex flex-col items-center px-4 py-10"
    >
      <div
        className="w-full max-w-md card relative"
        role="region"
        aria-labelledby="auth-title"
      >
        {isBusy ? (
          <div className="flex flex-col items-center gap-3 w-full h-full max-w-md">
            <div className="text-brand">
              <TWSpinner />
            </div>
            <p className="text-xl text-muted-foreground">Chargement...</p>
          </div>
        ) : (
          <>
            <h1
              id="auth-title"
              className="text-xl font-semibold tracking-tight mb-2"
            >
              Authentification
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Accédez à votre espace.
            </p>
            <div
              className="flex items-center gap-2 mb-6"
              role="tablist"
              aria-label="Modes d'authentification"
            >
              <button
                type="button"
                role="tab"
                className={`btn text-sm px-3 py-1.5 ${mode === "login" ? "bg-bg-muted" : "btn-ghost"}`}
                onClick={() => {
                  setMode("login");
                  setErrors({});
                  setSuccessMessage(null);
                }}
                disabled={isBusy}
              >
                Se connecter
              </button>
              <button
                type="button"
                role="tab"
                className={`btn text-sm px-3 py-1.5 ${mode === "signup" ? "bg-bg-muted" : "btn-ghost"}`}
                onClick={() => {
                  setMode("signup");
                  setErrors({});
                  setSuccessMessage(null);
                  setEmailNotVerified(false);
                }}
                disabled={isBusy}
              >
                Créer un compte
              </button>
            </div>
            {verifiedParam === "1" && (
              <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-xs text-green-700">
                Email vérifié, vous pouvez maintenant vous connecter.
              </div>
            )}
            {verifiedParam === "0" && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                Lien invalide ou expiré, renvoyez un email de vérification.
              </div>
            )}
            {errors.global && (
              <div
                className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-600"
                role="alert"
              >
                {errors.global}
              </div>
            )}
            {successMessage && (
              <div
                className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-xs text-green-700"
                role="status"
              >
                {successMessage}
              </div>
            )}
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  overflow: "hidden",
                  height: 0,
                  width: 0,
                  clip: "rect(0 0 0 0)",
                  clipPath: "inset(50%)",
                  whiteSpace: "nowrap",
                }}
              >
                <label htmlFor="website">Ne pas remplir ce champ</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeyValue}
                  onChange={onChange}
                />
              </div>
              <InputField
                id="email"
                label="Email"
                type="email"
                value={formData.email}
                onChange={onChange}
                disabled={isBusy}
                error={errors.email}
                placeholder="vous@exemple.fr"
                autoComplete="email"
              />
              <PasswordField
                id="password"
                label="Mot de passe"
                value={formData.password}
                onChange={onChange}
                disabled={isBusy}
                error={errors.password}
                placeholder="••••••••"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
              {showStrength && (
                <PasswordStrengthMeter
                  password={formData.password}
                  className="bg-white"
                />
              )}
              {mode === "signup" && (
                <PasswordField
                  id="confirmPassword"
                  label="Confirmer le mot de passe"
                  value={formData.confirmPassword}
                  onChange={onChange}
                  disabled={isBusy}
                  error={errors.confirmPassword}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              )}

              {mode === "signup" && (
                <>
                  <InputField
                    id="firstName"
                    label="Prénom"
                    value={formData.firstName}
                    onChange={onChange}
                    disabled={isBusy}
                    error={errors.firstName}
                    placeholder="Votre prénom"
                    autoComplete="given-name"
                  />
                  <InputField
                    id="lastName"
                    label="Nom"
                    value={formData.lastName}
                    onChange={onChange}
                    disabled={isBusy}
                    error={errors.lastName}
                    placeholder="Votre nom"
                    autoComplete="family-name"
                  />
                  <InputField
                    id="phone"
                    label="Téléphone"
                    value={formData.phone}
                    onChange={onChange}
                    disabled={isBusy}
                    error={errors.phone}
                    placeholder="+33 ..."
                    autoComplete="tel"
                  />
                  <div className="flex items-start gap-2 text-xs mt-2">
                    <input
                      id="acceptTerms"
                      type="checkbox"
                      className="mt-0.5 cursor-pointer"
                      checked={acceptTerms}
                      onChange={(e) => {
                        setAcceptTerms(e.target.checked);
                        if (errors.terms)
                          setErrors((prev) => ({ ...prev, terms: undefined }));
                      }}
                    />
                    <label
                      htmlFor="acceptTerms"
                      className="cursor-pointer select-none leading-relaxed"
                    >
                      J`&#39;accepte les{" "}
                      <a
                        href="/cgv"
                        className="underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        CGV
                      </a>{" "}
                      et la{" "}
                      <a
                        href="/politique-confidentialite"
                        className="underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Politique de confidentialité
                      </a>
                    </label>
                  </div>
                  {errors.terms && (
                    <p className="text-red-600 text-[11px] mt-1" role="alert">
                      {errors.terms}
                    </p>
                  )}
                </>
              )}
              <button
                type="submit"
                disabled={isBusy || (mode === "signup" && !acceptTerms)}
                className="btn-primary h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-disabled={isBusy || (mode === "signup" && !acceptTerms)}
              >
                {isBusy
                  ? "…"
                  : mode === "login"
                    ? "Se connecter"
                    : "Créer le compte"}
              </button>
              {mode === "login" && (
                <div className="flex flex-col">
                  <p className="text-l text-center text-muted-foreground">
                    Ou se connecter avec :
                  </p>
                  <div
                    className="grid grid-cols-2 gap-2 mt-1"
                    aria-label="Boutons SSO"
                  >
                    <button
                      type="button"
                      className="btn bg-foreground hover:bg-muted-foreground cursor-pointer"
                      title="Connexion avec Google"
                      onClick={handleGoogleSignIn}
                    >
                      <FcGoogle size={28} />
                    </button>
                    <button
                      type="button"
                      className="btn bg-linkedin text-foreground hover:bg-foreground hover:text-linkedin cursor-pointer"
                      title="Connexion avec LinkedIn"
                      onClick={handleLinkedInSignIn}
                    >
                      <FaLinkedin size={28} />
                    </button>
                  </div>
                </div>
              )}
              {emailNotVerified && mode === "login" && (
                <button
                  type="button"
                  onClick={resend}
                  disabled={resent}
                  className="underline text-xs text-muted-foreground disabled:opacity-50 self-start"
                >
                  Renvoyer l&apos;email de vérification
                </button>
              )}
            </form>
            <div aria-live="polite" className="sr-only" />
            <hr className="my-6 border-border" />
            <div className="text-xs leading-relaxed text-muted-foreground">
              <h2 className="font-semibold mb-1 text-sm">Notes</h2>
              <ul className="list-disc pl-4 space-y-1">
                <li>Email vérifié requis avant première connexion.</li>
                <li>
                  Mot de passe: 8+ caractères (force affichée à
                  l&apos;inscription).
                </li>
                {/* Correction apostrophe */}
                <li className="hidden">Mot de passe info fallback</li>
                <li>
                  Les comptes existants peuvent demander un renvoi de mail si
                  non vérifiés.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
      <SignupVerifyModal
        opened={showVerifyModal}
        enablePolling={true}
        onClose={() => {
          console.log("[SignupVerifyModal] manual close");
          setShowVerifyModal(false);
        }}
        email={formData.email}
      />
    </main>
  );
}
