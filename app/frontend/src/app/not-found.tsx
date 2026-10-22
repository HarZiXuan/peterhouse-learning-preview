import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-content-center gap-3 px-4 text-center">
      <h1 className="font-heading text-3xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">That address does not lead anywhere.</p>
      <div className="mt-2">
        <Button asChild>
          <Link href="/">Back to the start</Link>
        </Button>
      </div>
    </main>
  );
}
