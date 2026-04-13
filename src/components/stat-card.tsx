import { InfoIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StatCardProps {
  eyebrow: string;
  value: string;
  hint: string;
  tone?: "default" | "accent";
}

export function StatCard({ eyebrow, value, hint, tone = "default" }: StatCardProps) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-card/85 shadow-sm backdrop-blur",
        tone === "accent" &&
          "border-primary/20 bg-linear-to-br from-primary/10 via-card/95 to-accent/5",
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-700">
            {eyebrow}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                suppressHydrationWarning
                className="inline-flex size-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                <InfoIcon className="size-3.5" />
                <span className="sr-only">{hint}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 text-balance">{hint}</TooltipContent>
          </Tooltip>
        </div>
        <CardTitle className="text-pretty text-3xl font-semibold leading-none sm:text-4xl">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm leading-6 text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
