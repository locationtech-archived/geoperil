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
import { Vue, Component, Prop } from 'nuxt-property-decorator'
import { Event } from '../types/index'
import ActionButton from './ActionButton.vue'

@Component({
  components: {
    ActionButton,
  },
})
export default class PluginsButtons extends Vue {
  @Prop({ required: true }) event!: Event
}
</script>

<style>
.plugins-buttons-container {
  display: flex;
}
</style>
