<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { View, Hide, Wallet, Present, CreditCard, Delete, Plus, Loading } from '@element-plus/icons-vue'
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

onMounted(() => {
  resizeCanvas()
  animate()
  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeCanvas)
})

// 模式切换
const mode = ref<'single' | 'batch'>('single')

// 单个查询
const apiKey = ref('')
const showPassword = ref(false)
const loading = ref(false)
const showResult = ref(false)

const balance = reactive({
  total: 0,
  recharge: 0,
  gift: 0
})

// 批量查询
interface BatchItem {
  key: string
  name: string
  status: 'pending' | 'loading' | 'success' | 'error'
  balance?: {
    total: number
    recharge: number
    gift: number
  }
  error?: string
}

const batchKeys = ref<BatchItem[]>([
  { key: '', name: '', status: 'pending' }
])

const batchLoading = ref(false)

const addBatchKey = () => {
  batchKeys.value.push({ key: '', name: '', status: 'pending' })
}

const removeBatchKey = (index: number) => {
  if (batchKeys.value.length > 1) {
    batchKeys.value.splice(index, 1)
  }
}

const totalBatchBalance = computed(() => {
  return batchKeys.value
    .filter(item => item.status === 'success' && item.balance)
    .reduce((sum, item) => sum + (item.balance?.total || 0), 0)
})

const formatMoney = (value: number) => {
  return '¥' + value.toFixed(2)
}

// 单个查询 API
const queryBalance = async () => {
  if (!apiKey.value.trim()) {
    ElMessage.warning('请输入 API Key')
    return
  }

  loading.value = true
  showResult.value = false

  try {
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

// 批量查询 API
const queryBatchBalance = async () => {
  const validKeys = batchKeys.value.filter(item => item.key.trim())
  
  if (validKeys.length === 0) {
    ElMessage.warning('请至少输入一个 API Key')
    return
  }

  batchLoading.value = true
  
  // 重置状态
  batchKeys.value.forEach(item => {
    if (item.key.trim()) {
      item.status = 'loading'
      item.balance = undefined
      item.error = undefined
    }
  })

  const apiUrl = import.meta.env.DEV 
    ? '/api/v1/user/remain/points' 
    : '/api/balance'

  // 并发查询
  await Promise.all(
    batchKeys.value.map(async (item, index) => {
      if (!item.key.trim()) return

      try {
        const response = await axios.get(apiUrl, {
          headers: {
            'Authorization': `Bearer ${item.key.trim()}`
          }
        })

        if (response.data.code === 0) {
          item.status = 'success'
          item.balance = {
            total: response.data.data.total_remain,
            recharge: response.data.data.recharge_remain,
            gift: response.data.data.gift_remain
          }
        } else {
          item.status = 'error'
          item.error = response.data.msg || '查询失败'
        }
      } catch (error: any) {
        item.status = 'error'
        if (error.response?.status === 401) {
          item.error = 'Key 无效'
        } else {
          item.error = '网络错误'
        }
      }
    })
  )

  batchLoading.value = false
  
  const successCount = batchKeys.value.filter(item => item.status === 'success').length
  ElMessage.success(`查询完成：${successCount}/${validKeys.length} 成功`)
}

// 解析批量输入
const parseBatchInput = (text: string) => {
  const lines = text.split('\n').filter(line => line.trim())
  const newKeys: BatchItem[] = []
  
  lines.forEach(line => {
    // 支持格式: key 或 name:key 或 name key
    const parts = line.trim().split(/[:\s]+/)
    if (parts.length >= 2) {
      newKeys.push({ key: parts[parts.length - 1], name: parts[0], status: 'pending' })
    } else if (parts.length === 1 && parts[0]) {
      newKeys.push({ key: parts[0], name: '', status: 'pending' })
    }
  })
  
  if (newKeys.length > 0) {
    batchKeys.value = newKeys
    ElMessage.success(`已导入 ${newKeys.length} 个 Key`)
  }
}

const batchInputText = ref('')
const showBatchImport = ref(false)

const importBatchKeys = () => {
  if (batchInputText.value.trim()) {
    parseBatchInput(batchInputText.value)
    showBatchImport.value = false
    batchInputText.value = ''
  }
}
</script>

<template>
  <div class="app-container">
    <canvas ref="canvasRef" class="particle-canvas"></canvas>
    <div class="gradient-overlay"></div>

    <div class="main-content">
      <div
        v-motion
        :initial="{ opacity: 0, y: 50, scale: 0.9 }"
        :enter="{ opacity: 1, y: 0, scale: 1, transition: { duration: 600, type: 'spring', stiffness: 100 } }"
        class="card"
        :class="{ 'card-wide': mode === 'batch' }"
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
          <h1>AIPing 余额查询</h1>
          <p>输入 API Key 查询账户余额</p>
        </div>

        <!-- 模式切换 -->
        <div class="mode-switch">
          <el-radio-group v-model="mode" size="large">
            <el-radio-button value="single">单个查询</el-radio-button>
            <el-radio-button value="batch">批量查询</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 单个查询模式 -->
        <template v-if="mode === 'single'">
          <div class="input-section">
            <label>API Key</label>
            <el-input
              v-model="apiKey"
              :type="showPassword ? 'text' : 'password'"
              placeholder="QC-xxxxxxxx-xxxxxxxxxxxx"
              size="large"
              @keyup.enter="queryBalance"
            >
              <template #suffix>
                <el-icon class="cursor-pointer" @click="showPassword = !showPassword">
                  <View v-if="!showPassword" />
                  <Hide v-else />
                </el-icon>
              </template>
            </el-input>
          </div>

          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="query-btn"
            @click="queryBalance"
          >
            {{ loading ? '查询中...' : '查询余额' }}
          </el-button>

          <Transition name="result">
            <div v-if="showResult" class="result-section">
              <h3>账户余额</h3>
              <div class="balance-cards">
                <div class="balance-card total">
                  <div class="balance-icon">
                    <el-icon :size="24"><Wallet /></el-icon>
                  </div>
                  <div class="balance-info">
                    <span>总余额</span>
                    <strong>{{ formatMoney(balance.total) }}</strong>
                  </div>
                </div>
                <div class="balance-card">
                  <div class="balance-icon recharge">
                    <el-icon :size="20"><CreditCard /></el-icon>
                  </div>
                  <div class="balance-info">
                    <span>充值余额</span>
                    <strong>{{ formatMoney(balance.recharge) }}</strong>
                  </div>
                </div>
                <div class="balance-card">
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
        </template>

        <!-- 批量查询模式 -->
        <template v-else>
          <div class="batch-section">
            <div class="batch-header">
              <span>API Key 列表</span>
              <div class="batch-actions">
                <el-button size="small" @click="showBatchImport = true">批量导入</el-button>
                <el-button size="small" :icon="Plus" @click="addBatchKey">添加</el-button>
              </div>
            </div>

            <div class="batch-list">
              <div 
                v-for="(item, index) in batchKeys" 
                :key="index" 
                class="batch-item"
                :class="{ 
                  'batch-item-success': item.status === 'success',
                  'batch-item-error': item.status === 'error'
                }"
              >
                <el-input
                  v-model="item.name"
                  placeholder="备注名"
                  size="default"
                  class="batch-name"
                />
                <el-input
                  v-model="item.key"
                  placeholder="API Key"
                  size="default"
                  class="batch-key"
                  show-password
                />
                <div class="batch-result" v-if="item.status === 'success' && item.balance">
                  <span class="batch-balance">{{ formatMoney(item.balance.total) }}</span>
                </div>
                <div class="batch-result" v-else-if="item.status === 'error'">
                  <span class="batch-error">{{ item.error }}</span>
                </div>
                <div class="batch-result" v-else-if="item.status === 'loading'">
                  <el-icon class="is-loading"><Loading /></el-icon>
                </div>
                <el-button
                  :icon="Delete"
                  circle
                  size="small"
                  @click="removeBatchKey(index)"
                  :disabled="batchKeys.length <= 1"
                />
              </div>
            </div>

            <el-button
              type="primary"
              size="large"
              :loading="batchLoading"
              class="query-btn"
              @click="queryBatchBalance"
            >
              {{ batchLoading ? '查询中...' : '批量查询' }}
            </el-button>

            <Transition name="result">
              <div v-if="batchKeys.some(item => item.status === 'success')" class="batch-summary">
                <div class="summary-card">
                  <span>总余额汇总</span>
                  <strong>{{ formatMoney(totalBatchBalance) }}</strong>
                </div>
              </div>
            </Transition>
          </div>
        </template>

        <div class="footer">
          <a href="https://aiping.cn" target="_blank">访问 AIPing 官网 →</a>
        </div>
      </div>
    </div>

    <!-- 批量导入弹窗 -->
    <el-dialog v-model="showBatchImport" title="批量导入" width="500px">
      <p class="import-tip">每行一个 Key，支持格式：</p>
      <ul class="import-tip-list">
        <li>直接输入 Key</li>
        <li>备注名:Key</li>
        <li>备注名 Key</li>
      </ul>
      <el-input
        v-model="batchInputText"
        type="textarea"
        :rows="8"
        placeholder="QC-xxx1&#10;账号1:QC-xxx2&#10;账号2 QC-xxx3"
      />
      <template #footer>
        <el-button @click="showBatchImport = false">取消</el-button>
        <el-button type="primary" @click="importBatchKeys">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  overflow: auto;
}

.particle-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.gradient-overlay {
  position: fixed;
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
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
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
  transition: max-width 0.3s ease;
}

.card-wide {
  max-width: 600px;
}

.header {
  text-align: center;
  margin-bottom: 24px;
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

.mode-switch {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
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

/* 批量查询样式 */
.batch-section {
  margin-bottom: 20px;
}

.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.batch-header span {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.batch-actions {
  display: flex;
  gap: 8px;
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
  max-height: 400px;
  overflow-y: auto;
}

.batch-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.batch-item-success {
  border-color: #10b981;
  background: #ecfdf5;
}

.batch-item-error {
  border-color: #ef4444;
  background: #fef2f2;
}

.batch-name {
  width: 100px;
  flex-shrink: 0;
}

.batch-key {
  flex: 1;
}

.batch-result {
  width: 80px;
  text-align: right;
  flex-shrink: 0;
}

.batch-balance {
  color: #10b981;
  font-weight: 600;
  font-size: 14px;
}

.batch-error {
  color: #ef4444;
  font-size: 12px;
}

.batch-summary {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.summary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-card span {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.summary-card strong {
  color: white;
  font-size: 24px;
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

.import-tip {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 8px;
}

.import-tip-list {
  color: #9ca3af;
  font-size: 13px;
  margin-bottom: 16px;
  padding-left: 20px;
}

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

.is-loading {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
