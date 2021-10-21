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
  <v-tooltip
    v-model="show"
    open-delay="500"
    right
  >
    <template v-slot:activator="{ on }">
      <div v-on="on">
        <v-btn
          class="pl-1 pr-1"
          min-width="0"
          text
          v-on="on"
          @click="handleClick"
        >
          <v-icon
            color="#154f8a"
            size="16"
          >
            {{ icon }}
          </v-icon>
        </v-btn>
      </div>
    </template>
    <span>{{ helpText }}</span>
  </v-tooltip>
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'

@Component
export default class ActionButton extends Vue {
  @Prop({ type: String, required: true }) icon!: string
  @Prop({ type: String, required: true }) helpText!: string

  private show: boolean = false

  public handleClick (): void {
    this.$emit('click')
  }
}
</script>
