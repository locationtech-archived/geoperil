<template>
  <v-container>
    <v-expansion-panels popout>
      <AddUser />
    </v-expansion-panels>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import AddUser from './AddUser.vue'

@Component({
  components: {
    AddUser,
  },
})
export default class UserManagement extends Vue {
}
</script>
