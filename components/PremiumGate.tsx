export default function PremiumGate({ title, description, onUpgrade, language = "en", panelId, labelledBy }: {
  title: string;
  description: string;
  onUpgrade: () => void;
  language?: "en" | "ar";
  panelId?: string;
  labelledBy?: string;
}) {
  return (
    <section className="panel premium-feature-gate" id={panelId} role={panelId ? "tabpanel" : undefined} aria-labelledby={labelledBy}>
      <span className="premium-pill">{language === "ar" ? "احترافي" : "Premium"}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button type="button" className="primary-action" onClick={onUpgrade}>{language === "ar" ? "افتح بالخطة الاحترافية" : "Unlock with Premium"}</button>
    </section>
  );
}
