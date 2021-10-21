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

// add trailing slash to URL if not present
export const WEBGUISRV_BASE_URL = process.env.webguisrvUrl +
  (process.env.webguisrvUrl!.endsWith('/') ? '' : '/')
export const API_PLUGINS_URL = WEBGUISRV_BASE_URL + 'supported_plugins'
export const API_SIGNIN_URL = WEBGUISRV_BASE_URL + 'signin'
export const API_SESSION_URL = WEBGUISRV_BASE_URL + 'session'
export const API_SIGNOUT_URL = WEBGUISRV_BASE_URL + 'signout'
export const API_FETCH_URL = WEBGUISRV_BASE_URL + 'get_events'
export const API_STATIONLIST_URL = WEBGUISRV_BASE_URL + 'stationlist'
export const API_COMPUTE_URL = WEBGUISRV_BASE_URL + 'compute'
export const API_UPDATE_URL = WEBGUISRV_BASE_URL + 'update'
export const API_GETISOS_URL = WEBGUISRV_BASE_URL + 'getisos'
export const API_GETJETS_URL = WEBGUISRV_BASE_URL + 'getjets'
export const API_CHANGEPWD_URL = WEBGUISRV_BASE_URL + 'changepassword'
export const API_SAVEUSERSTATIONS_URL = WEBGUISRV_BASE_URL + 'saveuserstations'
export const API_SAVEUSERSETTINGS_URL = WEBGUISRV_BASE_URL + 'saveusersettings'
export const API_GETSTATIONDATA_URL = WEBGUISRV_BASE_URL + 'getdata'
export const API_GETSTATIONSIMDATA_URL = WEBGUISRV_BASE_URL + 'getsimdata'
export const API_REGISTERUSER_URL = WEBGUISRV_BASE_URL + 'register'
export const API_INSTLIST_URL = WEBGUISRV_BASE_URL + 'instlist'
export const API_SAVEPICKING_URL = WEBGUISRV_BASE_URL + 'save_picking'
export const API_LOADPICKING_URL = WEBGUISRV_BASE_URL + 'load_picking'
export const FORM_ENCODE_CONFIG = {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
}
export const UPDATE_INTERVAL_MSEC = 5000
