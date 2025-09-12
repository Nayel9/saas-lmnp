"use client";
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface WizardState { propertyId?: string; saleId?: string; assetId?: string; }

type StepKey = "property" | "sale" | "asset" | "done";

const assetCategories = [
  { value: "mobilier", label: "Mobilier" },
  { value: "batiment", label: "Bâtiment" },
  { value: "vehicule", label: "Véhicule" },
];

export default function OnboardingWizardPage() {
  const [step, setStep] = React.useState<StepKey>("property");
  const [state, setState] = React.useState<WizardState>({});
  const [loading, setLoading] = React.useState(false);

  // Form states
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [propForm, setPropForm] = React.useState({ label: "", startDate: today, iban: "", address: "" });
  const [saleForm, setSaleForm] = React.useState({ date: today, amountTTC: "", tenant: "", isDeposit: false });
  const [assetForm, setAssetForm] = React.useState({ category: "mobilier", label: "", costTTC: "", inServiceDate: today, durationMonths: "" });

  async function submitProperty(e: React.FormEvent) {
    e.preventDefault(); if (loading) return; setLoading(true);
    try {
      const res = await fetch("/api/onboarding/property", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: propForm.label, startDate: propForm.startDate, iban: propForm.iban || undefined, address: propForm.address || undefined }) });
      const json = await res.json();
      if (!res.ok || !json.ok) { toast("Erreur création bien"); return; }
      setState((s) => ({ ...s, propertyId: json.propertyId }));
      toast("Bien créé ✅");
      setStep("sale");
    } catch { toast("Erreur réseau"); } finally { setLoading(false); }
  }

  async function submitSale(e: React.FormEvent) {
    e.preventDefault(); if (loading || !state.propertyId) return; setLoading(true);
    try {
      const amount = parseFloat(saleForm.amountTTC.replace(/,/g, "."));
      const res = await fetch("/api/onboarding/sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: state.propertyId, date: saleForm.date, amountTTC: amount, tenant: saleForm.tenant, isDeposit: saleForm.isDeposit }) });
      const json = await res.json();
      if (!res.ok || !json.ok) { toast("Erreur création vente"); return; }
      setState((s) => ({ ...s, saleId: json.saleId }));
      toast("Vente ajoutée ✅");
      setStep("asset");
    } catch { toast("Erreur réseau"); } finally { setLoading(false); }
  }

  async function submitAsset(e: React.FormEvent) {
    e.preventDefault(); if (loading || !state.propertyId) return; setLoading(true);
    try {
      const cost = parseFloat(assetForm.costTTC.replace(/,/g, "."));
      const duration = assetForm.durationMonths ? parseInt(assetForm.durationMonths, 10) : undefined;
      const res = await fetch("/api/onboarding/asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: state.propertyId, category: assetForm.category, label: assetForm.label, costTTC: cost, inServiceDate: assetForm.inServiceDate, durationMonths: duration }) });
      const json = await res.json();
      if (!res.ok || !json.ok) { toast("Erreur création immobilisation"); return; }
      setState((s) => ({ ...s, assetId: json.assetId }));
      toast("Immobilisation créée ✅");
      setStep("done");
    } catch { toast("Erreur réseau"); } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Onboarding</h1>
          <p className="text-sm text-muted-foreground">3 étapes rapides pour démarrer</p>
        </header>
        <Stepper step={step} state={state} />
        {step === "property" && (
          <form onSubmit={submitProperty} className="card p-5 space-y-4" noValidate>
            <h2 className="font-medium">Étape 1 — Créer un bien</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="p_label">Nom</Label>
                <Input id="p_label" value={propForm.label} onChange={(e) => setPropForm((f) => ({ ...f, label: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p_start">Début activité</Label>
                <Input id="p_start" type="date" value={propForm.startDate} onChange={(e) => setPropForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p_iban">IBAN (option)</Label>
                <Input id="p_iban" value={propForm.iban} onChange={(e) => setPropForm((f) => ({ ...f, iban: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="p_address">Adresse (option)</Label>
                <Input id="p_address" value={propForm.address} onChange={(e) => setPropForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end">
              <button disabled={loading || !propForm.label.trim()} className="btn-primary">{loading ? "Création…" : "Créer et continuer"}</button>
            </div>
          </form>
        )}
        {step === "sale" && (
          <form onSubmit={submitSale} className="card p-5 space-y-4" noValidate>
            <h2 className="font-medium">Étape 2 — Ajouter une vente initiale</h2>
            {!state.propertyId && <p className="text-sm text-red-600">Créez d&apos;abord un bien.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="s_date">Date</Label>
                <Input id="s_date" type="date" value={saleForm.date} onChange={(e) => setSaleForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s_amount">Montant TTC (€)</Label>
                <Input id="s_amount" inputMode="decimal" value={saleForm.amountTTC} onChange={(e) => setSaleForm((f) => ({ ...f, amountTTC: e.target.value }))} required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="s_tenant">Locataire</Label>
                <Input id="s_tenant" value={saleForm.tenant} onChange={(e) => setSaleForm((f) => ({ ...f, tenant: e.target.value }))} required />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input id="s_dep" type="checkbox" checked={saleForm.isDeposit} onChange={(e) => setSaleForm((f) => ({ ...f, isDeposit: e.target.checked }))} />
                <Label htmlFor="s_dep" className="!m-0">Caution ?</Label>
              </div>
            </div>
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep("property")} className="btn">Retour</button>
              <button disabled={loading || !state.propertyId || !saleForm.amountTTC || !saleForm.tenant.trim()} className="btn-primary">{loading ? "Enregistrement…" : "Enregistrer et continuer"}</button>
            </div>
          </form>
        )}
        {step === "asset" && (
          <form onSubmit={submitAsset} className="card p-5 space-y-4" noValidate>
            <h2 className="font-medium">Étape 3 — Ajouter une immobilisation</h2>
            {!state.propertyId && <p className="text-sm text-red-600">Créez d&apos;abord un bien.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="a_cat">Catégorie</Label>
                <select id="a_cat" className="input" value={assetForm.category} onChange={(e) => setAssetForm((f) => ({ ...f, category: e.target.value }))}>
                  {assetCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="a_cost">Coût TTC (€)</Label>
                <Input id="a_cost" inputMode="decimal" value={assetForm.costTTC} onChange={(e) => setAssetForm((f) => ({ ...f, costTTC: e.target.value }))} required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="a_label">Nom</Label>
                <Input id="a_label" value={assetForm.label} onChange={(e) => setAssetForm((f) => ({ ...f, label: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="a_date">Mise en service</Label>
                <Input id="a_date" type="date" value={assetForm.inServiceDate} onChange={(e) => setAssetForm((f) => ({ ...f, inServiceDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="a_duration">Durée (mois)</Label>
                <Input id="a_duration" inputMode="numeric" value={assetForm.durationMonths} onChange={(e) => setAssetForm((f) => ({ ...f, durationMonths: e.target.value }))} placeholder="(auto si défaut)" />
              </div>
            </div>
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep("sale")} className="btn">Retour</button>
              <button disabled={loading || !state.propertyId || !assetForm.label.trim() || !assetForm.costTTC} className="btn-primary">{loading ? "Création…" : "Créer et terminer"}</button>
            </div>
          </form>
        )}
        {step === "done" && (
          <div className="card p-8 space-y-6 text-center">
            <div className="text-5xl">✅</div>
            <h2 className="text-xl font-semibold">On est prêts !</h2>
            <p className="text-sm text-muted-foreground">Votre premier bien, une vente et une immobilisation sont enregistrés.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a className="btn-primary" href="/dashboard">Dashboard</a>
              <a className="btn" href="/journal/ventes">Ventes</a>
              <a className="btn" href="/assets">Immobilisations</a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Stepper({ step, state }: { step: StepKey; state: WizardState }) {
  const steps: { key: StepKey; label: string }[] = [
    { key: "property", label: "Bien" },
    { key: "sale", label: "Vente" },
    { key: "asset", label: "Immobilisation" },
    { key: "done", label: "Fin" },
  ];
  let reached = true;
  return (
    <ol className="flex flex-wrap items-center justify-center gap-4 text-sm">
      {steps.map((s, idx) => {
        if (s.key === "sale" && !state.propertyId) reached = false;
        if (s.key === "asset" && !state.propertyId) reached = false;
        const active = step === s.key;
        const enabled = reached || s.key === "done" || step === s.key;
        return (
          <li key={s.key} className={`flex items-center gap-2 ${active ? "font-semibold" : "text-muted-foreground"} ${!enabled ? "opacity-40" : ""}`}>
            <span className={`w-6 h-6 rounded-full grid place-items-center text-xs border ${active ? "bg-primary text-white" : ""}`}>{idx + 1}</span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}
