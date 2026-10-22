import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Shown inside the staff screens (so the menu stays) when a child, class or report no longer exists. */
export default function StaffNotFound() {
  return (
    <main className="mx-auto grid max-w-md gap-3 px-4 py-24 text-center">
      <h1 className="font-heading text-3xl font-bold">We can’t find that</h1>
      <p className="text-muted-foreground">It may have been removed, or it belongs to a semester where this child has no report. Go back to your list and open it from there.</p>
      <div className="mt-2 flex justify-center gap-2">
        <Button asChild>
          <Link href="/">Back to the start</Link>
        </Button>
      </div>
    </main>
  );
}
