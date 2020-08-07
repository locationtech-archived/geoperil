<template>
  <v-list
    id="user-list"
    class="ma-0 pa-0"
  >
    <EventItem
      v-for="(item, index) in userEvents"
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
export default class UserList extends Vue {
  get userEvents(): Event[] {
    console.log("GET")
    return this.$store.getters.userEvents
  }

  public handleChangeComposeTab(): void {
    this.$emit('change-to-compose-tab')
  }
}
</script>

<style>
#user-list {
  height: 100%;
  overflow-y: auto;
}
</style>
