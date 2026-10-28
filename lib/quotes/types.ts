export type QuoteLine = {
  filamentId: string;
  name: string;
  material: string;
  color: string;
  grams: number;
  unitCostPerGram: number;
  amount: number;
};

export type QuoteCostBreakdown = {
  material: number;
  electricity: number;
  labor: number;
  machine: number;
  other: number;
  total: number;
  profitPercent: number;
  profit: number;
  suggestedPrice: number;
};

export type QuoteData = {
  printerId: string | null;
  printerName: string;
  slicer: string;
  sourceFileName: string;
  durationMinutes: number;
  items: QuoteLine[];
  costs: QuoteCostBreakdown;
  notes: string;
};

export type QuoteRecord = {
  id: string;
  quoteNumber: string;
  projectName: string;
  customerName: string;
  customerEmail: string;
  currency: string;
  status: "draft" | "sent" | "accepted" | "expired";
  totalCost: number;
  suggestedPrice: number;
  validUntil: string | null;
  data: QuoteData;
  createdAt: string;
  updatedAt: string;
};
