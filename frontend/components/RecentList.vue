<template>
  <v-list
    id="recent-list"
    class="ma-0 pa-0"
  >
    <EventItem
      v-for="(item, index) in testdata"
      :key="index"
      :data="item"
    >
    </EventItem>
  </v-list>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import EventItem from './EventItem.vue'

@Component({
  components: {
    EventItem
  }
})
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
}
</script>

<style>
#recent-list {
  height: 100%;
  overflow-y: auto;
}
</style>
