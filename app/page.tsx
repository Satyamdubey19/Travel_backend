export default function HomePage() {
  return (
    <div style={{
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#090d16",
      color: "#f8fafc",
      padding: "2rem",
      textAlign: "center"
    }}>
      <div style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px",
        padding: "2.5rem",
        maxWidth: "520px",
        width: "100%"
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✈️ 🏨</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Travels Pro API Server</h1>
        <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
          Backend API is running and healthy. All traveler and host pages are hosted on the frontend application.
        </p>
        <a
          href="https://rootly-mu.vercel.app"
          style={{
            display: "inline-block",
            background: "#6366f1",
            color: "#ffffff",
            padding: "0.75rem 1.5rem",
            borderRadius: "10px",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.875rem"
          }}
        >
          Go to Travels Pro Website &rarr;
        </a>
      </div>
    </div>
  );
}
