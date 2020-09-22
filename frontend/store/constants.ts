// add trailing slash to URL if not present
// 'as string' needed for TS since it could be undefined, but should not
export const WEBGUISRV_BASE_URL = process.env.webguisrvUrl
  + ((process.env.webguisrvUrl as string).endsWith('/') ? '' : '/')
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
export const API_GETSTATIONDATA_URL = WEBGUISRV_BASE_URL + 'getdata'
export const FORM_ENCODE_CONFIG = {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
}
export const UPDATE_INTERVAL_MSEC = 1000
