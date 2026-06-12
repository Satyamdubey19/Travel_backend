import * as React from "react"

type TourTransactionalEmailProps = {
  preview: string
  title: string
  lines: string[]
  ctaUrl?: string
  ctaLabel?: string
}

export default function TourTransactionalEmail({ ctaLabel, ctaUrl, lines, preview, title }: TourTransactionalEmailProps) {
  return (
    <html>
      <body style={{ margin: 0, background: "#f8fafc", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>{preview}</div>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px" }}>
          <section style={{ borderRadius: 24, background: "#ffffff", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ background: "#0f172a", padding: 28, color: "#ffffff" }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#67e8f9" }}>GetHotels Tours</p>
              <h1 style={{ margin: "12px 0 0", fontSize: 28, lineHeight: "34px" }}>{title}</h1>
            </div>
            <div style={{ padding: 28 }}>
              {lines.map((line) => (
                <p key={line} style={{ margin: "0 0 14px", fontSize: 15, lineHeight: "24px", color: "#475569" }}>{line}</p>
              ))}
              {ctaUrl ? (
                <a href={ctaUrl} style={{ display: "inline-block", marginTop: 12, borderRadius: 14, background: "#0f172a", color: "#ffffff", padding: "13px 18px", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
                  {ctaLabel ?? "Open GetHotels"}
                </a>
              ) : null}
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
