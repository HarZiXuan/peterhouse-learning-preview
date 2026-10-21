import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in · Peterhouse Learning Review" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; out?: string }> }) {
  const { next, out } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/peterhouse-shield.png" alt="Peterhouse Preschool" className="mb-5 h-16 w-auto" />
        <h1 className="font-heading text-3xl font-bold tracking-tight">Learning Review</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">Peterhouse Preschool · staff only</p>
        {out && (
          <Alert className="mb-4" role="status">
            <AlertDescription>You are signed out.</AlertDescription>
          </Alert>
        )}
        <LoginForm next={next ?? "/"} />
      </section>
    </main>
  );
}
