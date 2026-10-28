"use client";

import { useCallback, useEffect, useState } from "react";

export type TierState = {
  tier: "free" | "premium";
  status: string;
  currentPeriodEnd: string | null;
};

const freeTier: TierState = { tier: "free", status: "inactive", currentPeriodEnd: null };

export function useUserTier(accessToken: string) {
  const [state, setState] = useState<TierState>(freeTier);
  const [loading, setLoading] = useState(true);

  const refreshTier = useCallback(async () => {
    try {
      const response = await fetch("/api/tier", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Could not load subscription status.");
      const data = await response.json() as TierState;
      setState(data.tier === "premium" ? data : freeTier);
    } catch {
      setState(freeTier);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    // Loading the remote tier is the intended synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshTier();
  }, [refreshTier]);

  return { ...state, loading, isPremium: state.tier === "premium", refreshTier };
}
