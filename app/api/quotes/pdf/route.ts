import { getD1 } from "@/db/filaments";
import { getQuote } from "@/db/quotes";
import { createQuotePdf } from "@/lib/quotes/pdf";
import { requirePremiumUser } from "@/lib/subscriptions/server";

export async function GET(request: Request) {
  const auth = await requirePremiumUser(request, "PDF quote exports");
  if (auth.response) return auth.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "A quote id is required." }, { status: 400 });
  const quote = await getQuote(auth.user.id, id);
  if (!quote) return Response.json({ error: "Quote not found." }, { status: 404 });
  const profile = await getD1().prepare("SELECT display_name FROM profiles WHERE owner_id = ?")
    .bind(auth.user.id).first<{ display_name: string }>();
  const bytes = await createQuotePdf(quote, profile?.display_name || "Spoolwise studio", auth.user.email ?? "");
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.quoteNumber}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
