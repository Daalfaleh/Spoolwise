"use client";

import { FormEvent, useEffect, useState } from "react";
import { currencyName, currencySymbol, formatMoney, formatNumber } from "@/lib/i18n";
import PremiumGate from "./PremiumGate";

export type PrinterProfile = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  powerWatts: number;
  hourlyRate: number;
  currency: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

const currencies = ["SAR", "AED", "BHD", "EGP", "JOD", "KWD", "OMR", "QAR", "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NZD", "TRY", "INR", "PKR", "JPY", "CNY", "MAD", "ZAR"];

const emptyForm = {
  name: "", manufacturer: "", model: "", powerWatts: "150", hourlyRate: "0", currency: "SAR", isDefault: false,
};

const ar: Record<string, string> = {
  "Printer profiles": "ملفات الطابعات",
  "Save printer power and machine rates so every quote uses the right production cost.": "احفظ قدرة الطابعة وتكلفة تشغيلها لتستخدم عروض الأسعار تكلفة الإنتاج الصحيحة.",
  "PREMIUM PRINTERS": "الطابعات الاحترافية",
  "printer": "طابعة",
  "printers": "طابعات",
  "EDIT PROFILE": "تعديل الملف",
  "ADD PROFILE": "إضافة ملف",
  "Update printer": "تحديث الطابعة",
  "Add a printer": "إضافة طابعة",
  "Hourly machine cost covers depreciation and maintenance separately from electricity.": "تشمل تكلفة التشغيل بالساعة الاستهلاك والصيانة بشكل منفصل عن الكهرباء.",
  "Profile name": "اسم الملف",
  "Manufacturer": "الشركة المصنعة",
  "Model": "الطراز",
  "Power": "القدرة",
  "Machine rate": "تكلفة التشغيل",
  "Currency": "العملة",
  "Default printer": "الطابعة الافتراضية",
  "Use this profile first in the calculator.": "استخدم هذا الملف أولاً في الحاسبة.",
  "Saving…": "جارٍ الحفظ…",
  "Save changes": "حفظ التغييرات",
  "Add printer": "إضافة طابعة",
  "Cancel": "إلغاء",
  "SAVED PROFILES": "الملفات المحفوظة",
  "Your printers": "طابعاتك",
  "No printer profiles yet": "لا توجد ملفات طابعات بعد",
  "Add one to include machine and electricity costs automatically.": "أضف طابعة لإدراج تكاليف التشغيل والكهرباء تلقائياً.",
  "Custom printer": "طابعة مخصصة",
  "Machine": "التشغيل",
  "Default": "افتراضي",
  "Edit": "تعديل",
  "Remove": "حذف",
  "Remove this printer profile permanently?": "هل تريد حذف ملف الطابعة هذا نهائياً؟",
};

export default function PrinterProfilesPanel({ accessToken, isPremium, onUpgrade, printers, onPrintersChange, language }: {
  accessToken: string;
  isPremium: boolean;
  onUpgrade: () => void;
  printers: PrinterProfile[];
  onPrintersChange: (printers: PrinterProfile[]) => void;
  language: "en" | "ar";
}) {
  const t = (value: string) => language === "ar" ? (ar[value] ?? value) : value;
  const currencyLabel = (currency: string) => language === "ar" ? `${currencyName(currency, language)} (${currency})` : currency;
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/printers", { cache: "no-store", headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json() as { printers?: PrinterProfile[]; error?: string };
    if (!response.ok || !data.printers) throw new Error(data.error || "Could not load printer profiles.");
    onPrintersChange(data.printers);
  }

  useEffect(() => {
    if (!isPremium) return;
    void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load printer profiles."));
    // Access token and callbacks remain stable for the mounted workbench.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium]);

  function edit(printer: PrinterProfile) {
    setEditingId(printer.id);
    setForm({
      name: printer.name,
      manufacturer: printer.manufacturer,
      model: printer.model,
      powerWatts: String(printer.powerWatts),
      hourlyRate: String(printer.hourlyRate),
      currency: printer.currency,
      isDefault: printer.isDefault,
    });
    setMessage("");
  }

  function reset() {
    setEditingId("");
    setForm({ ...emptyForm, currency: printers[0]?.currency ?? "SAR" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/printers", {
        method: editingId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId || undefined, ...form, powerWatts: Number(form.powerWatts), hourlyRate: Number(form.hourlyRate) }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save this printer profile.");
      await refresh();
      setMessage(editingId ? "Printer profile updated." : "Printer profile added.");
      reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this printer profile.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("Remove this printer profile permanently?"))) return;
    setMessage("");
    const response = await fetch(`/api/printers?id=${encodeURIComponent(id)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error || "Could not remove this printer profile.");
    await refresh();
    if (editingId === id) reset();
  }

  if (!isPremium) return <PremiumGate title={t("Printer profiles")} description={t("Save printer power and machine rates so every quote uses the right production cost.")} onUpgrade={onUpgrade} language={language} panelId="panel-printers" labelledBy="tab-printers" />;

  return (
    <section className="panel premium-workflow-panel" id="panel-printers" role="tabpanel" aria-labelledby="tab-printers">
      <div className="panel-heading">
        <div><p className="step">04 / {t("PREMIUM PRINTERS")}</p><h2>{t("Printer profiles")}</h2></div>
        <span className="count">{formatNumber(printers.length, language, 0)} {printers.length === 1 ? t("printer") : t("printers")}</span>
      </div>
      <div className="premium-grid">
        <form className="premium-form" onSubmit={save}>
          <div><p className="mini-step">{editingId ? t("EDIT PROFILE") : t("ADD PROFILE")}</p><h3>{editingId ? t("Update printer") : t("Add a printer")}</h3><p>{t("Hourly machine cost covers depreciation and maintenance separately from electricity.")}</p></div>
          <label className="field"><span>{t("Profile name")}</span><input required maxLength={80} placeholder="e.g. Bambu P1S production" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></label>
          <div className="two-field-row">
            <label className="field"><span>{t("Manufacturer")}</span><input maxLength={80} placeholder="Bambu Lab" value={form.manufacturer} onChange={(event) => setForm((value) => ({ ...value, manufacturer: event.target.value }))} /></label>
            <label className="field"><span>{t("Model")}</span><input maxLength={80} placeholder="P1S" value={form.model} onChange={(event) => setForm((value) => ({ ...value, model: event.target.value }))} /></label>
          </div>
          <div className="two-field-row">
            <label className="field"><span>{t("Power")}</span><div className="unit-input"><input type="number" min="0" max="20000" step="1" value={form.powerWatts} onChange={(event) => setForm((value) => ({ ...value, powerWatts: event.target.value }))} /><span>{language === "ar" ? "واط" : "W"}</span></div></label>
            <label className="field"><span>{t("Machine rate")}</span><div className="unit-input"><input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(event) => setForm((value) => ({ ...value, hourlyRate: event.target.value }))} /><span>{currencySymbol(form.currency, language)}/{language === "ar" ? "س" : "h"}</span></div></label>
          </div>
          <label className="field"><span>{t("Currency")}</span><select value={form.currency} onChange={(event) => setForm((value) => ({ ...value, currency: event.target.value }))}>{currencies.map((currency) => <option key={currency} value={currency}>{currencyLabel(currency)}</option>)}</select></label>
          <label className="check-row"><input aria-label={t("Default printer")} type="checkbox" checked={form.isDefault} onChange={(event) => setForm((value) => ({ ...value, isDefault: event.target.checked }))} /><span><strong>{t("Default printer")}</strong><small>{t("Use this profile first in the calculator.")}</small></span></label>
          <div className="form-actions"><button type="submit" className="primary-action" disabled={saving}>{saving ? t("Saving…") : editingId ? t("Save changes") : t("Add printer")}</button>{editingId && <button type="button" className="secondary-button" onClick={reset}>{t("Cancel")}</button>}</div>
          {message && <p className="form-message" role="status">{message}</p>}
        </form>
        <div className="premium-list">
          <div><p className="mini-step">{t("SAVED PROFILES")}</p><h3>{t("Your printers")}</h3></div>
          {!printers.length && <div className="empty-premium-state"><strong>{t("No printer profiles yet")}</strong><p>{t("Add one to include machine and electricity costs automatically.")}</p></div>}
          {printers.map((printer) => (
            <article className="printer-card" key={printer.id}>
              <div><span className="printer-icon" aria-hidden="true">P</span><div><strong>{printer.name}</strong><p>{[printer.manufacturer, printer.model].filter(Boolean).join(" · ") || t("Custom printer")}</p></div></div>
              <dl><div><dt>{t("Power")}</dt><dd>{formatNumber(printer.powerWatts, language, 0)} {language === "ar" ? "واط" : "W"}</dd></div><div><dt>{t("Machine")}</dt><dd>{formatMoney(printer.hourlyRate, printer.currency, language)}/{language === "ar" ? "س" : "h"}</dd></div></dl>
              {printer.isDefault && <span className="default-badge">{t("Default")}</span>}
              <div className="card-actions"><button type="button" className="secondary-button" onClick={() => edit(printer)}>{t("Edit")}</button><button type="button" className="danger-link" onClick={() => void remove(printer.id)}>{t("Remove")}</button></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
