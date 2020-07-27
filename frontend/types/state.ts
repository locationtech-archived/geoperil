import { User, Event } from "~/types";

export interface RootState {
    recentEvents: Event[],
    authUser: User | null
}
