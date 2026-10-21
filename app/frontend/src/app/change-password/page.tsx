import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password · Peterhouse Learning Review" };

export default function ChangePasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-sm">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Choose a new password</h1>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">Please replace the temporary password you were given. A few random words is a good idea.</p>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
