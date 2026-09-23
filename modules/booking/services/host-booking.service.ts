import {
  Prisma,
  type BookingEventType,
  type BookingStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { queueNotification } from "@/modules/notification/services/notification-outbox.service";

const PAGE_SIZE = 50;
export type HostBookingType = "tour" | "activity" | "rental";

function money(value: unknown) {
  return Number(value ?? 0);
}
function clientStatus(value: BookingStatus) {
  return value.toLowerCase();
}

const bookingSelect = {
  id: true,
  bookingCode: true,
  status: true,
  checkIn: true,
  checkOut: true,
  totalGuests: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  specialRequests: true,
  totalAmount: true,
  currency: true,
  createdAt: true,
  Tour: {
    select: {
      id: true,
      title: true,
      slug: true,
      city: true,
      cancellationPolicy: true,
    },
  },
  Payment: {
    select: {
      id: true,
      status: true,
      hostEarnings: true,
      platformFee: true,
      refundedAt: true,
    },
  },
  User: { select: { id: true, name: true, email: true } },
} satisfies Prisma.BookingSelect;

function presentBooking(
  booking: Prisma.BookingGetPayload<{ select: typeof bookingSelect }>,
) {
  return {
    bookingType: "tour" as const,
    id: booking.id,
    bookingCode: booking.bookingCode,
    status: clientStatus(booking.status),
    checkInDate: booking.checkIn?.toISOString() ?? null,
    checkOutDate: booking.checkOut?.toISOString() ?? null,
    startDate: booking.checkIn?.toISOString() ?? null,
    endDate: booking.checkOut?.toISOString() ?? null,
    numberOfGuests: booking.totalGuests,
    totalPrice: money(booking.totalAmount),
    currency: booking.currency,
    createdAt: booking.createdAt.toISOString(),
    specialRequests: booking.specialRequests,
    guest: {
      id: booking.User.id,
      name: booking.contactName || booking.User.name,
      email: booking.contactEmail || booking.User.email,
      phone: booking.contactPhone,
    },
    tour: booking.Tour
      ? {
          id: booking.Tour.id,
          name: booking.Tour.title,
          slug: booking.Tour.slug,
          city: booking.Tour.city,
        }
      : null,
    cancellationPolicy: booking.Tour?.cancellationPolicy ?? null,
    rooms: [],
    payment: booking.Payment
      ? {
          status: booking.Payment.status,
          hostEarnings: money(booking.Payment.hostEarnings),
          platformFee: money(booking.Payment.platformFee),
          refundedAt: booking.Payment.refundedAt?.toISOString() ?? null,
        }
      : null,
  };
}

const activityBookingSelect = {
  id: true,
  bookingCode: true,
  status: true,
  date: true,
  startTime: true,
  guestCount: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  specialRequests: true,
  totalAmount: true,
  currency: true,
  createdAt: true,
  Activity: {
    select: {
      id: true,
      title: true,
      slug: true,
      city: true,
      area: true,
      cancellationPolicy: true,
    },
  },
  ActivityPayment: { select: { id: true, status: true, amount: true } },
  ActivityRefund: {
    select: { status: true, requestedAmount: true, approvedAmount: true },
  },
  ActivityBookingGuest: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      age: true,
      type: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  ActivityBookingTimeline: {
    select: { type: true, title: true, message: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.ActivityBookingSelect;

const rentalBookingSelect = {
  id: true,
  bookingCode: true,
  status: true,
  pickupDate: true,
  returnDate: true,
  pickupTime: true,
  days: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  notes: true,
  totalAmount: true,
  currency: true,
  createdAt: true,
  Rental: {
    select: {
      id: true,
      title: true,
      slug: true,
      city: true,
      pickupArea: true,
      cancellationPolicy: true,
    },
  },
  RentalPayment: { select: { id: true, status: true, amount: true } },
  RentalRefund: {
    select: { status: true, requestedAmount: true, approvedAmount: true },
  },
  RentalBookingTimeline: {
    select: { type: true, title: true, message: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.RentalBookingSelect;

function presentActivityBooking(
  booking: Prisma.ActivityBookingGetPayload<{
    select: typeof activityBookingSelect;
  }>,
) {
  return {
    bookingType: "activity" as const,
    id: booking.id,
    bookingCode: booking.bookingCode,
    status: booking.status.toLowerCase(),
    checkInDate: booking.date.toISOString(),
    checkOutDate: null,
    startDate: booking.date.toISOString(),
    endDate: null,
    startTime: booking.startTime,
    numberOfGuests: booking.guestCount,
    totalPrice: money(booking.totalAmount),
    currency: booking.currency,
    createdAt: booking.createdAt.toISOString(),
    specialRequests: booking.specialRequests,
    guest: {
      name: booking.contactName,
      email: booking.contactEmail,
      phone: booking.contactPhone,
    },
    tour: {
      id: booking.Activity.id,
      name: booking.Activity.title,
      slug: booking.Activity.slug,
      city: booking.Activity.city,
      area: booking.Activity.area,
    },
    payment: booking.ActivityPayment
      ? {
          status: booking.ActivityPayment.status,
          grossAmount: money(booking.ActivityPayment.amount),
          hostEarnings: null,
          platformFee: null,
        }
      : null,
    refund: booking.ActivityRefund
      ? {
          status: booking.ActivityRefund.status,
          requestedAmount: money(booking.ActivityRefund.requestedAmount),
          approvedAmount:
            booking.ActivityRefund.approvedAmount == null
              ? null
              : money(booking.ActivityRefund.approvedAmount),
        }
      : null,
    travelers: booking.ActivityBookingGuest.map((row) => ({
      id: row.id,
      fullName: [row.firstName, row.lastName].filter(Boolean).join(" "),
      age: row.age,
      relation: row.type,
      status: booking.status,
    })),
    timeline: booking.ActivityBookingTimeline.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    cancellationPolicy: booking.Activity.cancellationPolicy,
  };
}

function presentRentalBooking(
  booking: Prisma.RentalBookingGetPayload<{
    select: typeof rentalBookingSelect;
  }>,
) {
  return {
    bookingType: "rental" as const,
    id: booking.id,
    bookingCode: booking.bookingCode,
    status: booking.status.toLowerCase(),
    checkInDate: booking.pickupDate.toISOString(),
    checkOutDate: booking.returnDate.toISOString(),
    startDate: booking.pickupDate.toISOString(),
    endDate: booking.returnDate.toISOString(),
    startTime: booking.pickupTime,
    numberOfGuests: 1,
    quantityLabel: `${booking.days} day${booking.days === 1 ? "" : "s"}`,
    totalPrice: money(booking.totalAmount),
    currency: booking.currency,
    createdAt: booking.createdAt.toISOString(),
    specialRequests: booking.notes,
    guest: {
      name: booking.contactName,
      email: booking.contactEmail,
      phone: booking.contactPhone,
    },
    tour: {
      id: booking.Rental.id,
      name: booking.Rental.title,
      slug: booking.Rental.slug,
      city: booking.Rental.city,
      area: booking.Rental.pickupArea,
    },
    payment: booking.RentalPayment
      ? {
          status: booking.RentalPayment.status,
          grossAmount: money(booking.RentalPayment.amount),
          hostEarnings: null,
          platformFee: null,
        }
      : null,
    refund: booking.RentalRefund
      ? {
          status: booking.RentalRefund.status,
          requestedAmount: money(booking.RentalRefund.requestedAmount),
          approvedAmount:
            booking.RentalRefund.approvedAmount == null
              ? null
              : money(booking.RentalRefund.approvedAmount),
        }
      : null,
    travelers: [],
    timeline: booking.RentalBookingTimeline.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    cancellationPolicy: booking.Rental.cancellationPolicy,
  };
}

export async function listHostBookings(
  hostId: string,
  status?: string,
  type?: string,
) {
  const normalizedType = (type ?? "all").toLowerCase();
  if (!["all", "tour", "activity", "rental"].includes(normalizedType))
    throw Object.assign(new Error("Invalid booking type"), { statusCode: 400 });
  const normalizedStatus =
    status && status !== "all"
      ? (status.toUpperCase() as BookingStatus)
      : undefined;
  if (
    normalizedStatus &&
    ![
      "PENDING",
      "CONFIRMED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
      "REFUND_PENDING",
    ].includes(normalizedStatus)
  )
    throw Object.assign(new Error("Invalid booking status"), {
      statusCode: 400,
    });
  const includeTour = normalizedType === "all" || normalizedType === "tour";
  const includeActivity =
    normalizedType === "all" || normalizedType === "activity";
  const includeRental = normalizedType === "all" || normalizedType === "rental";
  const [
    tourRows,
    activityRows,
    rentalRows,
    tourStats,
    activityStats,
    rentalStats,
  ] = await Promise.all([
    includeTour
      ? prisma.booking.findMany({
          where: {
            hostId,
            tourId: { not: null },
            ...(normalizedStatus ? { status: normalizedStatus } : {}),
          },
          select: bookingSelect,
          orderBy: { createdAt: "desc" },
          take: PAGE_SIZE,
        })
      : [],
    includeActivity
      ? prisma.activityBooking.findMany({
          where: {
            hostId,
            ...(normalizedStatus ? { status: normalizedStatus } : {}),
          },
          select: activityBookingSelect,
          orderBy: { createdAt: "desc" },
          take: PAGE_SIZE,
        })
      : [],
    includeRental
      ? prisma.rentalBooking.findMany({
          where: {
            hostId,
            ...(normalizedStatus ? { status: normalizedStatus } : {}),
          },
          select: rentalBookingSelect,
          orderBy: { createdAt: "desc" },
          take: PAGE_SIZE,
        })
      : [],
    includeTour
      ? prisma.booking.findMany({
          where: { hostId, tourId: { not: null } },
          select: {
            status: true,
            Payment: { select: { status: true, amount: true } },
          },
        })
      : [],
    includeActivity
      ? prisma.activityBooking.findMany({
          where: { hostId },
          select: {
            status: true,
            ActivityPayment: { select: { status: true, amount: true } },
          },
        })
      : [],
    includeRental
      ? prisma.rentalBooking.findMany({
          where: { hostId },
          select: {
            status: true,
            RentalPayment: { select: { status: true, amount: true } },
          },
        })
      : [],
  ]);
  const data = [
    ...tourRows.map(presentBooking),
    ...activityRows.map(presentActivityBooking),
    ...rentalRows.map(presentRentalBooking),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, PAGE_SIZE);
  const statRows = [
    ...tourStats.map((row) => ({
      status: row.status,
      paid: row.Payment?.status === "SUCCESS" ? money(row.Payment.amount) : 0,
    })),
    ...activityStats.map((row) => ({
      status: row.status,
      paid:
        row.ActivityPayment?.status === "SUCCESS"
          ? money(row.ActivityPayment.amount)
          : 0,
    })),
    ...rentalStats.map((row) => ({
      status: row.status,
      paid:
        row.RentalPayment?.status === "SUCCESS"
          ? money(row.RentalPayment.amount)
          : 0,
    })),
  ];
  return {
    data,
    meta: {
      stats: {
        totalBookings: statRows.length,
        confirmedBookings: statRows.filter((row) => row.status === "CONFIRMED")
          .length,
        pendingBookings: statRows.filter((row) => row.status === "PENDING")
          .length,
        totalRevenue: statRows.reduce((sum, row) => sum + row.paid, 0),
      },
    },
  };
}

export async function getHostBooking(
  hostId: string,
  bookingId: string,
  type: HostBookingType = "tour",
) {
  if (type === "activity") {
    const booking = await prisma.activityBooking.findFirst({
      where: { id: bookingId, hostId },
      select: activityBookingSelect,
    });
    if (!booking)
      throw Object.assign(new Error("Booking not found"), { statusCode: 404 });
    return presentActivityBooking(booking);
  }
  if (type === "rental") {
    const booking = await prisma.rentalBooking.findFirst({
      where: { id: bookingId, hostId },
      select: rentalBookingSelect,
    });
    if (!booking)
      throw Object.assign(new Error("Booking not found"), { statusCode: 404 });
    return presentRentalBooking(booking);
  }
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hostId, tourId: { not: null } },
    select: bookingSelect,
  });
  if (!booking)
    throw Object.assign(new Error("Booking not found"), { statusCode: 404 });
  const tourBooking = await prisma.tourBooking.findUnique({
    where: { legacyBookingId: booking.id },
  });
  const travelers = tourBooking
    ? await prisma.tourTraveler.findMany({
        where: { tourBookingId: tourBooking.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fullName: true,
          age: true,
          dob: true,
          gender: true,
          email: true,
          phone: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          foodPreference: true,
          medicalNotes: true,
          bloodGroup: true,
          relation: true,
          status: true,
        },
      })
    : [];
  const timeline = await prisma.bookingTimeline.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    select: { type: true, title: true, message: true, createdAt: true },
  });
  return {
    ...presentBooking(booking),
    travelers: travelers.map((row) => ({
      ...row,
      dob: row.dob?.toISOString() ?? null,
    })),
    timeline: timeline.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

async function updateTourBookingStatus(
  hostId: string,
  bookingId: string,
  requestedStatus: string,
  note?: string,
) {
  const nextStatus = requestedStatus.toUpperCase() as BookingStatus;
  if (!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(nextStatus))
    throw Object.assign(
      new Error("Hosts cannot override payment confirmation"),
      { statusCode: 400 },
    );
  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, hostId, tourId: { not: null } },
        include: { Payment: true, Tour: true },
      });
      if (!booking?.Tour || !booking.tourId)
        throw Object.assign(new Error("Booking not found"), {
          statusCode: 404,
        });
      if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(booking.status))
        throw Object.assign(new Error("Booking is already closed"), {
          statusCode: 409,
        });
      const now = new Date();
      if (
        nextStatus === "COMPLETED" &&
        (!booking.checkOut || booking.checkOut > now)
      )
        throw Object.assign(
          new Error("A trip can be completed only after it ends"),
          { statusCode: 409 },
        );
      if (
        nextStatus === "NO_SHOW" &&
        (!booking.checkIn || booking.checkIn > now)
      )
        throw Object.assign(
          new Error("No-show can be recorded only after the trip starts"),
          { statusCode: 409 },
        );

      let bookingStatus = nextStatus;
      if (nextStatus === "CANCELLED" && booking.Payment?.status === "SUCCESS") {
        bookingStatus = "REFUND_PENDING";
        const tourBooking = await tx.tourBooking.findUnique({
          where: { legacyBookingId: booking.id },
        });
        if (tourBooking)
          await tx.refund.create({
            data: {
              tourBookingId: tourBooking.id,
              paymentId: booking.Payment.id,
              amount: booking.totalAmount,
              currency: booking.currency,
              status: "PENDING",
              reason: note?.trim() || "Trip cancelled by host",
            },
          });
        await tx.$executeRaw`UPDATE "Tour" SET "availableSlots" = LEAST("totalSlots", "availableSlots" + ${booking.totalGuests}), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${booking.tourId}`;
        const metadata = await tx.bookingTimeline.findFirst({
          where: { bookingId, type: "CREATED" },
          select: { metadata: true },
        });
        const batchId = (
          metadata?.metadata as { departureBatchId?: string } | null
        )?.departureBatchId;
        if (batchId)
          await tx.$executeRaw`UPDATE "TourDepartureBatch" SET "seatsLeft" = LEAST("totalSeats", "seatsLeft" + ${booking.totalGuests}), "status" = CASE WHEN "status" = 'SOLD_OUT' THEN 'OPEN' ELSE "status" END, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${batchId}`;
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: bookingStatus,
          cancelledAt: nextStatus === "CANCELLED" ? now : undefined,
          cancellationReason:
            nextStatus === "CANCELLED"
              ? note?.trim() || "Trip cancelled by host"
              : undefined,
          BookingTimeline: {
            create: {
              type: (nextStatus === "CANCELLED"
                ? "CANCELLED"
                : nextStatus) as BookingEventType,
              title:
                nextStatus === "CANCELLED"
                  ? "Trip cancelled by host"
                  : `Booking marked ${nextStatus.toLowerCase().replace("_", " ")}`,
              message: note?.trim() || null,
            },
          },
        },
      });
      await tx.tourBooking.updateMany({
        where: { legacyBookingId: booking.id },
        data: {
          status: bookingStatus,
          cancelledAt: nextStatus === "CANCELLED" ? now : undefined,
        },
      });
      await tx.tourTraveler.updateMany({
        where: {
          tourBookingId:
            (
              await tx.tourBooking.findUnique({
                where: { legacyBookingId: booking.id },
                select: { id: true },
              })
            )?.id ?? "missing",
        },
        data: { status: nextStatus },
      });
      await tx.tourParticipant.updateMany({
        where: { bookingId: booking.id },
        data: {
          status: nextStatus === "COMPLETED" ? "COMPLETED" : "CANCELLED",
          cancelledAt: nextStatus === "CANCELLED" ? now : undefined,
        },
      });
      await queueNotification(tx, {
        data: {
          userId: booking.userId,
          type: nextStatus === "CANCELLED" ? "BOOKING_CANCELLED" : "SYSTEM",
          title:
            nextStatus === "CANCELLED"
              ? "Tour cancelled by host"
              : `Tour booking marked ${nextStatus.toLowerCase().replace("_", " ")}`,
          message:
            note?.trim() ||
            `Booking ${booking.bookingCode} was updated by the host.`,
          data: {
            bookingId: booking.id,
            product: "tour",
            status: bookingStatus,
          },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function updateActivityBookingStatus(
  hostId: string,
  bookingId: string,
  requestedStatus: string,
  note?: string,
) {
  const nextStatus = requestedStatus.toUpperCase() as BookingStatus;
  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.activityBooking.findFirst({
        where: { id: bookingId, hostId },
        include: {
          Activity: { select: { cancellationPolicy: true } },
          ActivityPayment: true,
          ActivityRefund: true,
        },
      });
      if (!booking)
        throw Object.assign(new Error("Booking not found"), {
          statusCode: 404,
        });
      if (!["PENDING", "CONFIRMED"].includes(booking.status))
        throw Object.assign(new Error("Booking is already closed"), {
          statusCode: 409,
        });
      const now = new Date();
      if (nextStatus === "COMPLETED" && booking.date > now)
        throw Object.assign(
          new Error("An activity can be completed only after its date"),
          { statusCode: 409 },
        );
      if (nextStatus === "NO_SHOW" && booking.date > now)
        throw Object.assign(
          new Error("No-show can be recorded only after the activity date"),
          { statusCode: 409 },
        );
      const paid = booking.ActivityPayment?.status === "SUCCESS";
      const bookingStatus =
        nextStatus === "CANCELLED" && paid ? "REFUND_PENDING" : nextStatus;
      const claim = await tx.activityBooking.updateMany({
        where: {
          id: booking.id,
          hostId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        data: {
          status: bookingStatus,
          cancelledAt: nextStatus === "CANCELLED" ? now : undefined,
          cancellationReason:
            nextStatus === "CANCELLED" ? note!.trim() : undefined,
          expiresAt: nextStatus === "CANCELLED" ? null : undefined,
        },
      });
      if (claim.count !== 1)
        throw Object.assign(
          new Error("Booking update is already being processed"),
          { statusCode: 409 },
        );
      if (nextStatus === "CANCELLED" && booking.slotId)
        await tx.$executeRaw`UPDATE "ActivitySlot" SET "bookedSpots" = GREATEST(0, "bookedSpots" - ${booking.guestCount}), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${booking.slotId}`;
      if (nextStatus === "CANCELLED" && !paid && booking.ActivityPayment)
        await tx.activityPayment.updateMany({
          where: {
            id: booking.ActivityPayment.id,
            status: { in: ["PENDING", "PROCESSING"] },
          },
          data: { status: "FAILED" },
        });
      if (
        nextStatus === "CANCELLED" &&
        paid &&
        booking.ActivityPayment &&
        !booking.ActivityRefund
      )
        await tx.activityRefund.create({
          data: {
            activityBookingId: booking.id,
            activityPaymentId: booking.ActivityPayment.id,
            requestedAmount: booking.totalAmount,
            currency: booking.currency,
            status: "REVIEW_PENDING",
            reason: note!.trim(),
            policySnapshot:
              booking.Activity.cancellationPolicy ||
              "No policy snapshot available",
          },
        });
      await tx.activityBookingTimeline.create({
        data: {
          bookingId: booking.id,
          type:
            nextStatus === "CANCELLED"
              ? "CANCELLED"
              : (nextStatus as BookingEventType),
          title:
            nextStatus === "CANCELLED"
              ? paid
                ? "Cancelled by host; refund review started"
                : "Cancelled by host"
              : `Booking marked ${nextStatus.toLowerCase().replace("_", " ")}`,
          message: note?.trim() || null,
        },
      });
      await queueNotification(tx, {
        data: {
          userId: booking.userId,
          type: nextStatus === "CANCELLED" ? "BOOKING_CANCELLED" : "SYSTEM",
          title:
            nextStatus === "CANCELLED"
              ? "Activity cancelled by host"
              : `Activity booking marked ${nextStatus.toLowerCase().replace("_", " ")}`,
          message:
            note?.trim() ||
            `Booking ${booking.bookingCode} was updated by the host.`,
          data: {
            bookingId: booking.id,
            product: "activity",
            status: bookingStatus,
          },
        },
      });
      return { id: booking.id, status: bookingStatus };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function updateRentalBookingStatus(
  hostId: string,
  bookingId: string,
  requestedStatus: string,
  note?: string,
) {
  const nextStatus = requestedStatus.toUpperCase() as BookingStatus;
  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.rentalBooking.findFirst({
        where: { id: bookingId, hostId },
        include: {
          Rental: { select: { cancellationPolicy: true } },
          RentalPayment: true,
          RentalRefund: true,
        },
      });
      if (!booking)
        throw Object.assign(new Error("Booking not found"), {
          statusCode: 404,
        });
      if (!["PENDING", "CONFIRMED"].includes(booking.status))
        throw Object.assign(new Error("Booking is already closed"), {
          statusCode: 409,
        });
      const now = new Date();
      if (nextStatus === "COMPLETED" && booking.returnDate > now)
        throw Object.assign(
          new Error("A rental can be completed only after its return date"),
          { statusCode: 409 },
        );
      if (nextStatus === "NO_SHOW" && booking.pickupDate > now)
        throw Object.assign(
          new Error("No-show can be recorded only after pickup time"),
          { statusCode: 409 },
        );
      const paid = booking.RentalPayment?.status === "SUCCESS";
      const bookingStatus =
        nextStatus === "CANCELLED" && paid ? "REFUND_PENDING" : nextStatus;
      const claim = await tx.rentalBooking.updateMany({
        where: {
          id: booking.id,
          hostId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        data: {
          status: bookingStatus,
          cancelledAt: nextStatus === "CANCELLED" ? now : undefined,
          cancellationReason:
            nextStatus === "CANCELLED" ? note!.trim() : undefined,
          expiresAt: nextStatus === "CANCELLED" ? null : undefined,
        },
      });
      if (claim.count !== 1)
        throw Object.assign(
          new Error("Booking update is already being processed"),
          { statusCode: 409 },
        );
      if (nextStatus === "CANCELLED" && !paid && booking.RentalPayment)
        await tx.rentalPayment.updateMany({
          where: {
            id: booking.RentalPayment.id,
            status: { in: ["PENDING", "PROCESSING"] },
          },
          data: { status: "FAILED" },
        });
      if (
        nextStatus === "CANCELLED" &&
        paid &&
        booking.RentalPayment &&
        !booking.RentalRefund
      )
        await tx.rentalRefund.create({
          data: {
            rentalBookingId: booking.id,
            rentalPaymentId: booking.RentalPayment.id,
            requestedAmount: booking.totalAmount,
            currency: booking.currency,
            status: "REVIEW_PENDING",
            reason: note!.trim(),
            policySnapshot:
              booking.Rental.cancellationPolicy ||
              "No policy snapshot available",
          },
        });
      await tx.rentalBookingTimeline.create({
        data: {
          bookingId: booking.id,
          type:
            nextStatus === "CANCELLED"
              ? "CANCELLED"
              : (nextStatus as BookingEventType),
          title:
            nextStatus === "CANCELLED"
              ? paid
                ? "Cancelled by host; refund review started"
                : "Cancelled by host"
              : `Booking marked ${nextStatus.toLowerCase().replace("_", " ")}`,
          message: note?.trim() || null,
        },
      });
      await queueNotification(tx, {
        data: {
          userId: booking.userId,
          type: nextStatus === "CANCELLED" ? "BOOKING_CANCELLED" : "SYSTEM",
          title:
            nextStatus === "CANCELLED"
              ? "Rental cancelled by host"
              : `Rental booking marked ${nextStatus.toLowerCase().replace("_", " ")}`,
          message:
            note?.trim() ||
            `Booking ${booking.bookingCode} was updated by the host.`,
          data: {
            bookingId: booking.id,
            product: "rental",
            status: bookingStatus,
          },
        },
      });
      return { id: booking.id, status: bookingStatus };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateHostBookingStatus(
  hostId: string,
  bookingId: string,
  requestedStatus: string,
  note?: string,
  type: HostBookingType = "tour",
) {
  const nextStatus = requestedStatus.toUpperCase();
  if (!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(nextStatus))
    throw Object.assign(
      new Error("Hosts cannot override payment confirmation"),
      { statusCode: 400 },
    );
  if (
    ["CANCELLED", "NO_SHOW"].includes(nextStatus) &&
    (!note?.trim() || note.trim().length < 5)
  )
    throw Object.assign(
      new Error("A reason of at least 5 characters is required"),
      { statusCode: 400 },
    );
  if (type === "activity")
    return updateActivityBookingStatus(
      hostId,
      bookingId,
      requestedStatus,
      note,
    );
  if (type === "rental")
    return updateRentalBookingStatus(hostId, bookingId, requestedStatus, note);
  return updateTourBookingStatus(hostId, bookingId, requestedStatus, note);
}
