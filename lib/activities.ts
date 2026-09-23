export type ActivityCategory = "adventure" | "wellness" | "heritage" | "water" | "food" | "culture" | "nature" | "sports"

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
  slots?: Array<{ id: string; date: string; startTime: string; spotsLeft: number }>
  language: string
  difficulty: "Easy" | "Moderate" | "High"
  highlights: string[]
  included: string[]
  itinerary: string[]
  cancellationPolicy?: string | null
  host: { name: string; verified: boolean; responseTime: string }
}
