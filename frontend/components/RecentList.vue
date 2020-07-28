<template>
  <v-list
    id="recent-list"
    class="ma-0 pa-0"
  >
    <EventItem
      v-for="(item, index) in recentEvents"
      :key="index"
      :data="item"
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
}
</script>

<style>
#recent-list {
  height: 100%;
  overflow-y: auto;
}
</style>
