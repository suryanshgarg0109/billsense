// Bundled specimen bills so the product can be demoed with zero setup.
export interface SampleBill {
  id: string;
  label: string;
  hint: string;
  path: string;
}

export const SAMPLE_BILLS: SampleBill[] = [
  {
    id: "residential",
    label: "Residential home",
    hint: "Clean slab-tariff bill",
    path: "/samples/residential-bill.pdf",
  },
  {
    id: "commercial",
    label: "Commercial office",
    hint: "Late fee + demand charges",
    path: "/samples/commercial-bill.pdf",
  },
  {
    id: "industrial",
    label: "Industrial HT unit",
    hint: "PF penalty + TOD tariff",
    path: "/samples/industrial-bill.pdf",
  },
];
