import type { ReactNode } from "react";
import { Construction } from "lucide-react";

export function PageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {children ?? <EmptyShell />}
    </div>
  );
}

export function EmptyShell({ label = "Halaman ini siap dikembangkan" }: { label?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground">
        <Construction className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{label}</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Struktur halaman, route, dan navigasi sudah aktif. Logic bisnis menyusul setelah backend
        disambungkan.
      </p>
    </div>
  );
}
