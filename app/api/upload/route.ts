import { NextRequest, NextResponse } from "next/server"
import cloudinary from "@/lib/cloudinary"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"])

export async function POST(req: NextRequest) {
  try {
    const missingConfig = [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ].filter(key => !process.env[key])

    if (missingConfig.length > 0) {
      return NextResponse.json(
        { error: `Missing Cloudinary config: ${missingConfig.join(", ")}` },
        { status: 500 },
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image must be 10 MB or smaller" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const b64 = Buffer.from(bytes).toString("base64")
    const dataUri = `data:${file.type};base64,${b64}`

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "gethotels/hotels",
      resource_type: "auto",
    })

    return NextResponse.json({ url: result.secure_url })
  } catch (error: unknown) {
    console.error("Upload error:", error)
    const message = error instanceof Error ? error.message : "Upload failed. Please try again."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
