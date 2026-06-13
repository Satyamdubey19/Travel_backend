export type UserPost = {
  id: string
  username: string
  userImage: string
  description: string
  image: string
  category: "tour" | "activity" | "destination"
  hashtags: string[]
  timestamp: string
  likes: number
}

export const userPosts: UserPost[] = []
