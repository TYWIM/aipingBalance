import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { MotionPlugin } from '@vueuse/motion'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(ElementPlus)
app.use(MotionPlugin)
app.mount('#app')
