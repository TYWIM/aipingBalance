<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { View, Hide, Wallet, Present, CreditCard } from '@element-plus/icons-vue'
import axios from 'axios'

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
const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe']

function initParticles(width: number, height: number) {
  particles.length = 0
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      radius: Math.random() * 2 + 1,
      color: colors[Math.floor(Math.random() * colors.length)]
    })
  }
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 更新和绘制粒子
  particles.forEach((p, i) => {
    p.x += p.vx
    p.y += p.vy

    if (p.x < 0 || p.x > canvas.width) p.vx *= -1
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1

    // 绘制粒子
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = 0.6
    ctx.fill()

    // 绘制连线
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

onMounted(() => {
  resizeCanvas()
  animate()
  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeCanvas)
})

// 表单逻辑
const apiKey = ref('')
const showPassword = ref(false)
const loading = ref(false)
const showResult = ref(false)

const balance = reactive({
  total: 0,
  recharge: 0,
  gift: 0
})

const formatMoney = (value: number) => {
  return '¥' + value.toFixed(2)
}

const queryBalance = async () => {
  if (!apiKey.value.trim()) {
    ElMessage.warning('请输入 API Key')
    return
  }

  loading.value = true
  showResult.value = false

  try {
    // 开发环境用 Vite 代理，生产环境用 Netlify Functions
    const apiUrl = import.meta.env.DEV 
      ? '/api/v1/user/remain/points' 
      : '/api/balance'
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey.value.trim()}`
      }
    })

    if (response.data.code === 0) {
      balance.total = response.data.data.total_remain
      balance.recharge = response.data.data.recharge_remain
      balance.gift = response.data.data.gift_remain
      showResult.value = true
      ElMessage.success('查询成功')
    } else {
      ElMessage.error(response.data.msg || '查询失败')
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      ElMessage.error('API Key 无效或已过期，请检查后重试')
    } else if (error.response?.status === 403) {
      ElMessage.error('没有访问权限')
    } else {
      ElMessage.error('网络请求失败，请检查网络连接')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="app-container">
    <!-- 粒子背景 -->
    <canvas ref="canvasRef" class="particle-canvas"></canvas>
    
    <!-- 渐变遮罩 -->
    <div class="gradient-overlay"></div>

    <!-- 主卡片 -->
    <div class="main-content">
      <div
        v-motion
        :initial="{ opacity: 0, y: 50, scale: 0.9 }"
        :enter="{ opacity: 1, y: 0, scale: 1, transition: { duration: 600, type: 'spring', stiffness: 100 } }"
        class="card"
      >
        <!-- 头部 -->
        <div class="header">
          <div
            v-motion
            :initial="{ scale: 0, rotate: -180 }"
            :enter="{ scale: 1, rotate: 0, transition: { delay: 200, duration: 500, type: 'spring' } }"
            class="logo"
          >
            <el-icon :size="32"><Wallet /></el-icon>
          </div>
          <h1
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { delay: 300 } }"
          >
            AIPing 余额查询
          </h1>
          <p
            v-motion
            :initial="{ opacity: 0 }"
            :enter="{ opacity: 1, transition: { delay: 400 } }"
          >
            输入您的 API Key 查询账户余额
          </p>
        </div>

        <!-- 输入框 -->
        <div
          v-motion
          :initial="{ opacity: 0, x: -30 }"
          :enter="{ opacity: 1, x: 0, transition: { delay: 500 } }"
          class="input-section"
        >
          <label>API Key</label>
          <el-input
            v-model="apiKey"
            :type="showPassword ? 'text' : 'password'"
            placeholder="QC-xxxxxxxx-xxxxxxxxxxxx"
            size="large"
            @keyup.enter="queryBalance"
          >
            <template #suffix>
              <el-icon 
                class="cursor-pointer" 
                @click="showPassword = !showPassword"
              >
                <View v-if="!showPassword" />
                <Hide v-else />
              </el-icon>
            </template>
          </el-input>
        </div>

        <!-- 查询按钮 -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :enter="{ opacity: 1, y: 0, transition: { delay: 600 } }"
        >
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="query-btn"
            @click="queryBalance"
          >
            {{ loading ? '查询中...' : '查询余额' }}
          </el-button>
        </div>

        <!-- 结果展示 -->
        <Transition name="result">
          <div v-if="showResult" class="result-section">
            <h3>账户余额</h3>
            <div class="balance-cards">
              <!-- 总余额 -->
              <div
                v-motion
                :initial="{ opacity: 0, scale: 0.8 }"
                :enter="{ opacity: 1, scale: 1, transition: { delay: 0 } }"
                class="balance-card total"
              >
                <div class="balance-icon">
                  <el-icon :size="24"><Wallet /></el-icon>
                </div>
                <div class="balance-info">
                  <span>总余额</span>
                  <strong>{{ formatMoney(balance.total) }}</strong>
                </div>
              </div>

              <!-- 充值余额 -->
              <div
                v-motion
                :initial="{ opacity: 0, x: -20 }"
                :enter="{ opacity: 1, x: 0, transition: { delay: 100 } }"
                class="balance-card"
              >
                <div class="balance-icon recharge">
                  <el-icon :size="20"><CreditCard /></el-icon>
                </div>
                <div class="balance-info">
                  <span>充值余额</span>
                  <strong>{{ formatMoney(balance.recharge) }}</strong>
                </div>
              </div>

              <!-- 赠送余额 -->
              <div
                v-motion
                :initial="{ opacity: 0, x: 20 }"
                :enter="{ opacity: 1, x: 0, transition: { delay: 200 } }"
                class="balance-card"
              >
                <div class="balance-icon gift">
                  <el-icon :size="20"><Present /></el-icon>
                </div>
                <div class="balance-info">
                  <span>赠送余额</span>
                  <strong>{{ formatMoney(balance.gift) }}</strong>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- 底部链接 -->
        <div
          v-motion
          :initial="{ opacity: 0 }"
          :enter="{ opacity: 1, transition: { delay: 700 } }"
          class="footer"
        >
          <a href="https://aiping.cn" target="_blank">访问 AIPing 官网 →</a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.particle-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.gradient-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.3) 100%);
  z-index: 2;
}

.main-content {
  position: relative;
  z-index: 3;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.card {
  width: 100%;
  max-width: 440px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  padding: 40px;
  box-shadow: 
    0 25px 50px -12px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  width: 72px;
  height: 72px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: white;
  box-shadow: 0 10px 30px -10px rgba(102, 126, 234, 0.5);
}

.header h1 {
  font-size: 26px;
  color: #1a1a2e;
  font-weight: 700;
  margin-bottom: 8px;
}

.header p {
  color: #6b7280;
  font-size: 14px;
}

.input-section {
  margin-bottom: 24px;
}

.input-section label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
}

.cursor-pointer {
  cursor: pointer;
  transition: color 0.2s;
}

.cursor-pointer:hover {
  color: #667eea;
}

.query-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition: all 0.3s ease;
}

.query-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px -10px rgba(102, 126, 234, 0.6);
}

.result-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.result-section h3 {
  font-size: 16px;
  color: #374151;
  margin-bottom: 16px;
  font-weight: 600;
}

.balance-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.balance-card {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 16px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: transform 0.2s ease;
}

.balance-card:hover {
  transform: translateX(4px);
}

.balance-card.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.balance-card.total .balance-icon {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.balance-card.total .balance-info span {
  color: rgba(255, 255, 255, 0.8);
}

.balance-card.total .balance-info strong {
  color: white;
}

.balance-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.balance-icon.recharge {
  background: #d1fae5;
  color: #10b981;
}

.balance-icon.gift {
  background: #fef3c7;
  color: #f59e0b;
}

.balance-info {
  flex: 1;
}

.balance-info span {
  font-size: 13px;
  color: #6b7280;
  display: block;
  margin-bottom: 4px;
}

.balance-info strong {
  font-size: 22px;
  color: #1a1a2e;
  font-weight: 700;
}

.footer {
  text-align: center;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.footer a {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s;
}

.footer a:hover {
  color: #764ba2;
}

/* 结果动画 */
.result-enter-active {
  animation: slideUp 0.4s ease-out;
}

.result-leave-active {
  animation: slideUp 0.3s ease-in reverse;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
