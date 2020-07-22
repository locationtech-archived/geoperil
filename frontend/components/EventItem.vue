<template>
  <v-list-item
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
              >{{ data.name }}</a>
            </div>
            <div class="item-metadata">{{ data.date }} &middot; {{ data.time }} &middot; {{ data.identifier }}</div>
            <div class="item-metadata">Lat {{ data.lat }}° &middot; Lon {{ data.lon }}° &middot; Depth {{ data.depth }} km</div>
            <div class="item-metadata">Dip {{ data.dip }}° &middot; Strike {{ data.strike }}° &middot; Rake {{ data.rake }}°</div>
            <div class="item-potential">{{ data.infotext }}</div>
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
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'
import type { Event } from "~/types"

@Component
export default class EventItem extends Vue {
  @Prop({
    required: true
  })
  data!: Event

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

.recent-list-item {
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: #bbb;
}
</style>
