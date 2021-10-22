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
  <v-dialog
    v-model="dialog"
    :transition="false"
    fullscreen
    hide-overlay
    persistent
  >
    <DialogToolbar
      :close-action="closeDialog"
      :title="dialogTitle"
    />
    <DialogRow>
      <v-col
        v-if="gmthelp.length > 0"
        xs="10"
        sm="8"
        md="8"
        lg="6"
        xl="4"
      >
        <p class="mt-5 mb-5">
          For the custom map generation following parameters are available:
        </p>

        <v-form>
          <template
            v-for="item in gmthelp"
            v-key="item.variable"
          >
            <v-text-field
              v-if="useTextfield(item)"
              :key="item.variable"
              :label="item.flagname"
              :placeholder="item.default"
              :value="getValue(item.variable)"
              :hint="item.help"
              class="mt-3 mb-3"
              clearable
              @input.native="update(item.variable, $event.target.value)"
            />

            <v-checkbox
              v-else-if="useCheckbox(item)"
              :key="item.variable"
              :label="item.flagname"
              :input-value="getValue(item.variable)"
              class="mt-3 mb-3"
              @change="update(item.variable, $event)"
            />

            <v-select
              v-else-if="useSelect(item)"
              :key="item.variable"
              :label="item.flagname"
              item-text="name"
              item-value="key"
              :items="item.group"
              :value="getValue(item.variable)"
              class="mt-3 mb-3"
              @change="update(item.variable, $event)"
            />
          </template>
        </v-form>

        <v-row justify="end">
          <v-col class="pa-0 mr-3" cols="auto">
            <v-btn
              :key="modelChanged"
              :href="downloadUrl()"
              target="_blank"
              color="primary"
            >
              Create Map
            </v-btn>
          </v-col>
        </v-row>
      </v-col>
    </DialogRow>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import DialogToolbar from '~/components/Utils/DialogToolbar.vue'
import DialogRow from '~/components/Utils/DialogRow.vue'
import { DATASRV_BASE_URL } from '~/store/constants'
import { GmtHelpItem } from '~/types'

@Component({
  components: {
    DialogToolbar,
    DialogRow,
  },
})
export default class CustomMapDialog extends Vue {
  private dialog = true
  private models: { [key: string]: any } = {}
  private modelChanged = 0

  created () {
    const help = this.gmthelp

    // init models
    for (const item of help) {
      this.models[item.variable] = this.getDefaultValue(item.variable)
    }
  }

  public closeDialog () {
    this.$store.commit('SET_SHOW_CUSTOM_MAP_DIALOG', false)
    this.$store.commit('SET_DATADOWNLOAD_EVENT', null)
  }

  private useTextfield (item: GmtHelpItem) {
    return item.dataType === 'String' || item.dataType === 'Number' ||
      item.dataType === 'R/G/B'
  }

  private useCheckbox (item: GmtHelpItem) {
    return item.dataType === 'Boolean'
  }

  private useSelect (item: GmtHelpItem) {
    return item.dataType === 'group'
  }

  get dialogTitle () {
    return 'Create Custom Map for Computation with ID \'' +
      this.datadownloadEvent.compId + '\''
  }

  get datadownloadEvent () {
    return this.$store.getters.datadownloadEvent
  }

  get gmthelp (): GmtHelpItem[] {
    return this.$store.getters.gmtHelp
  }

  private getValue (variable: string): any {
    if (variable in this.models) {
      return this.models[variable]
    }

    return ''
  }

  private getDefaultValue (variable: string) {
    const gmt = this.gmthelp

    for (const item of gmt) {
      if (item.variable !== variable) {
        continue
      }

      if (item.dataType === 'Boolean') {
        return item.default === 'Y'
      }

      return item.default
    }

    return null
  }

  private update (variable: string, value: any) {
    this.models[variable] = value
    this.modelChanged += 1
  }

  private downloadUrl () {
    if (!this.datadownloadEvent || !this.datadownloadEvent.identifier) {
      console.error('Event to download data from is unknown')
      return '#'
    }

    const id = this.datadownloadEvent.identifier
    const urlParams = []

    for (const param in this.models) {
      const value = this.models[param]

      if (value === this.getDefaultValue(param)) {
        // do not set default values in URL
        continue
      }

      let useValue

      if (value === true) {
        useValue = 'Y'
      } else if (value === false) {
        useValue = 'N'
      } else if (value === null) {
        useValue = ''
      } else {
        useValue = value
      }

      urlParams.push(param + '=' + useValue)
    }

    return DATASRV_BASE_URL + id + '/custom.png?' + urlParams.join('&')
  }
}
</script>

<style>
.no-select-highlight.v-list-item--active::before {
  opacity: 0;
}

.no-select-highlight.v-list-item--active:hover::before {
  opacity: 0.04;
}
</style>
