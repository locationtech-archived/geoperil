<template>
  <v-tooltip
    v-model="show"
    open-delay=500
    right
  >
    <template v-slot:activator="{ on }">
      <div v-on="on">
        <v-btn
          v-on="on"
          class="pl-1 pr-1"
          min-width="0"
          @click="handleClick"
          text
        >
          <v-icon
            color="#154f8a"
            size="16"
          >
            {{ icon }}
          </v-icon>
        </v-btn>
      </div>
    </template>
    <span>{{ helpText }}</span>
  </v-tooltip>
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'

@Component
export default class ActionButton extends Vue {
  @Prop({ type: String, required: true }) icon!: string
  @Prop({ type: String, required: true }) helpText!: string

  private show: boolean = false

  public handleClick(): void {
    this.$emit('click')
  }
}
</script>
