export type Itinerary = {
  day: number;
  title: string;
  description: string;
  activities: string[];
  meals: string[];
};

export type Tour = {
  id: string;
  slug: string;
  title: string;
  destination: string;
  location: { lat: number; lng: number; city: string; country: string };
  duration: number; // in days
  price: number;
  groupSize: string;
  availableSlots?: number;
  totalSlots?: number;
  joinApprovalRequired?: boolean;
  womenOnly?: boolean;
  safeForSoloWomen?: boolean;
  verifiedTravelersOnly?: boolean;
  rating: number;
  reviews: number;
  image: string;
  gallery: string[];
  description: string;
  highlights: string[];
  itinerary: Itinerary[];
  includedHotels: string[];
  bestTimeToVisit: string;
  category: string;
  tags: string[];
  budget: {
    perPersonBase: number;
    inclusions: string[];
    exclusions: string[];
  };
};

const tourImages = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1483683804023-6ccdb62f86ef?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
]

export const tours: Tour[] = [
  {
    id: "tour-1",
    slug: "himalayan-adventure",
    title: "Himalayan Adventure - Manali & Rohtang Pass",
    destination: "Manali, Himachal Pradesh",
    location: {
      lat: 32.2396,
      lng: 77.1887,
      city: "Manali",
      country: "India",
    },
    duration: 5,
    price: 15000,
    groupSize: "4-10 people",
    rating: 4.7,
    reviews: 128,
    image: tourImages[0],
    gallery: [tourImages[0], tourImages[1], tourImages[6], tourImages[7]],
    description:
      "Experience the breathtaking beauty of the Himalayas with this 5-day adventure. Trek through pristine landscapes, visit the famous Rohtang Pass, and enjoy adventure activities including paragliding and mountain biking.",
    highlights: [
      "Rohtang Pass visit",
      "Paragliding experience",
      "Old Manali exploration",
      "Mountain biking",
      "Hadimba Temple visit",
      "Spectacular sunrise trek",
    ],
    itinerary: [
      {
        day: 1,
        title: "Arrival in Manali",
        description: "Arrive in Manali, check into hotel, explore local markets",
        activities: [
          "Hotel check-in",
          "Local market exploration",
          "Evening walk in Old Manali",
        ],
        meals: ["Lunch", "Dinner"],
      },
      {
        day: 2,
        title: "Rohtang Pass Adventure",
        description: "Early morning drive to Rohtang Pass, engage in adventure activities",
        activities: ["Rohtang Pass visit", "Paragliding", "Photography"],
        meals: ["Breakfast", "Lunch", "Dinner"],
      },
      {
        day: 3,
        title: "Mountain Biking & Trekking",
        description: "Mountain biking through scenic trails and short forest trek",
        activities: ["Mountain biking", "Forest trekking", "Bonfire"],
        meals: ["Breakfast", "Lunch", "Dinner"],
      },
      {
        day: 4,
        title: "Cultural Exploration",
        description: "Visit Hadimba Temple and explore local culture",
        activities: ["Hadimba Temple", "Local crafts workshop", "Cultural show"],
        meals: ["Breakfast", "Lunch", "Dinner"],
      },
      {
        day: 5,
        title: "Departure",
        description: "Final breakfast and departure",
        activities: ["Breakfast", "Souvenir shopping", "Departure"],
        meals: ["Breakfast"],
      },
    ],
    includedHotels: ["seyfert-sarovar", "ramada-resort", "taj-crystal"],
    bestTimeToVisit: "March to June, September to November",
    category: "adventure",
    tags: ["trekking", "mountain", "paragliding", "snow"],
    budget: {
      perPersonBase: 15000,
      inclusions: [
        "4 nights accommodation",
        "Daily breakfast",
        "Rohtang Pass entry",
        "Paragliding experience",
        "Mountain bike rental",
        "Guide services",
        "Bonfire dinner",
      ],
      exclusions: [
        "Airfare/Train fare",
        "Personal expenses",
        "Travel insurance",
        "Activities not mentioned",
      ],
    },
  },
  {
    id: "tour-2",
    slug: "kerala-backwaters",
    title: "Kerala Backwaters & Beaches",
    destination: "Kochi & Alleppey, Kerala",
    location: {
      lat: 9.5941,
      lng: 76.2411,
      city: "Kochi",
      country: "India",
    },
    duration: 4,
    price: 12000,
    groupSize: "2-8 people",
    rating: 4.9,
    reviews: 245,
    image: tourImages[2],
    gallery: [tourImages[2], tourImages[7], tourImages[4], tourImages[5]],
    description:
      "Discover the serene backwaters of Kerala with houseboat cruises, visit pristine beaches, and experience authentic Kerala cuisine and culture.",
    highlights: [
      "Houseboat cruise",
      "Alleppey beach",
      "Chinese fishing nets",
      "Spice market tour",
      "Ayurvedic spa",
      "Local village visit",
    ],
    itinerary: [
      {
        day: 1,
        title: "Arrival in Kochi",
        description: "Arrive in Kochi, check-in, explore historic Kochi Fort",
        activities: [
          "Hotel check-in",
          "Chinese fishing nets visit",
          "Fort Kochi exploration",
        ],
        meals: ["Lunch", "Dinner"],
      },
      {
        day: 2,
        title: "Backwater Houseboat Cruise",
        description: "Full day houseboat cruise through Kerala backwaters",
        activities: [
          "Houseboat cruise",
          "Bird watching",
          "Sunset viewing",
          "Local meal on boat",
        ],
        meals: ["Breakfast", "Lunch", "Dinner"],
      },
      {
        day: 3,
        title: "Alleppey Beach & Ayurveda",
        description: "Beach relaxation and authentic Ayurvedic spa treatment",
        activities: ["Beach time", "Ayurvedic massage", "Local market visit"],
        meals: ["Breakfast", "Lunch", "Dinner"],
      },
      {
        day: 4,
        title: "Spice Market & Departure",
        description: "Visit spice markets and depart",
        activities: ["Spice market tour", "Shopping", "Departure"],
        meals: ["Breakfast"],
      },
    ],
    includedHotels: ["royal-vista", "ramada-resort"],
    bestTimeToVisit: "October to February",
    category: "relaxation",
    tags: ["beach", "houseboat", "ayurveda", "backwaters"],
    budget: {
      perPersonBase: 12000,
      inclusions: [
        "3 nights accommodation",
        "Daily breakfast",
        "Houseboat cruise",
        "Ayurvedic massage",
        "Spice market tour",
        "Local guide",
      ],
      exclusions: [
        "Transportation",
        "Personal expenses",
        "Activities not listed",
      ],
    },
  },
  {
    id: "tour-3",
    slug: "rajasthan-royal-heritage",
    title: "Rajasthan Royal Heritage Tour",
    destination: "Jaipur & Udaipur, Rajasthan",
    location: { lat: 26.9124, lng: 75.7873, city: "Jaipur", country: "India" },
    duration: 6,
    price: 18000,
    groupSize: "4-12 people",
    rating: 4.8,
    reviews: 189,
    image: tourImages[3],
    gallery: [tourImages[3], tourImages[6], tourImages[0]],
    description: "Immerse yourself in the royal heritage of Rajasthan. Explore majestic forts, ornate palaces, and vibrant bazaars across the Pink City and the City of Lakes.",
    highlights: ["Amber Fort", "City Palace Udaipur", "Lake Pichola boat ride", "Desert safari", "Traditional Rajasthani dinner", "Hawa Mahal"],
    category: "cultural",
    tags: ["heritage", "palace", "desert", "history"],
    itinerary: [
      { day: 1, title: "Arrival in Jaipur", description: "Check in and explore local markets", activities: ["Hotel check-in", "Johri Bazaar shopping", "Welcome dinner"], meals: ["Dinner"] },
      { day: 2, title: "Jaipur Forts & Palaces", description: "Visit Amber Fort and City Palace", activities: ["Amber Fort", "City Palace", "Hawa Mahal", "Jantar Mantar"], meals: ["Breakfast", "Lunch", "Dinner"] },
      { day: 3, title: "Desert Experience", description: "Camel safari and desert camping", activities: ["Camel safari", "Desert camping", "Folk music night"], meals: ["Breakfast", "Lunch", "Dinner"] },
      { day: 4, title: "Travel to Udaipur", description: "Scenic drive to the City of Lakes", activities: ["Scenic drive", "Chittorgarh Fort stop", "Udaipur check-in"], meals: ["Breakfast", "Lunch", "Dinner"] },
      { day: 5, title: "Udaipur Exploration", description: "Lake Pichola and City Palace", activities: ["City Palace Udaipur", "Lake Pichola boat ride", "Sunset viewing"], meals: ["Breakfast", "Lunch", "Dinner"] },
      { day: 6, title: "Departure", description: "Final breakfast and departure", activities: ["Breakfast", "Souvenir shopping", "Departure"], meals: ["Breakfast"] },
    ],
    includedHotels: ["royal-vista", "taj-crystal"],
    bestTimeToVisit: "October to March",
    budget: {
      perPersonBase: 18000,
      inclusions: ["5 nights accommodation", "Daily breakfast", "Amber Fort entry", "Desert safari", "Lake Pichola boat ride", "Guide services"],
      exclusions: ["Airfare", "Personal expenses", "Travel insurance"],
    },
  },
  {
    id: "tour-4",
    slug: "goa-beach-paradise",
    title: "Goa Beach Paradise Getaway",
    destination: "North & South Goa",
    location: { lat: 15.2993, lng: 74.124, city: "Goa", country: "India" },
    duration: 3,
    price: 8000,
    groupSize: "2-6 people",
    rating: 4.6,
    reviews: 312,
    image: tourImages[4],
    gallery: [tourImages[4], tourImages[7], tourImages[2]],
    description: "Unwind on the golden beaches of Goa with this perfect beach getaway. Enjoy water sports, nightlife, Portuguese architecture, and delicious Goan cuisine.",
    highlights: ["Baga Beach", "Old Goa churches", "Water sports", "Dudhsagar Falls", "Goan seafood", "Nightlife experience"],
    category: "relaxation",
    tags: ["beach", "nightlife", "water-sports", "cuisine"],
    itinerary: [
      { day: 1, title: "North Goa Beaches", description: "Explore famous North Goa beaches", activities: ["Baga Beach", "Calangute Beach", "Water sports", "Beach shack dinner"], meals: ["Lunch", "Dinner"] },
      { day: 2, title: "Heritage & Adventure", description: "Old Goa churches and Dudhsagar Falls", activities: ["Old Goa churches", "Dudhsagar Falls trip", "Spice plantation visit"], meals: ["Breakfast", "Lunch", "Dinner"] },
      { day: 3, title: "South Goa & Departure", description: "Peaceful South Goa beaches and departure", activities: ["Palolem Beach", "Souvenir shopping", "Departure"], meals: ["Breakfast", "Lunch"] },
    ],
    includedHotels: ["seyfert-sarovar"],
    bestTimeToVisit: "November to February",
    budget: {
      perPersonBase: 8000,
      inclusions: ["2 nights accommodation", "Daily breakfast", "Water sports session", "Dudhsagar Falls trip", "Local guide"],
      exclusions: ["Flights", "Personal expenses", "Nightlife expenses"],
    },
  },
  {
    id: "tour-5",
    slug: "jim-corbett-safari",
    title: "Jim Corbett Wildlife Safari",
    destination: "Jim Corbett National Park, Uttarakhand",
    location: { lat: 29.53, lng: 78.7747, city: "Ramnagar", country: "India" },
    duration: 4,
    price: 14000,
    groupSize: "4-8 people",
    rating: 4.5,
    reviews: 97,
    image: tourImages[5],
    gallery: [tourImages[5], tourImages[0], tourImages[1]],
    description: "Embark on a thrilling wildlife safari in India's oldest national park. Spot Bengal tigers, elephants, and exotic birds in their natural habitat.",
    highlights: ["Tiger safari", "Elephant ride", "Bird watching", "River rafting", "Nature walks", "Jungle campfire"],
    category: "adventure",
    tags: ["wildlife", "safari", "nature", "tiger"],
    itinerary: [
      { day: 1, title: "Arrival at Corbett", description: "Check into jungle resort and evening nature walk", activities: ["Resort check-in", "Evening nature walk", "Welcome campfire"], meals: ["Lunch", "Dinner"] },
      { day: 2, title: "Jungle Safari", description: "Full day jeep safari in the national park", activities: ["Morning jeep safari", "Bird watching", "Afternoon safari"], meals: ["Breakfast", "Lunch", "Dinner"] },
      { day: 3, title: "Adventure Day", description: "River rafting and elephant interaction", activities: ["River rafting", "Elephant safari", "Jungle campfire"], meals: ["Breakfast", "Lunch", "Dinner"] },
      { day: 4, title: "Departure", description: "Morning bird watching and departure", activities: ["Morning bird watching", "Breakfast", "Departure"], meals: ["Breakfast"] },
    ],
    includedHotels: ["ramada-resort"],
    bestTimeToVisit: "November to June",
    budget: {
      perPersonBase: 14000,
      inclusions: ["3 nights accommodation", "Daily breakfast", "2 jeep safaris", "Elephant safari", "River rafting", "Guide"],
      exclusions: ["Transport to Ramnagar", "Personal expenses", "Camera fees"],
    },
  },
  {
    id: "tour-6",
    slug: "andaman-island-escape",
    title: "Andaman Island Tropical Escape",
    destination: "Port Blair & Havelock, Andaman",
    location: { lat: 11.6234, lng: 92.7265, city: "Port Blair", country: "India" },
    duration: 5,
    price: 22000,
    groupSize: "2-6 people",
    rating: 4.8,
    reviews: 156,
    image: tourImages[7],
    gallery: [tourImages[7], tourImages[2], tourImages[4]],
    description: "Escape to the pristine islands of Andaman with crystal-clear waters, white sand beaches, and extraordinary marine life. Perfect for snorkeling and scuba diving enthusiasts.",
    highlights: ["Radhanagar Beach", "Scuba diving", "Cellular Jail", "Glass-bottom boat", "Snorkeling at Elephant Beach", "Limestone caves"],
    category: "relaxation",
    tags: ["island", "scuba", "snorkeling", "beach"],
    itinerary: [
      { day: 1, title: "Arrival in Port Blair", description: "Arrive and visit Cellular Jail", activities: ["Airport pickup", "Cellular Jail visit", "Light & Sound show"], meals: ["Dinner"] },
      { day: 2, title: "Havelock Island", description: "Ferry to Havelock and beach exploration", activities: ["Ferry to Havelock", "Radhanagar Beach", "Sunset viewing"], meals: ["Breakfast", "Lunch", "Dinner"] },
      { day: 3, title: "Water Adventures", description: "Scuba diving and snorkeling", activities: ["Scuba diving", "Snorkeling at Elephant Beach", "Beach relaxation"], meals: ["Breakfast", "Lunch", "Dinner"] },
      { day: 4, title: "Neil Island", description: "Day trip to Neil Island", activities: ["Ferry to Neil Island", "Natural Bridge", "Glass-bottom boat ride", "Return to Havelock"], meals: ["Breakfast", "Lunch", "Dinner"] },
      { day: 5, title: "Departure", description: "Return to Port Blair and departure", activities: ["Ferry to Port Blair", "Shopping", "Departure"], meals: ["Breakfast"] },
    ],
    includedHotels: ["royal-vista", "seyfert-sarovar"],
    bestTimeToVisit: "October to May",
    budget: {
      perPersonBase: 22000,
      inclusions: ["4 nights accommodation", "Daily breakfast", "Ferry tickets", "Scuba diving session", "Snorkeling gear", "Airport transfers"],
      exclusions: ["Flights to Port Blair", "Personal expenses", "Travel insurance", "Underwater camera rental"],
    },
  },
];
