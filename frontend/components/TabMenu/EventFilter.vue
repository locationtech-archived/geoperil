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
  <v-row
    class="filterrow mb-0"
    dense
  >
    <v-col class="mt-5 ml-1">
      <v-range-slider
        v-model="mwrange"
        class="mwslider"
        min="0"
        max="10"
        label="Mw"
        thumb-label="always"
        ticks="always"
        :tick-size="4"
        :thumb-size="16"
        dense
        hide-details
      />
    </v-col>
    <v-col class="pa-0" cols="2">
      <v-checkbox
        v-model="filter.mt"
        class="filtercheckbox"
        :label="!$vuetify.breakpoint.mdAndDown ? 'MT' : ''"
        :hint="$vuetify.breakpoint.mdAndDown ? 'MT' : ''"
        :persistent-hint="$vuetify.breakpoint.mdAndDown"
        dense
      />
    </v-col>
    <v-col class="pa-0" cols="2">
      <v-checkbox
        v-model="filter.sea"
        class="filtercheckbox"
        :label="!$vuetify.breakpoint.mdAndDown ? 'Sea' : ''"
        :hint="$vuetify.breakpoint.mdAndDown ? 'Sea' : ''"
        :persistent-hint="$vuetify.breakpoint.mdAndDown"
        dense
      />
    </v-col>
    <v-col class="pa-0" cols="2">
      <v-checkbox
        v-model="filter.sim"
        class="filtercheckbox"
        :label="!$vuetify.breakpoint.mdAndDown ? 'Sim' : ''"
        :hint="$vuetify.breakpoint.mdAndDown ? 'Sim' : ''"
        :persistent-hint="$vuetify.breakpoint.mdAndDown"
        dense
      />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from 'nuxt-property-decorator'
import { EventFiltering } from '~/types'

@Component({})
export default class EventFilter extends Vue {
  @Prop({ type: Object, required: true }) filter!: EventFiltering

  private mwrange: number[] = [0, 10]

  @Watch('mwrange')
  public onRangeChange () {
    this.filter.min = this.mwrange[0]
    this.filter.max = this.mwrange[1]
  }
}
</script>

<style>
.filtercheckbox .v-input--selection-controls__input,
.mwslider label {
  margin-right: 0 !important;
}

.filtercheckbox .v-input__slot {
  margin-bottom: 0 !important;
}

.mwslider label {
  top: -5px;
}

.filtercheckbox .v-messages {
  max-width: 30px;
  margin-left: 4px;
}

.filtercheckbox {
  max-width: 60px;
  margin-top: 16px !important;
}

.filterrow {
  height: 60px;
  width: 100%;
  margin-top: 0;
}
</style>
