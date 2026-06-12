import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude and longitude required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENCAGE_API_KEY
    if (!apiKey) {
      console.warn('OPENCAGE_API_KEY not found')
      return NextResponse.json({ city: 'Current Location' }, { status: 200 })
    }

    const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${apiKey}&language=en`
    
    const response = await fetch(url, { 
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'GetHotels/1.0'
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      console.error(`OpenCage GPS error: ${response.status}`)
      return NextResponse.json({ city: 'Current Location' }, { status: 200 })
    }

    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ city: 'Current Location' }, { status: 200 })
    }

    const result = data.results[0]
    const city = result.components?.city || 
                 result.components?.town || 
                 result.components?.village || 
                 result.components?.county ||
                 result.components?.state ||
                 'Current Location'

    return NextResponse.json({ city }, { status: 200 })
  } catch (error) {
    console.error('GPS location error:', error)
    return NextResponse.json({ city: 'Current Location' }, { status: 200 })
  }
}
