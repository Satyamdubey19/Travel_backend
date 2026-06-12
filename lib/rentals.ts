export type RentalType = "car" | "bike"

export type Rental = {
  slug: string
  type: RentalType
  title: string
  brand: string
  city: string
  pickupArea: string
  image: string
  pricePerDay: number
  originalPrice: number
  rating: number
  reviews: number
  seats?: number
  transmission?: "Manual" | "Automatic"
  fuel?: "Petrol" | "Diesel" | "Electric"
  engine?: string
  rangeKm: number
  totalUnits?: number
  availableUnits?: number
  deposit: number
  cancellation: string
  features: string[]
  documents: string[]
  vendor: {
    name: string
    responseTime: string
    verified: boolean
  }
}

const rentalImages = {
  suv: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80",
  hatchback: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
  sedan: "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1200&q=80",
  thar: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80",
  scooter: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80",
  bike: "https://images.unsplash.com/photo-1558980664-10e7170b5df9?auto=format&fit=crop&w=1200&q=80",
  royal: "https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=1200&q=80",
  electric: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1200&q=80",
}

export const rentals: Rental[] = [
  {
    slug: "goa-thar-convertible",
    type: "car",
    title: "Mahindra Thar Convertible",
    brand: "Mahindra",
    city: "Goa",
    pickupArea: "Candolim pickup hub",
    image: rentalImages.thar,
    pricePerDay: 4200,
    originalPrice: 5200,
    rating: 4.8,
    reviews: 146,
    seats: 4,
    transmission: "Manual",
    fuel: "Diesel",
    rangeKm: 300,
    deposit: 5000,
    cancellation: "Free cancellation before pickup day",
    features: ["Open roof", "Beach route friendly", "Bluetooth audio", "Roadside support", "Unlimited local km"],
    documents: ["Driving license", "Government ID", "Security deposit"],
    vendor: { name: "Goa Coastal Wheels", responseTime: "Usually replies in 8 min", verified: true },
  },
  {
    slug: "goa-activa-scooter",
    type: "bike",
    title: "Honda Activa 6G",
    brand: "Honda",
    city: "Goa",
    pickupArea: "Baga beach counter",
    image: rentalImages.scooter,
    pricePerDay: 550,
    originalPrice: 750,
    rating: 4.7,
    reviews: 231,
    engine: "110cc",
    fuel: "Petrol",
    rangeKm: 120,
    deposit: 1000,
    cancellation: "Free cancellation up to 12 hours before pickup",
    features: ["Helmet included", "Phone holder", "Fuel efficient", "Easy beach parking", "24/7 vendor support"],
    documents: ["Two-wheeler license", "Government ID", "Security deposit"],
    vendor: { name: "Baga Ride Desk", responseTime: "Usually replies in 5 min", verified: true },
  },
  {
    slug: "dehradun-swift-manual",
    type: "car",
    title: "Maruti Swift",
    brand: "Maruti Suzuki",
    city: "Dehradun",
    pickupArea: "Clock Tower pickup point",
    image: rentalImages.hatchback,
    pricePerDay: 2100,
    originalPrice: 2600,
    rating: 4.6,
    reviews: 98,
    seats: 5,
    transmission: "Manual",
    fuel: "Petrol",
    rangeKm: 240,
    deposit: 3000,
    cancellation: "Free cancellation before 10 PM previous day",
    features: ["Hill-route checked", "Air conditioning", "Compact parking", "Music system", "Verified papers"],
    documents: ["Driving license", "Government ID", "Security deposit"],
    vendor: { name: "Doon Drive Co.", responseTime: "Usually replies in 12 min", verified: true },
  },
  {
    slug: "dehradun-royal-enfield-classic",
    type: "bike",
    title: "Royal Enfield Classic 350",
    brand: "Royal Enfield",
    city: "Dehradun",
    pickupArea: "Rajpur Road garage",
    image: rentalImages.royal,
    pricePerDay: 1300,
    originalPrice: 1650,
    rating: 4.9,
    reviews: 184,
    engine: "350cc",
    fuel: "Petrol",
    rangeKm: 180,
    deposit: 2500,
    cancellation: "Free cancellation up to 24 hours before pickup",
    features: ["Two helmets", "Saddle bag option", "Mountain-ready tyres", "Phone mount", "Emergency pickup"],
    documents: ["Motorcycle license", "Government ID", "Security deposit"],
    vendor: { name: "Himalayan Moto Rentals", responseTime: "Usually replies in 7 min", verified: true },
  },
  {
    slug: "jaipur-honda-city-auto",
    type: "car",
    title: "Honda City Automatic",
    brand: "Honda",
    city: "Jaipur",
    pickupArea: "MI Road delivery zone",
    image: rentalImages.sedan,
    pricePerDay: 3200,
    originalPrice: 3900,
    rating: 4.7,
    reviews: 121,
    seats: 5,
    transmission: "Automatic",
    fuel: "Petrol",
    rangeKm: 260,
    deposit: 4000,
    cancellation: "Free cancellation up to 18 hours before pickup",
    features: ["Automatic drive", "Rear camera", "Airport delivery", "Sanitized cabin", "Family luggage space"],
    documents: ["Driving license", "Government ID", "Security deposit"],
    vendor: { name: "Pink City Cars", responseTime: "Usually replies in 10 min", verified: true },
  },
  {
    slug: "rishikesh-himalayan-bike",
    type: "bike",
    title: "Royal Enfield Himalayan",
    brand: "Royal Enfield",
    city: "Rishikesh",
    pickupArea: "Tapovan pickup desk",
    image: rentalImages.bike,
    pricePerDay: 1600,
    originalPrice: 2100,
    rating: 4.8,
    reviews: 89,
    engine: "411cc",
    fuel: "Petrol",
    rangeKm: 210,
    deposit: 3000,
    cancellation: "Free cancellation up to 24 hours before pickup",
    features: ["Adventure kit", "Helmet included", "Hill assist support", "Luggage rack", "Route suggestions"],
    documents: ["Motorcycle license", "Government ID", "Security deposit"],
    vendor: { name: "Tapovan Trail Rides", responseTime: "Usually replies in 9 min", verified: true },
  },
  {
    slug: "mumbai-electric-hatchback",
    type: "car",
    title: "Tata Tiago EV",
    brand: "Tata",
    city: "Mumbai",
    pickupArea: "Bandra charging hub",
    image: rentalImages.electric,
    pricePerDay: 2800,
    originalPrice: 3400,
    rating: 4.5,
    reviews: 76,
    seats: 5,
    transmission: "Automatic",
    fuel: "Electric",
    rangeKm: 220,
    deposit: 3500,
    cancellation: "Free cancellation before pickup day",
    features: ["EV charging guide", "Automatic drive", "City commute ready", "Zero fuel cost", "App-based unlock"],
    documents: ["Driving license", "Government ID", "Security deposit"],
    vendor: { name: "Mumbai EV Rentals", responseTime: "Usually replies in 15 min", verified: true },
  },
]

export const getRentalBySlug = (slug: string) => rentals.find((rental) => rental.slug === slug)
export const rentalCities = Array.from(new Set(rentals.map((rental) => rental.city))).sort()
