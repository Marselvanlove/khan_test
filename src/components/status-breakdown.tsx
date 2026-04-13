"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OperationsStatusFlowItem } from "@/shared/types";

interface StatusBreakdownProps {
  rows: OperationsStatusFlowItem[];
  activeGroup?: string | null;
  onSelect?: (group: string) => void;
}

export function StatusBreakdown({ rows, activeGroup = null, onSelect }: StatusBreakdownProps) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Status Flow</p>
        <CardTitle>Срез по статусным группам</CardTitle>
        <CardDescription>
          Показывает, где поток застревает. Клик по карточке фильтрует рабочие очереди ниже.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.length ? (
          rows.map((row) => {
            const isActive = activeGroup === row.group;

            return (
              <button
                key={row.group}
                type="button"
                onClick={() => onSelect?.(row.group)}
                className={cn(
                  "rounded-xl border border-border/70 bg-background/70 p-4 text-left transition-colors",
                  onSelect && "hover:border-primary/40",
                  isActive && "border-primary/50 bg-primary/5",
                )}
              >
                <p className="text-3xl font-semibold leading-none">{row.count}</p>
                <p className="mt-2 text-sm text-foreground">{row.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.share.toFixed(1)}% потока</p>
              </button>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
            Статусы пока не загружены.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
