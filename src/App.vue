<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { View, Hide, Wallet, Present, CreditCard, User, List, Delete, Loading, Check, Close } from '@element-plus/icons-vue'
import axios from 'axios'

// 查询模式
const queryMode = ref<'single' | 'batch'>('single')

// 平台配置
const platforms = [
  { 
    id: 'aiping', 
    name: 'AIPing', 
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    placeholder: 'QC-xxxxxxxx-xxxxxxxxxxxx'
  },
  { 
    id: 'siliconflow', 
    name: '硅基流动', 
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    placeholder: 'sk-xxxxxxxxxxxxxxxx'
  }
]

const currentPlatform = ref('aiping')
const currentPlatformConfig = computed(() => 
  platforms.find(p => p.id === currentPlatform.value) || platforms[0]
)

// 滑动指示器位置
const platformIndex = computed(() => platforms.findIndex(p => p.id === currentPlatform.value))
const modeIndex = computed(() => queryMode.value === 'single' ? 0 : 1)

// 粒子背景
const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId: number
const prefersReducedMotion = ref(false)

interface Particle { x: number; y: number; vx: number; vy: number; radius: number; color: string }
const particles: Particle[] = []
const particleCount = 60
const connectionDistance = 120

const targetColors = ref<string[]>(['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8'])
const currentColors = ref<string[]>(['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8'])
const platformColors: Record<string, string[]> = {
  aiping: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8'],
  siliconflow: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#14b8a6']
}

let colorTransitionProgress = 1
const colorTransitionDuration = 600

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 }
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('')
}

function lerpColor(c1: string, c2: string, t: number) {
  const rgb1 = hexToRgb(c1), rgb2 = hexToRgb(c2)
  return rgbToHex(rgb1.r + (rgb2.r - rgb1.r) * t, rgb1.g + (rgb2.g - rgb1.g) * t, rgb1.b + (rgb2.b - rgb1.b) * t)
}

function initParticles(w: number, h: number) {
  particles.length = 0
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 1.5 + 0.5,
      color: currentColors.value[Math.floor(Math.random() * currentColors.value.length)]
    })
  }
}

function animate() {
  if (prefersReducedMotion.value) return
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (colorTransitionProgress < 1) {
    colorTransitionProgress = Math.min(1, colorTransitionProgress + 16 / colorTransitionDuration)
    const ease = 1 - Math.pow(1 - colorTransitionProgress, 3)
    particles.forEach((p, i) => { p.color = lerpColor(currentColors.value[i % 5], targetColors.value[i % 5], ease) })
    if (colorTransitionProgress >= 1) currentColors.value = [...targetColors.value]
  }

  particles.forEach((p, i) => {
    p.x += p.vx; p.y += p.vy
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = p.color; ctx.globalAlpha = 0.4; ctx.fill()
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j], dist = Math.hypot(p.x - p2.x, p.y - p2.y)
      if (dist < connectionDistance) {
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y)
        ctx.strokeStyle = p.color; ctx.globalAlpha = (1 - dist / connectionDistance) * 0.15
        ctx.lineWidth = 0.5; ctx.stroke()
      }
    }
  })
  ctx.globalAlpha = 1
  animationId = requestAnimationFrame(animate)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = window.innerWidth; canvas.height = window.innerHeight
  initParticles(canvas.width, canvas.height)
}

function switchPlatform(id: string) {
  if (currentPlatform.value === id) return
  currentPlatform.value = id; showResult.value = false; batchResults.value = []
  targetColors.value = platformColors[id] || platformColors.aiping
  colorTransitionProgress = 0
}

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resizeCanvas(); if (!prefersReducedMotion.value) animate()
  window.addEventListener('resize', resizeCanvas)
})
onUnmounted(() => { cancelAnimationFrame(animationId); window.removeEventListener('resize', resizeCanvas) })

// 表单状态
const apiKey = ref('')
const showPassword = ref(false)
const loading = ref(false)
const showResult = ref(false)
const aipingBalance = reactive({ total: 0, recharge: 0, gift: 0 })
const siliconflowInfo = reactive({ name: '', balance: 0, chargeBalance: 0, totalBalance: 0 })

// 批量查询
const batchKeys = ref('')
interface BatchResult { key: string; keyShort: string; status: 'pending' | 'success' | 'error'; platform: string; data?: any; error?: string }
const batchResults = ref<BatchResult[]>([])
const batchLoading = ref(false)
const batchProgress = ref(0)

const formatMoney = (v: number) => '¥' + v.toFixed(2)

const queryBalance = async () => {
  if (!apiKey.value.trim()) { ElMessage.warning('请输入 API Key'); return }
  loading.value = true; showResult.value = false
  try {
    currentPlatform.value === 'aiping' ? await queryAiping() : await querySiliconflow()
  } finally { loading.value = false }
}

const queryAiping = async () => {
  const url = import.meta.env.DEV ? '/api/v1/user/remain/points' : '/api/balance'
  try {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${apiKey.value.trim()}` } })
    if (res.data.code === 0) {
      Object.assign(aipingBalance, res.data.data)
      aipingBalance.total = res.data.data.total_remain
      aipingBalance.recharge = res.data.data.recharge_remain
      aipingBalance.gift = res.data.data.gift_remain
      showResult.value = true; ElMessage.success('查询成功')
    } else ElMessage.error(res.data.msg || '查询失败')
  } catch (e: any) { ElMessage.error(e.response?.status === 401 ? 'API Key 无效' : '网络错误') }
}

const querySiliconflow = async () => {
  const url = import.meta.env.DEV ? '/siliconflow/v1/user/info' : '/api/siliconflow'
  try {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${apiKey.value.trim()}` } })
    if (res.data.code === 20000 || res.data.data) {
      const d = res.data.data || res.data
      siliconflowInfo.name = d.name || d.username || '用户'
      siliconflowInfo.balance = parseFloat(d.balance) || 0
      siliconflowInfo.chargeBalance = parseFloat(d.chargeBalance) || 0
      siliconflowInfo.totalBalance = parseFloat(d.totalBalance) || siliconflowInfo.balance + siliconflowInfo.chargeBalance
      showResult.value = true; ElMessage.success('查询成功')
    } else ElMessage.error(res.data.message || '查询失败')
  } catch (e: any) { ElMessage.error(e.response?.status === 401 ? 'API Key 无效' : '网络错误') }
}

const queryBatch = async () => {
  const keys = batchKeys.value.split('\n').map(k => k.trim()).filter(Boolean)
  if (!keys.length) { ElMessage.warning('请输入至少一个 API Key'); return }
  if (keys.length > 50) { ElMessage.warning('最多支持 50 个'); return }

  batchLoading.value = true; batchProgress.value = 0
  batchResults.value = keys.map(key => ({ key, keyShort: key.length > 20 ? key.slice(0, 8) + '···' + key.slice(-4) : key, status: 'pending' as const, platform: currentPlatform.value }))

  for (let i = 0; i < keys.length; i++) {
    try {
      const url = currentPlatform.value === 'aiping' 
        ? (import.meta.env.DEV ? '/api/v1/user/remain/points' : '/api/balance')
        : (import.meta.env.DEV ? '/siliconflow/v1/user/info' : '/api/siliconflow')
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${keys[i]}` } })
      const ok = currentPlatform.value === 'aiping' ? res.data.code === 0 : (res.data.code === 20000 || res.data.data)
      batchResults.value[i].status = ok ? 'success' : 'error'
      batchResults.value[i].data = ok ? (res.data.data || res.data) : null
      batchResults.value[i].error = ok ? undefined : (res.data.msg || res.data.message || '失败')
    } catch (e: any) {
      batchResults.value[i].status = 'error'
      batchResults.value[i].error = e.response?.status === 401 ? '无效' : '网络错误'
    }
    batchProgress.value = Math.round(((i + 1) / keys.length) * 100)
    await new Promise(r => setTimeout(r, 150))
  }
  batchLoading.value = false
  const success = batchResults.value.filter(r => r.status === 'success').length
  ElMessage.success(`完成：${success}/${keys.length} 成功`)
}

const clearBatch = () => { batchResults.value = []; batchKeys.value = '' }

const batchTotal = computed(() => batchResults.value.filter(r => r.status === 'success' && r.data).reduce((s, r) => {
  return s + (currentPlatform.value === 'aiping' ? (r.data.total_remain || 0) : (parseFloat(r.data.totalBalance) || parseFloat(r.data.balance) || 0))
}, 0))
</script>

<template>
  <div class="app-container">
    <canvas ref="canvasRef" class="particle-canvas" aria-hidden="true"></canvas>
    <div class="gradient-overlay"></div>

    <main class="main-content">
      <article v-motion :initial="{ opacity: 0, y: 40 }" :enter="{ opacity: 1, y: 0, transition: { duration: 500, type: 'spring', stiffness: 120 } }" class="card">
        
        <!-- 平台切换 -->
        <nav class="tabs-container" role="tablist" aria-label="选择平台">
          <div class="tabs-slider" :style="{ transform: `translateX(${platformIndex * 100}%)`, background: currentPlatformConfig.gradient }"></div>
          <button v-for="(p, i) in platforms" :key="p.id" role="tab" :aria-selected="currentPlatform === p.id" :class="['tab-btn', { active: currentPlatform === p.id }]" @click="switchPlatform(p.id)">
            {{ p.name }}
          </button>
        </nav>

        <!-- 头部 -->
        <header class="header">
          <div v-motion :initial="{ scale: 0 }" :enter="{ scale: 1, transition: { delay: 150, type: 'spring' } }" class="logo" :style="{ background: currentPlatformConfig.gradient }">
            <el-icon :size="28"><Wallet /></el-icon>
          </div>
          <h1>{{ currentPlatformConfig.name }} 余额查询</h1>
          <p>安全查询您的 API 账户余额</p>
        </header>

        <!-- 模式切换 -->
        <div class="mode-container" role="tablist">
          <div class="mode-slider" :style="{ transform: `translateX(${modeIndex * 100}%)` }"></div>
          <button role="tab" :aria-selected="queryMode === 'single'" :class="['mode-btn', { active: queryMode === 'single' }]" @click="queryMode = 'single'">
            <el-icon :size="16"><Wallet /></el-icon>
            <span>单个查询</span>
          </button>
          <button role="tab" :aria-selected="queryMode === 'batch'" :class="['mode-btn', { active: queryMode === 'batch' }]" @click="queryMode = 'batch'">
            <el-icon :size="16"><List /></el-icon>
            <span>批量查询</span>
          </button>
        </div>

        <!-- 单个查询表单 -->
        <form v-if="queryMode === 'single'" @submit.prevent="queryBalance" class="form-section">
          <div class="input-group">
            <label for="apiKey">API Key</label>
            <el-input id="apiKey" v-model="apiKey" :type="showPassword ? 'text' : 'password'" :placeholder="currentPlatformConfig.placeholder" size="large" clearable>
              <template #suffix>
                <button type="button" class="toggle-btn" @click="showPassword = !showPassword" :aria-label="showPassword ? '隐藏密码' : '显示密码'">
                  <el-icon :size="18"><View v-if="!showPassword" /><Hide v-else /></el-icon>
                </button>
              </template>
            </el-input>
          </div>
          <button type="submit" class="submit-btn" :disabled="loading" :style="{ background: currentPlatformConfig.gradient }">
            <el-icon v-if="loading" class="spin"><Loading /></el-icon>
            <span>{{ loading ? '查询中...' : '查询余额' }}</span>
          </button>
        </form>

        <!-- 批量查询表单 -->
        <form v-else @submit.prevent="queryBatch" class="form-section">
          <div class="input-group">
            <label for="batchKeys">API Keys <span class="hint">（每行一个，最多50个）</span></label>
            <el-input id="batchKeys" v-model="batchKeys" type="textarea" :rows="4" :placeholder="`${currentPlatformConfig.placeholder}\n${currentPlatformConfig.placeholder}`" resize="none" />
          </div>
          <div class="btn-group">
            <button type="submit" class="submit-btn" :disabled="batchLoading" :style="{ background: currentPlatformConfig.gradient }">
              <el-icon v-if="batchLoading" class="spin"><Loading /></el-icon>
              <span>{{ batchLoading ? `${batchProgress}%` : '批量查询' }}</span>
            </button>
            <button v-if="batchResults.length" type="button" class="clear-btn" @click="clearBatch">
              <el-icon :size="16"><Delete /></el-icon>
            </button>
          </div>
        </form>

        <!-- 单个结果 -->
        <Transition name="fade-slide">
          <section v-if="showResult && queryMode === 'single'" class="result-section" aria-live="polite">
            <h2>账户余额</h2>
            <div class="balance-grid">
              <div class="balance-card primary" :style="{ background: currentPlatformConfig.gradient }">
                <div class="card-icon"><el-icon :size="22"><Wallet /></el-icon></div>
                <div class="card-content">
                  <span class="label">总余额</span>
                  <strong class="value">{{ formatMoney(currentPlatform === 'aiping' ? aipingBalance.total : siliconflowInfo.totalBalance) }}</strong>
                </div>
              </div>
              <div class="balance-card">
                <div class="card-icon recharge"><el-icon :size="18"><CreditCard /></el-icon></div>
                <div class="card-content">
                  <span class="label">充值</span>
                  <strong class="value">{{ formatMoney(currentPlatform === 'aiping' ? aipingBalance.recharge : siliconflowInfo.chargeBalance) }}</strong>
                </div>
              </div>
              <div class="balance-card">
                <div class="card-icon gift"><el-icon :size="18"><Present /></el-icon></div>
                <div class="card-content">
                  <span class="label">赠送</span>
                  <strong class="value">{{ formatMoney(currentPlatform === 'aiping' ? aipingBalance.gift : siliconflowInfo.balance) }}</strong>
                </div>
              </div>
              <div v-if="currentPlatform === 'siliconflow'" class="balance-card">
                <div class="card-icon user"><el-icon :size="18"><User /></el-icon></div>
                <div class="card-content">
                  <span class="label">用户</span>
                  <strong class="value small">{{ siliconflowInfo.name }}</strong>
                </div>
              </div>
            </div>
          </section>
        </Transition>

        <!-- 批量结果 -->
        <Transition name="fade-slide">
          <section v-if="batchResults.length && queryMode === 'batch'" class="result-section" aria-live="polite">
            <div class="batch-header">
              <h2>查询结果</h2>
              <div class="batch-total" :style="{ background: currentPlatformConfig.gradient }">
                {{ formatMoney(batchTotal) }}
              </div>
            </div>
            <ul class="batch-list">
              <li v-for="(r, i) in batchResults" :key="i" :class="['batch-item', r.status]">
                <code class="key">{{ r.keyShort }}</code>
                <span class="status">
                  <el-icon v-if="r.status === 'pending'" class="spin"><Loading /></el-icon>
                  <template v-else-if="r.status === 'success'">
                    <el-icon class="icon-success"><Check /></el-icon>
                    {{ currentPlatform === 'aiping' ? formatMoney(r.data?.total_remain || 0) : formatMoney(parseFloat(r.data?.totalBalance) || 0) }}
                  </template>
                  <template v-else>
                    <el-icon class="icon-error"><Close /></el-icon>
                    {{ r.error }}
                  </template>
                </span>
              </li>
            </ul>
          </section>
        </Transition>

        <!-- 底部 -->
        <footer class="footer">
          <a :href="currentPlatform === 'aiping' ? 'https://aiping.cn' : 'https://siliconflow.cn'" target="_blank" rel="noopener noreferrer">
            访问 {{ currentPlatformConfig.name }} 官网
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>
          </a>
        </footer>
      </article>
    </main>
  </div>
</template>

<style scoped>
/* 基础布局 */
.app-container { width: 100%; min-height: 100vh; position: relative; background: #0f172a; }
.particle-canvas { position: fixed; inset: 0; z-index: 1; pointer-events: none; }
.gradient-overlay { position: fixed; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 60%); z-index: 2; pointer-events: none; }
.main-content { position: relative; z-index: 3; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }

/* 卡片 */
.card { width: 100%; max-width: 420px; background: #ffffff; border-radius: 20px; padding: 32px; box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05); }

/* 平台切换 - 滑动指示器 */
.tabs-container { display: flex; position: relative; padding: 4px; background: #f1f5f9; border-radius: 12px; margin-bottom: 24px; }
.tabs-slider { position: absolute; top: 4px; left: 4px; width: calc(50% - 4px); height: calc(100% - 8px); border-radius: 8px; transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); z-index: 1; }
.tab-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; background: transparent; color: #64748b; position: relative; z-index: 2; transition: color 0.3s ease; }
.tab-btn:hover { color: #475569; }
.tab-btn.active { color: #fff; }

/* 头部 */
.header { text-align: center; margin-bottom: 28px; }
.logo { width: 64px; height: 64px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; color: #fff; margin-bottom: 16px; box-shadow: 0 8px 24px -8px rgba(99, 102, 241, 0.4); transition: all 0.4s ease; }
.header h1 { font-size: 20px; color: #0f172a; font-weight: 700; margin: 0 0 6px; }
.header p { color: #64748b; font-size: 14px; margin: 0; }

/* 模式切换 - 滑动指示器 */
.mode-container { display: flex; position: relative; gap: 0; margin-bottom: 24px; background: #f8fafc; border-radius: 12px; padding: 4px; border: 1px solid #e2e8f0; }
.mode-slider { position: absolute; top: 4px; left: 4px; width: calc(50% - 4px); height: calc(100% - 8px); background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); z-index: 1; }
.mode-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; background: transparent; color: #94a3b8; position: relative; z-index: 2; transition: color 0.3s ease; }
.mode-btn:hover { color: #64748b; }
.mode-btn.active { color: #6366f1; }

/* 表单 */
.form-section { display: flex; flex-direction: column; gap: 16px; }
.input-group { display: flex; flex-direction: column; gap: 8px; }
.input-group label { font-size: 14px; font-weight: 600; color: #374151; }
.input-group .hint { font-weight: 400; color: #94a3b8; font-size: 12px; }
.toggle-btn { background: none; border: none; padding: 4px; cursor: pointer; color: #94a3b8; transition: color 0.2s; display: flex; }
.toggle-btn:hover { color: #6366f1; }

/* 按钮 */
.submit-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 48px; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; color: #fff; cursor: pointer; transition: all 0.25s ease; }
.submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px -8px rgba(99, 102, 241, 0.5); }
.submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-group { display: flex; gap: 10px; }
.btn-group .submit-btn { flex: 1; }
.clear-btn { width: 48px; height: 48px; border: 2px solid #e2e8f0; border-radius: 12px; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; transition: all 0.2s; }
.clear-btn:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

/* 结果区域 */
.result-section { margin-top: 24px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
.result-section h2 { font-size: 14px; font-weight: 600; color: #475569; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.5px; }

/* 余额卡片网格 */
.balance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.balance-card { padding: 16px; border-radius: 12px; background: #f8fafc; display: flex; align-items: center; gap: 12px; transition: transform 0.2s ease; cursor: default; }
.balance-card:hover { transform: translateY(-2px); }
.balance-card.primary { grid-column: 1 / -1; padding: 20px; }
.balance-card.primary .card-icon { background: rgba(255, 255, 255, 0.2); color: #fff; }
.balance-card.primary .label { color: rgba(255, 255, 255, 0.8); }
.balance-card.primary .value { color: #fff; font-size: 26px; }
.card-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.card-icon.recharge { background: #dcfce7; color: #16a34a; }
.card-icon.gift { background: #fef3c7; color: #d97706; }
.card-icon.user { background: #e0e7ff; color: #4f46e5; }
.card-content { min-width: 0; }
.label { font-size: 12px; color: #64748b; display: block; margin-bottom: 2px; }
.value { font-size: 18px; font-weight: 700; color: #0f172a; display: block; }
.value.small { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 批量结果 */
.batch-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.batch-header h2 { margin: 0; }
.batch-total { padding: 6px 14px; border-radius: 20px; color: #fff; font-weight: 700; font-size: 14px; }
.batch-list { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.batch-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #e2e8f0; transition: all 0.2s; }
.batch-item.success { background: #f0fdf4; border-left-color: #22c55e; }
.batch-item.error { background: #fef2f2; border-left-color: #ef4444; }
.batch-item .key { font-family: 'SF Mono', Monaco, monospace; font-size: 12px; color: #475569; background: none; }
.batch-item .status { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #64748b; }
.icon-success { color: #22c55e; }
.icon-error { color: #ef4444; }

/* 底部 */
.footer { text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
.footer a { display: inline-flex; align-items: center; gap: 4px; color: #6366f1; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
.footer a:hover { color: #4f46e5; }

/* 动画 */
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.fade-slide-enter-active { animation: fadeSlide 0.4s ease-out; }
.fade-slide-leave-active { animation: fadeSlide 0.25s ease-in reverse; }
@keyframes fadeSlide { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

/* 响应式 */
@media (max-width: 480px) {
  .card { padding: 24px 20px; border-radius: 16px; }
  .header h1 { font-size: 18px; }
  .balance-grid { grid-template-columns: 1fr; }
  .balance-card.primary .value { font-size: 22px; }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
</style>
