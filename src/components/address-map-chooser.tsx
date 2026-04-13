"use client";

import { MapPinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buildMapLinks } from "@/shared/maps";
import { cn } from "@/lib/utils";

interface AddressMapChooserProps {
  address: string | null;
  city?: string | null;
  className?: string;
  compact?: boolean;
}

export function AddressMapChooser({
  address,
  city,
  className,
  compact = false,
}: AddressMapChooserProps) {
  const links = buildMapLinks(address, city);
  const label = [city, address].filter(Boolean).join(", ") || "Адрес не указан";

  if (!links.length) {
    return <span className={cn("text-muted-foreground", className)}>{label}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={compact ? "ghost" : "outline"}
          size={compact ? "sm" : "default"}
          className={cn(
            "h-auto max-w-full justify-start px-0 text-left whitespace-normal",
            compact && "px-2",
            className,
          )}
        >
          <MapPinIcon className="mt-0.5 size-4 shrink-0" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Открыть адрес</PopoverTitle>
          <PopoverDescription>
            Выберите карту для просмотра адреса клиента.
          </PopoverDescription>
        </PopoverHeader>
        <div className="grid gap-2">
          {links.map((link) => (
            <Button key={link.label} asChild variant="outline" className="justify-start">
              <a href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
