export default function ({ store, error }: any) {
  if (!store.state.user) {
    error({
      message: 'You are not connected',
      statusCode: 403
    })
  }
}
