<template>
  <v-tabs
    v-model="tab"
    grow
  >
    <v-tab class="no-text-transform">Recent</v-tab>
    <v-tab class="no-text-transform">My List</v-tab>
    <v-tab class="no-text-transform">Compose</v-tab>

    <v-tabs-items v-model="tab">
      <TabItem>
        <RecentList />
      </TabItem>

      <TabItem>
        Test 2
      </TabItem>

      <TabItem>
        Test 3
      </TabItem>
    </v-tabs-items>
  </v-tabs>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import TabItem from './TabItem.vue'
import RecentList from './RecentList.vue';

@Component({
  components: {
    TabItem,
    RecentList
  }
})
export default class LeftMenu extends Vue {
  private tab: any = null
}
</script>

<style>
.no-text-transform {
  text-transform: none;
}
</style>
