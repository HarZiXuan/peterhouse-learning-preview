import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in · Peterhouse Learning Review" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="login-page">
      <div className="login-disc login-disc-gold" aria-hidden />
      <div className="login-disc login-disc-sky" aria-hidden />
      <section className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/peterhouse-shield.png" alt="Peterhouse Preschool" className="login-shield" />
        <h1>Learning Review</h1>
        <p className="muted small">Peterhouse Preschool · staff only</p>
        <LoginForm next={next ?? "/"} />
      </section>
    </main>
  );
}
