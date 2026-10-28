"use client";

import { DragEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { estimateReference, usesMixedCurrencies } from "@/lib/estimate";
import UpgradeModal from "@/components/UpgradeModal";
import PrinterProfilesPanel, { type PrinterProfile } from "@/components/PrinterProfilesPanel";
import QuotesPanel from "@/components/QuotesPanel";
import SlicerConnectionsPanel from "@/components/SlicerConnectionsPanel";
import { applyDocumentLanguage, currencyName, currencySymbol, formatGrams, formatMoney, formatNumber, formatPercent, storedLanguage } from "@/lib/i18n";
import { useUserTier } from "@/lib/subscriptions/use-user-tier";
import { parsePrintFile } from "@/utils/gcodeParser";

type Filament = {
  id: string;
  name: string;
  material: string;
  color: string;
  colorHex: string;
  colorHexes: string[];
  spoolWeightGrams: number;
  remainingWeightGrams: number;
  purchaseCost: number;
  currency: string;
};

type UsageRecord = {
  id: string;
  filamentId: string;
  filamentName: string;
  partName: string;
  gramsUsed: number;
  deducted: boolean;
  createdAt: string;
};

type Profile = {
  displayName: string;
  country: string;
  preferredCurrency: string;
  language: "en" | "ar";
};

/** One filament of a (possibly multicolor) print: which spool, and how many grams of it. */
type PrintLine = { key: string; filamentId: string; grams: number };

type ParsedPrintFile = {
  fileName: string;
  slicer: string;
  modelWeightGrams: number;
  wasteWeightGrams: number;
  totalWeightGrams: number;
  durationSeconds: number;
  warnings: string[];
};

type MainTab = "inventory" | "calculator" | "records" | "printers" | "quotes" | "slicer";

const MAX_PRINT_LINES = 8;

const materialOptions = ["PLA", "PETG", "ABS", "ASA", "TPU", "Nylon", "Other"];

/** Kept in sync with `supportedCurrencies` in db/profile.ts. */
const currencyOptions = [
  "SAR", "AED", "BHD", "EGP", "JOD", "KWD", "OMR", "QAR",
  "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NZD",
  "TRY", "INR", "PKR", "JPY", "CNY", "MAD", "ZAR",
];

const colorPresets = [
  { name: "Black", hex: "#24251f" },
  { name: "White", hex: "#e8e6da" },
  { name: "Red", hex: "#d84335" },
  { name: "Orange", hex: "#ec7d2f" },
  { name: "Yellow", hex: "#f0c928" },
  { name: "Green", hex: "#4b9b55" },
  { name: "Blue", hex: "#2472a4" },
  { name: "Purple", hex: "#743f80" },
  { name: "Pink", hex: "#dd7a9f" },
  { name: "Grey", hex: "#85877e" },
];

const arabic: Record<string, string> = {
  "Inventory saved online": "تم حفظ المخزون على الإنترنت",
  "Loading inventory…": "جارٍ تحميل المخزون…",
  "Saving changes…": "جارٍ حفظ التغييرات…",
  "Inventory sync needs attention": "تحتاج مزامنة المخزون إلى المراجعة",
  "Spoolwise sections": "أقسام Spoolwise",
  "Inventory sections": "أقسام المخزون",
  "Record sections": "أقسام السجلات",
  "Remove this filament permanently?": "هل تريد حذف هذا الخيط نهائياً؟",
  "3D PRINT COSTING WORKBENCH": "مساحة عمل تسعير الطباعة ثلاثية الأبعاد",
  "Know your cost.": "اعرف تكلفتك.",
  "Price with confidence.": "سعّر بثقة.",
  "Save your filament spools, enter the grams used, and get a clear selling price in seconds.": "احفظ بكرات الخيوط، وأدخل الجرامات المستخدمة، واحصل على سعر بيع واضح خلال ثوانٍ.",
  "Inventory": "المخزون",
  "Add & manage filaments": "إضافة الخيوط وإدارتها",
  "Calculator": "الحاسبة",
  "Cost & price a print": "احسب تكلفة وسعر الطباعة",
  "Records": "السجلات",
  "Log & review filament use": "تسجيل ومراجعة استخدام الخيوط",
  "Account": "الحساب",
  "Printers": "الطابعات",
  "Profiles & machine rates": "ملفات الطابعات وتكاليف التشغيل",
  "Quotes": "عروض الأسعار",
  "Instant quotes & PDFs": "عروض فورية وملفات PDF",
  "Connections": "الاتصالات",
  "Desktop app": "تطبيق سطح المكتب",
  "Premium": "احترافي",
  "Free · Upgrade": "مجاني · ترقية",
  "Add inventory": "إضافة مخزون",
  "Add and view filament spools": "إضافة بكرات الخيوط وعرضها",
  "Manage inventory": "إدارة المخزون",
  "Adjust weight, price and stock": "تعديل الوزن والسعر والمخزون",
  "Record filament use": "تسجيل استخدام الخيط",
  "Log a part and deduct its spools": "سجّل جزءًا واخصم من بكراته",
  "Usage history": "سجل الاستخدام",
  "Totals and the full ledger": "الإجماليات والسجل الكامل",
  "RECORD FILAMENT USE": "تسجيل استخدام الخيط",
  "Add a used part": "إضافة جزء مستخدم",
  "See the full usage history": "عرض سجل الاستخدام الكامل",
  "Every recorded part": "كل الأجزاء المسجلة",
  "Filter records": "تصفية السجلات",
  "Deducted only": "المخصوم فقط",
  "All records": "كل السجلات",
  "No records yet": "لا توجد سجلات بعد",
  "Weight": "الوزن",
  "ADD INVENTORY": "إضافة مخزون",
  "Your filaments": "خيوط الطباعة لديك",
  "spool": "بكرة",
  "spools": "بكرات",
  "Filament name": "اسم الخيط",
  "e.g. Matte Black": "مثال: أسود مطفي",
  "Material": "الخامة",
  "Colour": "اللون",
  "Type a colour, e.g. Red": "اكتب لونًا، مثال: أحمر",
  "Quick colour choices": "خيارات ألوان سريعة",
  "Custom colour": "لون مخصص",
  "Multicolor roll": "بكرة متعددة الألوان",
  "Pick any colour from the wheel": "اختر أي لون من عجلة الألوان",
  "Type a filament colour": "اكتب لون خيط الطباعة",
  "Choose a custom filament colour": "اختر لون خيط مخصص",
  "Multicolor roll colour": "لون البكرة متعددة الألوان",
  "Remove colour": "إزالة اللون",
  "Colours in this roll": "الألوان في هذه البكرة",
  "colour stops": "ألوان",
  "Add colour": "إضافة لون",
  "Spool weight": "وزن البكرة",
  "Purchase cost": "سعر الشراء",
  "Currency": "العملة",
  "Add to inventory": "إضافة إلى المخزون",
  "Saving…": "جارٍ الحفظ…",
  "Loading your workbench…": "جارٍ تحميل مساحة العمل…",
  "No filaments yet. Add your first spool above.": "لا توجد خيوط بعد. أضف أول بكرة أعلاه.",
  "left": "متبقٍ",
  "Remove": "حذف",
  "INVENTORY MANAGEMENT": "إدارة المخزون",
  "Manage spool weight": "إدارة وزن البكرة",
  "used part": "جزء مستخدم",
  "used parts": "أجزاء مستخدمة",
  "Select a spool": "اختر بكرة",
  "Add a filament first": "أضف خيطًا أولاً",
  "Add a filament to start managing spool weight.": "أضف خيطًا لبدء إدارة وزن البكرة.",
  "remaining": "متبقٍ",
  "Original": "الأصلي",
  "Set remaining weight": "تعيين الوزن المتبقي",
  "Use this after weighing a spool or correcting its current amount.": "استخدم هذا بعد وزن البكرة أو لتصحيح الكمية الحالية.",
  "Weight currently on spool": "الوزن الحالي على البكرة",
  "grams": "جرام",
  "Update spool weight": "تحديث وزن البكرة",
  "Edit purchase price": "تعديل سعر الشراء",
  "Update what this spool cost. Prices in the calculator refresh automatically.": "حدّث تكلفة البكرة. ستتحدث أسعار الحاسبة تلقائيًا.",
  "Spool purchase price": "سعر شراء البكرة",
  "Purchase price currency": "عملة سعر الشراء",
  "Save purchase price": "حفظ سعر الشراء",
  "USED SUBPART": "جزء مستخدم",
  "Record filament used": "تسجيل الخيط المستخدم",
  "Add every colour used by a part, prototype, support, or failed print.": "أضف كل لون استخدمته في جزء أو نموذج أولي أو دعامات أو طباعة فاشلة.",
  "Subpart name": "اسم الجزء",
  "e.g. Left hinge prototype": "مثال: نموذج مفصلة يسرى",
  "Filament used": "الخيط المستخدم",
  "Spools used by this part": "البكرات المستخدمة في هذا الجزء",
  "One row per colour": "صف واحد لكل لون",
  "Add spool": "إضافة بكرة",
  "Remove this spool": "إزالة هذه البكرة",
  "Deduct from spool totals": "خصم من إجمالي البكرات",
  "Every spool above loses the weight you entered.": "سيتم خصم الوزن المُدخل من كل بكرة أعلاه.",
  "Add used subpart": "إضافة جزء مستخدم",
  "RECENT ACTIVITY": "النشاط الأخير",
  "Used subparts": "الأجزاء المستخدمة",
  "Newest first": "الأحدث أولاً",
  "No used subparts recorded yet.": "لم يتم تسجيل أجزاء مستخدمة بعد.",
  "Deducted": "تم الخصم",
  "Log only": "تسجيل فقط",
  "AVAILABLE FILAMENTS": "الخيوط المتاحة",
  "Complete inventory": "المخزون الكامل",
  "available": "متاحة",
  "No filaments in inventory yet.": "لا توجد خيوط في المخزون بعد.",
  "Filament": "الخيط",
  "Spool size": "حجم البكرة",
  "Available": "المتاح",
  "Purchase price": "سعر الشراء",
  "colours": "ألوان",
  "PRICE YOUR PRINT": "سعّر طباعتك",
  "Print calculator": "حاسبة الطباعة",
  "Markup is added on top of your total production cost.": "تُضاف نسبة الربح فوق إجمالي تكلفة الإنتاج.",
  "Filaments in this print": "الخيوط في هذه الطباعة",
  "Add a row for every colour": "أضف صفًا لكل لون",
  "Add filament": "إضافة خيط",
  "Select filament": "اختر الخيط",
  "Other costs": "تكاليف أخرى",
  "Print file": "ملف الطباعة",
  "Drop a sliced .gcode or .3mf file here": "أفلت ملف ‎.gcode أو ‎.3mf مقسّماً هنا",
  "or choose a file": "أو اختر ملفاً",
  "Premium parses locally on your device — files are never uploaded.": "تتم قراءة الملفات محلياً على جهازك في الخطة الاحترافية — ولا يتم رفعها أبداً.",
  "Upgrade to use file parsing": "رقِّ حسابك لاستخدام قراءة الملفات",
  "Print duration": "مدة الطباعة",
  "Hours": "الساعات",
  "Minutes": "الدقائق",
  "Printer power": "قدرة الطابعة",
  "Electricity rate": "تعرفة الكهرباء",
  "Labor time": "وقت العمل",
  "Labor rate": "تكلفة ساعة العمل",
  "Electricity": "الكهرباء",
  "Labor": "العمل",
  "Model": "المجسم",
  "Purge & tower waste": "هدر التفريغ والبرج",
  "optional": "اختياري",
  "Profit markup": "نسبة الربح",
  "Move the slider to set your target": "حرّك المؤشر لتحديد النسبة المستهدفة",
  "LIVE COST BREAKDOWN": "تفصيل التكلفة المباشر",
  "Cost estimate · not a tax invoice": "تقدير للتكلفة · ليس فاتورة ضريبية",
  "Date": "التاريخ",
  "Ref": "المرجع",
  "Items": "البنود",
  "Item": "البند",
  "Qty": "الكمية",
  "Amount": "المبلغ",
  "Total production cost": "إجمالي تكلفة الإنتاج",
  "Your profit": "ربحك",
  "markup": "ربح",
  "Suggested selling price": "سعر البيع المقترح",
  "Round this up to a customer-friendly price.": "قرّب هذا المبلغ إلى سعر مناسب للعميل.",
  "Keep this estimate with your build notes.": "احتفظ بهذا التقدير مع ملاحظات الطباعة.",
  "Spools use different currencies, so totals are not converted.": "البكرات تستخدم عملات مختلفة، لذلك لم يتم تحويل الإجماليات.",
  "Choose spools priced in one currency to calculate a total.": "اختر بكرات مسعّرة بعملة واحدة لحساب الإجمالي.",
  "Select a filament to see your price.": "اختر خيطًا لعرض السعر.",
  "Use": "استخدم",
  "across": "عبر",
  "from this spool": "من هذه البكرة",
  "Record & deduct": "تسجيل وخصم",
  "DEDUCTION RECORDS": "سجلات الخصم",
  "Deducted filament": "الخيوط المخصومة",
  "record": "سجل",
  "records": "سجلات",
  "Total deducted": "إجمالي المخصوم",
  "Across every recorded print and subpart": "عبر جميع الطبعات والأجزاء المسجلة",
  "Deductions": "عمليات الخصم",
  "Individual usage records": "سجلات الاستخدام الفردية",
  "Spools used": "البكرات المستخدمة",
  "Filament spools with deductions": "بكرات خيوط تحتوي على خصومات",
  "FULL LEDGER": "السجل الكامل",
  "All deducted weights": "جميع الأوزان المخصومة",
  "No deductions yet": "لا توجد خصومات بعد",
  "Record a used subpart and choose “Deduct from spool totals” to see it here.": "سجّل جزءًا مستخدمًا واختر «خصم من إجمالي البكرات» ليظهر هنا.",
  "Part / print": "الجزء / الطباعة",
  "Spool": "البكرة",
  "Made for makers who want the numbers to make sense.": "صُمم للصنّاع الذين يريدون أرقامًا واضحة.",
  "Sign out": "تسجيل الخروج",
  "Signed in as": "تم تسجيل الدخول باسم",
  "Black": "أسود",
  "White": "أبيض",
  "Red": "أحمر",
  "Orange": "برتقالي",
  "Yellow": "أصفر",
  "Green": "أخضر",
  "Blue": "أزرق",
  "Purple": "بنفسجي",
  "Pink": "وردي",
  "Grey": "رمادي",
  "Other": "أخرى",
  "Custom": "مخصص",
  "Multicolor": "متعدد الألوان",
  "Machine rate": "تكلفة تشغيل الطابعة",
  "Printer profile": "ملف الطابعة",
  "Manual printer settings": "إعدادات الطابعة اليدوية",
  "Manage profiles": "إدارة الملفات",
  "Default": "افتراضي",
  "Reading sliced file…": "جارٍ قراءة ملف التقطيع…",
  "Unlock reusable printer power and machine rates": "افتح حفظ قدرة الطابعة وتكاليف تشغيلها",
  "Create instant quote": "إنشاء عرض سعر فوري",
  "Save this calculation as a customer quote and export a branded PDF.": "احفظ هذا الحساب كعرض للعميل وصدّره كملف PDF بهوية Spoolwise.",
  "Project name": "اسم المشروع",
  "e.g. Custom enclosure": "مثال: غلاف مخصص",
  "Customer name": "اسم العميل",
  "Customer email": "بريد العميل الإلكتروني",
  "Optional": "اختياري",
  "Valid for": "صالح لمدة",
  "days": "أيام",
  "Quote notes": "ملاحظات العرض",
  "Lead time, finish, delivery, or payment notes": "مدة التنفيذ أو التشطيب أو التسليم أو ملاحظات الدفع",
  "Creating quote…": "جارٍ إنشاء العرض…",
  "Unlock instant quotes": "افتح عروض الأسعار الفورية",
  "Machine": "تشغيل الطابعة",
};

function typedColorToHex(value: string, fallback: string) {
  if (typeof document === "undefined" || !CSS.supports("color", value)) return fallback;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return fallback;
  context.fillStyle = "#000000";
  context.fillStyle = value;
  return /^#[0-9a-f]{6}$/i.test(context.fillStyle) ? context.fillStyle : fallback;
}

function filamentFill(colorHexes: string[] | undefined, fallback: string) {
  const colors = colorHexes?.length ? colorHexes : [fallback];
  if (colors.length === 1) return colors[0];
  return `linear-gradient(135deg, ${colors.map((color, index) => {
    const start = (index / colors.length) * 100;
    const end = ((index + 1) / colors.length) * 100;
    return `${color} ${start}% ${end}%`;
  }).join(", ")})`;
}

function remainingPercent(item: Pick<Filament, "remainingWeightGrams" | "spoolWeightGrams">) {
  if (!(item.spoolWeightGrams > 0)) return 0;
  return Math.min(100, Math.max(0, (item.remainingWeightGrams / item.spoolWeightGrams) * 100));
}

/** Drives the colour of the remaining-filament bars: orange normally, red once a spool runs low. */
function progressLevel(percent: number) {
  if (percent <= 12) return "low";
  if (percent <= 35) return "warn";
  return "ok";
}

function lineKey() {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

const receiptTeethPath = `M 0 8 ${Array.from({ length: 40 }, (_, index) => {
  const start = index * 2.4;
  return `L ${(start + 1.2).toFixed(2)} 0 L ${(start + 2.4).toFixed(2)} 8`;
}).join(" ")} Z`;

function FilamentBar({ percent, size }: { percent: number; size?: "sm" | "lg" }) {
  return (
    <span className={`filament-bar${size ? ` filament-bar-${size}` : ""}`} data-level={progressLevel(percent)}>
      <i style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }} />
    </span>
  );
}

export default function SpoolwiseApp({ accessToken, user, onSignOut, initialLanguage }: {
  accessToken: string;
  user: { displayName: string; email: string };
  onSignOut: () => Promise<void>;
  initialLanguage: "en" | "ar";
}) {
  const [language, setLanguage] = useState<"en" | "ar">(initialLanguage);
  const skipInitialLanguagePersistence = useRef(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("inventory");
  const [inventorySection, setInventorySection] = useState<"add" | "manage">("add");
  const [recordsSection, setRecordsSection] = useState<"log" | "history">("log");
  const [historyFilter, setHistoryFilter] = useState<"all" | "deducted">("deducted");
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [printLines, setPrintLines] = useState<PrintLine[]>([{ key: "print-1", filamentId: "", grams: 125 }]);
  const [managementFilamentId, setManagementFilamentId] = useState("");
  const [extraCosts, setExtraCosts] = useState(3.5);
  const [printDurationMinutes, setPrintDurationMinutes] = useState(0);
  const [printerWatts, setPrinterWatts] = useState(150);
  const [machineHourlyRate, setMachineHourlyRate] = useState(0);
  const [printers, setPrinters] = useState<PrinterProfile[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [electricityRate, setElectricityRate] = useState(0);
  const [laborHours, setLaborHours] = useState(0);
  const [laborRate, setLaborRate] = useState(0);
  const [profitPercent, setProfitPercent] = useState(45);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showColorWheel, setShowColorWheel] = useState(false);
  const [remainingWeightInput, setRemainingWeightInput] = useState(0);
  const [editPurchaseCost, setEditPurchaseCost] = useState("");
  const [editCurrency, setEditCurrency] = useState("SAR");
  const [partName, setPartName] = useState("");
  const [deductLines, setDeductLines] = useState<PrintLine[]>([{ key: "deduct-1", filamentId: "", grams: 50 }]);
  const [deductUsage, setDeductUsage] = useState(true);
  const [managementSaving, setManagementSaving] = useState(false);
  const [managementMessage, setManagementMessage] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [fileDragging, setFileDragging] = useState(false);
  const [fileParsing, setFileParsing] = useState(false);
  const [fileParseMessage, setFileParseMessage] = useState("");
  const [parsedPrint, setParsedPrint] = useState<ParsedPrintFile | null>(null);
  const [quoteProjectName, setQuoteProjectName] = useState("");
  const [quoteCustomerName, setQuoteCustomerName] = useState("");
  const [quoteCustomerEmail, setQuoteCustomerEmail] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteValidDays, setQuoteValidDays] = useState(14);
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [quotesRefreshKey, setQuotesRefreshKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isPremium, loading: tierLoading, refreshTier } = useUserTier(accessToken);
  const [profile, setProfile] = useState<Profile>({
    displayName: user.displayName,
    country: "",
    preferredCurrency: "SAR",
    language: "en",
  });
  const [form, setForm] = useState({
    name: "",
    material: "PLA",
    color: "Black",
    colorHex: "#24251f",
    colorHexes: ["#24251f"],
    spoolWeightGrams: "1000",
    purchaseCost: "80",
    currency: "SAR",
  });

  useEffect(() => {
    const saved = storedLanguage();
    if (!saved) return;
    applyDocumentLanguage(saved);
    // Restoring a deliberate local preference is the synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanguage(saved);
  }, []);

  useEffect(() => {
    if (skipInitialLanguagePersistence.current) {
      skipInitialLanguagePersistence.current = false;
      return;
    }
    applyDocumentLanguage(language);
    window.localStorage.setItem("spoolwise-language", language);
  }, [language]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const frame = window.requestAnimationFrame(() => {
      accountMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });

    function closeOnOutsideClick(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        window.requestAnimationFrame(() => accountTriggerRef.current?.focus());
      }
    }

    function moveMenuFocus(event: KeyboardEvent) {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = Array.from(accountMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      if (!items.length || !items.includes(document.activeElement as HTMLElement)) return;
      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[nextIndex].focus();
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("keydown", moveMenuFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("keydown", moveMenuFocus);
    };
  }, [accountMenuOpen]);

  const isArabic = language === "ar";
  const t = (value: string) => isArabic ? (arabic[value] ?? value) : value;
  const money = (value: number, currency: string) => formatMoney(value, currency, language);
  const grams = (value: number) => formatGrams(value, language);
  const formatPercentValue = (value: number) => formatPercent(value, language);
  const number = (value: number, decimals = 1) => formatNumber(value, language, decimals);
  const currencyLabel = (currency: string) => isArabic ? `${currencyName(currency, language)} (${currency})` : currency;
  const hourlyCurrencyUnit = (currency: string) => `${currencySymbol(currency, language)}/${isArabic ? "س" : "h"}`;
  const electricityCurrencyUnit = (currency: string) => `${currencySymbol(currency, language)}/${isArabic ? "ك.و.س" : "kWh"}`;
  const hours = (value: number) => `${number(value, 1)} ${isArabic ? "س" : "h"}`;
  const syncLabel = syncState === "loading"
    ? t("Loading inventory…")
    : syncState === "saving"
      ? t("Saving changes…")
      : syncState === "error"
        ? t("Inventory sync needs attention")
        : t("Inventory saved online");
  const authorization = { Authorization: `Bearer ${accessToken}` };
  const closeUpgrade = useCallback(() => setUpgradeOpen(false), []);
  const handlePremium = useCallback(() => { void refreshTier(); }, [refreshTier]);

  function moveMainTab(event: ReactKeyboardEvent<HTMLButtonElement>, current: MainTab) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs: MainTab[] = ["inventory", "calculator", "records", "printers", "quotes", "slicer"];
    const currentIndex = tabs.indexOf(current);
    const next = event.key === "Home"
      ? tabs[0]
      : event.key === "End"
        ? tabs[tabs.length - 1]
        : tabs[(currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    setActiveTab(next);
    window.requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  }

  useEffect(() => {
    // The printed date is client-only so server and browser markup always agree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReceiptDate(new Date().toLocaleDateString(language === "ar" ? "ar" : "en-GB", {
      year: "numeric", month: "short", day: "numeric",
    }));
  }, [language]);

  async function loadWorkbench() {
    setSyncState("loading");
    try {
      const [response, usageResponse, profileResponse] = await Promise.all([
        fetch("/api/filaments", { cache: "no-store", headers: authorization }),
        fetch("/api/usage", { cache: "no-store", headers: authorization }),
        fetch("/api/profile", { cache: "no-store", headers: authorization }),
      ]);
      if (!response.ok || !usageResponse.ok) throw new Error("Could not load your filament inventory.");
      const data = (await response.json()) as { filaments: Filament[] };
      const usageData = (await usageResponse.json()) as { usage: UsageRecord[] };
      setFilaments(data.filaments);
      setUsage(usageData.usage);

      const firstId = data.filaments[0]?.id ?? "";
      const known = (id: string) => data.filaments.some((item) => item.id === id);
      setPrintLines((lines) => lines.map((line, index) => ({
        ...line,
        filamentId: known(line.filamentId) ? line.filamentId : (index === 0 ? firstId : ""),
      })));
      setDeductLines((lines) => lines.map((line, index) => ({
        ...line,
        filamentId: known(line.filamentId) ? line.filamentId : (index === 0 ? firstId : ""),
      })));
      setManagementFilamentId((current) => known(current) ? current : firstId);

      if (profileResponse.ok) {
        const profileData = (await profileResponse.json()) as { profile: Profile };
        setProfile(profileData.profile);
        setForm((current) => ({ ...current, currency: profileData.profile.preferredCurrency }));
        setLanguage(storedLanguage() ?? profileData.profile.language);
      }
      setSyncState("saved");
    } catch (error) {
      setSyncState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Loading remote inventory is the intended synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkbench();
    // The access token is fixed for the mounted app; refreshes update through Supabase's session listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filamentById = useMemo(
    () => new Map(filaments.map((item) => [item.id, item])),
    [filaments],
  );
  const managedFilament = managementFilamentId ? filamentById.get(managementFilamentId) : undefined;
  const selectedId = printLines[0]?.filamentId ?? "";

  useEffect(() => {
    if (managedFilament) {
      // Keep the management form aligned with the newly selected spool.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemainingWeightInput(managedFilament.remainingWeightGrams);
      setEditPurchaseCost(String(managedFilament.purchaseCost));
      setEditCurrency(managedFilament.currency);
    }
  }, [managedFilament]);

  const printItems = useMemo(() => printLines
    .map((line) => ({ line, filament: filamentById.get(line.filamentId) }))
    .filter((item): item is { line: PrintLine; filament: Filament } => Boolean(item.filament) && item.line.grams > 0),
    [printLines, filamentById]);

  const priceCurrency = printItems[0]?.filament.currency ?? profile.preferredCurrency;
  const selectedPrinter = printers.find((printer) => printer.id === selectedPrinterId);
  const printerCurrencyMismatch = Boolean(selectedPrinter && selectedPrinter.currency !== priceCurrency);
  const mixedCurrency = usesMixedCurrencies(printItems.map((item) => item.filament.currency));
  const pricingAvailable = !mixedCurrency;
  const materialCost = pricingAvailable
    ? printItems.reduce((total, item) =>
      total + (item.filament.purchaseCost / item.filament.spoolWeightGrams) * item.line.grams, 0)
    : 0;
  const totalGrams = printItems.reduce((total, item) => total + item.line.grams, 0);
  const durationHours = Math.max(0, printDurationMinutes || 0) / 60;
  const electricityCost = durationHours * (Math.max(0, printerWatts || 0) / 1000) * Math.max(0, electricityRate || 0);
  const laborCost = Math.max(0, laborHours || 0) * Math.max(0, laborRate || 0);
  const machineCost = printerCurrencyMismatch ? 0 : durationHours * Math.max(0, machineHourlyRate || 0);
  const nonMaterialCosts = Math.max(0, extraCosts || 0) + electricityCost + laborCost + machineCost;
  const totalCost = materialCost + nonMaterialCosts;
  const profitAmount = totalCost * (profitPercent / 100);
  const suggestedPrice = totalCost + profitAmount;
  const receiptRef = useMemo(
    () => estimateReference({
      items: printItems.map((item) => ({
        id: item.filament.id,
        grams: item.line.grams,
        purchaseCost: item.filament.purchaseCost,
        spoolWeightGrams: item.filament.spoolWeightGrams,
        currency: item.filament.currency,
      })),
      extraCosts: nonMaterialCosts,
      profitPercent,
      currency: priceCurrency,
    }),
    [printItems, nonMaterialCosts, profitPercent, priceCurrency],
  );

  const deductedUsage = useMemo(() => usage.filter((item) => item.deducted), [usage]);
  const totalDeducted = useMemo(
    () => deductedUsage.reduce((total, item) => total + item.gramsUsed, 0),
    [deductedUsage],
  );
  const deductedSpoolCount = useMemo(
    () => new Set(deductedUsage.map((item) => item.filamentId)).size,
    [deductedUsage],
  );
  const ledgerUsage = historyFilter === "deducted" ? deductedUsage : usage;
  const deductTotalGrams = deductLines.reduce((total, line) =>
    total + (filamentById.has(line.filamentId) ? Math.max(0, line.grams || 0) : 0), 0);

  async function addFilament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSyncState("saving");
    setMessage("");
    try {
      const response = await fetch("/api/filaments", {
        method: "POST",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { filament?: Filament; error?: string; code?: string };
      if (!response.ok || !data.filament) {
        if (data.code === "FREE_SPOOL_LIMIT") setUpgradeOpen(true);
        throw new Error(data.error || "Could not save this filament.");
      }
      const added = data.filament;
      setFilaments((items) => [added, ...items]);
      setPrintLines((lines) => lines.map((line, index) =>
        index === 0 && !line.filamentId ? { ...line, filamentId: added.id } : line));
      setDeductLines((lines) => lines.map((line, index) =>
        index === 0 && !line.filamentId ? { ...line, filamentId: added.id } : line));
      if (!managementFilamentId) setManagementFilamentId(added.id);
      setForm((current) => ({ ...current, name: "" }));
      setMessage(`${added.name} is ready to price.`);
      setSyncState("saved");
    } catch (error) {
      setSyncState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function removeFilament(id: string) {
    if (!window.confirm(t("Remove this filament permanently?"))) return;
    setMessage("");
    setSyncState("saving");
    try {
      const response = await fetch(`/api/filaments?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authorization,
      });
      if (!response.ok) throw new Error("Could not remove this filament.");
      const next = filaments.filter((item) => item.id !== id);
      setFilaments(next);
      const fallback = next[0]?.id ?? "";
      setPrintLines((lines) => lines.map((line, index) =>
        line.filamentId === id ? { ...line, filamentId: index === 0 ? fallback : "" } : line));
      setDeductLines((lines) => lines.map((line, index) =>
        line.filamentId === id ? { ...line, filamentId: index === 0 ? fallback : "" } : line));
      if (managementFilamentId === id) setManagementFilamentId(fallback);
      setUsage((items) => items.filter((item) => item.filamentId !== id));
      setSyncState("saved");
    } catch (error) {
      setSyncState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  function choosePresetColor(name: string, hex: string) {
    setForm({ ...form, color: name, colorHex: hex, colorHexes: [hex] });
    setShowColorWheel(false);
  }

  function typeColor(value: string) {
    if (form.colorHexes.length > 1) {
      setForm({ ...form, color: value });
      return;
    }
    const colorHex = typedColorToHex(value.trim(), form.colorHex);
    setForm({ ...form, color: value, colorHex, colorHexes: [colorHex] });
  }

  function toggleMulticolor() {
    if (form.colorHexes.length > 1) {
      setForm({ ...form, color: "Custom", colorHexes: [form.colorHex] });
    } else {
      const colors = [form.colorHex, "#2472a4", "#d97948"];
      setForm({ ...form, color: "Multicolor", colorHexes: colors });
      setShowColorWheel(false);
    }
  }

  function updateMulticolor(index: number, value: string) {
    const colors = form.colorHexes.map((color, colorIndex) => colorIndex === index ? value : color);
    setForm({ ...form, colorHex: colors[0], colorHexes: colors });
  }

  function addMulticolorStop() {
    if (form.colorHexes.length >= 6) return;
    setForm({ ...form, colorHexes: [...form.colorHexes, "#85877e"] });
  }

  function removeMulticolorStop(index: number) {
    if (form.colorHexes.length <= 2) return;
    const colors = form.colorHexes.filter((_, colorIndex) => colorIndex !== index);
    setForm({ ...form, colorHex: colors[0], colorHexes: colors });
  }

  function updateLine(
    setLines: (updater: (lines: PrintLine[]) => PrintLine[]) => void,
    key: string,
    patch: Partial<PrintLine>,
  ) {
    setLines((lines) => lines.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function addLine(setLines: (updater: (lines: PrintLine[]) => PrintLine[]) => void, defaultGrams: number) {
    setLines((lines) => lines.length >= MAX_PRINT_LINES
      ? lines
      : [...lines, { key: lineKey(), filamentId: "", grams: defaultGrams }]);
  }

  function removeLine(setLines: (updater: (lines: PrintLine[]) => PrintLine[]) => void, key: string) {
    setLines((lines) => lines.length <= 1 ? lines : lines.filter((line) => line.key !== key));
  }

  async function updateRemainingWeight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!managedFilament) return;
    setManagementSaving(true);
    setSyncState("saving");
    setManagementMessage("");
    try {
      const response = await fetch("/api/filaments", {
        method: "PATCH",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ id: managedFilament.id, remainingWeightGrams: remainingWeightInput }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not update this spool.");
      setFilaments((items) => items.map((item) => item.id === managedFilament.id
        ? { ...item, remainingWeightGrams: remainingWeightInput }
        : item));
      setManagementMessage(`Remaining weight updated to ${grams(remainingWeightInput)}.`);
      setSyncState("saved");
    } catch (error) {
      setSyncState("error");
      setManagementMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setManagementSaving(false);
    }
  }

  async function addUsedPart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entries = deductLines
      .filter((line) => filamentById.has(line.filamentId) && line.grams > 0)
      .map((line) => ({ filamentId: line.filamentId, gramsUsed: line.grams }));
    if (!entries.length) {
      setManagementMessage("Choose at least one spool and a weight above 0g.");
      return;
    }
    setManagementSaving(true);
    setSyncState("saving");
    setManagementMessage("");
    try {
      const response = await fetch("/api/usage", {
        method: "POST",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ partName, deducted: deductUsage, entries }),
      });
      const data = (await response.json()) as {
        usage?: UsageRecord[];
        remaining?: Record<string, number>;
        error?: string;
      };
      if (!response.ok || !data.usage || !data.remaining) {
        throw new Error(data.error || "Could not record this used part.");
      }
      const remaining = data.remaining;
      setUsage((items) => [...data.usage!, ...items]);
      setFilaments((items) => items.map((item) => remaining[item.id] === undefined
        ? item
        : { ...item, remainingWeightGrams: remaining[item.id] }));
      if (managementFilamentId && remaining[managementFilamentId] !== undefined) {
        setRemainingWeightInput(remaining[managementFilamentId]);
      }
      setPartName("");
      const spoolCount = data.usage.length;
      setManagementMessage(`${data.usage[0].partName} recorded across ${spoolCount} ${spoolCount === 1 ? "spool" : "spools"}${deductUsage ? " and deducted" : ""}.`);
      setSyncState("saved");
    } catch (error) {
      setSyncState("error");
      setManagementMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setManagementSaving(false);
    }
  }

  async function updatePurchasePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!managedFilament) return;
    setManagementSaving(true);
    setSyncState("saving");
    setManagementMessage("");
    try {
      const response = await fetch("/api/filaments", {
        method: "PATCH",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ id: managedFilament.id, purchaseCost: editPurchaseCost, currency: editCurrency }),
      });
      const data = (await response.json()) as { purchaseCost?: number; currency?: string; error?: string };
      if (!response.ok || data.purchaseCost === undefined || !data.currency) {
        throw new Error(data.error || "Could not update the purchase price.");
      }
      setFilaments((items) => items.map((item) => item.id === managedFilament.id
        ? { ...item, purchaseCost: data.purchaseCost!, currency: data.currency! }
        : item));
      setEditPurchaseCost(String(data.purchaseCost));
      setManagementMessage(`Purchase price updated to ${money(data.purchaseCost, data.currency)}.`);
      setSyncState("saved");
    } catch (error) {
      setSyncState("error");
      setManagementMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setManagementSaving(false);
    }
  }

  function prepareUsageFromCalculator() {
    if (!printItems.length) return;
    setDeductLines(printItems.map((item, index) => ({
      key: `deduct-${index + 1}-${item.filament.id}`,
      filamentId: item.filament.id,
      grams: item.line.grams,
    })));
    setManagementFilamentId(printItems[0].filament.id);
    setPartName("3D print");
    setDeductUsage(true);
    setRecordsSection("log");
    setActiveTab("records");
  }

  function handlePrintersChange(nextPrinters: PrinterProfile[]) {
    setPrinters(nextPrinters);
    setSelectedPrinterId((current) => {
      const printer = nextPrinters.find((item) => item.id === current)
        ?? nextPrinters.find((item) => item.isDefault)
        ?? nextPrinters[0];
      if (!printer) return "";
      if (printer.id !== current) {
        setPrinterWatts(printer.powerWatts);
        setMachineHourlyRate(printer.hourlyRate);
      }
      return printer.id;
    });
  }

  function choosePrinter(id: string) {
    setSelectedPrinterId(id);
    const printer = printers.find((item) => item.id === id);
    if (!printer) return;
    setPrinterWatts(printer.powerWatts);
    setMachineHourlyRate(printer.hourlyRate);
  }

  async function createInstantQuote() {
    if (!isPremium) {
      setUpgradeOpen(true);
      return;
    }
    if (!quoteProjectName.trim() || !printItems.length || !pricingAvailable || printerCurrencyMismatch) {
      setQuoteMessage(printerCurrencyMismatch
        ? "The selected printer profile uses a different currency. Choose a matching profile or enter the machine rate manually."
        : "Add a project name and at least one priced filament before creating a quote.");
      return;
    }
    setQuoteSaving(true);
    setQuoteMessage("");
    try {
      const validUntil = new Date();
      validUntil.setUTCDate(validUntil.getUTCDate() + Math.max(1, Math.min(365, quoteValidDays || 14)));
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: quoteProjectName,
          customerName: quoteCustomerName,
          customerEmail: quoteCustomerEmail,
          currency: priceCurrency,
          validUntil: validUntil.toISOString().slice(0, 10),
          data: {
            printerId: selectedPrinter?.id ?? null,
            printerName: selectedPrinter?.name ?? "",
            slicer: parsedPrint?.slicer ?? "",
            sourceFileName: parsedPrint?.fileName ?? "",
            durationMinutes: printDurationMinutes,
            items: printItems.map(({ line, filament }) => ({
              filamentId: filament.id,
              name: filament.name,
              material: filament.material,
              color: filament.color,
              grams: line.grams,
              unitCostPerGram: filament.purchaseCost / filament.spoolWeightGrams,
              amount: (filament.purchaseCost / filament.spoolWeightGrams) * line.grams,
            })),
            costs: {
              material: materialCost,
              electricity: electricityCost,
              labor: laborCost,
              machine: machineCost,
              other: Math.max(0, extraCosts || 0),
              total: totalCost,
              profitPercent,
              profit: profitAmount,
              suggestedPrice,
            },
            notes: quoteNotes,
          },
        }),
      });
      const data = await response.json() as { quote?: { quoteNumber: string }; error?: string; code?: string };
      if (!response.ok || !data.quote) {
        if (data.code === "PREMIUM_REQUIRED") setUpgradeOpen(true);
        throw new Error(data.error || "Could not create this quote.");
      }
      setQuoteMessage(`${data.quote.quoteNumber} created.`);
      setQuotesRefreshKey((value) => value + 1);
      setActiveTab("quotes");
    } catch (error) {
      setQuoteMessage(error instanceof Error ? error.message : "Could not create this quote.");
    } finally {
      setQuoteSaving(false);
    }
  }

  async function parseSelectedFile(file: File) {
    if (!isPremium) {
      setUpgradeOpen(true);
      return;
    }
    setFileParsing(true);
    setFileParseMessage("");
    try {
      const parsed = await parsePrintFile(file) as ParsedPrintFile;
      setParsedPrint(parsed);
      if (parsed.totalWeightGrams > 0) {
        setPrintLines((lines) => lines.map((line, index) => index === 0 ? { ...line, grams: parsed.totalWeightGrams } : line));
      }
      if (parsed.durationSeconds > 0) setPrintDurationMinutes(Math.round(parsed.durationSeconds / 60));
      setFileParseMessage("File parsed privately on this device. Nothing was uploaded.");
    } catch (error) {
      setParsedPrint(null);
      setFileParseMessage(error instanceof Error ? error.message : "Could not read this sliced file.");
    } finally {
      setFileParsing(false);
    }
  }

  function handleFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setFileDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void parseSelectedFile(file);
  }

  const accountInitial = (profile.displayName || user.email || "S").slice(0, 1).toUpperCase();

  function renderLineEditor(
    lines: PrintLine[],
    setLines: (updater: (lines: PrintLine[]) => PrintLine[]) => void,
    options: { idPrefix: string; defaultGrams: number; disabled?: boolean },
  ) {
    return (
      <div className="print-lines">
        {lines.map((line, index) => {
          const filament = filamentById.get(line.filamentId);
          return (
            <div className="print-line" key={line.key}>
              <span className="print-line-index" aria-hidden="true">{index + 1}</span>
              <span
                className="print-line-swatch"
                style={{ background: filament ? filamentFill(filament.colorHexes, filament.colorHex) : "#d5d2c8" }}
                aria-hidden="true"
              />
              <select
                aria-label={`${t("Select filament")} ${index + 1}`}
                value={line.filamentId}
                disabled={options.disabled || !filaments.length}
                onChange={(event) => updateLine(setLines, line.key, { filamentId: event.target.value })}
              >
                <option value="">{filaments.length ? t("Select filament") : t("Add a filament first")}</option>
                {filaments.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.material} · {t(item.color)}</option>
                ))}
              </select>
              <div className="unit-input print-line-grams">
                <input
                  aria-label={`${t("Filament used")} ${index + 1}`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={line.grams}
                  disabled={options.disabled}
                  onChange={(event) => updateLine(setLines, line.key, { grams: Number(event.target.value) })}
                />
                <span>{isArabic ? "غ" : "g"}</span>
              </div>
              <button
                className="line-remove"
                type="button"
                aria-label={t("Remove this spool")}
                disabled={lines.length <= 1}
                onClick={() => removeLine(setLines, line.key)}
              >
                ×
              </button>
              {filament && (
                <div className="print-line-meta">
                  <FilamentBar percent={remainingPercent(filament)} size="sm" />
                  <small>{grams(filament.remainingWeightGrams)} {t("left")}</small>
                </div>
              )}
            </div>
          );
        })}
        <button
          className="line-add plus-action"
          type="button"
          id={`${options.idPrefix}-add`}
          disabled={options.disabled || lines.length >= MAX_PRINT_LINES || !filaments.length}
          onClick={() => addLine(setLines, options.defaultGrams)}
        >
          <span className="plus-label">{t("Add filament")}</span><span className="plus-symbol" aria-hidden="true">+</span>
        </button>
      </div>
    );
  }

  return (
    <main dir={isArabic ? "rtl" : "ltr"} lang={language}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label={isArabic ? "سبول وايز — الرئيسية" : "Spoolwise home"}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-word">{isArabic ? "سبول وايز" : "spoolwise"}</span>
        </a>
        <div className="topbar-actions">
          <button className={`tier-button ${isPremium ? "is-premium" : ""}`} type="button" onClick={() => { if (!isPremium) setUpgradeOpen(true); }} disabled={tierLoading}>
            {isPremium ? t("Premium") : t("Free · Upgrade")}
          </button>
          <div className="save-status" data-state={syncState} role="status" aria-live="polite"><span aria-hidden="true" /> <em>{syncLabel}</em></div>
          <button
            className="language-toggle"
            type="button"
            aria-label={isArabic ? "اختيار اللغة" : "Choose language"}
            onClick={() => setLanguage(isArabic ? "en" : "ar")}
          >
            <span aria-hidden="true">◎</span>
            {isArabic ? "English" : "العربية"}
          </button>
          <div className="user-menu" ref={accountMenuRef}>
            <button
              ref={accountTriggerRef}
              className="user-menu-trigger"
              type="button"
              aria-label={t("Account")}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              onClick={() => setAccountMenuOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setAccountMenuOpen(true);
                }
              }}
            >
              <span aria-hidden="true">{accountInitial}</span>
            </button>
            {accountMenuOpen && (
              <div className="user-menu-popover" role="menu" aria-label={t("Account")}>
                <p>{t("Signed in as")}</p>
                <strong>{profile.displayName || user.email}</strong>
                <small>{user.email}</small>
                <a href="/account" role="menuitem">
                  <span aria-hidden="true">☰</span>
                  {t("Account")}
                </a>
                <button type="button" role="menuitem" className="sign-out-item" onClick={() => void onSignOut()}>
                  <span aria-hidden="true">↪</span>
                  {t("Sign out")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">{t("3D PRINT COSTING WORKBENCH")}</p>
          <h1>{t("Know your cost.")}<br /><em>{t("Price with confidence.")}</em></h1>
        </div>
        <p className="intro-copy">
          {t("Save your filament spools, enter the grams used, and get a clear selling price in seconds.")}
        </p>
      </section>

      <div className="app-tabs" aria-label={t("Spoolwise sections")} role="tablist">
        <button
          className={activeTab === "inventory" ? "active" : ""}
          type="button"
          role="tab"
          id="tab-inventory"
          aria-controls="panel-inventory"
          aria-selected={activeTab === "inventory"}
          tabIndex={activeTab === "inventory" ? 0 : -1}
          onKeyDown={(event) => moveMainTab(event, "inventory")}
          onClick={() => setActiveTab("inventory")}
        >
          <span>01</span>
          <strong>{t("Inventory")}</strong>
          <small>{t("Add & manage filaments")}</small>
        </button>
        <button
          className={activeTab === "calculator" ? "active" : ""}
          type="button"
          role="tab"
          id="tab-calculator"
          aria-controls="panel-calculator"
          aria-selected={activeTab === "calculator"}
          tabIndex={activeTab === "calculator" ? 0 : -1}
          onKeyDown={(event) => moveMainTab(event, "calculator")}
          onClick={() => setActiveTab("calculator")}
        >
          <span>02</span>
          <strong>{t("Calculator")}</strong>
          <small>{t("Cost & price a print")}</small>
        </button>
        <button
          className={activeTab === "records" ? "active" : ""}
          type="button"
          role="tab"
          id="tab-records"
          aria-controls="panel-records"
          aria-selected={activeTab === "records"}
          tabIndex={activeTab === "records" ? 0 : -1}
          onKeyDown={(event) => moveMainTab(event, "records")}
          onClick={() => setActiveTab("records")}
        >
          <span>03</span>
          <strong>{t("Records")}</strong>
          <small>{t("Log & review filament use")}</small>
        </button>
        <button
          className={activeTab === "printers" ? "active" : ""}
          type="button"
          role="tab"
          id="tab-printers"
          aria-controls="panel-printers"
          aria-selected={activeTab === "printers"}
          tabIndex={activeTab === "printers" ? 0 : -1}
          onKeyDown={(event) => moveMainTab(event, "printers")}
          onClick={() => setActiveTab("printers")}
        >
          <span>04</span>
          <strong>{t("Printers")}</strong>
          <small>{t("Profiles & machine rates")}</small>
        </button>
        <button
          className={activeTab === "quotes" ? "active" : ""}
          type="button"
          role="tab"
          id="tab-quotes"
          aria-controls="panel-quotes"
          aria-selected={activeTab === "quotes"}
          tabIndex={activeTab === "quotes" ? 0 : -1}
          onKeyDown={(event) => moveMainTab(event, "quotes")}
          onClick={() => setActiveTab("quotes")}
        >
          <span>05</span>
          <strong>{t("Quotes")}</strong>
          <small>{t("Instant quotes & PDFs")}</small>
        </button>
        <button
          className={activeTab === "slicer" ? "active" : ""}
          type="button"
          role="tab"
          id="tab-slicer"
          aria-controls="panel-slicer"
          aria-selected={activeTab === "slicer"}
          tabIndex={activeTab === "slicer" ? 0 : -1}
          onKeyDown={(event) => moveMainTab(event, "slicer")}
          onClick={() => setActiveTab("slicer")}
        >
          <span>06</span>
          <strong>{t("Connections")}</strong>
          <small>{t("Desktop app")}</small>
        </button>
      </div>

      {activeTab === "inventory" && (
        <nav className="section-subtabs" aria-label={t("Inventory sections")}>
          <button className={`plus-tab${inventorySection === "add" ? " active" : ""}`} type="button" onClick={() => setInventorySection("add")}>
            <span className="plus-symbol" aria-hidden="true">+</span>
            <div><strong>{t("Add inventory")}</strong><small>{t("Add and view filament spools")}</small></div>
          </button>
          <button className={inventorySection === "manage" ? "active" : ""} type="button" onClick={() => setInventorySection("manage")}>
            <span aria-hidden="true">↕</span>
            <div><strong>{t("Manage inventory")}</strong><small>{t("Adjust weight, price and stock")}</small></div>
          </button>
        </nav>
      )}

      {activeTab === "records" && (
        <nav className="section-subtabs" aria-label={t("Record sections")}>
          <button className={recordsSection === "log" ? "active" : ""} type="button" onClick={() => setRecordsSection("log")}>
            <span aria-hidden="true">✎</span>
            <div><strong>{t("Record filament use")}</strong><small>{t("Log a part and deduct its spools")}</small></div>
          </button>
          <button className={recordsSection === "history" ? "active" : ""} type="button" onClick={() => setRecordsSection("history")}>
            <span aria-hidden="true">≡</span>
            <div><strong>{t("Usage history")}</strong><small>{t("Totals and the full ledger")}</small></div>
          </button>
        </nav>
      )}

      <section className="workspace" aria-label={t("Spoolwise sections")}>
        {activeTab === "inventory" && inventorySection === "add" && (
        <aside className="panel inventory-panel" id="panel-inventory" role="tabpanel" aria-labelledby="tab-inventory">
          <div className="panel-heading">
            <div>
              <p className="step">01A / {t("ADD INVENTORY")}</p>
              <h2>{t("Your filaments")}</h2>
            </div>
            <span className="count">{filaments.length} {filaments.length === 1 ? t("spool") : t("spools")}</span>
          </div>

          <form className="inventory-form" onSubmit={addFilament}>
            <label className="field field-wide">
              <span>{t("Filament name")}</span>
              <input
                required
                placeholder={t("e.g. Matte Black")}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{t("Material")}</span>
              <select value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })}>
                {materialOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <div className="field color-field field-wide">
              <span>{t("Colour")}</span>
              <div className="typed-color">
                <span className="typed-color-preview" style={{ background: filamentFill(form.colorHexes, form.colorHex) }} aria-hidden="true" />
                <input
                  required
                  aria-label={t("Type a filament colour")}
                  placeholder={t("Type a colour, e.g. Red")}
                  value={t(form.color)}
                  onChange={(event) => typeColor(event.target.value)}
                />
              </div>
              <div className="color-presets" role="group" aria-label={t("Quick colour choices")}>
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={form.colorHexes.length === 1 && form.color.toLowerCase() === preset.name.toLowerCase() ? "selected" : ""}
                    aria-label={t(preset.name)}
                    aria-pressed={form.color.toLowerCase() === preset.name.toLowerCase()}
                    title={t(preset.name)}
                    style={{ "--preset-color": preset.hex } as React.CSSProperties}
                    onClick={() => choosePresetColor(preset.name, preset.hex)}
                  />
                ))}
                <button
                  className={`multicolor-button ${form.colorHexes.length > 1 ? "selected" : ""}`}
                  type="button"
                  aria-pressed={form.colorHexes.length > 1}
                  onClick={toggleMulticolor}
                >
                  <span className="multicolor-icon" aria-hidden="true" /> {t("Multicolor roll")}
                </button>
                <button
                  className={`custom-color-button plus-action ${showColorWheel ? "selected" : ""}`}
                  type="button"
                  aria-expanded={showColorWheel}
                  onClick={() => setShowColorWheel((shown) => !shown)}
                >
                  <span className="plus-label">{t("Custom colour")}</span><span className="plus-symbol" aria-hidden="true">+</span>
                </button>
              </div>
              {showColorWheel && (
                <div className="color-wheel-row">
                  <input
                    type="color"
                    aria-label={t("Choose a custom filament colour")}
                    value={form.colorHex}
                    onChange={(event) => setForm({ ...form, color: "Custom", colorHex: event.target.value, colorHexes: [event.target.value] })}
                  />
                  <span>{t("Pick any colour from the wheel")}</span>
                  <code>{form.colorHex.toUpperCase()}</code>
                </div>
              )}
              {form.colorHexes.length > 1 && (
                <div className="multicolor-editor">
                  <div className="multicolor-editor-heading">
                    <span>{t("Colours in this roll")}</span>
                    <small>{form.colorHexes.length} {t("colour stops")}</small>
                  </div>
                  <div className="multicolor-stops">
                    {form.colorHexes.map((color, index) => (
                      <label key={`${index}-${color}`}>
                        <input type="color" value={color} aria-label={`${t("Multicolor roll colour")} ${number(index + 1, 0)}`} onChange={(event) => updateMulticolor(index, event.target.value)} />
                        <span>{number(index + 1, 0)}</span>
                        {form.colorHexes.length > 2 && (
                          <button type="button" aria-label={`${t("Remove colour")} ${number(index + 1, 0)}`} onClick={() => removeMulticolorStop(index)}>×</button>
                        )}
                      </label>
                    ))}
                    {form.colorHexes.length < 6 && <button className="add-color-stop plus-action" type="button" onClick={addMulticolorStop}><span className="plus-label">{t("Add colour")}</span><span className="plus-symbol" aria-hidden="true">+</span></button>}
                  </div>
                </div>
              )}
            </div>
            <label className="field">
              <span>{t("Spool weight")}</span>
              <div className="unit-input">
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={form.spoolWeightGrams}
                  onChange={(event) => setForm({ ...form, spoolWeightGrams: event.target.value })}
                />
                <span>{isArabic ? "غ" : "g"}</span>
              </div>
            </label>
            <label className="field">
              <span>{t("Purchase cost")}</span>
              <div className="cost-input">
                <select
                  aria-label={t("Currency")}
                  value={form.currency}
                  onChange={(event) => setForm({ ...form, currency: event.target.value })}
                >
                  {currencyOptions.map((option) => <option key={option} value={option}>{currencyLabel(option)}</option>)}
                </select>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={form.purchaseCost}
                  onChange={(event) => setForm({ ...form, purchaseCost: event.target.value })}
                />
              </div>
            </label>
            <button className="add-button plus-action field-wide" disabled={saving} type="submit">
              <span className="plus-label">{saving ? t("Saving…") : t("Add to inventory")}</span><span className="plus-symbol" aria-hidden="true">+</span>
            </button>
          </form>

          {message && <p className="form-message" role="status">{message}</p>}

          <div className="spool-list" aria-live="polite">
            {loading && <p className="empty-state">{t("Loading your workbench…")}</p>}
            {!loading && filaments.length === 0 && (
              <p className="empty-state">{t("No filaments yet. Add your first spool above.")}</p>
            )}
            {filaments.map((item) => {
              const percent = remainingPercent(item);
              return (
                <article className={`spool-card ${item.id === selectedId ? "selected" : ""}`} key={item.id}>
                  <button
                    className="spool-main"
                    type="button"
                    onClick={() => updateLine(setPrintLines, printLines[0].key, { filamentId: item.id })}
                  >
                    <span className="spool-swatch" style={{ "--swatch": item.colorHex, background: filamentFill(item.colorHexes, item.colorHex) } as React.CSSProperties} aria-hidden="true"><span /></span>
                    <span className="spool-details">
                      <strong>{item.name}</strong>
                      <span>{item.material} · {t(item.color)}</span>
                    </span>
                    <span className="spool-price">
                      <strong>{money(item.purchaseCost, item.currency)}</strong>
                      <span>{grams(item.spoolWeightGrams)}</span>
                    </span>
                    <span className="spool-progress">
                      <FilamentBar percent={percent} />
                      <span className="spool-progress-meta">
                        <b>{formatPercentValue(percent)} {t("left")}</b>
                        <span>{grams(item.remainingWeightGrams)} / {grams(item.spoolWeightGrams)}</span>
                      </span>
                    </span>
                  </button>
                  <button className="remove-button" type="button" aria-label={`${t("Remove")} ${item.name}`} onClick={() => void removeFilament(item.id)}>×</button>
                </article>
              );
            })}
          </div>
        </aside>
        )}

        {activeTab === "inventory" && inventorySection === "manage" && (
        <section className="panel management-panel" id="panel-inventory" role="tabpanel" aria-labelledby="tab-inventory">
          <div className="panel-heading">
            <div>
              <p className="step">01B / {t("INVENTORY MANAGEMENT")}</p>
              <h2>{t("Manage spool weight")}</h2>
            </div>
            <span className="count">{filaments.length} {filaments.length === 1 ? t("spool") : t("spools")}</span>
          </div>

          <div className="management-body">
            <div className="management-column">
              <label className="field">
                <span>{t("Select a spool")}</span>
                <select value={managementFilamentId} onChange={(event) => setManagementFilamentId(event.target.value)} disabled={!filaments.length}>
                  {!filaments.length && <option>{t("Add a filament first")}</option>}
                  {filaments.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} · {item.material} · {t(item.color)}</option>
                  ))}
                </select>
              </label>

              {managedFilament ? (
                <div className="weight-card">
                  <div className="weight-card-top">
                    <span className="spool-swatch large-swatch" style={{ "--swatch": managedFilament.colorHex, background: filamentFill(managedFilament.colorHexes, managedFilament.colorHex) } as React.CSSProperties} aria-hidden="true"><span /></span>
                    <div>
                      <strong>{managedFilament.name}</strong>
                      <span>{managedFilament.material} · {t(managedFilament.color)}</span>
                    </div>
                    <div className="weight-number">
                      <strong>{grams(managedFilament.remainingWeightGrams)}</strong>
                      <span>{t("remaining")}</span>
                    </div>
                  </div>
                  <div className="weight-progress">
                    <FilamentBar percent={remainingPercent(managedFilament)} size="lg" />
                    <output>{formatPercentValue(remainingPercent(managedFilament))}</output>
                  </div>
                  <div className="weight-scale">
                    <span>{grams(0)}</span>
                    <span>{t("Original")}: {grams(managedFilament.spoolWeightGrams)}</span>
                  </div>
                </div>
              ) : <p className="empty-state">{t("Add a filament to start managing spool weight.")}</p>}

              <form className="management-form" onSubmit={updateRemainingWeight}>
                <div>
                  <h3>{t("Set remaining weight")}</h3>
                  <p>{t("Use this after weighing a spool or correcting its current amount.")}</p>
                </div>
                <label className="field">
                  <span>{t("Weight currently on spool")}</span>
                  <div className="unit-input large-input compact-input">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={remainingWeightInput}
                      onChange={(event) => setRemainingWeightInput(Number(event.target.value))}
                      disabled={!managedFilament}
                    />
                    <span>{t("grams")}</span>
                  </div>
                </label>
                <button className="secondary-button" type="submit" disabled={!managedFilament || managementSaving}>{t("Update spool weight")}</button>
              </form>
            </div>

            <div className="management-column">
              <form className="management-form" onSubmit={updatePurchasePrice}>
                <div>
                  <h3>{t("Edit purchase price")}</h3>
                  <p>{t("Update what this spool cost. Prices in the calculator refresh automatically.")}</p>
                </div>
                <label className="field">
                  <span>{t("Spool purchase price")}</span>
                  <div className="cost-input price-edit-input">
                    <select aria-label={t("Purchase price currency")} value={editCurrency} onChange={(event) => setEditCurrency(event.target.value)}>
                      {currencyOptions.map((option) => <option key={option} value={option}>{currencyLabel(option)}</option>)}
                    </select>
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={editPurchaseCost}
                      onChange={(event) => setEditPurchaseCost(event.target.value)}
                      disabled={!managedFilament}
                    />
                  </div>
                </label>
                <button className="secondary-button" type="submit" disabled={!managedFilament || managementSaving}>{t("Save purchase price")}</button>
              </form>
            </div>

            {managementMessage && <p className="management-message management-status" role="status">{managementMessage}</p>}

            <div className="inventory-overview">
              <div className="subsection-heading">
                <div>
                  <p className="mini-step">{t("AVAILABLE FILAMENTS")}</p>
                  <h3>{t("Complete inventory")}</h3>
                </div>
                <span>{filaments.length} {filaments.length === 1 ? t("spool") : t("spools")} {t("available")}</span>
              </div>
              {filaments.length === 0 ? (
                <p className="empty-state">{t("No filaments in inventory yet.")}</p>
              ) : (
                <div className="inventory-table-scroll">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>{t("Filament")}</th>
                        <th>{t("Material")}</th>
                        <th>{t("Colour")}</th>
                        <th>{t("Spool size")}</th>
                        <th>{t("Available")}</th>
                        <th>{t("Purchase price")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filaments.map((item) => {
                        const percent = remainingPercent(item);
                        return (
                          <tr key={item.id}>
                            <td data-label={t("Filament")}>
                              <div className="table-filament-name">
                                <span className="record-swatch" style={{ "--record-color": item.colorHex, background: filamentFill(item.colorHexes, item.colorHex) } as React.CSSProperties} aria-hidden="true" />
                                <strong>{item.name}</strong>
                              </div>
                            </td>
                            <td data-label={t("Material")}><span className="material-pill">{item.material}</span></td>
                            <td data-label={t("Colour")}>
                              <div className="table-color-name">
                                <strong>{t(item.color)}</strong>
                                <small>{item.colorHexes.length > 1 ? `${item.colorHexes.length} ${t("colours")}` : item.colorHex.toUpperCase()}</small>
                              </div>
                            </td>
                            <td data-label={t("Spool size")}>{grams(item.spoolWeightGrams)}</td>
                            <td data-label={t("Available")}>
                              <div className="table-availability">
                                <strong>{grams(item.remainingWeightGrams)} · {formatPercentValue(percent)}</strong>
                                <FilamentBar percent={percent} size="sm" />
                              </div>
                            </td>
                            <td data-label={t("Purchase price")}>{money(item.purchaseCost, item.currency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
        )}

        {activeTab === "calculator" && (
        <section className="panel calculator-panel" id="panel-calculator" role="tabpanel" aria-labelledby="tab-calculator">
          <div className="panel-heading calculator-heading">
            <div>
              <p className="step">02 / {t("PRICE YOUR PRINT")}</p>
              <h2>{t("Print calculator")}</h2>
            </div>
            <p>{t("Markup is added on top of your total production cost.")}</p>
          </div>

          <div className="calculator-body">
            <div className="calculator-inputs">
              <div className="field field-wide">
                <span>{t("Print file")}</span>
                <div
                  className={`print-dropzone${fileDragging ? " is-dragging" : ""}${!isPremium ? " is-locked" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => isPremium ? fileInputRef.current?.click() : setUpgradeOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    if (isPremium) fileInputRef.current?.click();
                    else setUpgradeOpen(true);
                  }}
                  onDragEnter={(event) => { event.preventDefault(); setFileDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFileDragging(false); }}
                  onDrop={handleFileDrop}
                >
                  <input ref={fileInputRef} type="file" accept=".gcode,.gco,.3mf" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseSelectedFile(file); event.currentTarget.value = ""; }} />
                  <span className="dropzone-icon" aria-hidden="true">⇩</span>
                  <strong>{fileParsing ? t("Reading sliced file…") : t("Drop a sliced .gcode or .3mf file here")}</strong>
                  <small>{isPremium ? t("or choose a file") : t("Upgrade to use file parsing")}</small>
                  <em>{t("Premium parses locally on your device — files are never uploaded.")}</em>
                </div>
                {fileParseMessage && <p className="file-parse-message" role="status">{fileParseMessage}</p>}
                {parsedPrint && (
                  <div className="parsed-print-summary">
                    <strong>{parsedPrint.fileName}</strong>
                    <span>{t("Model")}: {grams(parsedPrint.modelWeightGrams)}</span>
                    <span>{t("Purge & tower waste")}: {grams(parsedPrint.wasteWeightGrams)}</span>
                    <span>{t("Print duration")}: {number(Math.floor(parsedPrint.durationSeconds / 3600), 0)} {isArabic ? "س" : "h"} {number(Math.round((parsedPrint.durationSeconds % 3600) / 60), 0)} {isArabic ? "د" : "m"}</span>
                    {parsedPrint.slicer && <span>{parsedPrint.slicer}</span>}
                    {parsedPrint.warnings.map((warning) => <small key={warning}>{warning}</small>)}
                  </div>
                )}
              </div>
              <div className="field field-wide">
                <span>{t("Filaments in this print")} <small>{t("Add a row for every colour")}</small></span>
                {renderLineEditor(printLines, setPrintLines, { idPrefix: "print", defaultGrams: 25 })}
              </div>
              <div className="field field-wide premium-inline-control">
                <span>{t("Printer profile")} <small>{t("Premium")}</small></span>
                {isPremium ? (
                  <div className="printer-select-row">
                    <select value={selectedPrinterId} onChange={(event) => choosePrinter(event.target.value)}>
                      <option value="">{t("Manual printer settings")}</option>
                      {printers.map((printer) => <option key={printer.id} value={printer.id}>{printer.name}{printer.isDefault ? ` · ${t("Default")}` : ""}</option>)}
                    </select>
                    <button type="button" className="secondary-button" onClick={() => setActiveTab("printers")}>{t("Manage profiles")}</button>
                  </div>
                ) : (
                  <button type="button" className="locked-inline-feature" onClick={() => setUpgradeOpen(true)}>{t("Unlock reusable printer power and machine rates")}</button>
                )}
                {printerCurrencyMismatch && <p className="field-warning" role="alert">This printer profile uses {selectedPrinter?.currency}; the current print uses {priceCurrency}. Its machine rate is excluded.</p>}
              </div>
              <div className="calculator-metrics field-wide">
                <label className="field metric-field">
                  <span>{t("Print duration")}</span>
                  <div className="dual-metric-input">
                    <div className="unit-input"><input type="number" min="0" step="1" value={Math.floor(printDurationMinutes / 60)} onChange={(event) => setPrintDurationMinutes(Math.max(0, Number(event.target.value)) * 60 + (printDurationMinutes % 60))} /><span>{t("Hours")}</span></div>
                    <div className="unit-input"><input type="number" min="0" max="59" step="1" value={Math.round(printDurationMinutes % 60)} onChange={(event) => setPrintDurationMinutes(Math.floor(printDurationMinutes / 60) * 60 + Math.min(59, Math.max(0, Number(event.target.value))))} /><span>{t("Minutes")}</span></div>
                  </div>
                </label>
                <label className="field metric-field"><span>{t("Printer power")}</span><div className="unit-input"><input type="number" min="0" step="1" value={printerWatts} onChange={(event) => setPrinterWatts(Number(event.target.value))} /><span>{isArabic ? "واط" : "W"}</span></div></label>
                <label className="field metric-field"><span>{t("Electricity rate")}</span><div className="unit-input"><input type="number" min="0" step="0.01" value={electricityRate} onChange={(event) => setElectricityRate(Number(event.target.value))} /><span>{electricityCurrencyUnit(priceCurrency)}</span></div></label>
                <label className="field metric-field"><span>{t("Labor time")}</span><div className="unit-input"><input type="number" min="0" step="0.25" value={laborHours} onChange={(event) => setLaborHours(Number(event.target.value))} /><span>{t("Hours")}</span></div></label>
                <label className="field metric-field"><span>{t("Labor rate")}</span><div className="unit-input"><input type="number" min="0" step="0.01" value={laborRate} onChange={(event) => setLaborRate(Number(event.target.value))} /><span>{hourlyCurrencyUnit(priceCurrency)}</span></div></label>
                <label className="field metric-field"><span>{t("Machine rate")}</span><div className="unit-input"><input type="number" min="0" step="0.01" value={machineHourlyRate} onChange={(event) => setMachineHourlyRate(Number(event.target.value))} /><span>{hourlyCurrencyUnit(priceCurrency)}</span></div></label>
              </div>
              <label className="field metric-field field-wide">
                <span>{t("Other costs")} <small>{t("optional")}</small></span>
                <div className="unit-input large-input">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={extraCosts}
                    onChange={(event) => setExtraCosts(Number(event.target.value))}
                  />
                  <span>{currencySymbol(priceCurrency, language)}</span>
                </div>
              </label>

              <div className="markup-control field-wide">
                <div className="markup-label">
                  <div>
                    <span>{t("Profit markup")}</span>
                    <small>{t("Move the slider to set your target")}</small>
                  </div>
                  <output>{formatPercentValue(profitPercent)}</output>
                </div>
                <input
                  aria-label="Profit markup percentage"
                  className="range"
                  type="range"
                  min="0"
                  max="200"
                  step="5"
                  value={profitPercent}
                  onChange={(event) => setProfitPercent(Number(event.target.value))}
                  style={{ "--range-progress": `${profitPercent / 2}%` } as React.CSSProperties}
                />
                <div className="range-labels"><span>{formatPercentValue(0)}</span><span>{formatPercentValue(100)}</span><span>{formatPercentValue(200)}</span></div>
              </div>

              <div className="instant-quote-builder field-wide">
                <div className="instant-quote-heading"><div><span className="premium-pill">{t("Premium")}</span><h3>{t("Create instant quote")}</h3></div><p>{t("Save this calculation as a customer quote and export a branded PDF.")}</p></div>
                <div className="two-field-row">
                  <label className="field"><span>{t("Project name")}</span><input maxLength={120} placeholder={t("e.g. Custom enclosure")} value={quoteProjectName} onChange={(event) => setQuoteProjectName(event.target.value)} /></label>
                  <label className="field"><span>{t("Customer name")}</span><input maxLength={120} placeholder={t("Optional")} value={quoteCustomerName} onChange={(event) => setQuoteCustomerName(event.target.value)} /></label>
                </div>
                <div className="two-field-row">
                  <label className="field"><span>{t("Customer email")}</span><input type="email" maxLength={180} placeholder={t("Optional")} value={quoteCustomerEmail} onChange={(event) => setQuoteCustomerEmail(event.target.value)} /></label>
                  <label className="field"><span>{t("Valid for")}</span><div className="unit-input"><input type="number" min="1" max="365" value={quoteValidDays} onChange={(event) => setQuoteValidDays(Number(event.target.value))} /><span>{t("days")}</span></div></label>
                </div>
                <label className="field"><span>{t("Quote notes")}</span><textarea maxLength={1000} rows={3} placeholder={t("Lead time, finish, delivery, or payment notes")} value={quoteNotes} onChange={(event) => setQuoteNotes(event.target.value)} /></label>
                <button type="button" className="primary-action" disabled={quoteSaving || !printItems.length} onClick={() => void createInstantQuote()}>{quoteSaving ? t("Creating quote…") : isPremium ? t("Create instant quote") : t("Unlock instant quotes")}</button>
                {quoteMessage && <p className="form-message" role="status">{quoteMessage}</p>}
              </div>
            </div>

            <div className="receipt" aria-live="polite">
              <div className="receipt-paper">
                <div className="receipt-head">
                  <p className="receipt-brand">SPOOLWISE</p>
                  <p className="receipt-kicker">{t("LIVE COST BREAKDOWN")}</p>
                  <p className="receipt-address">{t("Cost estimate · not a tax invoice")}</p>
                </div>

                <dl className="receipt-meta">
                  <div><dt>{t("Date")}</dt><dd>{receiptDate || "—"}</dd></div>
                  <div><dt>{t("Ref")}</dt><dd>{receiptRef}</dd></div>
                  <div><dt>{t("Items")}</dt><dd>{printItems.length}</dd></div>
                </dl>

                <div className="receipt-perforation" aria-hidden="true" />

                <div className="receipt-columns" aria-hidden="true">
                  <span>{t("Item")}</span><span>{t("Qty")}</span><span>{t("Amount")}</span>
                </div>

                <div className="receipt-items">
                  {printItems.length === 0 && (
                    <p className="receipt-empty">{t("Select a filament to see your price.")}</p>
                  )}
                  {printItems.map(({ line, filament }) => (
                    <div className="receipt-item" key={line.key}>
                      <span className="receipt-item-name">
                        <i style={{ background: filamentFill(filament.colorHexes, filament.colorHex) }} aria-hidden="true" />
                        {filament.name}
                      </span>
                      <span className="receipt-item-qty">{grams(line.grams)}</span>
                      <span className="receipt-item-amount">
                        {money((filament.purchaseCost / filament.spoolWeightGrams) * line.grams, filament.currency)}
                      </span>
                    </div>
                  ))}
                  {Math.max(0, extraCosts || 0) > 0 && (
                    <div className="receipt-item">
                      <span className="receipt-item-name"><i className="extra-dot" aria-hidden="true" />{t("Other costs")}</span>
                      <span className="receipt-item-qty">1</span>
                      <span className="receipt-item-amount">{money(extraCosts, priceCurrency)}</span>
                    </div>
                  )}
                  {electricityCost > 0 && (
                    <div className="receipt-item">
                      <span className="receipt-item-name"><i className="energy-dot" aria-hidden="true" />{t("Electricity")}</span>
                      <span className="receipt-item-qty">{hours(durationHours)}</span>
                      <span className="receipt-item-amount">{money(electricityCost, priceCurrency)}</span>
                    </div>
                  )}
                  {laborCost > 0 && (
                    <div className="receipt-item">
                      <span className="receipt-item-name"><i className="labor-dot" aria-hidden="true" />{t("Labor")}</span>
                      <span className="receipt-item-qty">{hours(laborHours)}</span>
                      <span className="receipt-item-amount">{money(laborCost, priceCurrency)}</span>
                    </div>
                  )}
                  {machineCost > 0 && (
                    <div className="receipt-item">
                      <span className="receipt-item-name"><i className="machine-dot" aria-hidden="true" />{t("Machine")}</span>
                      <span className="receipt-item-qty">{hours(durationHours)}</span>
                      <span className="receipt-item-amount">{money(machineCost, priceCurrency)}</span>
                    </div>
                  )}
                </div>

                {mixedCurrency && (
                  <p className="receipt-warning" role="alert">
                    {t("Spools use different currencies, so totals are not converted.")} {t("Choose spools priced in one currency to calculate a total.")}
                  </p>
                )}

                <div className="receipt-rule" />
                <div className="receipt-row total-cost">
                  <span>{t("Total production cost")}</span>
                  <span>{pricingAvailable ? money(totalCost, priceCurrency) : "—"}</span>
                </div>
                <div className="receipt-row profit-row">
                  <span>{t("Your profit")} <small>({formatPercentValue(profitPercent)} {t("markup")})</small></span>
                  <span>{pricingAvailable ? `+ ${money(profitAmount, priceCurrency)}` : "—"}</span>
                </div>

                <div className="suggested-price">
                  <span>{t("Suggested selling price")}</span>
                  <strong>{pricingAvailable ? money(suggestedPrice, priceCurrency) : "—"}</strong>
                  <small>{pricingAvailable
                    ? t("Round this up to a customer-friendly price.")
                    : t("Choose spools priced in one currency to calculate a total.")}</small>
                </div>

                <button className="record-usage-button" type="button" onClick={prepareUsageFromCalculator} disabled={!printItems.length}>
                  <span>{t("Use")} {grams(totalGrams)} {printItems.length > 1 ? `${t("across")} ${printItems.length} ${t("spools")}` : t("from this spool")}</span>
                  <strong>{t("Record & deduct")} {isArabic ? "←" : "→"}</strong>
                </button>

                <div className="receipt-barcode" aria-hidden="true"><span /><code>SPW-{receiptRef}</code></div>
                <p className="receipt-footnote">{t("Keep this estimate with your build notes.")}</p>
              </div>
              <svg className="receipt-teeth" viewBox="0 0 96 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d={receiptTeethPath} fill="currentColor" />
              </svg>
            </div>
          </div>
        </section>
        )}

        {activeTab === "printers" && (
          <PrinterProfilesPanel
            accessToken={accessToken}
            isPremium={isPremium}
            onUpgrade={() => setUpgradeOpen(true)}
            printers={printers}
            onPrintersChange={handlePrintersChange}
            language={language}
          />
        )}

        {activeTab === "quotes" && (
          <QuotesPanel
            accessToken={accessToken}
            isPremium={isPremium}
            onUpgrade={() => setUpgradeOpen(true)}
            refreshKey={quotesRefreshKey}
            language={language}
          />
        )}

        {activeTab === "slicer" && (
          <SlicerConnectionsPanel
            isPremium={isPremium}
            onUpgrade={() => setUpgradeOpen(true)}
            onOpenCalculator={() => setActiveTab("calculator")}
            language={language}
          />
        )}

        {activeTab === "records" && recordsSection === "log" && (
        <section className="panel records-panel" id="panel-records" role="tabpanel" aria-labelledby="tab-records">
          <div className="panel-heading">
            <div>
              <p className="step">03A / {t("RECORD FILAMENT USE")}</p>
              <h2>{t("Record filament used")}</h2>
            </div>
            <span className="count">{usage.length} {usage.length === 1 ? t("used part") : t("used parts")}</span>
          </div>

          <div className="records-body record-log-body">
            <form className="management-form used-part-form" onSubmit={addUsedPart}>
              <div>
                <p className="mini-step">{t("USED SUBPART")}</p>
                <h3>{t("Add a used part")}</h3>
                <p>{t("Add every colour used by a part, prototype, support, or failed print.")}</p>
              </div>
              <label className="field">
                <span>{t("Subpart name")}</span>
                <input
                  required
                  placeholder={t("e.g. Left hinge prototype")}
                  value={partName}
                  onChange={(event) => setPartName(event.target.value)}
                  disabled={!filaments.length}
                />
              </label>
              <div className="field">
                <span>{t("Spools used by this part")} <small>{t("One row per colour")}</small></span>
                {renderLineEditor(deductLines, setDeductLines, {
                  idPrefix: "deduct",
                  defaultGrams: 25,
                  disabled: !filaments.length,
                })}
              </div>
              <label className="deduct-option">
                <input aria-label={t("Deduct from spool totals")} type="checkbox" checked={deductUsage} onChange={(event) => setDeductUsage(event.target.checked)} />
                <span>
                  <strong>{t("Deduct from spool totals")}</strong>
                  <small>{t("Every spool above loses the weight you entered.")} {grams(deductTotalGrams)}.</small>
                </span>
              </label>
              <button className="add-button plus-action" type="submit" disabled={!filaments.length || managementSaving}>
                <span className="plus-label">{managementSaving ? t("Saving…") : t("Add used subpart")}</span><span className="plus-symbol" aria-hidden="true">+</span>
              </button>
            </form>
            {managementMessage && <p className="management-message" role="status">{managementMessage}</p>}

            <div className="usage-history">
              <div className="subsection-heading">
                <div>
                  <p className="mini-step">{t("RECENT ACTIVITY")}</p>
                  <h3>{t("Used subparts")}</h3>
                </div>
                <span>{t("Newest first")}</span>
              </div>
              <div className="usage-list">
                {usage.length === 0 && <p className="empty-state">{t("No used subparts recorded yet.")}</p>}
                {usage.slice(0, 8).map((item) => (
                  <article className="usage-row" key={item.id}>
                    <span className="usage-dot" aria-hidden="true" />
                    <div>
                      <strong>{item.partName}</strong>
                      <span>{item.filamentName} · {new Date(item.createdAt).toLocaleDateString(language === "ar" ? "ar-SA" : "en-GB")}</span>
                    </div>
                    <div className="usage-amount">
                      <strong>{grams(item.gramsUsed)}</strong>
                      <span>{item.deducted ? t("Deducted") : t("Log only")}</span>
                    </div>
                  </article>
                ))}
              </div>
              {usage.length > 8 && (
                <button className="secondary-button ledger-link" type="button" onClick={() => setRecordsSection("history")}>
                  {t("See the full usage history")}
                </button>
              )}
            </div>
          </div>
        </section>
        )}

        {activeTab === "records" && recordsSection === "history" && (
        <section className="panel records-panel" id="panel-records" role="tabpanel" aria-labelledby="tab-records">
          <div className="panel-heading">
            <div>
              <p className="step">03B / {t("DEDUCTION RECORDS")}</p>
              <h2>{t("Deducted filament")}</h2>
            </div>
            <span className="count">{deductedUsage.length} {deductedUsage.length === 1 ? t("record") : t("records")}</span>
          </div>

          <div className="records-body">
            <div className="record-summary">
              <article>
                <span>{t("Total deducted")}</span>
                <strong>{grams(totalDeducted)}</strong>
                <small>{t("Across every recorded print and subpart")}</small>
              </article>
              <article>
                <span>{t("Deductions")}</span>
                <strong>{deductedUsage.length}</strong>
                <small>{t("Individual usage records")}</small>
              </article>
              <article>
                <span>{t("Spools used")}</span>
                <strong>{deductedSpoolCount}</strong>
                <small>{t("Filament spools with deductions")}</small>
              </article>
            </div>

            <div className="record-ledger">
              <div className="record-ledger-heading">
                <div>
                  <p className="mini-step">{t("FULL LEDGER")}</p>
                  <h3>{historyFilter === "deducted" ? t("All deducted weights") : t("Every recorded part")}</h3>
                </div>
                <div className="ledger-filter" role="group" aria-label={t("Filter records")}>
                  <button
                    type="button"
                    className={historyFilter === "deducted" ? "active" : ""}
                    aria-pressed={historyFilter === "deducted"}
                    onClick={() => setHistoryFilter("deducted")}
                  >
                    {t("Deducted only")}
                  </button>
                  <button
                    type="button"
                    className={historyFilter === "all" ? "active" : ""}
                    aria-pressed={historyFilter === "all"}
                    onClick={() => setHistoryFilter("all")}
                  >
                    {t("All records")}
                  </button>
                </div>
              </div>
              {ledgerUsage.length === 0 ? (
                <div className="records-empty">
                  <strong>{historyFilter === "deducted" ? t("No deductions yet") : t("No records yet")}</strong>
                  <p>{t("Record a used subpart and choose “Deduct from spool totals” to see it here.")}</p>
                  <button type="button" className="secondary-button" onClick={() => setRecordsSection("log")}>
                    {t("Record filament use")}
                  </button>
                </div>
              ) : (
                <div className="record-list">
                  <div className="record-table-head" aria-hidden="true">
                    <span>{t("Part / print")}</span><span>{t("Spool")}</span><span>{t("Date")}</span><span>{t("Weight")}</span>
                  </div>
                  {ledgerUsage.map((item) => {
                    const filament = filamentById.get(item.filamentId);
                    return (
                      <article className="record-row" key={item.id}>
                        <div className="record-part">
                          <span className="record-swatch" style={{ "--record-color": filament?.colorHex ?? "#85877e", background: filamentFill(filament?.colorHexes, filament?.colorHex ?? "#85877e") } as React.CSSProperties} aria-hidden="true" />
                          <strong>{item.partName}</strong>
                        </div>
                        <span>{item.filamentName}</span>
                        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(language === "ar" ? "ar-SA" : "en-GB", { year: "numeric", month: "short", day: "numeric" })}</time>
                        <div className="record-weight">
                          <strong className={item.deducted ? "deducted-weight" : "logged-weight"}>
                            {item.deducted ? "−" : ""}{grams(item.gramsUsed)}
                          </strong>
                          {!item.deducted && <small>{t("Log only")}</small>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
        )}

      </section>

      <footer>
        <p>{t("Made for makers who want the numbers to make sense.")}</p>
      </footer>
      {upgradeOpen && <UpgradeModal open accessToken={accessToken} onClose={closeUpgrade} onPremium={handlePremium} />}
    </main>
  );
}
