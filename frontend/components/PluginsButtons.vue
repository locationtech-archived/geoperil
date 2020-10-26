<template>
  <div class="plugins-buttons-container">
    <!-- Add your plugin buttons here -->
    <!--
    <ActionButton
      icon="mdi-information-outline"
      help-text="Helper text"
      @click="handleAction"
    />
    -->
  </div>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import ActionButton from './ActionButton.vue'

@Component({
  components: {
    ActionButton,
  },
})
export default class PluginsButtons extends Vue {
}
</script>

<style>
.plugins-buttons-container {
  display: flex;
}
</style>
