<template>
  <!--
    Add your tab contents for plugins here
    Note: this has to correspond with the tabs defined in PluginsSettingsTabs
  -->
  <div>
    <!--
    <TabItem>
      <YourSettingsContentHere />
    </TabItem>
    -->
  </div>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import TabItem from './TabItem.vue'

@Component({
  components: {
    TabItem,
  },
})
export default class PluginsSettingsTabsContent extends Vue {
}
</script>
