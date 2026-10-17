import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password · Peterhouse Learning Review" };

export default function ChangePasswordPage() {
  return (
    <main className="login-page">
      <div className="login-disc login-disc-gold" aria-hidden />
      <div className="login-disc login-disc-sky" aria-hidden />
      <section className="login-card">
        <h1>Choose a new password</h1>
        <p className="muted small">Please replace the temporary password you were given. Use at least 10 characters. A few random words is a good idea.</p>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
