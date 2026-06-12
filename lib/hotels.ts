export type HotelReview = {
  id: string
  name: string
  rating: number
  text: string
  date: string
}

export type Hotel = {
  id?: string
  slug: string
  title: string
  location: string
  city: string
  price: number
  rating: number
  image: string
  description: string
  gallery: string[]
  amenities: string[]
  rules: string[]
  reviews: HotelReview[]
}

const hotelImages = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1568084680786-a84f91d1153c?auto=format&fit=crop&w=1200&q=80",
]

export const hotels: Hotel[] = [
  {
    slug: "seyfert-sarovar",
    title: "Seyfert Sarovar",
    location: "Dehradun, India",
    city: "Dehradun",
    price: 10000,
    rating: 4.8,
    image: hotelImages[0],
    description:
      "A premium alpine retreat offering elegant rooms, wellness amenities, and easy access to Dehradun's top attractions.",
    gallery: [hotelImages[0], hotelImages[1], hotelImages[2], hotelImages[3]],
    amenities: [
      "Rooftop pool",
      "Spa and wellness center",
      "All-day dining",
      "High-speed Wi-Fi",
      "Airport transfers",
      "24/7 concierge",
    ],
    rules: [
      "Check-in from 2:00 PM",
      "Check-out by 12:00 PM",
      "No smoking in rooms",
      "Pets not allowed",
      "Quiet hours from 11:00 PM to 7:00 AM",
    ],
    reviews: [
      {
        id: "r1",
        name: "Aisha K.",
        rating: 5,
        text: "Beautiful views and excellent service—perfect for a weekend getaway.",
        date: "April 2, 2026",
      },
      {
        id: "r2",
        name: "Rohan S.",
        rating: 4,
        text: "Room was spacious and the breakfast spread was impressive.",
        date: "March 15, 2026",
      },
    ],
  },
  {
    slug: "ramada-resort",
    title: "Ramada Resort",
    location: "Dehradun, India",
    city: "Dehradun",
    price: 12000,
    rating: 4.9,
    image: hotelImages[1],
    description:
      "A modern resort with luxurious rooms, scenic mountain views, and curated dining experiences for every traveler.",
    gallery: [hotelImages[1], hotelImages[2], hotelImages[3], hotelImages[0]],
    amenities: [
      "Outdoor pool",
      "Fitness center",
      "Private balconies",
      "Room service",
      "Business center",
      "Event spaces",
    ],
    rules: [
      "Check-in from 3:00 PM",
      "Check-out by 11:00 AM",
      "No loud music after 10:00 PM",
      "Smoking only in designated areas",
      "Children under 12 stay free with parents",
    ],
    reviews: [
      {
        id: "r3",
        name: "Neha T.",
        rating: 5,
        text: "Fantastic resort with a calm atmosphere and wonderful staff.",
        date: "March 28, 2026",
      },
      {
        id: "r4",
        name: "Aman B.",
        rating: 4,
        text: "Great location and a beautiful room. Loved the breakfast.",
        date: "March 8, 2026",
      },
    ],
  },
  {
    slug: "taj-crystal",
    title: "Taj Crystal",
    location: "Mussoorie, India",
    city: "Mussoorie",
    price: 15000,
    rating: 5.0,
    image: hotelImages[2],
    description:
      "Luxury hillside hotel offering stunning valley views, refined accommodations, and signature hospitality.",
    gallery: [hotelImages[2], hotelImages[3], hotelImages[0], hotelImages[1]],
    amenities: [
      "Fine dining restaurant",
      "Spa treatments",
      "Private balcony rooms",
      "Complimentary breakfast",
      "Valet parking",
      "Guided tours",
    ],
    rules: [
      "Check-in from 2:00 PM",
      "Check-out by 12:00 PM",
      "No pets allowed",
      "Not responsible for valuables",
      "Smoking only in outdoor areas",
    ],
    reviews: [
      {
        id: "r5",
        name: "Priya M.",
        rating: 5,
        text: "A truly luxurious stay with breathtaking views and impeccable service.",
        date: "April 1, 2026",
      },
      {
        id: "r6",
        name: "Amit K.",
        rating: 5,
        text: "The room and amenities were perfect for our family vacation.",
        date: "March 18, 2026",
      },
    ],
  },
  {
    slug: "royal-vista",
    title: "Royal Vista",
    location: "Rishikesh, India",
    city: "Rishikesh",
    price: 9000,
    rating: 4.7,
    image: hotelImages[3],
    description:
      "A boutique stay near the river with elegant interiors, wellness facilities, and soulful dining.",
    gallery: [hotelImages[3], hotelImages[0], hotelImages[1], hotelImages[2]],
    amenities: [
      "River view rooms",
      "Meditation lounge",
      "Coffee bar",
      "Yoga sessions",
      "Complimentary Wi-Fi",
      "Free parking",
    ],
    rules: [
      "Check-in from 3:00 PM",
      "Check-out by 11:00 AM",
      "Quiet hours after 10:00 PM",
      "No smoking inside rooms",
      "Respect shared spaces",
    ],
    reviews: [
      {
        id: "r7",
        name: "Sara P.",
        rating: 4,
        text: "Lovely boutique hotel with a calm riverside vibe.",
        date: "March 22, 2026",
      },
      {
        id: "r8",
        name: "Vikram S.",
        rating: 5,
        text: "The wellness offerings and views made this stay special.",
        date: "March 10, 2026",
      },
    ],
  },
  {
    slug: "golden-tulip-goa",
    title: "Golden Tulip Goa",
    location: "Goa, India",
    city: "Goa",
    price: 8500,
    rating: 4.6,
    image: hotelImages[4],
    description:
      "A vibrant beachside retreat with lively ambiance, modern rooms, and direct access to Goa's famous beaches and nightlife.",
    gallery: [hotelImages[4], hotelImages[5], hotelImages[6], hotelImages[0]],
    amenities: [
      "Beach access",
      "Outdoor pool",
      "Restaurant",
      "WiFi",
      "Room Service",
      "Parking",
    ],
    rules: [
      "Check-in from 2:00 PM",
      "Check-out by 11:00 AM",
      "No smoking in rooms",
      "Pets not allowed",
    ],
    reviews: [
      {
        id: "r9",
        name: "Kavita D.",
        rating: 5,
        text: "Amazing beach views and the pool was fantastic. Perfect Goa vacation!",
        date: "March 25, 2026",
      },
      {
        id: "r10",
        name: "Raj M.",
        rating: 4,
        text: "Great location and friendly staff. Food could be better.",
        date: "March 5, 2026",
      },
    ],
  },
  {
    slug: "the-leela-jaipur",
    title: "The Leela Palace Jaipur",
    location: "Jaipur, India",
    city: "Jaipur",
    price: 18000,
    rating: 4.9,
    image: hotelImages[5],
    description:
      "Experience royal Rajasthani grandeur at this palatial hotel featuring ornate interiors, heritage architecture, and world-class dining.",
    gallery: [hotelImages[5], hotelImages[0], hotelImages[1], hotelImages[3]],
    amenities: [
      "Fine dining restaurant",
      "Spa treatments",
      "Pool",
      "Gym",
      "Valet parking",
      "Heritage tours",
    ],
    rules: [
      "Check-in from 2:00 PM",
      "Check-out by 12:00 PM",
      "Smart casual dress code in dining areas",
      "No pets allowed",
    ],
    reviews: [
      {
        id: "r11",
        name: "Meera J.",
        rating: 5,
        text: "Like staying in a palace. The architecture and service are unmatched.",
        date: "April 5, 2026",
      },
      {
        id: "r12",
        name: "Sunil R.",
        rating: 5,
        text: "Worth every rupee. The heritage tour was a highlight.",
        date: "March 20, 2026",
      },
    ],
  },
  {
    slug: "hyatt-regency-mumbai",
    title: "Hyatt Regency Mumbai",
    location: "Mumbai, India",
    city: "Mumbai",
    price: 14000,
    rating: 4.7,
    image: hotelImages[6],
    description:
      "Luxury business hotel in the heart of Mumbai with panoramic city views, state-of-the-art conference facilities, and award-winning restaurants.",
    gallery: [hotelImages[6], hotelImages[2], hotelImages[3], hotelImages[0]],
    amenities: [
      "Rooftop pool",
      "Fitness center",
      "Business center",
      "Spa",
      "All-day dining",
      "Airport transfers",
    ],
    rules: [
      "Check-in from 3:00 PM",
      "Check-out by 12:00 PM",
      "No smoking in rooms",
      "Quiet hours from 11:00 PM",
    ],
    reviews: [
      {
        id: "r13",
        name: "Deepak N.",
        rating: 5,
        text: "Best business hotel in Mumbai. Rooftop pool is incredible.",
        date: "April 8, 2026",
      },
      {
        id: "r14",
        name: "Ananya S.",
        rating: 4,
        text: "Great for conferences. Rooms are modern and comfortable.",
        date: "March 12, 2026",
      },
    ],
  },
]

export const getHotelBySlug = (slug: string) => hotels.find((hotel) => hotel.slug === slug)
export const getHotelSlugs = () => hotels.map((hotel) => ({ slug: hotel.slug }))
