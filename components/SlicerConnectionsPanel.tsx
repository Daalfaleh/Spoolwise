"use client";

import PremiumGate from "./PremiumGate";

const ar: Record<string, string> = {
  "Desktop slicer connection": "ربط برنامج التقطيع بسطح المكتب",
  "Automatic slicer detection and background syncing will be a Premium feature in Spoolwise Desktop.": "سيكون اكتشاف برامج التقطيع والمزامنة التلقائية ميزة احترافية في تطبيق Spoolwise لسطح المكتب.",
  "PREMIUM DESKTOP": "سطح المكتب الاحترافي",
  "Slicer connections": "اتصالات برامج التقطيع",
  "Desktop only": "لسطح المكتب فقط",
  "Coming soon": "قريباً",
  "SPOOLWISE DESKTOP FOR WINDOWS": "SPOOLWISE لسطح مكتب WINDOWS",
  "Easy slicer setup is coming soon.": "إعداد سهل لبرنامج التقطيع قادم قريباً.",
  "The desktop app will detect supported slicers, configure the connection, and securely sync print estimates to your Spoolwise account in the background.": "سيكتشف تطبيق سطح المكتب برامج التقطيع المدعومة، ويُعد الاتصال، ويزامن تقديرات الطباعة بأمان مع حسابك في الخلفية.",
  "Import a file in Calculator": "استورد ملفاً في الحاسبة",
  "Automatic connection will launch on Windows first.": "سيبدأ الاتصال التلقائي على Windows أولاً.",
  "Install Spoolwise Desktop": "ثبّت Spoolwise لسطح المكتب",
  "One guided installer": "مثبّت واحد بخطوات واضحة",
  "Choose your slicers": "اختر برامج التقطيع",
  "Slice normally": "قسّم ملفاتك كالمعتاد",
  "Print time, material, waste, and printer details sync automatically": "تتم مزامنة الوقت والخامة والهدر وبيانات الطابعة تلقائياً",
  "No command copying": "لا حاجة لنسخ الأوامر",
  "The desktop app will configure supported slicers for you.": "سيُعد تطبيق سطح المكتب برامج التقطيع المدعومة نيابةً عنك.",
  "Private by design": "خصوصية من الأساس",
  "Only estimate metadata is synced. Models and G-code stay on your computer.": "تتم مزامنة بيانات التقدير فقط، بينما تبقى المجسمات وملفات G-code على جهازك.",
  "Works with the web app": "يعمل مع تطبيق الويب",
  "Synced estimates will be ready in Calculator, Quotes, and Records.": "ستظهر التقديرات المتزامنة في الحاسبة وعروض الأسعار والسجلات.",
  "Until Spoolwise Desktop launches, Premium users can privately parse .gcode and .3mf files from the Calculator tab. Files are processed on the device and are not uploaded.": "حتى إطلاق Spoolwise لسطح المكتب، يمكن للمستخدمين المحترفين قراءة ملفات ‎.gcode و‎.3mf بخصوصية من تبويب الحاسبة. تتم معالجة الملفات على الجهاز ولا يتم رفعها.",
};

export default function SlicerConnectionsPanel({ isPremium, onUpgrade, onOpenCalculator, language }: {
  isPremium: boolean;
  onUpgrade: () => void;
  onOpenCalculator: () => void;
  language: "en" | "ar";
}) {
  const t = (value: string) => language === "ar" ? (ar[value] ?? value) : value;
  if (!isPremium) {
    return (
      <PremiumGate
        title={t("Desktop slicer connection")}
        description={t("Automatic slicer detection and background syncing will be a Premium feature in Spoolwise Desktop.")}
        onUpgrade={onUpgrade}
        language={language}
        panelId="panel-slicer"
        labelledBy="tab-slicer"
      />
    );
  }

  return (
    <section className="panel premium-workflow-panel" id="panel-slicer" role="tabpanel" aria-labelledby="tab-slicer">
      <div className="panel-heading">
        <div><p className="step">06 / {t("PREMIUM DESKTOP")}</p><h2>{t("Slicer connections")}</h2></div>
        <span className="count">{t("Desktop only")}</span>
      </div>

      <div className="desktop-connector-hero">
        <div className="desktop-connector-copy">
          <span className="premium-pill">{t("Coming soon")}</span>
          <p className="mini-step">{t("SPOOLWISE DESKTOP FOR WINDOWS")}</p>
          <h3>{t("Easy slicer setup is coming soon.")}</h3>
          <p>
            {t("The desktop app will detect supported slicers, configure the connection, and securely sync print estimates to your Spoolwise account in the background.")}
          </p>
          <div className="desktop-connector-actions">
            <button type="button" className="primary-action" onClick={onOpenCalculator}>{t("Import a file in Calculator")}</button>
            <span>{t("Automatic connection will launch on Windows first.")}</span>
          </div>
        </div>

        <div className="desktop-connector-preview" aria-label="Planned desktop connection flow">
          <div><span>01</span><strong>{t("Install Spoolwise Desktop")}</strong><small>{t("One guided installer")}</small></div>
          <div><span>02</span><strong>{t("Choose your slicers")}</strong><small>PrusaSlicer, OrcaSlicer, Bambu Studio, Cura</small></div>
          <div><span>03</span><strong>{t("Slice normally")}</strong><small>{t("Print time, material, waste, and printer details sync automatically")}</small></div>
        </div>
      </div>

      <div className="desktop-connector-grid">
        <article><strong>{t("No command copying")}</strong><p>{t("The desktop app will configure supported slicers for you.")}</p></article>
        <article><strong>{t("Private by design")}</strong><p>{t("Only estimate metadata is synced. Models and G-code stay on your computer.")}</p></article>
        <article><strong>{t("Works with the web app")}</strong><p>{t("Synced estimates will be ready in Calculator, Quotes, and Records.")}</p></article>
      </div>

      <p className="integration-note">{t("Until Spoolwise Desktop launches, Premium users can privately parse .gcode and .3mf files from the Calculator tab. Files are processed on the device and are not uploaded.")}</p>
    </section>
  );
}
