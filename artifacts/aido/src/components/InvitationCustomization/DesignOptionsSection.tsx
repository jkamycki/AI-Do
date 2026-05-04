import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LAYOUT_DESIGNS, LayoutThumbnail } from "./LayoutDecorations";
import type { ColorPalette } from "@/types/invitations";

interface DesignOptionsSectionProps {
  mode: "saveTheDate" | "digitalInvitation";
  selectedLayout: string;
  onLayoutChange: (layout: string) => void;
  backgroundColor: string | null;
  onBackgroundColorChange: (hex: string) => void;
  colors?: ColorPalette;
}

const DEFAULT_COLORS: ColorPalette = {
  primary: "#D4A017",
  secondary: "#F5C842",
  accent: "#D4A017",
  neutral: "#E8E0D0",
};

export function DesignOptionsSection({
  mode,
  selectedLayout,
  onLayoutChange,
  backgroundColor,
  onBackgroundColorChange,
  colors = DEFAULT_COLORS,
}: DesignOptionsSectionProps) {
  const label = mode === "saveTheDate" ? "Save the Date" : "Digital Invitation";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">✨ Design Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Layout grid */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{label} Layout</label>
          <div className="grid grid-cols-4 gap-2">
            {LAYOUT_DESIGNS.map((design) => {
              const active = selectedLayout === design.id;
              return (
                <button
                  key={design.id}
                  type="button"
                  onClick={() => onLayoutChange(design.id)}
                  title={design.desc}
                  className={[
                    "group relative flex flex-col rounded-lg border-2 overflow-hidden transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? "border-primary shadow-md"
                      : "border-border hover:border-primary/60 hover:shadow-sm",
                  ].join(" ")}
                >
                  {/* Thumbnail */}
                  <div className="aspect-[3/4] w-full overflow-hidden" style={{ backgroundColor: backgroundColor || "#1E1A2E" }}>
                    <LayoutThumbnail layout={design.id} colors={colors} backgroundColor={backgroundColor || "#1E1A2E"} />
                  </div>
                  {/* Label */}
                  <div className={[
                    "px-1 py-1 text-center text-[10px] leading-tight font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground group-hover:text-foreground",
                  ].join(" ")}>
                    {design.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Background Color */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Background Color</label>
          <div className="flex gap-2 items-center">
            <div
              className="w-10 h-10 rounded border-2 border-border cursor-pointer flex-shrink-0 transition-transform hover:scale-105"
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
              title="Click to pick a color"
            />
            <div className="flex flex-wrap gap-1.5 flex-1">
              {["#FFFFFF", "#FDF8F2", "#1E1A2E", "#0F172A", "#FFF5F5", "#F0F4F8"].map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onBackgroundColorChange(hex)}
                  title={hex}
                  className={[
                    "w-6 h-6 rounded border transition-all",
                    backgroundColor === hex
                      ? "border-primary scale-110 shadow-sm"
                      : "border-border hover:scale-110",
                  ].join(" ")}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Current: <span className="font-mono">{backgroundColor || "#FFFFFF"}</span>
          </p>
        </div>

      </CardContent>
    </Card>
  );
}
