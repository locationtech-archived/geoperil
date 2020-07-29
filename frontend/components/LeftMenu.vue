<template>
  <v-tabs
    v-model="tab"
    class="fill-height"
    grow
  >
    <v-tab class="no-text-transform">Recent</v-tab>
    <v-tab class="no-text-transform">My List</v-tab>
    <v-tab class="no-text-transform">Compose</v-tab>

    <v-tabs-items
      class="fill-height-tabs"
      v-model="tab"
    >
      <TabItem>
        <RecentList
          @change-to-compose-tab="changeTab(2)"
        />
      </TabItem>

      <TabItem>
        Test 2
      </TabItem>

      <TabItem>
        <ComposeSimulation
          @change-to-mylist-tab="changeTab(1)"
        />
      </TabItem>
    </v-tabs-items>
  </v-tabs>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import TabItem from './TabItem.vue'
import RecentList from './RecentList.vue'
import ComposeSimulation from './ComposeSimulation.vue'

@Component({
  components: {
    TabItem,
    RecentList,
    ComposeSimulation,
  }
})
export default class LeftMenu extends Vue {
  private tab: any = null

  public changeTab(which: number) {
    this.tab = which
  }

  get composeEvent(): Event | null {
    return this.$store.getters.composeEvent
  }
}
</script>

<style>
.no-text-transform {
  text-transform: none;
}

.fill-height-tabs {
  height: calc(100% - 48px);
}

/* needed for height of v-window__container */
.fill-height-tabs > div {
  height: 100%;
}
</style>
