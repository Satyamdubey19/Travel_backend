export type ActivityCategory = "adventure" | "wellness" | "heritage" | "water" | "food"

export type Activity = {
  slug: string
  title: string
  category: ActivityCategory
  city: string
  area: string
  image: string
  price: number
  originalPrice: number
  duration: string
  rating: number
  reviews: number
  groupSize: string
  startTimes: string[]
  language: string
  difficulty: "Easy" | "Moderate" | "High"
  highlights: string[]
  included: string[]
  itinerary: string[]
  host: {
    name: string
    verified: boolean
    responseTime: string
  }
}

const activityImages = {
  rafting: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
  heritage: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80",
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
  scuba: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
  yoga: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
  fort: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80",
  cruise: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  trek: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80",
}

export const activities: Activity[] = [
  {
    slug: "rishikesh-river-rafting",
    title: "Ganga River Rafting Experience",
    category: "adventure",
    city: "Rishikesh",
    area: "Shivpuri to Tapovan",
    image: activityImages.rafting,
    price: 1499,
    originalPrice: 1999,
    duration: "3 hours",
    rating: 4.8,
    reviews: 312,
    groupSize: "2-12 guests",
    startTimes: ["8:00 AM", "11:30 AM", "2:30 PM"],
    language: "Hindi, English",
    difficulty: "Moderate",
    highlights: ["Certified rafting guide", "Safety gear included", "Cliff jumping stop", "Photos available"],
    included: ["Rafting equipment", "Instructor", "Pickup from Tapovan", "Safety briefing"],
    itinerary: ["Meet at Tapovan desk", "Drive to Shivpuri", "Raft down Grade II-III rapids", "Return transfer"],
    host: { name: "Tapovan Adventure Crew", verified: true, responseTime: "Replies in 6 min" },
  },
  {
    slug: "goa-sunset-cruise",
    title: "Mandovi Sunset Cruise",
    category: "water",
    city: "Goa",
    area: "Panjim Jetty",
    image: activityImages.cruise,
    price: 899,
    originalPrice: 1200,
    duration: "90 minutes",
    rating: 4.6,
    reviews: 428,
    groupSize: "1-20 guests",
    startTimes: ["5:30 PM", "7:15 PM"],
    language: "English",
    difficulty: "Easy",
    highlights: ["River sunset views", "Live music", "Reserved seating", "Family friendly"],
    included: ["Cruise ticket", "Welcome drink", "Live entertainment", "Boarding support"],
    itinerary: ["Board at Panjim Jetty", "Mandovi river cruise", "Sunset photo stop", "Return to jetty"],
    host: { name: "Goa River Experiences", verified: true, responseTime: "Replies in 9 min" },
  },
  {
    slug: "jaipur-heritage-walk",
    title: "Old Jaipur Heritage Walk",
    category: "heritage",
    city: "Jaipur",
    area: "Hawa Mahal and Johri Bazaar",
    image: activityImages.heritage,
    price: 799,
    originalPrice: 1100,
    duration: "2.5 hours",
    rating: 4.9,
    reviews: 205,
    groupSize: "2-10 guests",
    startTimes: ["7:30 AM", "4:00 PM"],
    language: "Hindi, English",
    difficulty: "Easy",
    highlights: ["Local storyteller", "Hidden lanes", "Market tastings", "Photo spots"],
    included: ["Guide", "Street snack tasting", "Route map", "Local recommendations"],
    itinerary: ["Meet near Hawa Mahal", "Explore old city lanes", "Visit craft shops", "End at Johri Bazaar"],
    host: { name: "Pink City Walks", verified: true, responseTime: "Replies in 11 min" },
  },
  {
    slug: "goa-scuba-beginner",
    title: "Beginner Scuba Diving Session",
    category: "water",
    city: "Goa",
    area: "Grande Island",
    image: activityImages.scuba,
    price: 3499,
    originalPrice: 4300,
    duration: "5 hours",
    rating: 4.7,
    reviews: 167,
    groupSize: "1-8 guests",
    startTimes: ["7:00 AM"],
    language: "English",
    difficulty: "Moderate",
    highlights: ["Instructor-led dive", "Boat transfer", "Underwater photos", "No prior experience needed"],
    included: ["Dive gear", "Instructor", "Boat transfer", "Snacks", "Basic photos"],
    itinerary: ["Pickup from dive center", "Boat to island", "Training and dive", "Return transfer"],
    host: { name: "Coastal Dive Goa", verified: true, responseTime: "Replies in 14 min" },
  },
  {
    slug: "dehradun-food-trail",
    title: "Dehradun Food Trail",
    category: "food",
    city: "Dehradun",
    area: "Paltan Bazaar",
    image: activityImages.food,
    price: 699,
    originalPrice: 950,
    duration: "2 hours",
    rating: 4.5,
    reviews: 91,
    groupSize: "2-8 guests",
    startTimes: ["5:00 PM", "7:30 PM"],
    language: "Hindi, English",
    difficulty: "Easy",
    highlights: ["Local bakery stop", "Street food tastings", "Small-group walk", "Local host"],
    included: ["Food tastings", "Guide", "Water bottle", "Market route"],
    itinerary: ["Meet at Paltan Bazaar", "Taste local snacks", "Bakery stop", "Dessert finish"],
    host: { name: "Doon Local Table", verified: true, responseTime: "Replies in 8 min" },
  },
  {
    slug: "rishikesh-yoga-aarti",
    title: "Morning Yoga and Evening Aarti",
    category: "wellness",
    city: "Rishikesh",
    area: "Lakshman Jhula",
    image: activityImages.yoga,
    price: 999,
    originalPrice: 1400,
    duration: "Full day flexible",
    rating: 4.8,
    reviews: 144,
    groupSize: "1-10 guests",
    startTimes: ["6:30 AM"],
    language: "Hindi, English",
    difficulty: "Easy",
    highlights: ["Certified yoga teacher", "Ganga-side session", "Aarti seating help", "Wellness cafe guide"],
    included: ["Yoga mat", "Instructor", "Aarti coordination", "Tea"],
    itinerary: ["Morning yoga", "Free exploration time", "Wellness cafe recommendation", "Evening aarti"],
    host: { name: "Rishikesh Wellness Studio", verified: true, responseTime: "Replies in 10 min" },
  },
  {
    slug: "jaipur-amber-fort-photo-tour",
    title: "Amber Fort Photo Tour",
    category: "heritage",
    city: "Jaipur",
    area: "Amber Fort",
    image: activityImages.fort,
    price: 1299,
    originalPrice: 1700,
    duration: "3 hours",
    rating: 4.7,
    reviews: 118,
    groupSize: "1-6 guests",
    startTimes: ["6:30 AM", "3:30 PM"],
    language: "English",
    difficulty: "Moderate",
    highlights: ["Golden-hour route", "Photo guidance", "Historic context", "Less-crowded entries"],
    included: ["Photo guide", "Route planning", "Editing tips", "Local support"],
    itinerary: ["Meet at fort gate", "Courtyard route", "Viewpoint photos", "Local cafe finish"],
    host: { name: "Jaipur Lens Walks", verified: true, responseTime: "Replies in 12 min" },
  },
  {
    slug: "mussoorie-day-trek",
    title: "Mussoorie Ridge Day Trek",
    category: "adventure",
    city: "Mussoorie",
    area: "Landour trail",
    image: activityImages.trek,
    price: 1199,
    originalPrice: 1500,
    duration: "4 hours",
    rating: 4.6,
    reviews: 83,
    groupSize: "2-8 guests",
    startTimes: ["7:00 AM", "2:00 PM"],
    language: "Hindi, English",
    difficulty: "Moderate",
    highlights: ["Local trail guide", "Tea stop", "Forest route", "Viewpoint break"],
    included: ["Guide", "Basic first aid", "Tea stop", "Trail snacks"],
    itinerary: ["Meet in Landour", "Forest trail walk", "Viewpoint halt", "Return via cafe lane"],
    host: { name: "Landour Trail Guides", verified: true, responseTime: "Replies in 16 min" },
  },
]

export const getActivityBySlug = (slug: string) => activities.find((activity) => activity.slug === slug)
export const activityCities = Array.from(new Set(activities.map((activity) => activity.city))).sort()
