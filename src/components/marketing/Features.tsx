import React from "react";
import { CheckCircle, Shield, FileSpreadsheet, Calculator } from "lucide-react";

interface FeatureItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}

const items: FeatureItem[] = [
  {
    icon: CheckCircle,
    title: "Ultra-simple",
    desc: "Interface épurée pensée pour aller à l’essentiel.",
  },
  {
    icon: Calculator,
    title: "Automatisé",
    desc: "Amortissements et totaux générés sans Excel.",
  },
  {
    icon: FileSpreadsheet,
    title: "Exports fiscaux",
    desc: "2033C / 2033E / 2033A en quelques clics.",
  },
  {
    icon: Shield,
    title: "Sécurité",
    desc: "Données isolées et chiffrées (Supabase Postgres).",
  },
  {
    icon: CheckCircle,
    title: "100% LMNP",
    desc: "Spécialement adapté au régime réel simplifié.",
  },
];

export function Features() {
  return (
    <section
      className="py-16 px-4 bg-bg-muted"
      aria-labelledby="features-title"
    >
      <div className="max-w-5xl mx-auto">
        <h2
          id="features-title"
          className="text-2xl md:text-3xl font-semibold tracking-tight mb-10 text-center"
        >
          Pourquoi choisir LMNP App ?
        </h2>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f, i) => (
            <li key={i} className="card flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <f.icon className="w-6 h-6 text-brand" aria-hidden="true" />
                <h3 className="text-lg font-medium">{f.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
