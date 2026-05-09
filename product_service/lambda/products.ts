import type { ProductRecord, StockRecord } from "./types";

export const productsSeed: ProductRecord[] = [
  {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    title: "Porsche Cayenne All-Weather Floor Mats",
    description:
      "Heavy-duty rubber floor mats designed to protect your Cayenne interior from mud, snow, and spills. Custom-fit for all Cayenne models 2019+.",
    price: 150,
  },
  {
    id: "b1e8e4e2-2b9a-4b7a-9a3a-2f0a1a7b9f21",
    title: "Porsche Cayenne Roof Rack Cross Bars",
    description:
      "OEM-style aluminum cross bars for the Cayenne roof rails. Supports up to 165 lbs of cargo. Easy tool-free installation.",
    price: 890,
  },
  {
    id: "3f2a1b4c-7d8e-4f6a-9b2c-1e3d5f7a9b0c",
    title: "Porsche Cayenne LED Interior Light Kit",
    description:
      "Complete 18-piece LED upgrade kit for dome, map, trunk, and door lights. 6000K bright white, plug-and-play replacement.",
    price: 75,
  },
  {
    id: "a4b5c6d7-e8f9-4a1b-8c2d-3e4f5a6b7c8d",
    title: "Porsche Cayenne Carbon Fiber Mirror Covers",
    description:
      "Genuine carbon fiber side mirror cap replacements. Direct OEM fit with 3K twill weave finish. Sold as a pair.",
    price: 420,
  },
  {
    id: "d9e8f7a6-b5c4-4d3e-9a2b-1c0d8e7f6a5b",
    title: "Porsche Cayenne Sport Exhaust Tips",
    description:
      "Stainless steel dual exhaust tips with a brushed titanium finish. Bolt-on design, no cutting or welding required.",
    price: 650,
  },
  {
    id: "11bf2b9e-6c4a-4f0b-9d7e-5a8c2b1d3e4f",
    title: "Porsche Cayenne Tinted Window Visor Set",
    description:
      "Slim-profile acrylic window deflectors for all four doors. Allows fresh air in while keeping rain out. Tape-on installation.",
    price: 120,
  },
  {
    id: "22ce3d0f-7d5b-4a1c-8e6f-9b0a4c5d6e7f",
    title: "Porsche Cayenne Premium Cargo Liner",
    description:
      "Custom-molded trunk liner with raised edges to contain spills. Anti-slip surface, easy to clean. Fits Cayenne 2019+ models.",
    price: 195,
  },
  {
    id: "33df4e1a-8e6c-4b2d-9f7a-0c1b5d6e7f80",
    title: "Porsche Cayenne Wheel Center Caps (Set of 4)",
    description:
      "Factory-style center caps featuring the Porsche crest. 65mm diameter, fits all standard Cayenne alloy wheels.",
    price: 85,
  },
];

export const stocksSeed: StockRecord[] = [
  { product_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", count: 12 },
  { product_id: "b1e8e4e2-2b9a-4b7a-9a3a-2f0a1a7b9f21", count: 4 },
  { product_id: "3f2a1b4c-7d8e-4f6a-9b2c-1e3d5f7a9b0c", count: 24 },
  { product_id: "a4b5c6d7-e8f9-4a1b-8c2d-3e4f5a6b7c8d", count: 7 },
  { product_id: "d9e8f7a6-b5c4-4d3e-9a2b-1c0d8e7f6a5b", count: 3 },
  { product_id: "11bf2b9e-6c4a-4f0b-9d7e-5a8c2b1d3e4f", count: 15 },
  { product_id: "22ce3d0f-7d5b-4a1c-8e6f-9b0a4c5d6e7f", count: 9 },
  { product_id: "33df4e1a-8e6c-4b2d-9f7a-0c1b5d6e7f80", count: 20 },
];
