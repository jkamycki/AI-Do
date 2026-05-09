// Shared theme presets used by both the website editor and the invitation
// customization page so the swatches stay in sync.
export interface WebsiteTheme {
  id: string;
  name: string;
  font: string;
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  background: string;
  text: string;
}

export const WEBSITE_THEMES: WebsiteTheme[] = [
  { id: "classic",   name: "Classic Gold",      font: "Playfair Display",     primary: "#D4A017", secondary: "#F5C842", accent: "#D4A017", neutral: "#F5EFE3", background: "#FFFFFF", text: "#222222" },
  { id: "romantic",  name: "Romantic Blush",    font: "Cormorant Garamond",   primary: "#D4736E", secondary: "#F0C4BD", accent: "#D4736E", neutral: "#FAF0EE", background: "#FFFCFA", text: "#3A2A28" },
  { id: "modern",    name: "Modern Charcoal",   font: "Inter",                primary: "#2C2C2C", secondary: "#7A7A7A", accent: "#1A1A1A", neutral: "#F0F0F0", background: "#FFFFFF", text: "#1A1A1A" },
  { id: "earthy",    name: "Earthy Sage",       font: "Cormorant Garamond",   primary: "#7A8C6A", secondary: "#B8C5A8", accent: "#5C7050", neutral: "#EDF0E6", background: "#FBFCF8", text: "#2E3A24" },
  { id: "boho",      name: "Boho Terracotta",   font: "Playfair Display",     primary: "#C0664A", secondary: "#E8A487", accent: "#A04E36", neutral: "#FAF1EB", background: "#FFFBF7", text: "#3D2418" },
  { id: "coastal",   name: "Coastal Navy",      font: "Playfair Display",     primary: "#2A4D6E", secondary: "#7FA1C2", accent: "#1A3854", neutral: "#EAF1F8", background: "#FFFFFF", text: "#1A2A3A" },
  { id: "garden",    name: "Garden Lavender",   font: "Cormorant Garamond",   primary: "#8A6FA8", secondary: "#C5AED5", accent: "#6E5388", neutral: "#F4EFFA", background: "#FFFBFC", text: "#2E2538" },
  { id: "minimal",   name: "Minimal Beige",     font: "Inter",                primary: "#A89580", secondary: "#D4C4AE", accent: "#8A7560", neutral: "#F5F0E8", background: "#FCFAF6", text: "#3A3024" },
  { id: "luxe",      name: "Luxe Black & Gold", font: "Playfair Display",     primary: "#C9A96E", secondary: "#E8D8B8", accent: "#9D7E48", neutral: "#1A1A1A", background: "#FFFFFF", text: "#222222" },
  { id: "garden2",   name: "Wildflower",        font: "Cormorant Garamond",   primary: "#C18AAA", secondary: "#E8C5D5", accent: "#A8688A", neutral: "#F8EEF3", background: "#FFFCFD", text: "#3A2530" },
];
