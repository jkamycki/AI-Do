export type AddressFormat = {
  cityLabel: string;
  stateLabel: string;
  zipLabel: string;
  cityPlaceholder: string;
  statePlaceholder: string;
  zipPlaceholder: string;
  showState: boolean;
  showZip: boolean;
};

const US: AddressFormat = {
  cityLabel: "City", stateLabel: "State", zipLabel: "ZIP Code",
  cityPlaceholder: "Charleston", statePlaceholder: "SC", zipPlaceholder: "29401",
  showState: true, showZip: true,
};

const FORMATS: Record<string, AddressFormat> = {
  "United States": US,
  "Canada": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Toronto", statePlaceholder: "ON", zipPlaceholder: "M5H 2N2",
    showState: true, showZip: true,
  },
  "Mexico": {
    cityLabel: "City", stateLabel: "State", zipLabel: "Postal Code",
    cityPlaceholder: "Mexico City", statePlaceholder: "CDMX", zipPlaceholder: "01000",
    showState: true, showZip: true,
  },
  "United Kingdom": {
    cityLabel: "Town / City", stateLabel: "County", zipLabel: "Postcode",
    cityPlaceholder: "London", statePlaceholder: "Greater London", zipPlaceholder: "SW1A 1AA",
    showState: true, showZip: true,
  },
  "Ireland": {
    cityLabel: "Town / City", stateLabel: "County", zipLabel: "Eircode",
    cityPlaceholder: "Dublin", statePlaceholder: "Co. Dublin", zipPlaceholder: "D02 X285",
    showState: true, showZip: true,
  },
  "Australia": {
    cityLabel: "Suburb", stateLabel: "State", zipLabel: "Postcode",
    cityPlaceholder: "Sydney", statePlaceholder: "NSW", zipPlaceholder: "2000",
    showState: true, showZip: true,
  },
  "New Zealand": {
    cityLabel: "Town / City", stateLabel: "Region", zipLabel: "Postcode",
    cityPlaceholder: "Auckland", statePlaceholder: "Auckland", zipPlaceholder: "1010",
    showState: true, showZip: true,
  },
  "India": {
    cityLabel: "City", stateLabel: "State", zipLabel: "PIN Code",
    cityPlaceholder: "Mumbai", statePlaceholder: "Maharashtra", zipPlaceholder: "400001",
    showState: true, showZip: true,
  },
  "Pakistan": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Karachi", statePlaceholder: "Sindh", zipPlaceholder: "74000",
    showState: true, showZip: true,
  },
  "Bangladesh": {
    cityLabel: "City", stateLabel: "Division", zipLabel: "Postal Code",
    cityPlaceholder: "Dhaka", statePlaceholder: "Dhaka", zipPlaceholder: "1205",
    showState: true, showZip: true,
  },
  "Japan": {
    cityLabel: "City / Ward", stateLabel: "Prefecture", zipLabel: "Postal Code",
    cityPlaceholder: "Shibuya", statePlaceholder: "Tokyo", zipPlaceholder: "150-0001",
    showState: true, showZip: true,
  },
  "China": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Shanghai", statePlaceholder: "Shanghai", zipPlaceholder: "200000",
    showState: true, showZip: true,
  },
  "South Korea": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Seoul", statePlaceholder: "Seoul", zipPlaceholder: "04524",
    showState: true, showZip: true,
  },
  "Singapore": {
    cityLabel: "City", stateLabel: "", zipLabel: "Postal Code",
    cityPlaceholder: "Singapore", statePlaceholder: "", zipPlaceholder: "238823",
    showState: false, showZip: true,
  },
  "Hong Kong": {
    cityLabel: "District", stateLabel: "Region", zipLabel: "",
    cityPlaceholder: "Central", statePlaceholder: "Hong Kong Island", zipPlaceholder: "",
    showState: true, showZip: false,
  },
  "Brazil": {
    cityLabel: "City", stateLabel: "State", zipLabel: "CEP",
    cityPlaceholder: "São Paulo", statePlaceholder: "SP", zipPlaceholder: "01310-100",
    showState: true, showZip: true,
  },
  "Argentina": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Buenos Aires", statePlaceholder: "CABA", zipPlaceholder: "C1000",
    showState: true, showZip: true,
  },
  "Chile": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Santiago", statePlaceholder: "RM", zipPlaceholder: "8320000",
    showState: true, showZip: true,
  },
  "Colombia": {
    cityLabel: "City", stateLabel: "Department", zipLabel: "Postal Code",
    cityPlaceholder: "Bogotá", statePlaceholder: "Cundinamarca", zipPlaceholder: "110111",
    showState: true, showZip: true,
  },
  "Peru": {
    cityLabel: "City / District", stateLabel: "Department", zipLabel: "Postal Code",
    cityPlaceholder: "Lima", statePlaceholder: "Lima", zipPlaceholder: "15001",
    showState: true, showZip: true,
  },
  "Ecuador": {
    cityLabel: "City", stateLabel: "", zipLabel: "Postal Code",
    cityPlaceholder: "Quito", statePlaceholder: "", zipPlaceholder: "170150",
    showState: false, showZip: true,
  },
  "Bolivia": {
    cityLabel: "City", stateLabel: "Department", zipLabel: "",
    cityPlaceholder: "La Paz", statePlaceholder: "La Paz", zipPlaceholder: "",
    showState: true, showZip: false,
  },
  "Venezuela": {
    cityLabel: "City", stateLabel: "State", zipLabel: "Postal Code",
    cityPlaceholder: "Caracas", statePlaceholder: "Distrito Capital", zipPlaceholder: "1010",
    showState: true, showZip: true,
  },
  "Uruguay": {
    cityLabel: "City", stateLabel: "Department", zipLabel: "Postal Code",
    cityPlaceholder: "Montevideo", statePlaceholder: "Montevideo", zipPlaceholder: "11000",
    showState: true, showZip: true,
  },
  "Paraguay": {
    cityLabel: "City", stateLabel: "Department", zipLabel: "Postal Code",
    cityPlaceholder: "Asunción", statePlaceholder: "Central", zipPlaceholder: "1209",
    showState: true, showZip: true,
  },
  "Costa Rica": {
    cityLabel: "City / District", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "San José", statePlaceholder: "San José", zipPlaceholder: "10101",
    showState: true, showZip: true,
  },
  "Panama": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "",
    cityPlaceholder: "Panama City", statePlaceholder: "Panamá", zipPlaceholder: "",
    showState: true, showZip: false,
  },
  "Dominican Republic": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Santo Domingo", statePlaceholder: "Distrito Nacional", zipPlaceholder: "10101",
    showState: true, showZip: true,
  },
  "Cuba": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Havana", statePlaceholder: "La Habana", zipPlaceholder: "10100",
    showState: true, showZip: true,
  },
  "Spain": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Madrid", statePlaceholder: "Madrid", zipPlaceholder: "28013",
    showState: true, showZip: true,
  },
  "France": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Paris", statePlaceholder: "Île-de-France", zipPlaceholder: "75001",
    showState: true, showZip: true,
  },
  "Germany": {
    cityLabel: "City", stateLabel: "State (Land)", zipLabel: "Postal Code",
    cityPlaceholder: "Berlin", statePlaceholder: "Berlin", zipPlaceholder: "10115",
    showState: true, showZip: true,
  },
  "Italy": {
    cityLabel: "City (Comune)", stateLabel: "Province", zipLabel: "CAP",
    cityPlaceholder: "Roma", statePlaceholder: "RM", zipPlaceholder: "00184",
    showState: true, showZip: true,
  },
  "Netherlands": {
    cityLabel: "City", stateLabel: "", zipLabel: "Postcode",
    cityPlaceholder: "Amsterdam", statePlaceholder: "", zipPlaceholder: "1011 AB",
    showState: false, showZip: true,
  },
  "Belgium": {
    cityLabel: "City", stateLabel: "", zipLabel: "Postal Code",
    cityPlaceholder: "Brussels", statePlaceholder: "", zipPlaceholder: "1000",
    showState: false, showZip: true,
  },
  "Switzerland": {
    cityLabel: "City", stateLabel: "Canton", zipLabel: "Postal Code",
    cityPlaceholder: "Zürich", statePlaceholder: "ZH", zipPlaceholder: "8001",
    showState: true, showZip: true,
  },
  "Austria": {
    cityLabel: "City", stateLabel: "State", zipLabel: "Postal Code",
    cityPlaceholder: "Vienna", statePlaceholder: "Wien", zipPlaceholder: "1010",
    showState: true, showZip: true,
  },
  "Portugal": {
    cityLabel: "City", stateLabel: "District", zipLabel: "Postal Code",
    cityPlaceholder: "Lisbon", statePlaceholder: "Lisboa", zipPlaceholder: "1000-001",
    showState: true, showZip: true,
  },
  "Poland": {
    cityLabel: "City", stateLabel: "Voivodeship", zipLabel: "Postal Code",
    cityPlaceholder: "Warsaw", statePlaceholder: "Mazowieckie", zipPlaceholder: "00-001",
    showState: true, showZip: true,
  },
  "Czech Republic": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Prague", statePlaceholder: "Prague", zipPlaceholder: "110 00",
    showState: true, showZip: true,
  },
  "Sweden": {
    cityLabel: "City", stateLabel: "", zipLabel: "Postal Code",
    cityPlaceholder: "Stockholm", statePlaceholder: "", zipPlaceholder: "111 22",
    showState: false, showZip: true,
  },
  "Norway": {
    cityLabel: "City", stateLabel: "", zipLabel: "Postal Code",
    cityPlaceholder: "Oslo", statePlaceholder: "", zipPlaceholder: "0150",
    showState: false, showZip: true,
  },
  "Denmark": {
    cityLabel: "City", stateLabel: "", zipLabel: "Postal Code",
    cityPlaceholder: "Copenhagen", statePlaceholder: "", zipPlaceholder: "1050",
    showState: false, showZip: true,
  },
  "Finland": {
    cityLabel: "City", stateLabel: "", zipLabel: "Postal Code",
    cityPlaceholder: "Helsinki", statePlaceholder: "", zipPlaceholder: "00100",
    showState: false, showZip: true,
  },
  "Iceland": {
    cityLabel: "City", stateLabel: "", zipLabel: "Postal Code",
    cityPlaceholder: "Reykjavík", statePlaceholder: "", zipPlaceholder: "101",
    showState: false, showZip: true,
  },
  "South Africa": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Cape Town", statePlaceholder: "Western Cape", zipPlaceholder: "8001",
    showState: true, showZip: true,
  },
  "Nigeria": {
    cityLabel: "City", stateLabel: "State", zipLabel: "Postal Code",
    cityPlaceholder: "Lagos", statePlaceholder: "Lagos", zipPlaceholder: "100001",
    showState: true, showZip: true,
  },
  "Kenya": {
    cityLabel: "City / Town", stateLabel: "County", zipLabel: "Postal Code",
    cityPlaceholder: "Nairobi", statePlaceholder: "Nairobi", zipPlaceholder: "00100",
    showState: true, showZip: true,
  },
  "Egypt": {
    cityLabel: "City", stateLabel: "Governorate", zipLabel: "Postal Code",
    cityPlaceholder: "Cairo", statePlaceholder: "Cairo", zipPlaceholder: "11511",
    showState: true, showZip: true,
  },
  "Morocco": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Casablanca", statePlaceholder: "Casablanca-Settat", zipPlaceholder: "20000",
    showState: true, showZip: true,
  },
  "United Arab Emirates": {
    cityLabel: "City", stateLabel: "Emirate", zipLabel: "PO Box",
    cityPlaceholder: "Dubai", statePlaceholder: "Dubai", zipPlaceholder: "00000",
    showState: true, showZip: true,
  },
  "Saudi Arabia": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Riyadh", statePlaceholder: "Riyadh", zipPlaceholder: "11564",
    showState: true, showZip: true,
  },
  "Qatar": {
    cityLabel: "City", stateLabel: "", zipLabel: "",
    cityPlaceholder: "Doha", statePlaceholder: "", zipPlaceholder: "",
    showState: false, showZip: false,
  },
  "Israel": {
    cityLabel: "City", stateLabel: "", zipLabel: "Postal Code",
    cityPlaceholder: "Tel Aviv", statePlaceholder: "", zipPlaceholder: "6100000",
    showState: false, showZip: true,
  },
  "Turkey": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Istanbul", statePlaceholder: "Istanbul", zipPlaceholder: "34000",
    showState: true, showZip: true,
  },
  "Greece": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Athens", statePlaceholder: "Attica", zipPlaceholder: "104 31",
    showState: true, showZip: true,
  },
  "Russia": {
    cityLabel: "City", stateLabel: "Region (Oblast)", zipLabel: "Postal Code",
    cityPlaceholder: "Moscow", statePlaceholder: "Moscow", zipPlaceholder: "101000",
    showState: true, showZip: true,
  },
  "Ukraine": {
    cityLabel: "City", stateLabel: "Region (Oblast)", zipLabel: "Postal Code",
    cityPlaceholder: "Kyiv", statePlaceholder: "Kyiv", zipPlaceholder: "01001",
    showState: true, showZip: true,
  },
  "Thailand": {
    cityLabel: "City / District", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Bangkok", statePlaceholder: "Bangkok", zipPlaceholder: "10100",
    showState: true, showZip: true,
  },
  "Vietnam": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Ho Chi Minh City", statePlaceholder: "Ho Chi Minh", zipPlaceholder: "700000",
    showState: true, showZip: true,
  },
  "Indonesia": {
    cityLabel: "City / Regency", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Jakarta", statePlaceholder: "DKI Jakarta", zipPlaceholder: "10110",
    showState: true, showZip: true,
  },
  "Malaysia": {
    cityLabel: "City", stateLabel: "State", zipLabel: "Postcode",
    cityPlaceholder: "Kuala Lumpur", statePlaceholder: "Selangor", zipPlaceholder: "50000",
    showState: true, showZip: true,
  },
  "Philippines": {
    cityLabel: "City / Municipality", stateLabel: "Province", zipLabel: "ZIP Code",
    cityPlaceholder: "Manila", statePlaceholder: "Metro Manila", zipPlaceholder: "1000",
    showState: true, showZip: true,
  },
};

const DEFAULT: AddressFormat = {
  cityLabel: "City",
  stateLabel: "State / Region",
  zipLabel: "Postal Code",
  cityPlaceholder: "",
  statePlaceholder: "",
  zipPlaceholder: "",
  showState: true,
  showZip: true,
};

export function getAddressFormat(country: string | null | undefined): AddressFormat {
  if (!country) return US;
  return FORMATS[country] ?? DEFAULT;
}
