import { User, Event } from "~/types";

export interface RootState {
    recentEvents: Event[],
    hoveredEvent: Event | null,
    selectedEvent: Event | null,
    recentEventsGeojson: any,
    authUser: User | null,
}
