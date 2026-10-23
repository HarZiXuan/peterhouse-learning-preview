import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A page's h1 with its icon in a small tile: the same icon as the page's entry in the sidebar (docs/DESIGN-SYSTEM.md). */
export function PageTitle({ icon, children, className }: { icon: IconName; children: ReactNode; className?: string }) {
  return (
    <h1 className={cn("flex items-center gap-2.5 text-2xl font-semibold tracking-tight", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-card text-muted-foreground">
        <Icon name={icon} size={18} />
      </span>
      {children}
    </h1>
  );
}

/** A row of numbers or facts across the top of an admin page, in one bordered strip. */
export function StatStrip({ items, className }: { items: { label: string; value: ReactNode; note?: ReactNode; icon?: IconName }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4", className)}>
      {items.map((f) => (
        <div key={f.label} className="grid content-start gap-1 bg-card px-5 py-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {f.icon && <Icon name={f.icon} size={14} />}
            {f.label}
          </dt>
          <dd className="text-xl font-semibold tabular-nums">{f.value}</dd>
          {f.note && <dd className="text-xs text-muted-foreground">{f.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** A card with a title bar (icon, title, count, a line of help and an action) above a table or list. */
export function SectionCard({
  title,
  icon,
  count,
  description,
  action,
  children,
  className,
}: {
  title: string;
  icon?: IconName;
  count?: number;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0 shadow-none", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="grid gap-0.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {icon && (
              <span className="text-muted-foreground">
                <Icon name={icon} size={16} />
              </span>
            )}
            {title} {count !== undefined && <span className="font-normal text-muted-foreground">{count}</span>}
          </h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
