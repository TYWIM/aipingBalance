<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { View, Hide, Wallet, Present, CreditCard, User, Coin, List, Delete, Loading } from '@element-plus/icons-vue'
import axios from 'axios'

// 查询模式
const queryMode = ref<'single' | 'batch'>('single')

// 平台配置
const platforms = [
  { 
    id: 'aiping', 
    name: 'AIPing', 
    color: '#667eea',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    placeholder: 'QC-xxxxxxxx-xxxxxxxxxxxx'
  },
  { 
    id: 'siliconflow', 
    name: '硅基流动', 
    color: '#00d4aa',
    gradient: 'linear-gradient(135deg, #00d4aa 0%, #00a896 100%)',
    placeholder: 'sk-xxxxxxxxxxxxxxxx'
  }
]

const currentPlatform = ref('aiping')
const currentPlatformConfig = computed(() => 
  platforms.find(p => p.id === currentPlatform.value) || platforms[0]
)

// 粒子背景
const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId: number

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
}

const particles: Particle[] = []
const particleCount = 80
const connectionDistance = 150

// 颜色插值
const targetColors = ref<string[]>(['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'])
const currentColors = ref<string[]>(['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'])

const platformColors: Record<string, string[]> = {
  aiping: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'],
  siliconflow: ['#00d4aa', '#00a896', '#00c9b7', '#20e3b2', '#0cebeb']
}

let colorTransitionProgress = 1
const colorTransitionDuration = 800

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 }
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

function lerpColor(color1: string, color2: string, t: number) {
  const c1 = hexToRgb(color1)
  const c2 = hexToRgb(color2)
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  )
}

function initParticles(width: number, height: number) {
  particles.length = 0
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      radius: Math.random() * 2 + 1,
      color: currentColors.value[Math.floor(Math.random() * currentColors.value.length)]
    })
  }
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (colorTransitionProgress < 1) {
    colorTransitionProgress = Math.min(1, colorTransitionProgress + 16 / colorTransitionDuration)
    const easeProgress = 1 - Math.pow(1 - colorTransitionProgress, 3)
    particles.forEach((p, i) => {
      const colorIndex = i % currentColors.value.length
      p.color = lerpColor(currentColors.value[colorIndex], targetColors.value[colorIndex], easeProgress)
    })
    if (colorTransitionProgress >= 1) currentColors.value = [...targetColors.value]
  }

  particles.forEach((p, i) => {
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = 0.6
    ctx.fill()

    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j]
      const dx = p.x - p2.x
      const dy = p.y - p2.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < connectionDistance) {
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.strokeStyle = p.color
        ctx.globalAlpha = (1 - dist / connectionDistance) * 0.3
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }
  })
  ctx.globalAlpha = 1
  animationId = requestAnimationFrame(animate)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  initParticles(canvas.width, canvas.height)
}

function switchPlatform(platformId: string) {
  if (currentPlatform.value === platformId) return
  currentPlatform.value = platformId
  showResult.value = false
  batchResults.value = []
  targetColors.value = platformColors[platformId] || platformColors.aiping
  colorTransitionProgress = 0
}

onMounted(() => {
  resizeCanvas()
  animate()
  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeCanvas)
})

// 单个查询
const apiKey = ref('')
const showPassword = ref(false)
const loading = ref(false)
const showResult = ref(false)

const aipingBalance = reactive({ total: 0, recharge: 0, gift: 0 })
const siliconflowInfo = reactive({ name: '', balance: 0, chargeBalance: 0, totalBalance: 0 })

// 批量查询
const batchKeys = ref('')
interface BatchResult {
  key: string
  keyShort: string
  status: 'pending' | 'success' | 'error'
  platform: string
  data?: any
  error?: string
}
const batchResults = ref<BatchResult[]>([])
const batchLoading = ref(false)
const batchProgress = ref(0)

const formatMoney = (value: number) => '¥' + value.toFixed(2)

const queryBalance = async () => {
  if (!apiKey.value.trim()) {
    ElMessage.warning('请输入 API Key')
    return
  }
  loading.value = true
  showResult.value = false
  try {
    if (currentPlatform.value === 'aiping') await queryAiping()
    else await querySiliconflow()
  } finally {
    loading.value = false
  }
}

const queryAiping = async () => {
  const apiUrl = import.meta.env.DEV ? '/api/v1/user/remain/points' : '/api/balance'
  try {
    const response = await axios.get(apiUrl, {
      headers: { 'Authorization': `Bearer ${apiKey.value.trim()}` }
    })
    if (response.data.code === 0) {
      aipingBalance.total = response.data.data.total_remain
      aipingBalance.recharge = response.data.data.recharge_remain
      aipingBalance.gift = response.data.data.gift_remain
      showResult.value = true
      ElMessage.success('查询成功')
    } else {
      ElMessage.error(response.data.msg || '查询失败')
    }
  } catch (error: any) {
    if (error.response?.status === 401) ElMessage.error('API Key 无效或已过期')
    else ElMessage.error('网络请求失败')
  }
}

const querySiliconflow = async () => {
  const apiUrl = import.meta.env.DEV ? '/siliconflow/v1/user/info' : '/api/siliconflow'
  try {
    const response = await axios.get(apiUrl, {
      headers: { 'Authorization': `Bearer ${apiKey.value.trim()}` }
    })
    if (response.data.code === 20000 || response.data.status === 'success' || response.data.data) {
      const data = response.data.data || response.data
      siliconflowInfo.name = data.name || data.username || '用户'
      siliconflowInfo.balance = parseFloat(data.balance) || 0
      siliconflowInfo.chargeBalance = parseFloat(data.chargeBalance) || 0
      siliconflowInfo.totalBalance = parseFloat(data.totalBalance) || (siliconflowInfo.balance + siliconflowInfo.chargeBalance)
      showResult.value = true
      ElMessage.success('查询成功')
    } else {
      ElMessage.error(response.data.message || '查询失败')
    }
  } catch (error: any) {
    if (error.response?.status === 401) ElMessage.error('API Key 无效或已过期')
    else ElMessage.error('网络请求失败')
  }
}

// 批量查询逻辑
const queryBatch = async () => {
  const keys = batchKeys.value.split('\n').map(k => k.trim()).filter(k => k.length > 0)
  if (keys.length === 0) {
    ElMessage.warning('请输入至少一个 API Key')
    return
  }
  if (keys.length > 50) {
    ElMessage.warning('最多支持 50 个 Key 批量查询')
    return
  }

  batchLoading.value = true
  batchProgress.value = 0
  batchResults.value = keys.map(key => ({
    key,
    keyShort: key.length > 20 ? key.slice(0, 10) + '...' + key.slice(-6) : key,
    status: 'pending' as const,
    platform: currentPlatform.value
  }))

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    try {
      if (currentPlatform.value === 'aiping') {
        const apiUrl = import.meta.env.DEV ? '/api/v1/user/remain/points' : '/api/balance'
        const response = await axios.get(apiUrl, {
          headers: { 'Authorization': `Bearer ${key}` }
        })
        if (response.data.code === 0) {
          batchResults.value[i].status = 'success'
          batchResults.value[i].data = response.data.data
        } else {
          batchResults.value[i].status = 'error'
          batchResults.value[i].error = response.data.msg || '查询失败'
        }
      } else {
        const apiUrl = import.meta.env.DEV ? '/siliconflow/v1/user/info' : '/api/siliconflow'
        const response = await axios.get(apiUrl, {
          headers: { 'Authorization': `Bearer ${key}` }
        })
        if (response.data.code === 20000 || response.data.status === 'success' || response.data.data) {
          batchResults.value[i].status = 'success'
          batchResults.value[i].data = response.data.data || response.data
        } else {
          batchResults.value[i].status = 'error'
          batchResults.value[i].error = response.data.message || '查询失败'
        }
      }
    } catch (error: any) {
      batchResults.value[i].status = 'error'
      batchResults.value[i].error = error.response?.status === 401 ? 'Key 无效' : '网络错误'
    }
    batchProgress.value = Math.round(((i + 1) / keys.length) * 100)
    await new Promise(r => setTimeout(r, 200)) // 避免请求过快
  }
  batchLoading.value = false
  ElMessage.success(`批量查询完成，成功 ${batchResults.value.filter(r => r.status === 'success').length} 个`)
}

const clearBatchResults = () => {
  batchResults.value = []
  batchKeys.value = ''
}

const getBatchTotal = computed(() => {
  return batchResults.value
    .filter(r => r.status === 'success' && r.data)
    .reduce((sum, r) => {
      if (currentPlatform.value === 'aiping') {
        return sum + (r.data.total_remain || 0)
      } else {
        return sum + (parseFloat(r.data.totalBalance) || parseFloat(r.data.balance) || 0)
      }
    }, 0)
})
</script>

<template>
  <div class="app-container">
    <canvas ref="canvasRef" class="particle-canvas"></canvas>
    <div class="gradient-overlay"></div>

    <div class="main-content">
      <div v-motion :initial="{ opacity: 0, y: 50, scale: 0.9 }" :enter="{ opacity: 1, y: 0, scale: 1, transition: { duration: 600, type: 'spring', stiffness: 100 } }" class="card">
        <!-- 平台切换 -->
        <div class="platform-tabs">
          <button v-for="platform in platforms" :key="platform.id" :class="['platform-tab', { active: currentPlatform === platform.id }]" :style="currentPlatform === platform.id ? { background: platform.gradient } : {}" @click="switchPlatform(platform.id)">
            {{ platform.name }}
          </button>
        </div>

        <!-- 头部 -->
        <div class="header">
          <div v-motion :initial="{ scale: 0, rotate: -180 }" :enter="{ scale: 1, rotate: 0, transition: { delay: 200, duration: 500, type: 'spring' } }" class="logo" :style="{ background: currentPlatformConfig.gradient }">
            <el-icon :size="32"><Wallet /></el-icon>
          </div>
          <h1>{{ currentPlatformConfig.name }} 余额查询</h1>
          <p>输入您的 API Key 查询账户余额</p>
        </div>

        <!-- 查询模式切换 -->
        <div class="mode-tabs">
          <button :class="['mode-tab', { active: queryMode === 'single' }]" @click="queryMode = 'single'">
            <el-icon><Wallet /></el-icon> 单个查询
          </button>
          <button :class="['mode-tab', { active: queryMode === 'batch' }]" @click="queryMode = 'batch'">
            <el-icon><List /></el-icon> 批量查询
          </button>
        </div>

        <!-- 单个查询 -->
        <template v-if="queryMode === 'single'">
          <div class="input-section">
            <label>API Key</label>
            <el-input v-model="apiKey" :type="showPassword ? 'text' : 'password'" :placeholder="currentPlatformConfig.placeholder" size="large" @keyup.enter="queryBalance">
              <template #suffix>
                <el-icon class="cursor-pointer" @click="showPassword = !showPassword">
                  <View v-if="!showPassword" /><Hide v-else />
                </el-icon>
              </template>
            </el-input>
          </div>
          <el-button type="primary" size="large" :loading="loading" class="query-btn" :style="{ background: currentPlatformConfig.gradient }" @click="queryBalance">
            {{ loading ? '查询中...' : '查询余额' }}
          </el-button>
        </template>

        <!-- 批量查询 -->
        <template v-else>
          <div class="input-section">
            <label>API Keys（每行一个）</label>
            <el-input v-model="batchKeys" type="textarea" :rows="5" :placeholder="`每行输入一个 ${currentPlatformConfig.name} API Key\n例如：\n${currentPlatformConfig.placeholder}\n${currentPlatformConfig.placeholder}`" />
          </div>
          <div class="batch-actions">
            <el-button type="primary" size="large" :loading="batchLoading" class="query-btn" :style="{ background: currentPlatformConfig.gradient }" @click="queryBatch">
              {{ batchLoading ? `查询中 ${batchProgress}%` : '批量查询' }}
            </el-button>
            <el-button v-if="batchResults.length > 0" size="large" @click="clearBatchResults">
              <el-icon><Delete /></el-icon> 清空
            </el-button>
          </div>
        </template>

        <!-- 单个查询结果 - AIPing -->
        <Transition name="result">
          <div v-if="showResult && currentPlatform === 'aiping' && queryMode === 'single'" class="result-section">
            <h3>账户余额</h3>
            <div class="balance-cards">
              <div class="balance-card total" :style="{ background: currentPlatformConfig.gradient }">
                <div class="balance-icon"><el-icon :size="24"><Wallet /></el-icon></div>
                <div class="balance-info"><span>总余额</span><strong>{{ formatMoney(aipingBalance.total) }}</strong></div>
              </div>
              <div class="balance-card">
                <div class="balance-icon recharge"><el-icon :size="20"><CreditCard /></el-icon></div>
                <div class="balance-info"><span>充值余额</span><strong>{{ formatMoney(aipingBalance.recharge) }}</strong></div>
              </div>
              <div class="balance-card">
                <div class="balance-icon gift"><el-icon :size="20"><Present /></el-icon></div>
                <div class="balance-info"><span>赠送余额</span><strong>{{ formatMoney(aipingBalance.gift) }}</strong></div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- 单个查询结果 - 硅基流动 -->
        <Transition name="result">
          <div v-if="showResult && currentPlatform === 'siliconflow' && queryMode === 'single'" class="result-section">
            <h3>账户信息</h3>
            <div class="balance-cards">
              <div class="balance-card total" :style="{ background: currentPlatformConfig.gradient }">
                <div class="balance-icon"><el-icon :size="24"><Coin /></el-icon></div>
                <div class="balance-info"><span>总余额</span><strong>{{ formatMoney(siliconflowInfo.totalBalance) }}</strong></div>
              </div>
              <div class="balance-card">
                <div class="balance-icon recharge"><el-icon :size="20"><CreditCard /></el-icon></div>
                <div class="balance-info"><span>充值余额</span><strong>{{ formatMoney(siliconflowInfo.chargeBalance) }}</strong></div>
              </div>
              <div class="balance-card">
                <div class="balance-icon gift"><el-icon :size="20"><Present /></el-icon></div>
                <div class="balance-info"><span>赠送余额</span><strong>{{ formatMoney(siliconflowInfo.balance) }}</strong></div>
              </div>
              <div class="balance-card">
                <div class="balance-icon user"><el-icon :size="20"><User /></el-icon></div>
                <div class="balance-info"><span>用户名</span><strong class="username">{{ siliconflowInfo.name }}</strong></div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- 批量查询结果 -->
        <Transition name="result">
          <div v-if="batchResults.length > 0 && queryMode === 'batch'" class="result-section batch-result">
            <div class="batch-header">
              <h3>查询结果</h3>
              <div class="batch-summary" :style="{ background: currentPlatformConfig.gradient }">
                总计: {{ formatMoney(getBatchTotal) }}
              </div>
            </div>
            <div class="batch-list">
              <div v-for="(result, index) in batchResults" :key="index" :class="['batch-item', result.status]">
                <div class="batch-key">{{ result.keyShort }}</div>
                <div class="batch-status">
                  <template v-if="result.status === 'pending'">
                    <el-icon class="loading-icon"><Loading /></el-icon>
                  </template>
                  <template v-else-if="result.status === 'success'">
                    <span class="success-amount">
                      {{ currentPlatform === 'aiping' 
                        ? formatMoney(result.data?.total_remain || 0)
                        : formatMoney(parseFloat(result.data?.totalBalance) || parseFloat(result.data?.balance) || 0) 
                      }}
                    </span>
                  </template>
                  <template v-else>
                    <span class="error-text">{{ result.error }}</span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- 底部链接 -->
        <div class="footer">
          <a :href="currentPlatform === 'aiping' ? 'https://aiping.cn' : 'https://siliconflow.cn'" target="_blank">
            访问 {{ currentPlatformConfig.name }} 官网 →
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container { width: 100%; height: 100%; position: relative; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }
.particle-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
.gradient-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.3) 100%); z-index: 2; }
.main-content { position: relative; z-index: 3; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
.card { width: 100%; max-width: 480px; background: rgba(255, 255, 255, 0.95); border-radius: 24px; padding: 32px 40px 40px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); backdrop-filter: blur(20px); }
.platform-tabs { display: flex; gap: 8px; margin-bottom: 20px; padding: 4px; background: #f1f5f9; border-radius: 12px; }
.platform-tab { flex: 1; padding: 10px 16px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); background: transparent; color: #64748b; }
.platform-tab:hover { background: rgba(0, 0, 0, 0.05); }
.platform-tab.active { color: white; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
.header { text-align: center; margin-bottom: 24px; }
.logo { width: 72px; height: 72px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: white; box-shadow: 0 10px 30px -10px rgba(102, 126, 234, 0.5); transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.header h1 { font-size: 22px; color: #1a1a2e; font-weight: 700; margin-bottom: 6px; }
.header p { color: #6b7280; font-size: 14px; }

.mode-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.mode-tab { flex: 1; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.3s; background: white; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 6px; }
.mode-tab:hover { border-color: #cbd5e1; }
.mode-tab.active { border-color: #667eea; color: #667eea; background: #f0f4ff; }
.input-section { margin-bottom: 20px; }
.input-section label { display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px; }
.cursor-pointer { cursor: pointer; transition: color 0.2s; }
.cursor-pointer:hover { color: #667eea; }
.query-btn { width: 100%; height: 48px; font-size: 16px; font-weight: 600; border: none; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.query-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px -10px rgba(102, 126, 234, 0.6); }
.batch-actions { display: flex; gap: 12px; }
.batch-actions .query-btn { flex: 1; }
.result-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
.result-section h3 { font-size: 15px; color: #374151; margin-bottom: 14px; font-weight: 600; }
.balance-cards { display: flex; flex-direction: column; gap: 10px; }
.balance-card { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 14px; padding: 16px 18px; display: flex; align-items: center; gap: 14px; transition: transform 0.2s ease; }
.balance-card:hover { transform: translateX(4px); }
.balance-card.total .balance-icon { background: rgba(255, 255, 255, 0.2); color: white; }
.balance-card.total .balance-info span { color: rgba(255, 255, 255, 0.8); }
.balance-card.total .balance-info strong { color: white; }
.balance-icon { width: 42px; height: 42px; border-radius: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.balance-icon.recharge { background: #d1fae5; color: #10b981; }
.balance-icon.gift { background: #fef3c7; color: #f59e0b; }
.balance-icon.user { background: #e0e7ff; color: #6366f1; }
.balance-info span { font-size: 12px; color: #6b7280; display: block; margin-bottom: 3px; }
.balance-info strong { font-size: 20px; color: #1a1a2e; font-weight: 700; }
.balance-info strong.username { font-size: 15px; }

.batch-result .batch-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.batch-summary { padding: 8px 16px; border-radius: 20px; color: white; font-weight: 600; font-size: 14px; }
.batch-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.batch-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8fafc; border-radius: 10px; transition: all 0.3s; }
.batch-item.success { background: #f0fdf4; border-left: 3px solid #10b981; }
.batch-item.error { background: #fef2f2; border-left: 3px solid #ef4444; }
.batch-item.pending { background: #f8fafc; border-left: 3px solid #94a3b8; }
.batch-key { font-family: monospace; font-size: 13px; color: #475569; }
.batch-status { font-weight: 600; }
.success-amount { color: #10b981; }
.error-text { color: #ef4444; font-size: 12px; }
.loading-icon { animation: spin 1s linear infinite; color: #94a3b8; }
@keyframes spin { to { transform: rotate(360deg); } }
.footer { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
.footer a { color: #667eea; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
.footer a:hover { color: #764ba2; }
.result-enter-active { animation: slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.result-leave-active { animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) reverse; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>
