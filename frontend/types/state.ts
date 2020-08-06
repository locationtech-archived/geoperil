import { User, Event } from "~/types"

export interface RootState {
    recentEvents: Event[],
    recentEventsGeojson: any[],
    userEvents: Event[],
    userEventsGeojson: any[],
    hoveredEvent: Event | null,
    selectedEvent: Event | null,
    composeEvent: Event | null,
    user: User | null,
    lastUpdate: string | null,
}
