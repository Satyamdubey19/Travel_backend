import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeOidcCode } from "@/modules/sso/services/oidc.service";
import { validateSamlResponse } from "@/modules/sso/services/saml.service";
import {
  processSsoAuthentication,
  SsoInactiveAccountError,
  SsoProvisioningError,
} from "@/modules/sso/services/sso-auth.service";
import {
  getAppUrl,
  getClientIp,
  getUserAgent,
  verifyStateToken,
  setSsoAuthCookies,
} from "@/modules/sso/utils/sso-http";

interface SsoStatePayload {
  state: string;
  codeVerifier?: string;
  organizationId: string;
  domain: string;
  protocol: "OIDC" | "SAML2";
  callbackUrl?: string;
}

/**
 * Handles OIDC redirect callback (GET)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const appUrl = getAppUrl(request);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const idpError = searchParams.get("error");
  const idpErrorDesc = searchParams.get("error_description");

  if (idpError) {
    console.error("[SSO Callback] IdP Error:", idpError, idpErrorDesc);
    return NextResponse.redirect(
      new URL(`/login?error=IDP_ERROR&message=${encodeURIComponent(idpErrorDesc || idpError)}`, appUrl)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/login?error=INVALID_SSO_CALLBACK&message=Missing+code+or+state", appUrl)
    );
  }

  // Verify state cookie
  const stateCookie = request.cookies.get("sso_state")?.value;
  const stateData = verifyStateToken<SsoStatePayload>(stateCookie);

  if (!stateData || stateData.state !== state || !stateData.codeVerifier) {
    return NextResponse.redirect(
      new URL("/login?error=INVALID_STATE&message=SSO+session+state+is+invalid+or+expired", appUrl)
    );
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: stateData.organizationId },
      include: { ssoConfig: true },
    });

    if (!org || !org.ssoConfig) {
      return NextResponse.redirect(
        new URL("/login?error=ORG_NOT_FOUND&message=Organization+SSO+configuration+missing", appUrl)
      );
    }

    const redirectUri = `${appUrl}/api/auth/sso/callback`;
    const ssoProfile = await exchangeOidcCode(
      org.ssoConfig,
      code,
      stateData.codeVerifier,
      redirectUri
    );

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);
    const existingDeviceId = request.cookies.get("deviceId")?.value;

    const authResult = await processSsoAuthentication(org.id, ssoProfile, {
      ipAddress,
      userAgent,
      deviceId: existingDeviceId,
    });

    const targetUrl = new URL(stateData.callbackUrl || "/dashboard", appUrl);
    const response = NextResponse.redirect(targetUrl);

    // Set JWT, sliding refresh token, and deviceId cookies
    setSsoAuthCookies(response, {
      sessionToken: authResult.sessionToken,
      refreshToken: authResult.refreshToken,
      deviceId: authResult.deviceId,
      inactivityTimeoutMinutes: authResult.inactivityTimeoutMinutes,
    });

    // Clear state cookie
    response.cookies.set("sso_state", "", { maxAge: 0, path: "/" });

    return response;
  } catch (err) {
    if (err instanceof SsoInactiveAccountError) {
      return NextResponse.redirect(
        new URL("/login?error=ACCOUNT_INACTIVE&message=Your+corporate+employee+account+is+inactive", appUrl)
      );
    }
    if (err instanceof SsoProvisioningError) {
      return NextResponse.redirect(
        new URL("/login?error=PROVISIONING_DISABLED&message=Automatic+account+provisioning+is+disabled", appUrl)
      );
    }

    const errorMsg = err instanceof Error ? err.message : "SSO authentication failed";
    console.error("[SSO Callback Error]", errorMsg);
    return NextResponse.redirect(
      new URL(`/login?error=SSO_FAILED&message=${encodeURIComponent(errorMsg)}`, appUrl)
    );
  }
}

/**
 * Handles SAML 2.0 HTTP-POST assertion callback (POST)
 */
export async function POST(request: NextRequest) {
  const appUrl = getAppUrl(request);

  try {
    const formData = await request.formData();
    const samlResponseBase64 = formData.get("SAMLResponse") as string | null;
    const relayState = formData.get("RelayState") as string | null;

    if (!samlResponseBase64) {
      return NextResponse.redirect(
        new URL("/login?error=INVALID_SAML_RESPONSE&message=Missing+SAMLResponse+assertion", appUrl)
      );
    }

    // Attempt to verify state from RelayState or state cookie
    const stateCookie = request.cookies.get("sso_state")?.value;
    const stateData = verifyStateToken<SsoStatePayload>(relayState || stateCookie);

    const organizationId = stateData?.organizationId;
    const callbackUrl = stateData?.callbackUrl || "/dashboard";

    let org = organizationId
      ? await prisma.organization.findUnique({
          where: { id: organizationId },
          include: { ssoConfig: true },
        })
      : null;

    // Fallback: If RelayState was not maintained, find active organization with SAML2
    if (!org) {
      const activeOrgs = await prisma.organization.findMany({
        where: {
          isActive: true,
          ssoConfig: {
            protocol: "SAML2",
          },
        },
        include: { ssoConfig: true },
      });
      if (activeOrgs.length === 1) {
        org = activeOrgs[0];
      }
    }

    if (!org || !org.ssoConfig) {
      return NextResponse.redirect(
        new URL("/login?error=SSO_NOT_CONFIGURED&message=Could+not+resolve+organization+for+SAML+response", appUrl)
      );
    }

    const ssoProfile = validateSamlResponse(org.ssoConfig, samlResponseBase64);

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);
    const existingDeviceId = request.cookies.get("deviceId")?.value;

    const authResult = await processSsoAuthentication(org.id, ssoProfile, {
      ipAddress,
      userAgent,
      deviceId: existingDeviceId,
    });

    const targetUrl = new URL(callbackUrl, appUrl);
    const response = NextResponse.redirect(targetUrl);

    setSsoAuthCookies(response, {
      sessionToken: authResult.sessionToken,
      refreshToken: authResult.refreshToken,
      deviceId: authResult.deviceId,
      inactivityTimeoutMinutes: authResult.inactivityTimeoutMinutes,
    });

    response.cookies.set("sso_state", "", { maxAge: 0, path: "/" });

    return response;
  } catch (err) {
    if (err instanceof SsoInactiveAccountError) {
      return NextResponse.redirect(
        new URL("/login?error=ACCOUNT_INACTIVE&message=Your+corporate+employee+account+is+inactive", appUrl)
      );
    }
    if (err instanceof SsoProvisioningError) {
      return NextResponse.redirect(
        new URL("/login?error=PROVISIONING_DISABLED&message=Automatic+account+provisioning+is+disabled", appUrl)
      );
    }

    const errorMsg = err instanceof Error ? err.message : "SAML authentication processing failed";
    console.error("[SAML Callback Error]", errorMsg);
    return NextResponse.redirect(
      new URL(`/login?error=SSO_FAILED&message=${encodeURIComponent(errorMsg)}`, appUrl)
    );
  }
}
