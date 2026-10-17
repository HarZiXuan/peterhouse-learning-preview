"use client";

export function StartSemester({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Start the next semester now? The current semester will be closed. This cannot be undone.")) e.preventDefault();
      }}
    >
      <button className="btn">Start next semester</button>
    </form>
  );
}
