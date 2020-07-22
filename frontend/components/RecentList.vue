<template>
  <v-list
    id="recent-list"
    class="ma-0 pa-0"
  >
    <v-list-item
      v-for="(item, index) in testdata"
      :key="index"
      class="ma-0 pa-0 recent-list-item"
    >
      <v-col
        class="ma-0 pa-0 col-icon"
        align-self="center"
        cols="2"
      >
        <v-icon>mdi-map-marker</v-icon>
      </v-col>
      <v-col
        class="ma-0 pa-0"
        cols="8"
      >
        <v-card
          flat
          width="100%"
        >
          <v-list-item
            class="ma-0 pa-0"
          >
            <v-list-item-content
              class="pb-0 pt-1"
            >
              <div class="item-headline">
                <a
                  href="#"
                  @click="selectEvent"
                >{{ item.name }}</a>
              </div>
              <div class="item-metadata">{{ item.date }} &middot; {{ item.time }} &middot; {{ item.identifier }}</div>
              <div class="item-metadata">Lat {{ item.lat }}° &middot; Lon {{ item.lon }}° &middot; Depth {{ item.depth }} km</div>
              <div class="item-metadata">Dip {{ item.dip }}° &middot; Strike {{ item.strike }}° &middot; Rake {{ item.rake }}°</div>
              <div class="item-potential">{{ item.infotext }}</div>
            </v-list-item-content>
          </v-list-item>

          <v-card-actions class="pa-0">
            <v-row
              align="center"
              justify="start"
              class="ma-0"
            >
              <v-btn class="pl-1 pr-1" min-width="0" text><v-icon color="#154f8a" size="16">mdi-cloud-download</v-icon></v-btn>
              <v-btn class="pl-1 pr-1" min-width="0" text><v-icon color="#154f8a" size="16">mdi-information-outline</v-icon></v-btn>
              <v-btn class="pl-1 pr-1" min-width="0" text><v-icon color="#154f8a" size="16">mdi-reload</v-icon></v-btn>
              <v-btn class="pl-1 pr-1" min-width="0" text><v-icon color="#154f8a" size="16">mdi-telegram</v-icon></v-btn>
              <v-btn class="pl-1 pr-1" min-width="0" text><v-icon color="#154f8a" size="16">mdi-share</v-icon></v-btn>
              <v-btn class="pl-1 pr-1" min-width="0" text><v-icon color="#154f8a" size="16">mdi-sort-ascending</v-icon></v-btn>
            </v-row>
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col
        class="ma-0 pa-0 col-icon"
        align-self="center"
        cols="2"
      >
        <v-icon>mdi-web</v-icon>
      </v-col>
    </v-list-item>
  </v-list>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component
export default class RecentList extends Vue {
  private testdata: Object = [
    {
      name: 'Fiji Islands Region',
      date: '2020/06/09',
      time: '10:07 UTC',
      identifier: 'gfz2020sfjkl_gf_2',
      lat: -17.47,
      lon: -176.95,
      depth: 542,
      dip: 85,
      strike: 138,
      rake: 34,
      infotext: 'No tsunami potential'
    }
  ]

  public async selectEvent() {
    console.log('selectEvent')
    const id = 'TODO'
    await this.$store.dispatch('selectEvent', id)
  }
}
</script>

<style>
.item-headline {
  font-size: large;
  margin-bottom: 7px !important;
}

.item-headline a {
  font-weight: 500;
  text-decoration: none;
}

.item-headline a:hover {
  color: #154f8a;
  text-decoration: underline;
}

.item-metadata {
  font-size: small;
}

.item-potential {
  font-size: big;
  margin-top: 5px;
  color: #1976d2;
}

.col-icon {
  text-align: center;
}

div#recent-list {
  height: 100%;
  overflow-y: auto;
}

.recent-list-item {
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: #bbb;
}
</style>
