import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')?.[0]?.trim() ||
               request.headers.get('x-real-ip')?.trim() ||
               request.headers.get('cf-connecting-ip')?.trim() ||
               '8.8.8.8'

    console.log('Client IP:', ip)

    // Use IP-based geolocation service (ipapi.co)
    const response = await fetch(
      `https://ipapi.co/${ip}/json/`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'GetHotels/1.0'
        },
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      console.error(`IP geolocation service error: ${response.status}`)
      return NextResponse.json({ city: 'India' }, { status: 200 })
    }

    const data = await response.json()
    
    const city = data.city || data.region || data.country_name || 'India'

    return NextResponse.json({ city }, { status: 200 })
  } catch (error) {
    console.error('IP location error:', error)
    return NextResponse.json({ city: 'India' }, { status: 200 })
  }
}
