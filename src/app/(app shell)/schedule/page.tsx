"use client";

import React, { useState } from "react";
import { CalendarEvent } from "@/types/calendar";
import { useCalendarRange } from "../hooks/useCalendarRange";
import { useCalendarData } from "../hooks/useCalendarData";
import CalendarHeader from "./CalendarHeader";
import CalendarWeek from "./CalendarWeek";
import OutingDrawer from "./OutingDrawer";
import Sheet from "@/components/ui/Sheet";

export default function SchedulePage() {
	const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

	// Calendar state management
	const {
		currentWeek,
		isCurrentWeek,
		goToNextWeek,
		goToPreviousWeek,
		goToCurrentWeek,
	} = useCalendarRange();

	// Calendar data
	const {
		calendarDays,
		loading,
		error,
		stats,
	} = useCalendarData(currentWeek);

	// Event handlers
	const handleEventClick = (event: CalendarEvent) => {
		setSelectedEvent(event);
	};

	const handleCloseDrawer = () => {
		setSelectedEvent(null);
	};

	if (error) {
		return (
			<main className="flex flex-col justify-center items-center gap-2.5 flex-1 px-[100px] py-[180px]">
				<h1 className="sr-only">Schedule</h1>
				<div className="text-center">
					<p className="text-destructive mb-4">Failed to load calendar data</p>
					<p className="text-sm text-muted-foreground">{error}</p>
				</div>
			</main>
		);
	}

	return (
		<>
	       <main
		       style={{
			       display: 'flex',
			       flexDirection: 'column',
			       justifyContent: 'center',
			       gap: '32px',
			       boxSizing: 'border-box',
			       overflow: 'hidden',
		       }}
	       >
			       <h1 className="sr-only">Schedule</h1>

			       <div
				       style={{
					       width: '100%',
					       display: 'flex',
						flexDirection: 'column',

					       gap: '32px',
					       flexShrink: 1,
				       }}
			       >
					{/* Calendar Header */}
				<CalendarHeader
					currentWeek={currentWeek}
					onPreviousWeek={goToPreviousWeek}
					onNextWeek={goToNextWeek}
				/>				{/* Calendar Grid */}
					<CalendarWeek
						calendarDays={calendarDays}
						onEventClick={handleEventClick}
						loading={loading}
					/>

					{/* No events message */}
					{!loading && !stats.hasEvents && (
						<div className="text-center py-12" style={{ width: '100%' }}>
							<p className="text-muted-foreground mb-2">No outings scheduled for this week.</p>
							<p className="text-sm text-muted-foreground">
								Check back later or navigate to a different week.
							</p>
						</div>
					)}
				</div>
			</main>

			{/* Event Details Drawer - Rendered outside main container */}
			{selectedEvent && (
				<OutingDrawer
					outingId={selectedEvent.originalOuting}
					isOpen={!!selectedEvent}
					onClose={handleCloseDrawer}
				/>
			)}
		</>
	);
}