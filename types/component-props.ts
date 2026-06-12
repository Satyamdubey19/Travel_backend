import type { HomeData } from "@/lib/homeData";
import type { ReactNode } from "react";

export type HomePageProps = {
  data: HomeData;
};

export type PlanHolidayCard = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
};

export type PlanHolidayProps = {
  cards: PlanHolidayCard[];
};

export type HotelCardProps = {
  id?: string;
  title: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  slug?: string;
  city?: string;
};

export type IconProps = {
  className?: string;
};

export type FilledIconProps = IconProps & {
  filled?: boolean;
};

export type IconBaseProps = IconProps & {
  children: ReactNode;
};

export type SignupShellProps = {
  initialAccountType: "USER" | "HOST";
};
