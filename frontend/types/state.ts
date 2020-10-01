import { User, Event, Station } from "~/types"

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
    selectedTab: Number,
    mapIsLoading: Boolean,
    resultArrivaltimes: Array<any> | null,
    resultWavejets: Array<any> | null,
    showSettingsDialog: Boolean,
    allStations: Station[] | null,
    stationTimestamp: Date | null,
    stationHoveredMap: string | null,
    selectedStationMap: Station | null,
}
