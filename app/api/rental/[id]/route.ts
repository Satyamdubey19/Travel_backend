import { NextRequest } from "next/server"
import { deleteRentalController, getRental, updateRentalController } from "@/modules/rental/controllers/rental.controller"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return getRental(req, id)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return updateRentalController(req, id)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return deleteRentalController(req, id)
}
