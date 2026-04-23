import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | string | null | undefined;
  onChange?: (value: string) => void;
  onValueChange?: (value: number | null) => void;
  className?: string;
}

function formatDisplay(raw: string): string {
  if (raw === "" || raw === "-") return raw;
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return "";
  const [intPart, decPart] = cleaned.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${withCommas}.${decPart.slice(0, 2)}` : withCommas;
}

function toRawNumber(display: string): string {
  const cleaned = display.replace(/[^\d.]/g, "");
  const [intPart, decPart] = cleaned.split(".");
  if (decPart !== undefined) return `${intPart}.${decPart.slice(0, 2)}`;
  return intPart;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, onValueChange, className, onBlur, placeholder = "0.00", ...rest }, ref) => {
    const initial = value === null || value === undefined || value === "" ? "" : String(value);
    const [display, setDisplay] = React.useState(formatDisplay(initial));

    React.useEffect(() => {
      const next = value === null || value === undefined || value === "" ? "" : String(value);
      const raw = toRawNumber(display);
      if (raw !== next) setDisplay(formatDisplay(next));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const formatted = formatDisplay(e.target.value);
      setDisplay(formatted);
      const raw = toRawNumber(formatted);
      onChange?.(raw);
      const num = parseFloat(raw);
      if (!isNaN(num)) onValueChange?.(num);
      else if (raw === "") onValueChange?.(null);
    }

    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
      const raw = toRawNumber(display);
      if (raw !== "" && !isNaN(parseFloat(raw))) {
        const num = parseFloat(raw);
        const fixed = num.toFixed(2);
        setDisplay(formatDisplay(fixed));
        onChange?.(fixed);
        onValueChange?.(num);
      }
      onBlur?.(e);
    }

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
          $
        </span>
        <Input
          {...rest}
          ref={ref}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn("pl-7 text-right tabular-nums", className)}
        />
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";
