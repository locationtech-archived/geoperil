// Geoperil - A platform for the computation and web-mapping of hazard specific
// geospatial data, as well as for serving functionality to handle, share, and
// communicate threat specific information in a collaborative environment.
//
// Copyright (C) 2021 GFZ German Research Centre for Geosciences
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the Licence is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the Licence for the specific language governing permissions and
// limitations under the Licence.
//
// Contributors:
//   Johannes Spazier (GFZ)
//   Sven Reissland (GFZ)
//   Martin Hammitzsch (GFZ)
//   Matthias Rüster (GFZ)
//   Hannes Fuchs (GFZ)

import { User, Event, Station } from '~/types'

export interface RootState {
    supportedPlugins: any,
    recentEvents: Event[],
    recentEventsGeojson: any[],
    userEvents: Event[],
    userEventsGeojson: any[],
    hoveredEvent: Event | null,
    selectedEvent: Event | null,
    composeEvent: Event | null,
    user: User | null,
    allInstitutions: string[] | null,
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
    selectedStationDetail: Station | null,
}
