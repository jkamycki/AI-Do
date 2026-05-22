import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

export interface AddressSuggestion {
  display: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

const STREET_FALLBACK_RE = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|pl|place|pkwy|parkway|way|terrace|ter|circle|cir|hwy|highway)\b/i;

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (s: AddressSuggestion) => void;
  placeholder?: string;
  country?: string | null;
  className?: string;
  id?: string;
}

function normalizePart(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function deriveStreetLine(result: Record<string, unknown>, road: string, houseNumber: string) {
  const display = typeof result.display_name === "string" ? result.display_name : "";
  const parts = display.split(",").map(normalizePart).filter(Boolean);
  const normalizedRoad = road.toLowerCase();
  const roadIndex = road
    ? parts.findIndex((part) => part.toLowerCase() === normalizedRoad || part.toLowerCase().includes(normalizedRoad))
    : -1;

  if (houseNumber && road) return `${houseNumber} ${road}`;

  if (road && roadIndex > -1) {
    const roadPart = parts[roadIndex];
    const previous = parts[roadIndex - 1] ?? "";
    if (/^\d+[A-Za-z0-9-]*$/.test(previous)) return `${previous} ${road}`;
    if (/\d/.test(roadPart)) return roadPart;
  }

  if (road) {
    const addressLikePart = parts.find((part) => /\d/.test(part) && part.toLowerCase().includes(normalizedRoad));
    if (addressLikePart) return addressLikePart;
    return road;
  }

  return parts.find((part) => /\d/.test(part) && STREET_FALLBACK_RE.test(part)) ?? "";
}

function parseResult(result: Record<string, unknown>): AddressSuggestion | null {
  const a = (result.address ?? {}) as Record<string, string>;
  const display = typeof result.display_name === "string" ? result.display_name : "";
  const road = normalizePart(a.road ?? a.pedestrian ?? a.residential ?? a.footway ?? a.path ?? "");
  const houseNumber = a.house_number ?? "";
  const street = deriveStreetLine(result, road, houseNumber);
  if (!street) return null;
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
  const isoLevel4 = a["ISO3166-2-lvl4"] ?? "";
  const state = isoLevel4 ? isoLevel4.replace(/^[A-Z]+-/, "") : a.state ?? "";
  const zip = a.postcode ?? "";
  return { display, street, city, state, zip };
}

export function AddressAutocomplete({ value, onChange, onSelect, placeholder, country, className, id }: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const scopedQuery = country?.trim() ? `${q}, ${country.trim()}` : q;
    setLoading(true);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(scopedQuery)}&format=json&limit=5&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en-US,en;q=0.9" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as Record<string, unknown>[];
      const parsed = data.map(parseResult).filter((s): s is AddressSuggestion => s !== null);
      setSuggestions(parsed);
      setOpen(parsed.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [country]);

  function handleChange(val: string) {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 500);
  }

  function handleSelect(s: AddressSuggestion) {
    onChange(s.street);
    onSelect(s);
    setSuggestions([]);
    setOpen(false);
  }

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div ref={containerRef} className={`relative${className ? ` ${className}` : ""}`}>
      <Input
        id={id}
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-md max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="flex items-start gap-2 w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
              onMouseDown={() => handleSelect(s)}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span className="leading-snug line-clamp-2">{s.display}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
