import { useState } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese (Simplified)", "Japanese", "Korean", "Arabic", "Hindi",
  "Russian", "Dutch", "Polish",
];

interface LanguagePickerProps {
  value: string;
  onChange: (lang: string) => void;
  variant?: "header" | "default";
  className?: string;
}

export function LanguagePicker({ value, onChange, variant = "default", className }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);

  function select(lang: string) {
    onChange(lang);
    setOpen(false);
  }

  if (variant === "header") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-1.5 text-white/70 hover:text-primary hover:bg-white/5 px-3 h-9",
              className
            )}
          >
            <Globe className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline text-sm">{value}</span>
            <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-48"
          align="start"
          side="bottom"
          sideOffset={6}
          avoidCollisions
          collisionPadding={8}
        >
          <ScrollArea className="max-h-64">
            <div className="py-1">
              {LANGUAGES.map(lang => (
                <button
                  key={lang}
                  onClick={() => select(lang)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                    lang === value && "text-primary font-medium"
                  )}
                >
                  {lang}
                  {lang === value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-56 justify-between bg-background font-normal", className)}
        >
          <span className="truncate">{value}</span>
          <ChevronDown className={cn("h-4 w-4 opacity-50 flex-shrink-0 transition-transform duration-200", open && "rotate-180")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-56"
        align="start"
        avoidCollisions
        collisionPadding={8}
      >
        <ScrollArea className="max-h-64">
          <div className="py-1">
            {LANGUAGES.map(lang => (
              <button
                key={lang}
                onClick={() => select(lang)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                  lang === value && "text-primary font-medium"
                )}
              >
                {lang}
                {lang === value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
