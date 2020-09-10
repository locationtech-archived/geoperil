<template>
  <v-list
    id="recent-list"
    class="ma-0 pa-0"
  >
    <v-list-item v-if="!recentEvents || recentEvents.length == 0">
      <em>There are no recent events.</em>
    </v-list-item>
    <EventItem
      v-for="(item, index) in recentEvents"
      :key="index"
      :data="item"
      @change-to-compose-tab="handleChangeComposeTab"
    >
    </EventItem>
  </v-list>
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import EventItem from './EventItem.vue'
import { Event } from '../types'

@Component({
  components: {
    EventItem
  }
})
export default class RecentList extends Vue {
  get recentEvents(): Event[] {
    return this.$store.getters.recentEvents
  }

  public handleChangeComposeTab(): void {
    this.$emit('change-to-compose-tab')
  }
}
</script>

<style>
#recent-list {
  height: 100%;
  overflow-y: auto;
}
</style>
