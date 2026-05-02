export type AddressFormat = {
  cityLabel: string;
  stateLabel: string;
  zipLabel: string;
  cityPlaceholder: string;
  statePlaceholder: string;
  zipPlaceholder: string;
};

const US: AddressFormat = {
  cityLabel: "City", stateLabel: "State", zipLabel: "ZIP Code",
  cityPlaceholder: "Charleston", statePlaceholder: "SC", zipPlaceholder: "29401",
};

const FORMATS: Record<string, AddressFormat> = {
  "United States": US,
  "Canada": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Toronto", statePlaceholder: "ON", zipPlaceholder: "M5H 2N2",
  },
  "Mexico": {
    cityLabel: "City", stateLabel: "State", zipLabel: "Postal Code",
    cityPlaceholder: "Mexico City", statePlaceholder: "CDMX", zipPlaceholder: "01000",
  },
  "United Kingdom": {
    cityLabel: "Town / City", stateLabel: "County", zipLabel: "Postcode",
    cityPlaceholder: "London", statePlaceholder: "Greater London", zipPlaceholder: "SW1A 1AA",
  },
  "Ireland": {
    cityLabel: "Town / City", stateLabel: "County", zipLabel: "Eircode",
    cityPlaceholder: "Dublin", statePlaceholder: "Co. Dublin", zipPlaceholder: "D02 X285",
  },
  "Australia": {
    cityLabel: "Suburb", stateLabel: "State", zipLabel: "Postcode",
    cityPlaceholder: "Sydney", statePlaceholder: "NSW", zipPlaceholder: "2000",
  },
  "New Zealand": {
    cityLabel: "Town / City", stateLabel: "Region", zipLabel: "Postcode",
    cityPlaceholder: "Auckland", statePlaceholder: "Auckland", zipPlaceholder: "1010",
  },
  "India": {
    cityLabel: "City", stateLabel: "State", zipLabel: "PIN Code",
    cityPlaceholder: "Mumbai", statePlaceholder: "Maharashtra", zipPlaceholder: "400001",
  },
  "Pakistan": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Karachi", statePlaceholder: "Sindh", zipPlaceholder: "74000",
  },
  "Bangladesh": {
    cityLabel: "City", stateLabel: "Division", zipLabel: "Postal Code",
    cityPlaceholder: "Dhaka", statePlaceholder: "Dhaka", zipPlaceholder: "1205",
  },
  "Japan": {
    cityLabel: "City / Ward", stateLabel: "Prefecture", zipLabel: "Postal Code",
    cityPlaceholder: "Shibuya", statePlaceholder: "Tokyo", zipPlaceholder: "150-0001",
  },
  "China": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Shanghai", statePlaceholder: "Shanghai", zipPlaceholder: "200000",
  },
  "South Korea": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Seoul", statePlaceholder: "Seoul", zipPlaceholder: "04524",
  },
  "Singapore": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Singapore", statePlaceholder: "Central", zipPlaceholder: "238823",
  },
  "Hong Kong": {
    cityLabel: "District", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Central", statePlaceholder: "Hong Kong Island", zipPlaceholder: "",
  },
  "Brazil": {
    cityLabel: "City", stateLabel: "State", zipLabel: "CEP",
    cityPlaceholder: "São Paulo", statePlaceholder: "SP", zipPlaceholder: "01310-100",
  },
  "Argentina": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Buenos Aires", statePlaceholder: "CABA", zipPlaceholder: "C1000",
  },
  "Spain": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Madrid", statePlaceholder: "Madrid", zipPlaceholder: "28013",
  },
  "France": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Paris", statePlaceholder: "Île-de-France", zipPlaceholder: "75001",
  },
  "Germany": {
    cityLabel: "City", stateLabel: "State (Land)", zipLabel: "Postal Code",
    cityPlaceholder: "Berlin", statePlaceholder: "Berlin", zipPlaceholder: "10115",
  },
  "Italy": {
    cityLabel: "City (Comune)", stateLabel: "Province", zipLabel: "CAP",
    cityPlaceholder: "Roma", statePlaceholder: "RM", zipPlaceholder: "00184",
  },
  "Netherlands": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postcode",
    cityPlaceholder: "Amsterdam", statePlaceholder: "Noord-Holland", zipPlaceholder: "1011 AB",
  },
  "Belgium": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Brussels", statePlaceholder: "Brussels", zipPlaceholder: "1000",
  },
  "Switzerland": {
    cityLabel: "City", stateLabel: "Canton", zipLabel: "Postal Code",
    cityPlaceholder: "Zürich", statePlaceholder: "ZH", zipPlaceholder: "8001",
  },
  "Austria": {
    cityLabel: "City", stateLabel: "State", zipLabel: "Postal Code",
    cityPlaceholder: "Vienna", statePlaceholder: "Wien", zipPlaceholder: "1010",
  },
  "Portugal": {
    cityLabel: "City", stateLabel: "District", zipLabel: "Postal Code",
    cityPlaceholder: "Lisbon", statePlaceholder: "Lisboa", zipPlaceholder: "1000-001",
  },
  "Poland": {
    cityLabel: "City", stateLabel: "Voivodeship", zipLabel: "Postal Code",
    cityPlaceholder: "Warsaw", statePlaceholder: "Mazowieckie", zipPlaceholder: "00-001",
  },
  "Sweden": {
    cityLabel: "City", stateLabel: "County", zipLabel: "Postal Code",
    cityPlaceholder: "Stockholm", statePlaceholder: "Stockholm", zipPlaceholder: "111 22",
  },
  "Norway": {
    cityLabel: "City", stateLabel: "County", zipLabel: "Postal Code",
    cityPlaceholder: "Oslo", statePlaceholder: "Oslo", zipPlaceholder: "0150",
  },
  "Denmark": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Copenhagen", statePlaceholder: "Hovedstaden", zipPlaceholder: "1050",
  },
  "Finland": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Helsinki", statePlaceholder: "Uusimaa", zipPlaceholder: "00100",
  },
  "South Africa": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Cape Town", statePlaceholder: "Western Cape", zipPlaceholder: "8001",
  },
  "United Arab Emirates": {
    cityLabel: "City", stateLabel: "Emirate", zipLabel: "PO Box",
    cityPlaceholder: "Dubai", statePlaceholder: "Dubai", zipPlaceholder: "00000",
  },
  "Saudi Arabia": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Riyadh", statePlaceholder: "Riyadh", zipPlaceholder: "11564",
  },
  "Israel": {
    cityLabel: "City", stateLabel: "District", zipLabel: "Postal Code",
    cityPlaceholder: "Tel Aviv", statePlaceholder: "Tel Aviv", zipPlaceholder: "6100000",
  },
  "Turkey": {
    cityLabel: "City", stateLabel: "Province", zipLabel: "Postal Code",
    cityPlaceholder: "Istanbul", statePlaceholder: "Istanbul", zipPlaceholder: "34000",
  },
  "Greece": {
    cityLabel: "City", stateLabel: "Region", zipLabel: "Postal Code",
    cityPlaceholder: "Athens", statePlaceholder: "Attica", zipPlaceholder: "104 31",
  },
  "Russia": {
    cityLabel: "City", stateLabel: "Region (Oblast)", zipLabel: "Postal Code",
    cityPlaceholder: "Moscow", statePlaceholder: "Moscow", zipPlaceholder: "101000",
  },
  "Ukraine": {
    cityLabel: "City", stateLabel: "Region (Oblast)", zipLabel: "Postal Code",
    cityPlaceholder: "Kyiv", statePlaceholder: "Kyiv", zipPlaceholder: "01001",
  },
};

const DEFAULT: AddressFormat = {
  cityLabel: "City",
  stateLabel: "State / Region",
  zipLabel: "Postal Code",
  cityPlaceholder: "",
  statePlaceholder: "",
  zipPlaceholder: "",
};

export function getAddressFormat(country: string | null | undefined): AddressFormat {
  if (!country) return US;
  return FORMATS[country] ?? DEFAULT;
}
