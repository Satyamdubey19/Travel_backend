export type UserPost = {
  id: string
  username: string
  userImage: string
  description: string
  image: string
  category: 'hotel' | 'tour' | 'destination'
  hashtags: string[]
  timestamp: string
  likes: number
}

export const userPosts: UserPost[] = [
  {
    id: 'post-1',
    username: 'Priya Sharma',
    userImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya',
    description: 'Just booked the most amazing monsoon getaway at the Himalayan Adventure! The views are absolutely breathtaking. 🏔️✨ #GetHotels #TravelDiaries #HimalayaAdventure',
    image: '/tour1.jpg',
    category: 'tour',
    hashtags: ['#GetHotels', '#TravelDiaries', '#HimalayaAdventure', '#Wanderlust'],
    timestamp: '2 days ago',
    likes: 1250,
  },
  {
    id: 'post-2',
    username: 'Arjun Patel',
    userImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun',
    description: 'Found this incredible luxury hotel in Goa! The sunset from my room was pure magic. Thanks @GetHotels for the recommendation! 🌅🏨 #GetHotels #LuxuryTravel #GoaDiaries',
    image: '/hotel1.jpg',
    category: 'hotel',
    hashtags: ['#GetHotels', '#LuxuryTravel', '#GoaDiaries', '#VitaminSea'],
    timestamp: '3 days ago',
    likes: 2340,
  },
  {
    id: 'post-3',
    username: 'Sneha Desai',
    userImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha',
    description: 'Exploring the backwaters of Kerala with the most helpful tour guide ever! This is what travel dreams are made of 🛣️💚 #GetHotels #KeralaBackwaters #TravelBugBit',
    image: '/tour2.jpg',
    category: 'tour',
    hashtags: ['#GetHotels', '#KeralaBackwaters', '#TravelBugBit', '#ExploreMore'],
    timestamp: '5 days ago',
    likes: 3120,
  },
  {
    id: 'post-4',
    username: 'Rahul Singh',
    userImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul',
    description: 'The Taj Crystal Hotel exceeded all my expectations! Five-star service and the most delicious breakfast buffet I have ever seen. Highly recommend! 😍🍽️ #GetHotels #HotelLife #Mumbai',
    image: '/hotel2.jpg',
    category: 'hotel',
    hashtags: ['#GetHotels', '#HotelLife', '#Mumbai', '#TravelBlogger'],
    timestamp: '1 week ago',
    likes: 1890,
  },
  {
    id: 'post-5',
    username: 'Zara Khan',
    userImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zara',
    description: 'Adventure time! Paragliding over Manali was the most thrilling experience of my life! 🪂🏔️ Booked through #GetHotels and everything was perfect! #GetHotels #AdventureAwaits #ManaliBound',
    image: '/tour3.jpg',
    category: 'tour',
    hashtags: ['#GetHotels', '#AdventureAwaits', '#ManaliBound', '#ThrillSeeker'],
    timestamp: '1 week ago',
    likes: 4560,
  },
  {
    id: 'post-6',
    username: 'Vikram Rao',
    userImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram',
    description: 'Nothing beats a weekend escape to the beach! Royal Vista hotel is the definition of paradise on earth. Clear waters, soft sand, and amazing hospitality! 🏖️💙 #GetHotels #BeachVibes #WeekendGetaway',
    image: '/hotel3.jpg',
    category: 'hotel',
    hashtags: ['#GetHotels', '#BeachVibes', '#WeekendGetaway', '#CoastalLiving'],
    timestamp: '10 days ago',
    likes: 2780,
  },
  {
    id: 'post-7',
    username: 'Aisha Malik',
    userImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aisha',
    description: 'Discovering hidden temples and local culture in Rajasthan with the best tour group ever! Every moment is a memory to treasure. Thank you #GetHotels! 🏛️✨ #GetHotels #Rajasthan #CulturalExploration',
    image: '/tour4.jpg',
    category: 'tour',
    hashtags: ['#GetHotels', '#Rajasthan', '#CulturalExploration', '#HeritageTravel'],
    timestamp: '2 weeks ago',
    likes: 3450,
  },
  {
    id: 'post-8',
    username: 'Dev Kumar',
    userImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev',
    description: 'Ramada Resort is calling my name again! The spa, the pool, the food - everything is absolutely world-class. Already planning my next stay! 🛀✨🍹 #GetHotels #SpaLife #RelaxationMode',
    image: '/hotel4.jpg',
    category: 'hotel',
    hashtags: ['#GetHotels', '#SpaLife', '#RelaxationMode', '#HotelGoals'],
    timestamp: '2 weeks ago',
    likes: 2120,
  },
]
