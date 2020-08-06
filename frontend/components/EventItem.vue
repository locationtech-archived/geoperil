<template>
  <v-list-item
    class="ma-0 pa-0 eventitem-list-item"
    :class="isSelected ? 'selected' : ''"
    @mouseover="hoverEvent"
    @mouseleave="hoverEnd"
  >
    <v-col
      class="ma-0 pa-0 col-icon"
      align-self="center"
      cols="2"
    >
      <v-icon>mdi-map-marker</v-icon>
      <p class="item-mag">{{ data.mag }}</p>
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
              >{{ data.region }}</a>
            </div>
            <div class="item-metadata">{{ data.date }} &middot; {{ data.time }} &middot; {{ data.identifier }}</div>
            <div class="item-metadata">Lat {{ data.lat }}° &middot; Lon {{ data.lon }}° &middot; Depth {{ data.depth }} km</div>
            <div class="item-metadata" v-if="data.dip && data.strike && data.rake">Dip {{ data.dip }}° &middot; Strike {{ data.strike }}° &middot; Rake {{ data.rake }}°</div>
            <div class="item-potential">{{ eventInfoText }}</div>
          </v-list-item-content>
        </v-list-item>

        <v-card-actions class="pa-0">
          <v-row
            align="center"
            justify="start"
            class="ma-0"
          >
            <ActionButton
              icon="mdi-cloud-download"
              helpText="Download report"
            />
            <ActionButton
              icon="mdi-information-outline"
              helpText="Inspect event"
            />
            <ActionButton
              icon="mdi-reload"
              helpText="Modify and reprocess"
              @click="handleCompose"
            />
            <ActionButton
              icon="mdi-telegram"
              helpText="Send message"
            />
            <ActionButton
              icon="mdi-share"
              helpText="Share map"
            />
            <ActionButton
              icon="mdi-sort-ascending"
              helpText="Show timeline"
            />
          </v-row>
        </v-card-actions>
      </v-card>
    </v-col>
    <v-col
      class="ma-0 pa-0 col-icon"
      align-self="center"
      cols="2"
    >
      <img v-if="'bbUrl' in data" :src="data.bbUrl" />
    </v-col>
  </v-list-item>
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'
import { Event } from "~/types"
import ActionButton from './ActionButton.vue'

@Component({
  components: {
    ActionButton,
  }
})
export default class EventItem extends Vue {
  @Prop({ required: true }) data!: Event

  private hover: boolean = false

  get eventInfoText(): string {
    const data: Event = this.data

    // TODO analyse data.dip/rake/strike + seaArea
    if (!data.seaArea) {
      return 'Inland, no simulation processed'
    }

    if (!(data.lat && data.lon && data.mag && data.depth
      && data.dip && data.rake && data.strike)) {
      return 'Missing parameters'
    }

    // TODO: check if simulation was processed -> 'prepared', 'done'
    return 'No tsunami potential'
  }

  get isSelected(): boolean {
    const sel = this.$store.getters.selectedEvent
    if (!sel) {
      return false
    }
    return sel.identifier == this.data.identifier
  }

  public hoverEnd() {
    this.hover = false
    this.$store.commit('SET_HOVERED', null)
  }

  public hoverEvent() {
    if (this.hover) {
      return
    }
    this.hover = true
    this.$store.commit('SET_HOVERED', this.data)
  }

  public selectEvent() {
    this.$store.commit('SET_SELECTED', this.data)
  }

  public handleCompose() {
    this.$store.commit('SET_COMPOSE', this.data)
    this.$emit('change-to-compose-tab')
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

p.item-mag {
  font-weight: bold;
}

.item-metadata {
  font-size: 12px;
}

.item-potential {
  font-size: 14px;
  margin-top: 5px;
  color: #1976d2;
}

.col-icon {
  text-align: center;
}

.eventitem-list-item {
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: #bbb;
}

.eventitem-list-item.selected {
  border-left: 8px solid rgb(198, 0, 0);
  background-color: rgb(225, 238, 250);
}

.eventitem-list-item.selected div {
  background-color: rgb(225, 238, 250);
}

.eventitem-list-item:hover {
  background-color: rgb(195, 211, 225);
}

.eventitem-list-item:hover div {
  background-color: rgb(195, 211, 225);
}
</style>
