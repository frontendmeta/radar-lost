import type { BrandRow, MarketplaceRow } from '../types.ts';

export const BRANDS: BrandRow[] = [
  { id: 'b-libas', name: 'Libas', aliases: ['Libas'], domains: ['libas.in'], is_primary: true },
  { id: 'b-jk', name: 'Jaipur Kurti', aliases: ['Jaipur Kurti', 'JaipurKurti'], domains: ['jaipurkurti.com'], is_primary: false },
  { id: 'b-janasya', name: 'Janasya', aliases: ['Janasya'], domains: ['janasya.com'], is_primary: false },
  { id: 'b-biba', name: 'Biba', aliases: ['Biba', 'BIBA'], domains: ['biba.in'], is_primary: false },
  { id: 'b-aurelia', name: 'Aurelia', aliases: ['Aurelia'], domains: ['shopforaurelia.com'], is_primary: false },
  { id: 'b-kalini', name: 'Kalini', aliases: ['Kalini'], domains: [], is_primary: false },
];
export const MARKETPLACES: MarketplaceRow[] = [
  { id: 'm-myntra', name: 'Myntra', domains: ['myntra.com'] },
  { id: 'm-ajio', name: 'Ajio', domains: ['ajio.com'] },
  { id: 'm-amazon', name: 'Amazon', domains: ['amazon.in'] },
  { id: 'm-flipkart', name: 'Flipkart', domains: ['flipkart.com'] },
  { id: 'm-nykaa', name: 'Nykaa Fashion', domains: ['nykaafashion.com'] },
];
