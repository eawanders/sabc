"use client"

import React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { LeftArrow } from '@/components/icons/LeftArrow';
import { RightArrow } from '@/components/icons/RightArrow';
import { EventCard } from '@/components/EventCard';
import { useEvents } from '@/hooks/useEvents';

export default function EventsPageClient() {
  const { events, loading, error, refetch } = useEvents()
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!containerRef.current) return

    const getCards = () => {
      const root = containerRef.current
      if (!root) return [] as HTMLElement[]
      return Array.from(root.querySelectorAll<HTMLElement>('.event-card'))
    }

    const resize = () => {
      const cards = getCards()
      if (!cards || cards.length === 0) return
      const heights = cards.map((n) => n.offsetHeight)
      const max = Math.max(...heights, 0)
      cards.forEach((n) => {
        n.style.minHeight = `${max}px`
      })
    }

    // initial measurement
    resize()

    let ro: ResizeObserver | null = null
    if (typeof window !== 'undefined' && (window as any).ResizeObserver) {
      ro = new (window as any).ResizeObserver(resize)
      const cards = getCards()
      if (cards.length > 0) {
        cards.forEach((n) => ro!.observe(n))
        // also observe images inside cards (they may load later)
        cards.forEach((n) => {
          Array.from(n.querySelectorAll('img')).forEach((img) => ro!.observe(img))
        })
      }
    } else {
      if (typeof window !== 'undefined') {
        (window as any).addEventListener('resize', resize)
      }
      // fallback: listen for image load
      const imgs = containerRef.current?.querySelectorAll('img') || []
      imgs.forEach((img) => (img as HTMLImageElement).addEventListener('load', resize))
    }

    return () => {
      if (ro) {
        const cards = getCards()
        if (cards.length > 0) {
          cards.forEach((n) => ro!.unobserve(n))
        }
      } else {
        if (typeof window !== 'undefined') {
          (window as any).removeEventListener('resize', resize)
        }
        const imgs = containerRef.current?.querySelectorAll('img') || []
        imgs.forEach((img) => (img as HTMLImageElement).removeEventListener('load', resize))
      }
    }
  }, [events])

  if (loading) {
    return (
      <main className="flex flex-col mobile-events-page">
        <h1 className="text-2xl font-bold mobile-hide-header" style={{ marginBottom: 40 }}>Events</h1>
        <div className="text-center py-12 flex items-center justify-center" style={{ width: '100%', minHeight: '200px' }}>
          <p className="text-muted-foreground mb-2">Loading events...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 mobile-events-page">
        <h1 className="font-bold text-4xl mobile-hide-header" style={{ marginBottom: 40 }}>Events</h1>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-semibold">Error loading events</p>
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={refetch}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
        <main className="flex flex-col mobile-events-page">
          <h1 className="text-2xl font-bold mobile-hide-header" style={{ marginBottom: 100 }}>Events</h1>
          <div className="text-center py-12 flex items-center justify-center" style={{ width: '100%', minHeight: '200px' }}>
            <p className="text-muted-foreground mb-2">No upcoming events</p>
          </div>
        </main>
    )
  }

  return (
    <main className="flex flex-col bg-transparent mobile-events-page">
      <h1 className="text-2xl font-bold flex-shrink-0 mobile-hide-header" style={{ marginBottom: 100 }}>Events</h1>

      <div style={{ width: '100%', overflow: 'visible' }}>
          {error && <div>Error loading events</div>}
          {!loading && !error && events && events.length === 0 && (
            <div>No upcoming events</div>
          )}

          {!loading && !error && events && events.length > 0 && (
            <div ref={containerRef} style={{ width: 968, margin: '0 auto', position: 'relative', padding: '24px 24px', boxSizing: 'content-box', overflow: 'visible' }}>
              <Carousel
                className="w-full overflow-visible"
                opts={{ align: 'center', containScroll: 'trimSnaps' }}
                setApi={setCarouselApi}
              >
                <CarouselContent className="-ml-4">
                  {events.map((ev) => (
                    <CarouselItem
                      key={ev.id}
                      className="pl-4 basis-1/3"
                    >
                      <EventCard event={ev} className="event-card" />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              <div className="flex items-center justify-center" role="group" aria-label="carousel controls" style={{ marginTop: '32px', gap: '8px' }}>
                <button
                  onClick={() => carouselApi?.scrollPrev()}
                  aria-label="Previous slide"
                  className="flex items-center justify-center bg-[rgba(246,247,249,0.60)] hover:bg-[rgba(125,141,166,0.20)] transition-colors border-0"
                  style={{ width: 36, height: 36, padding: 0, borderRadius: '10px', cursor: 'pointer' }}
                >
                  <LeftArrow />
                </button>

                <button
                  onClick={() => carouselApi?.scrollNext()}
                  aria-label="Next slide"
                  className="flex items-center justify-center bg-[rgba(246,247,249,0.60)] hover:bg-[rgba(125,141,166,0.20)] transition-colors border-0"
                  style={{ width: 36, height: 36, padding: 0, borderRadius: '10px', cursor: 'pointer' }}
                >
                  <RightArrow />
                </button>
              </div>
            </div>
          )}
        </div>
    </main>
  );
}
