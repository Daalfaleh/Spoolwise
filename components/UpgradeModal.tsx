"use client";

import { useEffect, useId, useRef, useState } from "react";

type CheckoutConfig = {
  alreadyPremium?: boolean;
  orderId: string;
  amountHalalas: number;
  currency: "SAR";
  publishableKey: string;
  callbackUrl: string;
  methods: string[];
  samsungPayServiceId: string | null;
  supportedNetworks: string[];
  metadata: Record<string, string>;
};

type MoyasarWindow = Window & {
  Moyasar?: {
    init(options: Record<string, unknown>): void;
  };
};

const MOYASAR_VERSION = "2.2.10";
const SCRIPT_URL = `https://cdn.jsdelivr.net/npm/moyasar-payment-form@${MOYASAR_VERSION}/dist/moyasar.umd.min.js`;
const STYLE_URL = `https://cdn.jsdelivr.net/npm/moyasar-payment-form@${MOYASAR_VERSION}/dist/moyasar.css`;
const LOAD_TIMEOUT_MS = 10_000;

function loadMoyasar() {
  const existing = (window as MoyasarWindow).Moyasar;
  if (existing) return Promise.resolve(existing);
  if (!document.querySelector(`link[href="${STYLE_URL}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLE_URL;
    document.head.appendChild(link);
  }
  return new Promise<NonNullable<MoyasarWindow["Moyasar"]>>((resolve, reject) => {
    const prior = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    // A script element that has already loaded or failed will not emit another
    // load event. Replace it so retrying the checkout always starts a fresh load.
    prior?.remove();
    const script = document.createElement("script");
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      callback();
    };
    const onLoad = () => {
      const sdk = (window as MoyasarWindow).Moyasar;
      finish(() => {
        if (sdk) resolve(sdk);
        else reject(new Error("Moyasar did not initialize."));
      });
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", () => finish(() => {
      script.remove();
      reject(new Error("Could not load secure checkout."));
    }), { once: true });
    const timeout = window.setTimeout(() => finish(() => {
      script.remove();
      reject(new Error("Secure checkout took too long to load."));
    }), LOAD_TIMEOUT_MS);
    script.src = SCRIPT_URL;
    script.async = true;
    document.head.appendChild(script);
  });
}

export default function UpgradeModal({ open, accessToken, onClose, onPremium }: {
  open: boolean;
  accessToken: string;
  onClose: () => void;
  onPremium: () => void;
}) {
  const id = useId().replace(/:/g, "");
  const initialized = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    let cancelled = false;
    async function initialize() {
      if (initialized.current) return;
      initialized.current = true;
      try {
        const [response, sdk] = await Promise.all([
          fetch("/api/subscribe", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }),
          loadMoyasar(),
        ]);
        const config = await response.json() as CheckoutConfig & { error?: string };
        if (!response.ok) throw new Error(config.error || "Checkout is unavailable.");
        if (config.alreadyPremium) {
          onPremium();
          onClose();
          return;
        }
        if (cancelled) return;
        const target = document.getElementById(id);
        if (target) target.replaceChildren();
        const samsungPay = config.samsungPayServiceId ? {
          service_id: config.samsungPayServiceId,
          order_number: config.orderId,
          country: "SA",
          label: "Spoolwise",
          environment: "PRODUCTION",
          save_card: true,
        } : undefined;
        sdk.init({
          element: `#${id}`,
          amount: config.amountHalalas,
          currency: config.currency,
          description: "Spoolwise Premium — monthly plan",
          publishable_api_key: config.publishableKey,
          callback_url: config.callbackUrl,
          methods: config.methods,
          supported_networks: config.supportedNetworks,
          metadata: config.metadata,
          credit_card: { save_card: true },
          apple_pay: {
            country: "SA",
            label: "Spoolwise",
            validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate",
            save_card: true,
          },
          ...(samsungPay ? { samsung_pay: samsungPay } : {}),
          on_completed: async (payment: { id?: string }) => {
            if (!payment.id) return;
            await fetch("/api/subscribe", {
              method: "PATCH",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: config.orderId, paymentId: payment.id }),
            });
          },
        });
        setStatus("ready");
      } catch (error) {
        initialized.current = false;
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Checkout is unavailable.");
          setStatus("error");
        }
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, [accessToken, attempt, id, onClose, onPremium, open]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function keepFocusInDialog(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInDialog);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keepFocusInDialog);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="upgrade-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="upgrade-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} tabIndex={-1}>
        <button ref={closeButtonRef} className="upgrade-close" type="button" onClick={onClose} aria-label="Close checkout">×</button>
        <div className="upgrade-intro">
          <span className="premium-pill">Premium</span>
          <h2 id={`${id}-title`}>Unlock file-powered costing</h2>
          <p id={`${id}-description`}>Drop a G-code or 3MF file to fill print time, model filament and purge waste automatically.</p>
          <div lang="ar" dir="rtl" className="upgrade-arabic">
            <h3>فعّل المزايا الاحترافية</h3>
            <p>ارفع ملف G-code أو 3MF محلياً لحساب وقت الطباعة ووزن المجسم والهدر تلقائياً.</p>
          </div>
          <ul>
            <li>Unlimited filament inventory</li>
            <li>Private, on-device file parsing</li>
            <li>Printer profiles and automatic slicer sync in the upcoming desktop app</li>
            <li>Instant customer quotes with branded PDF exports</li>
            <li>Monthly plan — cancel future renewal anytime</li>
          </ul>
          <p className="payment-note">Secure checkout supports mada and cards, plus Apple Pay or STC Pay when available. Samsung Pay appears after merchant service setup. Google Pay is not offered by Moyasar&apos;s current web form.</p>
        </div>
        <div className="upgrade-checkout">
          {status === "loading" && <p className="checkout-status" role="status" aria-live="polite">Loading secure checkout…</p>}
          {status === "error" && <div className="checkout-error" role="alert"><p>{message}</p><button type="button" onClick={() => { initialized.current = false; setStatus("loading"); setMessage(""); setAttempt((value) => value + 1); }}>Try again</button></div>}
          <div id={id} className="mysr-form" hidden={status === "error"} />
        </div>
      </section>
    </div>
  );
}
