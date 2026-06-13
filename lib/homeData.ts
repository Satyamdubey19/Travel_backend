export type HomeFeature = {
  id: string
  title: string
  subtitle: string
  description: string
}

export type HomeCard = {
  id: string
  name: string
  location: string
  description: string
  price: string
  rating: number
}

export type HomeData = {
  hero: {
    title: string
    subtitle: string
    buttonLabel: string
  }
  features: HomeFeature[]
  featuredTrips: HomeCard[]
}

export const homeData: HomeData = {
  hero: {
    title: "Plan travel with GetHotels",
    subtitle: "Explore tours, activities, and rentals across premium destinations.",
    buttonLabel: "Explore Trips",
  },
  features: [],
  featuredTrips: [],
}
