export type Property = {
  id: string;
  price: string;
  priceValue: number;
  title: string;
  location: string;
  locality: string;
  type: 'Apartment' | 'Villa' | 'Plot / Land' | 'Commercial';
  purpose: 'Buy' | 'Rent';
  bhk?: number;
  area: string;
  seller: 'Owner' | 'Broker' | 'Builder';
  verified: boolean;
  rera?: string;
  status: string;
  approval: string;
  image: string;
  description: string;
  amenities: string[];
};

export const properties: Property[] = [
  {
    id: 'medavakkam-skyline',
    price: '₹58 L',
    priceValue: 58,
    title: 'Sunlit 2 BHK near the new metro',
    location: 'Medavakkam, Chennai',
    locality: 'Medavakkam',
    type: 'Apartment',
    purpose: 'Buy',
    bhk: 2,
    area: '1,180 sq.ft',
    seller: 'Builder',
    verified: true,
    rera: 'TN/29/Building/0123/2026',
    status: 'Ready to move',
    approval: 'CMDA approved',
    image: 'https://gobroker.co.in/img/residential-apartments.jpg',
    description: 'An airy, east-facing home with two balconies, metro connectivity and a landscaped residents’ courtyard.',
    amenities: ['Covered parking', 'Power backup', 'Gym', 'Children’s play area'],
  },
  {
    id: 'ecr-tropical-villa',
    price: '₹1.85 Cr',
    priceValue: 185,
    title: 'Tropical four-bedroom beach villa',
    location: 'ECR, Chennai',
    locality: 'ECR',
    type: 'Villa',
    purpose: 'Buy',
    bhk: 4,
    area: '3,240 sq.ft',
    seller: 'Owner',
    verified: true,
    status: 'Ready to move',
    approval: 'DTCP approved',
    image: 'https://www.inventarchitects.com/projimg/tropical/new_images/house_with_lighting.jpg',
    description: 'A private coastal residence designed around courtyards, natural ventilation and generous indoor-outdoor living.',
    amenities: ['Private garden', 'Two-car parking', 'Solar power', 'Sea access'],
  },
  {
    id: 'porur-grandeur-plots',
    price: '₹54 L onwards',
    priceValue: 54,
    title: 'CMDA approved green plots',
    location: 'Porur, Chennai',
    locality: 'Porur',
    type: 'Plot / Land',
    purpose: 'Buy',
    area: '581–3,061 sq.ft',
    seller: 'Builder',
    verified: true,
    rera: 'TN/01/Layout/8842/2025',
    status: 'Ready to construct',
    approval: 'CMDA & RERA',
    image: 'https://www.connectionpoint.in/project_folder/project_baner/678642519VGN_Grandeur%20Banner.jpg',
    description: 'A planned gated layout with blacktop roads, avenue trees and fast access to hospitals and the upcoming metro.',
    amenities: ['Clubhouse', 'Park', '24/7 security', 'Blacktop roads'],
  },
  {
    id: 'ambattur-classique',
    price: '₹65.9 L',
    priceValue: 65.9,
    title: 'Corner plot in a gated community',
    location: 'Ambattur, Chennai',
    locality: 'Ambattur',
    type: 'Plot / Land',
    purpose: 'Buy',
    area: '753 sq.ft',
    seller: 'Broker',
    verified: true,
    rera: 'TN/02/Layout/3100/2025',
    status: 'Immediate possession',
    approval: 'CMDA approved',
    image: 'https://is1-2.housingcdn.com/4f2250e8/223dd95def24ff928d9d1698b0fc74ea/v0/fs/vgn_classique-ambattur-chennai-vgn_homes.jpeg',
    description: 'A compact, clearly demarcated corner plot close to schools, healthcare and established residential neighbourhoods.',
    amenities: ['Solar street lights', 'Children’s park', 'Drainage', 'Community hall'],
  },
  {
    id: 'mannivakkam-township',
    price: '₹42 L',
    priceValue: 42,
    title: 'Avenue-facing township plot',
    location: 'Mannivakkam, Chennai',
    locality: 'Mannivakkam',
    type: 'Plot / Land',
    purpose: 'Buy',
    area: '1,200 sq.ft',
    seller: 'Builder',
    verified: false,
    status: 'New launch',
    approval: 'DTCP approved',
    image: 'https://tvh.in/wp-content/uploads/2022/01/p-banner1.jpg',
    description: 'A wide-road residential plot in a nature-led township with security and good connectivity to Vandalur.',
    amenities: ['60 ft main road', 'Jogging track', 'Play area', 'Security'],
  },
  {
    id: 'nolambur-family-rental',
    price: '₹32,000 / mo',
    priceValue: 0.32,
    title: 'Quiet 3 BHK for families',
    location: 'Nolambur, Chennai',
    locality: 'Nolambur',
    type: 'Apartment',
    purpose: 'Rent',
    bhk: 3,
    area: '1,640 sq.ft',
    seller: 'Owner',
    verified: true,
    status: 'Available now',
    approval: 'Occupancy certified',
    image: 'https://is1-3.housingcdn.com/4f2250e8/e2588135b8346a791191dc605f733c37/v0/fs/aura_nandanandana-chinna_nolambur-chennai-aura_properties.jpeg',
    description: 'A well-maintained family home with cross ventilation, covered parking and daily conveniences nearby.',
    amenities: ['Lift', 'Covered parking', 'Security', 'Rainwater harvesting'],
  },
];

export const roleMeta = {
  user: {
    label: 'Buyer / Owner',
    title: 'Your property journey, in one place.',
    description: 'Discover homes, save shortlists, post requirements and manage site visits.',
    demoEmail: 'buyer@easehome.in',
    demoPassword: 'Buyer@123',
  },
  broker: {
    label: 'Broker / Business',
    title: 'Turn property interest into qualified leads.',
    description: 'Publish listings and Reels, follow every enquiry and organise site visits.',
    demoEmail: 'broker@easehome.in',
    demoPassword: 'Broker@123',
  },
  admin: {
    label: 'Super Admin',
    title: 'Keep the marketplace trusted and moving.',
    description: 'Moderate accounts, verify listings and monitor platform performance.',
    demoEmail: 'admin@easehome.in',
    demoPassword: 'Admin@123',
  },
} as const;

export type PortalRole = keyof typeof roleMeta;
