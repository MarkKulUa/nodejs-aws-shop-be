export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  count: number;
}

export const products: Product[] = [
  {
    id: "1",
    title: "Porsche Cayenne All-Weather Floor Mats",
    description:
      "Heavy-duty rubber floor mats designed to protect your Cayenne interior from mud, snow, and spills. Custom-fit for all Cayenne models 2019+.",
    price: 150,
    count: 12,
  },
  {
    id: "2",
    title: "Porsche Cayenne Roof Rack Cross Bars",
    description:
      "OEM-style aluminum cross bars for the Cayenne roof rails. Supports up to 165 lbs of cargo. Easy tool-free installation.",
    price: 890,
    count: 4,
  },
  {
    id: "3",
    title: "Porsche Cayenne LED Interior Light Kit",
    description:
      "Complete 18-piece LED upgrade kit for dome, map, trunk, and door lights. 6000K bright white, plug-and-play replacement.",
    price: 75,
    count: 24,
  },
  {
    id: "4",
    title: "Porsche Cayenne Carbon Fiber Mirror Covers",
    description:
      "Genuine carbon fiber side mirror cap replacements. Direct OEM fit with 3K twill weave finish. Sold as a pair.",
    price: 420,
    count: 7,
  },
  {
    id: "5",
    title: "Porsche Cayenne Sport Exhaust Tips",
    description:
      "Stainless steel dual exhaust tips with a brushed titanium finish. Bolt-on design, no cutting or welding required.",
    price: 650,
    count: 3,
  },
  {
    id: "6",
    title: "Porsche Cayenne Tinted Window Visor Set",
    description:
      "Slim-profile acrylic window deflectors for all four doors. Allows fresh air in while keeping rain out. Tape-on installation.",
    price: 120,
    count: 15,
  },
  {
    id: "7",
    title: "Porsche Cayenne Premium Cargo Liner",
    description:
      "Custom-molded trunk liner with raised edges to contain spills. Anti-slip surface, easy to clean. Fits Cayenne 2019+ models.",
    price: 195,
    count: 9,
  },
  {
    id: "8",
    title: "Porsche Cayenne Wheel Center Caps (Set of 4)",
    description:
      "Factory-style center caps featuring the Porsche crest. 65mm diameter, fits all standard Cayenne alloy wheels.",
    price: 85,
    count: 20,
  },
];
