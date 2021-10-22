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
      :title="downloadTitle"
    />
    <DialogRow>
      <v-col xs="11" sm="10" md="8" lg="6" xl="4">
        <v-list :dense="denseList">
          <p class="ma-3">
            The following data products can be downloaded:
          </p>
          <v-list-group
            v-for="group in productGroups"
            v-show="showGroup(group)"
            :key="group"
            :value="group === 'Waveheights and arrival times'"
            eager
            no-action
          >
            <template #prependIcon>
              <v-icon size="28">
                {{ iconForGroup(group) }}
              </v-icon>
            </template>

            <template #activator>
              <v-list-item-content>
                <v-list-item-title v-text="group" />
              </v-list-item-content>
            </template>

            <template v-for="item in availableProductsForGroup(group)">
              <v-list-item
                :key="item.file"
                class="no-select-highlight"
                :target="targetForProduct(item)"
                :href="hrefForProduct(item)"
                @click="clickActionForProduct(item)"
              >
                <v-list-item-avatar>
                  <v-icon size="28">
                    {{ iconForProduct(item) }}
                  </v-icon>
                </v-list-item-avatar>

                <v-list-item-content>
                  <v-list-item-title v-text="item.shortdesc" />
                  <v-list-item-subtitle v-text="item.desc" />
                </v-list-item-content>

                <v-list-item-action v-if="item.file === 'custom.png'">
                  <v-icon size="28">
                    mdi-arrow-right-bold
                  </v-icon>
                </v-list-item-action>
              </v-list-item>

              <v-divider :key="'div-' + item.file" />
            </template>
          </v-list-group>
        </v-list>
      </v-col>
    </DialogRow>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import DialogToolbar from '~/components/Utils/DialogToolbar.vue'
import DialogRow from '~/components/Utils/DialogRow.vue'
import { DATASRV_BASE_URL } from '~/store/constants'
import { Product } from '~/types'

@Component({
  components: {
    DialogToolbar,
    DialogRow,
  },
})
export default class DownloadProductDialog extends Vue {
  private dialog = true

  public closeDialog () {
    this.$store.commit('SET_SHOW_DOWNLOAD_PRODUCT_DIALOG', false)
    this.$store.commit('SET_DATADOWNLOAD_EVENT', null)
  }

  get downloadTitle () {
    return 'Data Download for Computation with ID \'' +
      this.datadownloadEvent.compId + '\''
  }

  get denseList (): boolean {
    return (this as any).$vuetify.breakpoint.smAndDown
  }

  private showGroup (group: string) {
    if (!this.datadownloadEvent.root && group === 'Tsunami Forecast Points') {
      return false
    }

    return true
  }

  private iconForGroup (group: string) {
    switch (group) {
      case 'Waveheights and arrival times': return 'mdi-waves'
      case 'Cities': return 'mdi-city-variant'
      case 'Tsunami Forecast Points': return 'mdi-map-marker'
      case 'Miscellaneous': return 'mdi-plus-box-multiple'
    }

    return 'mdi-download'
  }

  private iconForProduct (product: Product) {
    switch (product.type) {
      case 'tiff': return 'mdi-grid'
      case 'png': return 'mdi-file-png-box'
      case 'csv': return 'mdi-file-delimited'
      case 'pdf': return 'mdi-file-pdf-box'
    }

    return 'mdi-download'
  }

  private targetForProduct (product: Product) {
    if (product.file === 'custom.png') {
      return undefined
    }

    return '_blank'
  }

  private hrefForProduct (product: Product) {
    if (product.file === 'custom.png') {
      return undefined
    }

    return this.downloadUrl(product.file)
  }

  private clickActionForProduct (product: Product) {
    if (product.file !== 'custom.png') {
      return true
    }

    this.$store.commit('SET_SHOW_DOWNLOAD_PRODUCT_DIALOG', false)
    this.$store.commit('SET_SHOW_CUSTOM_MAP_DIALOG', true)
  }

  private availableProductsForGroup (group: string) {
    return this.availableProducts.filter((elm: Product) => elm.group === group)
  }

  get productGroups () {
    const groups = []
    const products = this.availableProducts

    for (const pro of products) {
      groups.push(pro.group)
    }

    // get only unique entries
    return Array.from(new Set(groups))
  }

  get availableProducts () {
    return this.$store.getters.availableProducts
  }

  get datadownloadEvent () {
    return this.$store.getters.datadownloadEvent
  }

  private downloadUrl (file: string) {
    if (!this.datadownloadEvent || !this.datadownloadEvent.identifier) {
      console.error('Event to download data from is unknown')
      return '#'
    }

    const id = this.datadownloadEvent.identifier
    return DATASRV_BASE_URL + id + '/' + file
  }

  get gmthelp () {
    return this.$store.getters.gmtHelp
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
