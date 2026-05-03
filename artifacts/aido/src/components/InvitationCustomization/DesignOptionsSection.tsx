import { Button } from "@/components/ui/button";
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
  selectedFont: string;
  onFontChange: (font: string) => void;
  selectedLayout: string;
  onLayoutChange: (layout: string) => void;
  backgroundColor: string | null;
  onBackgroundColorChange: (hex: string) => void;
}

export function DesignOptionsSection({
  selectedFont,
  onFontChange,
  selectedLayout,
  onLayoutChange,
  backgroundColor,
  onBackgroundColorChange,
}: DesignOptionsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">✨ Design Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Font Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Font Style</label>
          <Select value={selectedFont} onValueChange={onFontChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((font) => (
                <SelectItem key={font} value={font}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p
            className="text-sm text-muted-foreground"
            style={{ fontFamily: selectedFont }}
          >
            Preview of {selectedFont}
          </p>
        </div>

        {/* Layout Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Layout / Theme</label>
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

        {/* Background Color (optional) */}
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
              style={{
                backgroundColor: backgroundColor || "#FFFFFF",
              }}
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
