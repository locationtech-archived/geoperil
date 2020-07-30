import { User, Event } from "~/types"

export interface RootState {
    recentEvents: Event[],
    recentEventsGeojson: any,
    hoveredEvent: Event | null,
    selectedEvent: Event | null,
    composeEvent: Event | null,
    authUser: User | null,
    lastUpdate: string | null,
}
