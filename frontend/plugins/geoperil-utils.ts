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

export function toUtcTimeStr (
  datetime: Date,
  withDate: boolean = true,
  withSeconds: boolean = true
) {
  const date = datetime.getUTCFullYear().toString() + '/' +
      (datetime.getUTCMonth() + 1).toString().padStart(2, '0') + '/' +
      datetime.getUTCDate().toString().padStart(2, '0') + ' · '

  const seconds = ':' + datetime.getUTCSeconds().toString().padStart(2, '0')

  return (withDate ? date : '') +
      datetime.getUTCHours().toString().padStart(2, '0') + ':' +
      datetime.getUTCMinutes().toString().padStart(2, '0') +
      (withSeconds ? seconds : '')
}
