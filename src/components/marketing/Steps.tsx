import React from "react";

export function Steps() {
  const steps = [
    {
      title: "Enregistrez loyers & charges",
      desc: "Saisissez simplement vos flux: loyers, charges, achats, ventes.",
    },
    {
      title: "Amortissements automatiques",
      desc: "Vos immobilisations génèrent un plan d’amortissement linéaire prêt à l’export.",
    },
    {
      title: "Exports 2033C / 2033E / 2033A",
      desc: "Générez vos formulaires fiscaux en un clic pour votre liasse.",
    },
  ];
  return (
    <section className="py-16 px-4" aria-labelledby="steps-title">
      <div className="max-w-5xl mx-auto">
        <h2
          id="steps-title"
          className="text-2xl md:text-3xl font-semibold tracking-tight mb-12 text-center"
        >
          Comment ça marche ?
        </h2>
        <ol
          className="grid gap-8 md:grid-cols-3"
          aria-label="Étapes d'utilisation"
        >
          {steps.map((s, i) => (
            <li key={i} className="flex flex-col gap-3 card relative">
              <span
                className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-brand text-[--color-brand-foreground] flex items-center justify-center font-semibold shadow"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="text-lg font-medium">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
