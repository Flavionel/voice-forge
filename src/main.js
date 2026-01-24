import { createApp } from 'vue'
import { Quasar, Notify, Dialog } from 'quasar'

// Import icon libraries
import '@quasar/extras/material-icons/material-icons.css'

// Import Quasar css
import 'quasar/src/css/index.sass'

// Import app styles
import './styles/app.scss'

import App from './App.vue'

const app = createApp(App)

app.use(Quasar, {
  plugins: {
    Notify,
    Dialog
  },
  config: {
    dark: true
  }
})

app.mount('#app')
