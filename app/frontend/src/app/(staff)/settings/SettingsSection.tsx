/** The title of one settings page, under the shared Settings header. */
export function SettingsSection({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-5">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 max-w-2xl text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
