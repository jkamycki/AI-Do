import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const FONTS = [
  "Georgia",
  "Garamond",
  "Playfair Display",
  "Cormorant Garamond",
  "Great Vibes",
  "Dancing Script",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Lora",
  "Merriweather",
  "Raleway",
  "Poppins",
  "Inter",
  "Source Sans Pro",
];

const LAYOUTS = [
  "classic",
  "modern",
  "romantic",
  "minimalist",
  "elegant",
  "playful",
  "luxury",
  "simple",
];

interface DesignOptionsSectionProps {
  mode: "saveTheDate" | "digitalInvitation";
  font: string;
  onFontChange: (font: string) => void;
  selectedLayout: string;
  onLayoutChange: (layout: string) => void;
  backgroundColor: string | null;
  onBackgroundColorChange: (hex: string) => void;
}

export function DesignOptionsSection({
  mode,
  font,
  onFontChange,
  selectedLayout,
  onLayoutChange,
  backgroundColor,
  onBackgroundColorChange,
}: DesignOptionsSectionProps) {
  const label = mode === "saveTheDate" ? "Save the Date" : "Digital Invitation";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">✨ Design Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Font Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{label} Font</label>
          <Select value={font} onValueChange={onFontChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p
            className="text-sm text-muted-foreground"
            style={{ fontFamily: font }}
          >
            Preview of {font}
          </p>
        </div>

        {/* Layout Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{label} Layout</label>
          <Select value={selectedLayout} onValueChange={onLayoutChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYOUTS.map((layout) => (
                <SelectItem key={layout} value={layout}>
                  {layout.charAt(0).toUpperCase() + layout.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Background Color */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Background Color (Optional)</label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="#FFFFFF"
              value={backgroundColor || ""}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
              maxLength={7}
            />
            <div
              className="w-10 h-10 rounded border border-border cursor-pointer"
              style={{ backgroundColor: backgroundColor || "#FFFFFF" }}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "color";
                input.value = backgroundColor || "#FFFFFF";
                input.onchange = (e) => {
                  if (e.target instanceof HTMLInputElement) {
                    onBackgroundColorChange(e.target.value);
                  }
                };
                input.click();
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
