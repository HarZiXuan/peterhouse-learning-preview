"use client";

export function RemoveChild({ name, action }: { name: string; action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Remove ${name} and their report? This cannot be undone.`)) e.preventDefault();
      }}
    >
      <button className="btn-text" title={`Remove ${name}`}>Remove</button>
    </form>
  );
}
