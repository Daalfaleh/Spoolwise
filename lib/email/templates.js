const palette = {
  ink: "#171912",
  muted: "#676a5e",
  paper: "#f2f0e8",
  card: "#fbfaf5",
  line: "#d8d7cd",
  accent: "#d97948",
  accentDark: "#a84d2e",
  receipt: "#403733",
  slate: "#4f6972",
};

export function escapeEmailHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function spoolwiseLogo() {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;border:2px solid ${palette.ink};border-radius:50%;background:${palette.accent};">
          <div style="width:24px;height:24px;border:1px solid ${palette.ink};border-radius:50%;padding:5px;box-sizing:border-box;">
            <div style="width:12px;height:12px;border:1px solid ${palette.ink};border-radius:50%;padding:3px;box-sizing:border-box;">
              <div style="width:4px;height:4px;border-radius:50%;background:${palette.ink};"></div>
            </div>
          </div>
        </td>
        <td style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:750;letter-spacing:-1.1px;color:${palette.ink};">spoolwise</td>
      </tr>
    </table>`;
}

function emailShell({ preheader, eyebrow, title, intro, body, ctaLabel, ctaUrl, finePrint, arabicSection = "" }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeEmailHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${palette.paper};color:${palette.ink};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeEmailHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${palette.paper};">
      <tr>
        <td align="center" style="padding:34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;">
            <tr>
              <td style="padding:0 4px 22px;">${spoolwiseLogo()}</td>
            </tr>
            <tr>
              <td style="border:1px solid ${palette.line};border-radius:18px;background:${palette.card};box-shadow:8px 9px 0 rgba(64,55,51,.16);overflow:hidden;">
                <div style="height:7px;background:${palette.accent};font-size:0;line-height:0;">&nbsp;</div>
                <div style="padding:44px 46px 42px;">
                  <p style="margin:0 0 15px;font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.5px;color:${palette.slate};text-transform:uppercase;">${escapeEmailHtml(eyebrow)}</p>
                  <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:42px;line-height:1.08;font-weight:400;letter-spacing:-1.5px;color:${palette.ink};">${escapeEmailHtml(title)}</h1>
                  <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.65;color:${palette.muted};">${escapeEmailHtml(intro)}</p>
                  ${body}
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
                    <tr>
                      <td align="center" style="border-radius:9px;background:${palette.receipt};">
                        <a href="${ctaUrl}" style="display:inline-block;padding:15px 25px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1;font-weight:700;color:#ffffff;text-decoration:none;border-radius:9px;">${escapeEmailHtml(ctaLabel)} &nbsp;<span style="color:${palette.accent};">→</span></a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:27px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${palette.muted};">${finePrint}</p>
                  ${arabicSection}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:25px 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:${palette.muted};">
                Made for makers who want every gram to make sense.<br>
                <span dir="rtl">صُمم للمبدعين الذين يهتمون بكل جرام.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderWelcomeEmail({ displayName, appUrl }) {
  const safeName = String(displayName ?? "").trim() || "Maker";
  const safeDisplayName = escapeEmailHtml(safeName);
  const safeAppUrl = escapeEmailHtml(appUrl);
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:4px 0 0;border-top:1px solid ${palette.line};border-bottom:1px solid ${palette.line};">
      <tr>
        <td width="33.33%" style="padding:20px 8px 20px 0;font-family:Arial,Helvetica,sans-serif;color:${palette.ink};"><b style="display:block;font-size:12px;line-height:1.4;">01 &nbsp;Inventory</b><span style="font-size:11px;line-height:1.5;color:${palette.muted};">Know every spool.</span></td>
        <td width="33.33%" style="padding:20px 8px;border-left:1px solid ${palette.line};font-family:Arial,Helvetica,sans-serif;color:${palette.ink};"><b style="display:block;font-size:12px;line-height:1.4;">02 &nbsp;Calculator</b><span style="font-size:11px;line-height:1.5;color:${palette.muted};">Price with confidence.</span></td>
        <td width="33.33%" style="padding:20px 0 20px 8px;border-left:1px solid ${palette.line};font-family:Arial,Helvetica,sans-serif;color:${palette.ink};"><b style="display:block;font-size:12px;line-height:1.4;">03 &nbsp;Records</b><span style="font-size:11px;line-height:1.5;color:${palette.muted};">Track every print.</span></td>
      </tr>
    </table>`;
  const arabicSection = `
    <div dir="rtl" style="margin-top:38px;padding-top:36px;border-top:2px solid ${palette.line};text-align:right;">
      <p style="margin:0 0 15px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:.4px;color:${palette.slate};">مساحة عملك جاهزة</p>
      <h2 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:35px;line-height:1.25;font-weight:700;letter-spacing:-.8px;color:${palette.ink};">أهلاً بك، ${safeDisplayName}.</h2>
      <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.85;color:${palette.muted};">يجمع Spoolwise مخزون خيوط الطباعة، وحساب تكاليف المطبوعات، وسجلات الاستخدام في مساحة عمل خاصة ومرتبة.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:4px 0 0;border-top:1px solid ${palette.line};border-bottom:1px solid ${palette.line};text-align:right;">
        <tr>
          <td width="33.33%" style="padding:20px 0 20px 8px;font-family:Arial,Helvetica,sans-serif;color:${palette.ink};"><b style="display:block;font-size:12px;line-height:1.5;">01 &nbsp;المخزون</b><span style="font-size:11px;line-height:1.6;color:${palette.muted};">اعرف حالة كل بكرة.</span></td>
          <td width="33.33%" style="padding:20px 8px;border-right:1px solid ${palette.line};font-family:Arial,Helvetica,sans-serif;color:${palette.ink};"><b style="display:block;font-size:12px;line-height:1.5;">02 &nbsp;الحاسبة</b><span style="font-size:11px;line-height:1.6;color:${palette.muted};">سعّر بثقة.</span></td>
          <td width="33.33%" style="padding:20px 8px 20px 0;border-right:1px solid ${palette.line};font-family:Arial,Helvetica,sans-serif;color:${palette.ink};"><b style="display:block;font-size:12px;line-height:1.5;">03 &nbsp;السجلات</b><span style="font-size:11px;line-height:1.6;color:${palette.muted};">تابع كل مطبوعة.</span></td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;margin-left:auto;">
        <tr>
          <td align="center" style="border-radius:9px;background:${palette.receipt};">
            <a href="${safeAppUrl}" style="display:inline-block;padding:15px 25px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1;font-weight:700;color:#ffffff;text-decoration:none;border-radius:9px;"><span style="color:${palette.accent};">←</span>&nbsp; افتح مساحة عملك</a>
          </td>
        </tr>
      </table>
      <p style="margin:27px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.8;color:${palette.muted};">وصلتك رسالة الترحيب هذه مرة واحدة لأنه تم إنشاء حساب Spoolwise باستخدام هذا البريد الإلكتروني.</p>
    </div>`;

  return {
    subject: "Welcome to Spoolwise | أهلاً بك في Spoolwise",
    html: emailShell({
      preheader: "Your private 3D-print costing workbench is ready. مساحة عملك الخاصة جاهزة.",
      eyebrow: "Your workbench is ready",
      title: `Welcome, ${safeName}.`,
      intro: "Spoolwise brings your filament inventory, print-cost calculations, and usage records into one calm, private workspace.",
      body,
      ctaLabel: "Open your workbench",
      ctaUrl: safeAppUrl,
      finePrint: "You received this one-time welcome email because a Spoolwise account was created with this address.",
      arabicSection,
    }),
    text: `Welcome, ${safeName}.\n\nYour Spoolwise workbench is ready. Manage your filament inventory, calculate print costs, and keep usage records together.\n\nOpen your workbench: ${appUrl}\n\nYou received this one-time welcome email because a Spoolwise account was created with this address.\n\n---\n\nأهلاً بك، ${safeName}.\n\nمساحة عملك في Spoolwise جاهزة. أدر مخزون خيوط الطباعة، واحسب تكاليف المطبوعات، واحتفظ بسجلات الاستخدام في مكان واحد.\n\nافتح مساحة عملك: ${appUrl}\n\nوصلتك رسالة الترحيب هذه مرة واحدة لأنه تم إنشاء حساب Spoolwise باستخدام هذا البريد الإلكتروني.`,
  };
}
