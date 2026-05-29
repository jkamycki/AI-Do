import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, Search } from "lucide-react";

export interface AddressSuggestion {
  display: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

const STREET_FALLBACK_RE = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|pl|place|pkwy|parkway|way|terrace|ter|circle|cir|hwy|highway)\b/i;

const COUNTRY_CODES: Record<string, string> = {
  "United States": "us",
  "United States of America": "us",
  USA: "us",
  US: "us",
  Canada: "ca",
  Mexico: "mx",
  "United Kingdom": "gb",
  UK: "gb",
  Ireland: "ie",
  Australia: "au",
  "New Zealand": "nz",
};

const ROAD_ABBREVIATIONS: Record<string, string> = {
  st: "street",
  ave: "avenue",
  rd: "road",
  blvd: "boulevard",
  dr: "drive",
  ln: "lane",
  ct: "court",
  pl: "place",
  pkwy: "parkway",
  cir: "circle",
  hwy: "highway",
};

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

function normalizeAddressKey(value: string) {
  return value.toLowerCase().replace(/[^\da-z]+/g, " ").trim();
}

function expandRoadAbbreviations(value: string) {
  return value.replace(/\b(st|ave|rd|blvd|dr|ln|ct|pl|pkwy|cir|hwy)\b\.?/gi, (match) => {
    const key = match.toLowerCase().replace(".", "");
    return ROAD_ABBREVIATIONS[key] ?? match;
  });
}

function countryCodeFor(country: string | null | undefined) {
  const key = country?.trim();
  if (!key) return "";
  return COUNTRY_CODES[key] ?? key.slice(0, 2).toLowerCase();
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

function parsePhotonResult(result: Record<string, unknown>): AddressSuggestion | null {
  const p = (result.properties ?? {}) as Record<string, string>;
  const streetName = normalizePart(p.street ?? p.name ?? "");
  const houseNumber = normalizePart(p.housenumber ?? "");
  const street = houseNumber && streetName ? `${houseNumber} ${streetName}` : streetName;
  if (!street || !STREET_FALLBACK_RE.test(street)) return null;
  const city = p.city ?? p.town ?? p.village ?? p.county ?? "";
  const state = p.state ?? "";
  const zip = p.postcode ?? "";
  const display = [street, city, state, zip, p.country].filter(Boolean).join(", ");
  return { display, street, city, state, zip };
}

function rankSuggestion(query: string, suggestion: AddressSuggestion) {
  const q = normalizeAddressKey(query);
  const street = normalizeAddressKey(suggestion.street);
  const display = normalizeAddressKey(suggestion.display);
  let score = 0;
  if (/\d/.test(suggestion.street)) score += 10;
  if (suggestion.zip) score += 4;
  if (suggestion.city) score += 3;
  if (street && q.startsWith(street.slice(0, Math.min(street.length, q.length)))) score += 6;
  if (display.includes(q)) score += 5;
  return score;
}

function uniqueSuggestions(query: string, suggestions: AddressSuggestion[]) {
  const seen = new Set<string>();
  return suggestions
    .filter((suggestion) => {
      const key = normalizeAddressKey([suggestion.street, suggestion.city, suggestion.state, suggestion.zip].filter(Boolean).join(" "));
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => rankSuggestion(query, b) - rankSuggestion(query, a))
    .slice(0, 8);
}

export function AddressAutocomplete({ value, onChange, onSelect, placeholder, country, className, id }: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const requestId = ++requestRef.current;
    const expandedQuery = expandRoadAbbreviations(trimmed);
    const scopedQuery = country?.trim() ? `${expandedQuery}, ${country.trim()}` : expandedQuery;
    const countryCode = countryCodeFor(country);
    setLoading(true);
    try {
      const nominatimParams = new URLSearchParams({
        q: scopedQuery,
        format: "json",
        limit: "8",
        addressdetails: "1",
        dedupe: "1",
      });
      if (countryCode) nominatimParams.set("countrycodes", countryCode);

      const structuredParams = new URLSearchParams({
        street: expandedQuery,
        format: "json",
        limit: "8",
        addressdetails: "1",
        dedupe: "1",
      });
      if (country?.trim()) structuredParams.set("country", country.trim());
      if (countryCode) structuredParams.set("countrycodes", countryCode);

      const photonParams = new URLSearchParams({
        q: scopedQuery,
        limit: "8",
        lang: "en",
      });

      const requests = [
        fetch(`https://nominatim.openstreetmap.org/search?${nominatimParams.toString()}`, {
          headers: { "Accept-Language": "en-US,en;q=0.9" },
        }),
        fetch(`https://nominatim.openstreetmap.org/search?${structuredParams.toString()}`, {
          headers: { "Accept-Language": "en-US,en;q=0.9" },
        }),
        fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`),
      ];

      const results = await Promise.allSettled(requests);
      if (requestId !== requestRef.current) return;

      const parsed: AddressSuggestion[] = [];
      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value.ok) continue;
        const data = (await result.value.json()) as unknown;
        if (Array.isArray(data)) {
          parsed.push(...data.map((item) => parseResult(item as Record<string, unknown>)).filter((s): s is AddressSuggestion => s !== null));
        } else {
          const features = ((data as { features?: unknown[] }).features ?? []) as Record<string, unknown>[];
          parsed.push(...features.map(parsePhotonResult).filter((s): s is AddressSuggestion => s !== null));
        }
      }
      const nextSuggestions = uniqueSuggestions(trimmed, parsed);
      setOpen(true);
      setSuggestions(nextSuggestions);
    } catch {
      setSuggestions([]);
      setOpen(true);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
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

  function handleUseTypedAddress() {
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
      {open && (
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
          {!loading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No strong match found. You can keep typing the address manually.
            </div>
          )}
          {!loading && value.trim().length >= 3 && (
            <button
              type="button"
              className="flex items-center gap-2 w-full border-t border-border px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent transition-colors"
              onMouseDown={handleUseTypedAddress}
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              Use "{value.trim()}" and fill city/state/ZIP manually
            </button>
          )}
        </div>
      )}
    </div>
  );
}
