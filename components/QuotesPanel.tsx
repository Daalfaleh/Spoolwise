"use client";

import { useEffect, useState } from "react";
import type { QuoteRecord } from "@/lib/quotes/types";
import { formatGrams, formatMoney, formatNumber, localeFor } from "@/lib/i18n";
import PremiumGate from "./PremiumGate";

const ar: Record<string, string> = {
  "Instant quotes and PDFs": "عروض أسعار فورية وملفات PDF",
  "Turn calculator results into customer-ready quotes, track their status, and export branded PDFs.": "حوّل نتائج الحاسبة إلى عروض جاهزة للعملاء، وتابع حالتها، وصدّر ملفات PDF بهوية Spoolwise.",
  "PREMIUM QUOTES": "عروض الأسعار الاحترافية",
  "Quotes": "عروض الأسعار",
  "saved": "محفوظة",
  "Customer-ready pricing": "تسعير جاهز للعملاء",
  "Create a quote from the Calculator tab, then manage and export it here.": "أنشئ عرضاً من تبويب الحاسبة، ثم أدره وصدّره من هنا.",
  "Refreshing…": "جارٍ التحديث…",
  "Refresh": "تحديث",
  "No quotes yet": "لا توجد عروض أسعار بعد",
  "Calculate a print, add the customer details, and choose “Create instant quote”.": "احسب تكلفة طبعة، وأضف بيانات العميل، ثم اختر «إنشاء عرض سعر فوري».",
  "No customer name": "لا يوجد اسم عميل",
  "Created": "تاريخ الإنشاء",
  "Valid until": "صالح حتى",
  "No expiry": "بلا انتهاء",
  "Print time": "مدة الطباعة",
  "Weight": "الوزن",
  "Status": "الحالة",
  "Draft": "مسودة",
  "Sent": "مُرسل",
  "Accepted": "مقبول",
  "Expired": "منتهي",
  "Download PDF": "تنزيل PDF",
  "Delete": "حذف",
  "Delete this quote permanently?": "هل تريد حذف عرض السعر هذا نهائياً؟",
};

export default function QuotesPanel({ accessToken, isPremium, onUpgrade, refreshKey, language }: {
  accessToken: string;
  isPremium: boolean;
  onUpgrade: () => void;
  refreshKey: number;
  language: "en" | "ar";
}) {
  const t = (value: string) => language === "ar" ? (ar[value] ?? value) : value;
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/quotes", { cache: "no-store", headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json() as { quotes?: QuoteRecord[]; error?: string };
      if (!response.ok || !data.quotes) throw new Error(data.error || "Could not load quotes.");
      setQuotes(data.quotes);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load quotes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isPremium) return;
    // Loading the remote quote ledger is the synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // Refresh key intentionally reloads after a quote is created in the calculator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, refreshKey]);

  async function updateStatus(id: string, status: QuoteRecord["status"]) {
    const response = await fetch("/api/quotes", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await response.json() as { quote?: QuoteRecord; error?: string };
    if (!response.ok || !data.quote) return setMessage(data.error || "Could not update this quote.");
    setQuotes((items) => items.map((item) => item.id === id ? data.quote! : item));
  }

  async function remove(id: string) {
    if (!window.confirm(t("Delete this quote permanently?"))) return;
    const response = await fetch(`/api/quotes?id=${encodeURIComponent(id)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error || "Could not remove this quote.");
    setQuotes((items) => items.filter((item) => item.id !== id));
  }

  async function downloadPdf(quote: QuoteRecord) {
    setMessage("Preparing branded PDF…");
    try {
      const response = await fetch(`/api/quotes/pdf?id=${encodeURIComponent(quote.id)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "Could not create this PDF.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${quote.quoteNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("PDF downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create this PDF.");
    }
  }

  if (!isPremium) return <PremiumGate title={t("Instant quotes and PDFs")} description={t("Turn calculator results into customer-ready quotes, track their status, and export branded PDFs.")} onUpgrade={onUpgrade} language={language} panelId="panel-quotes" labelledBy="tab-quotes" />;

  return (
    <section className="panel premium-workflow-panel" id="panel-quotes" role="tabpanel" aria-labelledby="tab-quotes">
      <div className="panel-heading">
        <div><p className="step">05 / {t("PREMIUM QUOTES")}</p><h2>{t("Quotes")}</h2></div>
        <span className="count">{formatNumber(quotes.length, language, 0)} {t("saved")}</span>
      </div>
      <div className="quotes-toolbar"><div><strong>{t("Customer-ready pricing")}</strong><p>{t("Create a quote from the Calculator tab, then manage and export it here.")}</p></div><button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading}>{loading ? t("Refreshing…") : t("Refresh")}</button></div>
      {message && <p className="form-message quote-message" role="status">{message}</p>}
      {!quotes.length && !loading && <div className="empty-premium-state large"><strong>{t("No quotes yet")}</strong><p>{t("Calculate a print, add the customer details, and choose “Create instant quote”.")}</p></div>}
      <div className="quote-list">
        {quotes.map((quote) => (
          <article className="quote-card" key={quote.id}>
            <div className="quote-card-head"><div><span>{quote.quoteNumber}</span><h3>{quote.projectName}</h3><p>{quote.customerName || t("No customer name")}{quote.customerEmail ? ` · ${quote.customerEmail}` : ""}</p></div><strong>{formatMoney(quote.suggestedPrice, quote.currency, language)}</strong></div>
            <dl className="quote-details"><div><dt>{t("Created")}</dt><dd>{new Date(quote.createdAt).toLocaleDateString(localeFor(language))}</dd></div><div><dt>{t("Valid until")}</dt><dd>{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString(localeFor(language)) : t("No expiry")}</dd></div><div><dt>{t("Print time")}</dt><dd>{quote.data.durationMinutes ? `${formatNumber(quote.data.durationMinutes / 60, language, 1)} ${language === "ar" ? "س" : "h"}` : "—"}</dd></div><div><dt>{t("Weight")}</dt><dd>{formatGrams(quote.data.items.reduce((sum, item) => sum + item.grams, 0), language)}</dd></div></dl>
            <div className="quote-card-actions">
              <label><span>{t("Status")}</span><select value={quote.status} onChange={(event) => void updateStatus(quote.id, event.target.value as QuoteRecord["status"])}><option value="draft">{t("Draft")}</option><option value="sent">{t("Sent")}</option><option value="accepted">{t("Accepted")}</option><option value="expired">{t("Expired")}</option></select></label>
              <button type="button" className="primary-action" onClick={() => void downloadPdf(quote)}>{t("Download PDF")}</button>
              <button type="button" className="danger-link" onClick={() => void remove(quote.id)}>{t("Delete")}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
