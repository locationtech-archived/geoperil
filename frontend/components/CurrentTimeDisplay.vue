<!--
GeoPeril - A platform for the computation and web-mapping of hazard specific
geospatial data, as well as for serving functionality to handle, share, and
communicate threat specific information in a collaborative environment.

Copyright (C) 2021 GFZ German Research Centre for Geosciences

SPDX-License-Identifier: Apache-2.0

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the Licence is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the Licence for the specific language governing permissions and
limitations under the Licence.

Contributors:
  Johannes Spazier (GFZ)
  Sven Reissland (GFZ)
  Martin Hammitzsch (GFZ)
  Matthias Rüster (GFZ)
  Hannes Fuchs (GFZ)
-->

<template>
  <v-row class="mt-3" justify="center">
    <v-col sm="6" md="4" lg="3">
      <DenseTextField
        :value="localtime"
        label="Local time"
      />
    </v-col>
    <v-col sm="6" md="4" lg="3">
      <DenseTextField
        :value="utctime"
        label="UTC time"
      />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import { toUtcTimeStr } from '../plugins/geoperil-utils'
import DenseTextField from './DenseTextField.vue'

@Component({
  components: {
    DenseTextField,
  },
})
export default class CurrentTimeDisplay extends Vue {
  private localtime: string = ''
  private utctime: string = ''
  private timer: any = null

  mounted () {
    this.updateDateTime()
    this.timer = setInterval(this.updateDateTime, 1000)
  }

  beforeDestroy () {
    clearInterval(this.timer)
  }

  public updateDateTime () {
    const cur = new Date()
    this.localtime = cur.getFullYear().toString() + '/' +
      (cur.getMonth() + 1).toString().padStart(2, '0') + '/' +
      cur.getDate().toString().padStart(2, '0') + ' · ' +
      cur.getHours().toString().padStart(2, '0') + ':' +
      cur.getMinutes().toString().padStart(2, '0') + ':' +
      cur.getSeconds().toString().padStart(2, '0')
    this.utctime = toUtcTimeStr(cur)
  }
}
</script>
