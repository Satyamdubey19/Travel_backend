import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SsoProtocol } from "@prisma/client";
import { resolveOrganizationByDomain } from "@/modules/sso/services/sso-auth.service";
import { generateOidcAuthUrl } from "@/modules/sso/services/oidc.service";
import { generateSamlAuthnRequest } from "@/modules/sso/services/saml.service";
import { createStateToken, getAppUrl } from "@/modules/sso/utils/sso-http";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const email = searchParams.get("email")?.trim();
  const domain = searchParams.get("domain")?.trim();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const shouldRedirect = searchParams.get("redirect") === "true";
  const appUrl = getAppUrl(request);

  const identifier = email || domain;
  if (!identifier) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Please provide a corporate email or company domain." },
      { status: 400 }
    );
  }

  try {
    const org = await resolveOrganizationByDomain(identifier);

    if (!org || !org.ssoConfig) {
      if (shouldRedirect) {
        return NextResponse.redirect(
          new URL(`/login?error=SSO_NOT_CONFIGURED&hint=${encodeURIComponent(identifier)}`, appUrl)
        );
      }
      return NextResponse.json(
        {
          error: "SSO_NOT_CONFIGURED",
          message: "No active Single Sign-On configuration found for this corporate domain.",
        },
        { status: 404 }
      );
    }

    const callbackRedirectUri = `${appUrl}/api/auth/sso/callback`;

    if (org.ssoConfig.protocol === SsoProtocol.OIDC) {
      const { url, state, codeVerifier } = await generateOidcAuthUrl(
        org.ssoConfig,
        callbackRedirectUri,
        email || undefined
      );

      const stateToken = createStateToken({
        state,
        codeVerifier,
        organizationId: org.id,
        domain: org.domain,
        protocol: "OIDC",
        callbackUrl,
      });

      const response = shouldRedirect
        ? NextResponse.redirect(url)
        : NextResponse.json({
            success: true,
            authorizationUrl: url,
            protocol: "OIDC",
            organization: { id: org.id, name: org.name, domain: org.domain },
          });

      response.cookies.set("sso_state", stateToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600, // 10 minutes
      });

      return response;
    } else if (org.ssoConfig.protocol === SsoProtocol.SAML2) {
      const { url, state } = generateSamlAuthnRequest(org.ssoConfig, callbackRedirectUri);

      const stateToken = createStateToken({
        state,
        organizationId: org.id,
        domain: org.domain,
        protocol: "SAML2",
        callbackUrl,
      });

      const response = shouldRedirect
        ? NextResponse.redirect(url)
        : NextResponse.json({
            success: true,
            authorizationUrl: url,
            protocol: "SAML2",
            organization: { id: org.id, name: org.name, domain: org.domain },
          });

      response.cookies.set("sso_state", stateToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });

      return response;
    } else {
      return NextResponse.json(
        { error: "UNSUPPORTED_PROTOCOL", message: "Unsupported SSO protocol configured." },
        { status: 500 }
      );
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "SSO initialization failed";
    console.error("[SSO Authorize Error]", errorMsg);

    if (shouldRedirect) {
      return NextResponse.redirect(
        new URL(`/login?error=SSO_INIT_ERROR&message=${encodeURIComponent(errorMsg)}`, appUrl)
      );
    }

    return NextResponse.json(
      { error: "SSO_INIT_ERROR", message: errorMsg },
      { status: 500 }
    );
  }
}
