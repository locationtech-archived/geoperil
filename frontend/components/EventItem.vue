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
            <div class="item-metadata">{{ data.date }} &middot; {{ data.time }} &middot; {{ data.compId }}</div>
            <div class="item-metadata">Lat {{ data.lat }}° &middot; Lon {{ data.lon }}° &middot; Depth {{ data.depth }} km</div>
            <div class="item-metadata" v-if="data.dip && data.strike && data.rake">Dip {{ data.dip }}° &middot; Strike {{ data.strike }}° &middot; Rake {{ data.rake }}°</div>
            <div class="item-metadata" v-if="data.progress > 0">{{ algorithmName }} &middot; Resolution {{ data.gridres }}° <br> Duration {{ data.duration }} min <template v-if="data.progress == 100">&middot; Runtime {{ calctimeInSec }} sec</template></div>
            <div v-if="data.progress == null" class="item-potential">{{ eventInfoText }}</div>
            <div v-if="data.progress > 0 && data.progress < 100" class="item-potential">Simulation in progress</div>
            <div v-if="data.progress == 100" class="item-potential">Simulation processed</div>
            <div v-if="data.progress == -1" class="sim-error">Simulation failed</div>
            <div v-if="data.progress == -2" class="item-potential">Simulation processed: No tsunami potential</div>
            <div v-if="data.progress == 0" class="item-potential">Simulation is being prepared</div>
            <v-progress-linear
              v-if="data.progress > 0 && data.progress < 100"
              color="light-blue"
              height="10"
              class="item-progress-bar"
              :value="data.progress"
              striped
            ></v-progress-linear>
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

  get calctimeInSec(): string {
    if (this.data.calctime) {
      return (this.data.calctime / 1000).toFixed(1)
    }
    return ''
  }

  get algorithmName(): string {
    if (this.data.algo == 'easywave') {
      return 'easyWave'
    }

    if (this.data.algo == 'hysea') {
      return 'HySea'
    }

    return 'unknown'
  }

  get eventInfoText(): string {
    const data: Event = this.data

    if (!data.seaArea) {
      return 'Inland, no simulation processed'
    }

    if (!(data.lat && data.lon && data.mag && data.depth
      && data.dip && data.rake && data.strike)) {
      return 'Missing parameters'
    }

    // TODO: check slip + width

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
    if (!this.hover) {
      return
    }

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
    this.$store.dispatch('fetchResults')
  }

  public handleCompose() {
    this.$store.commit('SET_COMPOSE', this.data)
    this.$emit('change-to-compose-tab')
  }
}
</script>

<style>
.sim-error {
  color: red;
  font-size: 15px;
}

.item-progress-bar {
  border: 1px solid #bbb;
}

.v-progress-linear__buffer {
  z-index: -1;
}

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
