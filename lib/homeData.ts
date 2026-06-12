export type HomeFeature = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
};

export type HotelCard = {
  id: string;
  name: string;
  location: string;
  description: string;
  price: string;
  rating: number;
};

export type HomeData = {
  hero: {
    title: string;
    subtitle: string;
    buttonLabel: string;
  };
  features: HomeFeature[];
  featuredHotels: HotelCard[];
};

export const homeData: HomeData = {
  hero: {
    title: "Find your perfect stay with GetHotels",
    subtitle:
      "Search top hotels, exclusive offers, and curated holiday packages across premium destinations.",
    buttonLabel: "Explore Hotels",
  },
  features: [
    {
      id: "feature-1",
      title: "Best prices",
      subtitle: "Compare hotel deals",
      description: "Discover the lowest rates across premium stays and book with confidence.",
    },
    {
      id: "feature-2",
      title: "Curated stays",
      subtitle: "Handpicked hotels",
      description: "Stay at beautifully selected properties tailored for comfort and convenience.",
    },
    {
      id: "feature-3",
      title: "Easy booking",
      subtitle: "Fast checkout",
      description: "Reserve your room in seconds with our simple booking flow.",
    },
  ],
  featuredHotels: [
    {
      id: "hotel-1",
      name: "Seyfert Sarovar",
      location: "Dehradun, India",
      description: "Modern hotel with rooftop dining and stunning city views.",
      price: "₹10,000",
      rating: 4.7,
    },
    {
      id: "hotel-2",
      name: "Ramada",
      location: "Dehradun, India",
      description: "Comfortable rooms and exceptional service for every traveler.",
      price: "₹9,500",
      rating: 4.5,
    },
    {
      id: "hotel-3",
      name: "Taj Dehradun",
      location: "Dehradun, India",
      description: "Luxury hotel with elegant amenities and beautiful valley views.",
      price: "₹12,000",
      rating: 4.8,
    },
  ],
};
