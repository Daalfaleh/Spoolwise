import { spoolwiseSlicerBridge } from "@/lib/slicer/bridge-script";

export async function GET() {
  return new Response(spoolwiseSlicerBridge, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": 'attachment; filename="spoolwise-slicer-bridge.ps1"',
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
