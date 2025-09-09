import React from "react";
import Link from "next/link";

interface Plan {
  name: string;
  price: string;
  period?: string;
  features: string[];
  highlight?: boolean;
  ctaLabel: string;
}

const plans: Plan[] = [
  {
    name: "Gratuit",
    price: "0€",
    period: "",
    features: ["20 écritures", "1 utilisateur", "Essai illimité"],
    ctaLabel: "Choisir",
  },
  {
    name: "Essentiel",
    price: "99€",
    period: "/an",
    features: ["1 bien", "Amortissements", "Exports fiscaux"],
    highlight: true,
    ctaLabel: "Choisir",
  },
  {
    name: "Pro",
    price: "179€",
    period: "/an",
    features: ["Multi-biens", "Exports avancés", "Support prioritaire"],
    ctaLabel: "Choisir",
  },
];

export function Pricing({ authenticated }: { authenticated: boolean }) {
  return (
    <section className="py-20 px-4" aria-labelledby="pricing-title">
      <div className="max-w-5xl mx-auto">
        <h2
          id="pricing-title"
          className="text-2xl md:text-3xl font-semibold tracking-tight text-center mb-12"
        >
          Tarifs transparents
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`card flex flex-col ${plan.highlight ? "ring-2 ring-[--color-ring]" : ""}`}
            >
              <h3 className="text-xl font-semibold tracking-tight mb-1">
                {plan.name}
              </h3>
              <p className="text-3xl font-semibold mb-4">
                {plan.price}
                <span className="text-base font-normal text-muted-foreground">
                  {plan.period}
                </span>
              </p>
              <ul
                className="flex-1 space-y-2 text-sm mb-6"
                aria-label={`Avantages plan ${plan.name}`}
              >
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-brand">
                      •
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={authenticated ? "/dashboard" : "/login"}
                className="btn-primary"
                aria-label={`Choisir le plan ${plan.name}`}
              >
                {plan.ctaLabel}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
