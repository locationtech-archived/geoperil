<template>
  <v-text-field
    v-model="value"
    :label="label"
    :suffix="suffix"
    hide-details
    outlined
    readonly
    dense
  >
    <slot />
  </v-text-field>
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'

@Component
export default class DenseTextField extends Vue {
  @Prop({ required: true }) value!: any
  @Prop({ type: String, required: false, default: '' }) label!: any
  @Prop({ type: String, required: false, default: '' }) suffix!: any
}
</script>
