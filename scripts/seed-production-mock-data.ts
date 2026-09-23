import dotenv from "dotenv"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, ListingStatus, TourDifficulty, TourRiskLevel, VehicleType, TransmissionType, FuelType } from "@prisma/client"

dotenv.config({ path: ".env" })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is required in .env")
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function seedProductionMockData() {
  console.log("=== TRAVELS PRO: ACTIVATING PRODUCTION MOCK DATA & INVENTORY ===")

  // Fix any legacy enum values in DB that Prisma doesn't recognize
  await pool.query(`
    DO $$
    BEGIN
      -- Add MULTI_SERVICE if enum exists
      BEGIN
        ALTER TYPE "HostType" ADD VALUE IF NOT EXISTS 'MULTI_SERVICE';
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END $$;
    UPDATE "Host" SET "hostType" = 'MULTI_SERVICE' WHERE "hostType"::text NOT IN ('TOUR_OPERATOR', 'RENTAL_AGENCY', 'ACTIVITY_PROVIDER', 'MULTI_SERVICE');
  `).catch((err) => console.warn("Enum migration warning:", err.message));

  // 1. Ensure approved, verified hosts
  const verifiedHosts = await prisma.host.findMany({
    include: { User: true },
  })

  // Ensure all existing hosts are verified and approved
  for (const host of verifiedHosts) {
    await prisma.host.update({
      where: { id: host.id },
      data: {
        isApproved: true,
        isVerified: true,
        isActive: true,
        kycStatus: "APPROVED",
      },
    })
  }
  console.log(`✓ Verified and approved ${verifiedHosts.length} hosts in database`)

  const primaryHost = verifiedHosts[0]
  if (!primaryHost) {
    throw new Error("No hosts found in database to attach listings.")
  }

  // 2. Activate all existing Tours and ensure compliance
  const existingTours = await prisma.tour.findMany({
    include: { Host: true },
  })

  const now = new Date()
  const defaultStartDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
  const defaultEndDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)

  for (const tour of existingTours) {
    // Ensure host is valid
    const targetHostId = tour.Host?.isActive && tour.Host?.isApproved ? tour.hostId : primaryHost.id

    await prisma.tour.update({
      where: { id: tour.id },
      data: {
        hostId: targetHostId,
        status: ListingStatus.ACTIVE,
        isActive: true,
        isApproved: true,
        deletedAt: null,
        startDate: tour.startDate < now ? defaultStartDate : tour.startDate,
        endDate: tour.endDate < now ? defaultEndDate : tour.endDate,
        riskDisclosure: tour.riskDisclosure || "High-altitude and outdoor adventure safety protocols apply. Certified trip leaders, comprehensive first aid kits, emergency satellite communications, and weather tracking are active on all journeys.",
        meetingPoint: tour.meetingPoint || `${tour.city || tour.destination} Central Transport Hub / Airport Gateway`,
        highlights: tour.highlights?.length ? tour.highlights : [
          "Local certified storytelling guide",
          "Small group experience capped for immersion",
          "Private Trip Circle access for members",
          "Eco-sensitive leave-no-trace routing"
        ],
        included: tour.included?.length ? tour.included : [
          "Group accommodation",
          "Daily breakfast & route meals",
          "Local transit & permits",
          "24/7 on-trip emergency assistance"
        ],
        excluded: tour.excluded?.length ? tour.excluded : [
          "Flights / long-distance transit to gateway",
          "Personal outdoor equipment",
          "Individual snack and beverage expenses"
        ],
      },
    })
  }
  console.log(`✓ Updated and approved ${existingTours.length} existing tours to ACTIVE`)

  // 3. Upsert frontend-matching canonical tours (e.g. himalayan-adventure, golden-triangle)
  const canonicalTours = [
    {
      slug: "himalayan-adventure",
      title: "Himalayan Adventure - Manali & Rohtang Pass",
      destination: "Manali, Himachal Pradesh",
      city: "Manali",
      state: "Himachal Pradesh",
      country: "India",
      duration: 5,
      pricePerPerson: 15000,
      originalPrice: 18500,
      difficulty: TourDifficulty.MODERATE,
      riskLevel: TourRiskLevel.MEDIUM,
      riskDisclosure: "High-altitude acclimatization required. Weather changes rapidly at Rohtang Pass (13,058 ft). All participants receive thermal gear briefing and certified guide oversight.",
      meetingPoint: "Mall Road Clock Tower, Old Manali Hub",
      category: "adventure",
      tags: ["mountain", "trekking", "himalayas", "manali"],
      images: [
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80"
      ],
      highlights: [
        "Rohtang Pass high altitude crossing",
        "Solang Valley paragliding session",
        "Hadimba Temple & cedar forest walk",
        "Riverside camping with stargazing",
        "Private Trip Circle for confirmed travelers"
      ],
      included: [
        "4 nights mountain boutique stay",
        "All breakfasts and dinner at camp",
        "Rohtang pass permits & 4x4 transport",
        "Certified mountaineering guide"
      ],
      excluded: [
        "Transit to Manali bus stand",
        "Personal shopping expenses",
        "Extreme adventure insurance upgrades"
      ],
      itinerary: [
        { day: 1, title: "Arrival in Manali", description: "Arrive in Old Manali, check in to mountain retreat, briefing & gear check.", activities: ["Check-in", "Old Manali trail walk", "Welcome dinner"], meals: ["Dinner"] },
        { day: 2, title: "Rohtang Pass Expedition", description: "Early morning ascent to Rohtang Pass (13,058 ft) with snow vistas.", activities: ["High pass ascent", "Snow trail exploration", "Hot chai stop"], meals: ["Breakfast", "Lunch", "Dinner"] },
        { day: 3, title: "Solang Valley & Paragliding", description: "Adventure sports day across the Solang basin.", activities: ["Paragliding flight", "Mountain biking", "Campfire evening"], meals: ["Breakfast", "Dinner"] },
        { day: 4, title: "Jogini Waterfall Trek", description: "Scenic cliffside hike through Vashisht pine woods to Jogini falls.", activities: ["Waterfall trek", "Hot sulphur springs", "Café trail"], meals: ["Breakfast", "Lunch"] },
        { day: 5, title: "Departure", description: "Morning market exploration and return transfer.", activities: ["Souvenir trail", "Farewell lunch", "Bus departure"], meals: ["Breakfast"] },
      ]
    },
    {
      slug: "golden-triangle",
      title: "Golden Triangle Heritage Expedition - Delhi, Agra & Jaipur",
      destination: "Delhi, Agra & Jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      duration: 6,
      pricePerPerson: 18500,
      originalPrice: 22000,
      difficulty: TourDifficulty.EASY,
      riskLevel: TourRiskLevel.LOW,
      riskDisclosure: "Extensive heritage walking on stone ramparts. Hydration protocols and comfortable footwear are recommended during daytime fort visits.",
      meetingPoint: "Connaught Place Gateway Hub, New Delhi",
      category: "cultural",
      tags: ["heritage", "culture", "rajasthan", "monuments"],
      images: [
        "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80"
      ],
      highlights: [
        "Sunrise at the Taj Mahal without crowds",
        "Amber Fort elephant sanctuary route",
        "Chand Baori stepwell photography",
        "Old Delhi rickshaw food expedition",
        "Private AC coach between imperial cities"
      ],
      included: [
        "5 nights heritage haveli stays",
        "All monument priority skip-the-line tickets",
        "Dedicated ASI licensed historian guides",
        "Daily regional culinary experiences"
      ],
      excluded: [
        "Airfare to New Delhi",
        "Camera video permit fees at monuments",
        "Personal shopping"
      ],
      itinerary: [
        { day: 1, title: "Imperial Delhi Arrival", description: "Arrive in Delhi, Humayun Tomb & Qutub Minar exploration.", activities: ["Airport greeting", "Historic monument walk", "Welcome feast"], meals: ["Dinner"] },
        { day: 2, title: "Old Delhi to Agra", description: "Morning rickshaw tour through Chandni Chowk, drive along Yamuna expressway to Agra.", activities: ["Street food crawl", "Drive to Agra", "Mehtab Bagh sunset view of Taj"], meals: ["Breakfast", "Dinner"] },
        { day: 3, title: "Taj Mahal Sunrise & Fatehpur Sikri", description: "Dawn entry to Taj Mahal, Agra Fort, then scenic transfer toward Jaipur via Fatehpur Sikri.", activities: ["Taj Mahal sunrise", "Agra Fort", "Fatehpur Sikri royal complex"], meals: ["Breakfast", "Lunch", "Dinner"] },
        { day: 4, title: "The Pink City & Amber Fort", description: "Ascent to Amber Fort, photo stop at Jal Mahal, City Palace courtyards.", activities: ["Amber Fort ramparts", "Hawa Mahal facade", "City Palace"], meals: ["Breakfast", "Lunch"] },
        { day: 5, title: "Jaipur Artisans & Stepwells", description: "Visit hidden Panna Meena Ka Kund stepwell and block-printing atelier in Sanganer.", activities: ["Stepwell morning", "Block-print workshop", "Nahargarh sunset"], meals: ["Breakfast", "Dinner"] },
        { day: 6, title: "Return to Delhi", description: "Comfortable drive back to Delhi airport or city centre.", activities: ["Highway breakfast", "Return transfer"], meals: ["Breakfast"] },
      ]
    }
  ]

  for (const cTour of canonicalTours) {
    const existing = await prisma.tour.findUnique({ where: { slug: cTour.slug } })
    const { itinerary, ...data } = cTour
    const tourData = {
      ...data,
      hostId: primaryHost.id,
      status: ListingStatus.ACTIVE,
      isActive: true,
      isApproved: true,
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      description: `${cTour.title}. Discover vibrant landscapes, vetted safety measures, and handpicked local accommodations with certified trip leaders.`,
      maxGroupSize: 14,
      totalSlots: 14,
      availableSlots: 8,
      averageRating: 4.85,
      totalReviews: 42,
      totalBookings: 68,
    }

    let tourId: string
    if (existing) {
      const updated = await prisma.tour.update({
        where: { id: existing.id },
        data: tourData,
      })
      tourId = updated.id
    } else {
      const created = await prisma.tour.create({
        data: tourData,
      })
      tourId = created.id
    }

    // Upsert itinerary days
    await prisma.tourItineraryDay.deleteMany({ where: { tourId } })
    for (const day of itinerary) {
      await prisma.tourItineraryDay.create({
        data: {
          tourId,
          day: day.day,
          title: day.title,
          description: day.description,
          activities: day.activities,
          meals: day.meals,
        }
      })
    }
  }
  console.log(`✓ Upserted canonical tours (himalayan-adventure, golden-triangle) with full itineraries`)

  // 4. Activate all Activities and ensure future ActivitySlot records
  const existingActivities = await prisma.activity.findMany({
    include: { Host: true },
  })

  const slotTimes = ["07:30", "10:00", "15:30", "17:00"]
  for (const act of existingActivities) {
    const targetHostId = act.Host?.isActive && act.Host?.isApproved ? act.hostId : primaryHost.id

    await prisma.activity.update({
      where: { id: act.id },
      data: {
        hostId: targetHostId,
        status: ListingStatus.ACTIVE,
        isActive: true,
        isApproved: true,
        deletedAt: null,
        meetingPoint: act.meetingPoint || `${act.area || act.city} Central Meeting Point`,
        highlights: act.highlights?.length ? act.highlights : [
          "Expert local host briefing",
          "All specialized gear included",
          "Verified safety certifications",
          "Small group guarantee"
        ],
        included: act.included?.length ? act.included : ["Safety gear", "Certified instructor", "Mineral water & refreshments"],
        excluded: act.excluded?.length ? act.excluded : ["Personal transport to location", "Souvenirs"],
      },
    })

    // Populate daily slots for the next 45 days in batch
    const slotsToCreate: Array<{
      activityId: string;
      date: Date;
      startTime: string;
      totalSpots: number;
      bookedSpots: number;
      isActive: boolean;
    }> = []
    for (let dayOffset = 1; dayOffset <= 45; dayOffset++) {
      const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset)
      const selectedTime = slotTimes[(dayOffset + act.title.length) % slotTimes.length]
      slotsToCreate.push({
        activityId: act.id,
        date: slotDate,
        startTime: selectedTime,
        totalSpots: 16,
        bookedSpots: 2,
        isActive: true,
      })
    }
    await prisma.activitySlot.createMany({
      data: slotsToCreate,
      skipDuplicates: true,
    }).catch(() => null)
  }
  console.log(`✓ Updated and approved ${existingActivities.length} activities with 45-day active slot availability`)

  // 5. Activate all Rentals and ensure complete RentalDetails
  const existingRentals = await prisma.rental.findMany({
    include: { Host: true, RentalDetails: true },
  })

  for (const rental of existingRentals) {
    const targetHostId = rental.Host?.isActive && rental.Host?.isApproved ? rental.hostId : primaryHost.id

    await prisma.rental.update({
      where: { id: rental.id },
      data: {
        hostId: targetHostId,
        status: ListingStatus.ACTIVE,
        isActive: true,
        isApproved: true,
        cancellationPolicy: rental.cancellationPolicy || "Full refund up to 48 hours prior to pickup time. 50% refund up to 24 hours prior.",
      },
    })

    if (!rental.RentalDetails) {
      const isCar = rental.vehicleType === VehicleType.CAR || rental.vehicleType === VehicleType.SUV
      await prisma.rentalDetails.create({
        data: {
          rentalId: rental.id,
          transmission: isCar ? TransmissionType.AUTOMATIC : TransmissionType.MANUAL,
          fuelType: isCar ? FuelType.PETROL : FuelType.PETROL,
          seats: isCar ? 5 : 2,
          engine: isCar ? "2.0L Turbocharged" : "452cc Liquid-Cooled Single",
          rangeKm: isCar ? 650 : 420,
          deposit: isCar ? 5000 : 3000,
          features: [
            "GPS Navigation",
            "Comprehensive Insurance Included",
            "24/7 Roadside Assistance",
            "Unlimited Kilometers"
          ],
          documentsRequired: [
            "Valid Driving License",
            "Original Government ID (Aadhaar / Passport)"
          ],
        },
      })
    }
  }
  console.log(`✓ Updated and approved ${existingRentals.length} vehicle rentals with full specifications`)

  console.log("\n=======================================================")
  console.log("  PRODUCTION MOCK DATA SEEDED & ACTIVATED SUCCESSFULLY! ")
  console.log("=======================================================\n")
}

seedProductionMockData()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error("\n❌ SEED SCRIPT FAILED:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
