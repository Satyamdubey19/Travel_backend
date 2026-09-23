import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireHostApplicant } from "@/utils/host-auth"
import { getLatestHostKyc, submitHostKyc } from "@/modules/host/services/host-kyc.service"

function status(error: unknown): number {
  if (typeof error === "object" && error && "statusCode" in error) {
    return Number((error as { statusCode?: number }).statusCode) || 400
  }
  return error instanceof Error && error.name === "ZodError" ? 400 : 500
}

export async function getHostKycController() {
  try {
    const { host } = await requireHostApplicant();
    const kyc = await getLatestHostKyc(host.id);
    return NextResponse.json({ success: true, kyc, data: kyc });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to load KYC";
    return NextResponse.json({ error: message }, { status: status(error) });
  }
}

export async function submitHostKycController(request: NextRequest) {
  try {
    const { host } = await requireHostApplicant();
    const kyc = await submitHostKyc(host.id, await request.json());
    return NextResponse.json({ success: true, kyc, data: { kycApplication: kyc } }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to submit KYC";
    return NextResponse.json({ error: message }, { status: status(error) });
  }
}
