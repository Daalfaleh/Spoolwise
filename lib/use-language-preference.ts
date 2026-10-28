"use client";

import { useEffect, useState } from "react";
import { applyDocumentLanguage, storedLanguage } from "./i18n";

export function useLanguagePreference() {
  const [preference, setPreference] = useState<{ language: "en" | "ar"; ready: boolean }>({
    language: "en",
    ready: false,
  });

  useEffect(() => {
    const language = storedLanguage() ?? "en";
    applyDocumentLanguage(language);
    // Reading the browser preference is the intended synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreference({ language, ready: true });
  }, []);

  return preference;
}
