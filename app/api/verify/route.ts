export async function GET() {
  return Response.json({ error: "This verification endpoint is retired. Use the link sent in your verification email." }, { status: 410 })
}
