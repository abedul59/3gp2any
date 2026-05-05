<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6 font-sans">
    <h1 class="text-3xl font-extrabold text-center text-gray-900 mb-8">YouTube 雲端下載神器</h1>
    
    <!-- 網址輸入區 -->
    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <label class="block text-sm font-semibold text-gray-700 mb-2">輸入 YouTube 網址 (支援單一影片與播放清單，每行一筆)</label>
      <textarea 
        v-model="urlInput" 
        rows="5" 
        class="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition"
        placeholder="https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/playlist?list=..."
        :disabled="isProcessing"
      ></textarea>
    </div>

    <!-- 設定與控制區 -->
    <div class="flex flex-col sm:flex-row items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 gap-4">
      <div class="flex gap-4 w-full sm:w-auto">
        <div class="flex flex-col">
          <label class="text-xs font-semibold text-gray-500 mb-1">下載格式</label>
          <select v-model="settings.format" class="border border-gray-300 p-2 rounded-md bg-white" :disabled="isProcessing">
            <option value="mp4">影片 (MP4)</option>
            <option value="mp3">音樂 (MP3)</option>
          </select>
        </div>
        
        <div class="flex flex-col" v-if="settings.format === 'mp4'">
          <label class="text-xs font-semibold text-gray-500 mb-1">最高解析度</label>
          <select v-model="settings.resolution" class="border border-gray-300 p-2 rounded-md bg-white" :disabled="isProcessing">
            <option value="480">480p</option>
            <option value="720">720p</option>
            <option value="1080">1080p</option>
          </select>
        </div>
      </div>

      <button 
        @click="processInputUrls" 
        :disabled="isProcessing || !urlInput.trim()"
        class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-md transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {{ isProcessing ? statusMessage : '開始解析與下載' }}
      </button>
    </div>

    <!-- 任務進度列表 -->
    <div v-if="tasks.length > 0" class="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
      <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 class="font-bold text-gray-700">下載佇列 (共 {{ tasks.length }} 筆)</h3>
      </div>
      <ul class="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        <li v-for="(task, index) in tasks" :key="index" class="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="truncate w-full sm:w-2/3">
            <p class="text-sm font-medium text-gray-900 truncate" :title="task.title">{{ task.title }}</p>
            <p class="text-xs text-gray-400 truncate">{{ task.url }}</p>
          </div>
          
          <div class="w-full sm:w-auto flex items-center justify-end">
            <!-- 狀態指示 -->
            <span :class="getStatusColor(task.status)" class="text-sm flex items-center gap-2">
              <span v-if="task.status === 'downloading'" class="animate-pulse">🔄</span>
              <span v-if="task.status === 'success'">✅</span>
              <span v-if="task.status === 'error'">❌</span>
              {{ task.statusText }}
            </span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 定義你提供的 API 基底網址
const HF_API_BASE = 'https://lawxstudents168-yt-api.hf.space/api'

const urlInput = ref('')
const isProcessing = ref(false)
const statusMessage = ref('處理中...')
const settings = ref({
  format: 'mp4',
  resolution: '720'
})

const tasks = ref([])

// 取得狀態對應顏色
const getStatusColor = (status) => {
  switch(status) {
    case 'pending': return 'text-gray-400'
    case 'parsing': return 'text-purple-600 font-medium'
    case 'downloading': return 'text-blue-600 font-bold'
    case 'success': return 'text-green-600 font-bold'
    case 'error': return 'text-red-600 font-bold'
    default: return 'text-gray-800'
  }
}

// 階段一：解析輸入網址
const processInputUrls = async () => {
  const rawUrls = urlInput.value.split('\n').map(u => u.trim()).filter(u => u)
  if (rawUrls.length === 0) return

  isProcessing.value = true
  tasks.value = [] // 重置任務清單

  statusMessage.value = '正在解析網址...'

  for (const rawUrl of rawUrls) {
    // 判斷是否為清單 (URL 包含 list=)
    if (rawUrl.includes('list=')) {
      tasks.value.push({ url: rawUrl, title: '正在展開播放清單...', status: 'parsing', statusText: '解析清單中' })
      const parsingIndex = tasks.value.length - 1
      
      try {
        const res = await fetch(`${HF_API_BASE}/extract_playlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: rawUrl })
        })
        
        if (!res.ok) throw new Error('解析清單失敗')
        
        const data = await res.json()
        
        // 移除「正在解析」的暫存任務，將清單內的所有影片推入佇列
        tasks.value.splice(parsingIndex, 1)
        data.videos.forEach(v => {
          tasks.value.push({ url: v.url, title: v.title, status: 'pending', statusText: '等待下載' })
        })
      } catch (error) {
        tasks.value[parsingIndex].status = 'error'
        tasks.value[parsingIndex].statusText = '解析失敗'
      }
    } else {
      // 單一影片直接放入佇列
      tasks.value.push({ url: rawUrl, title: rawUrl, status: 'pending', statusText: '等待下載' })
    }
  }

  // 階段二：開始循序下載
  statusMessage.value = '下載進行中...'
  await processDownloadQueue()
  
  isProcessing.value = false
  statusMessage.value = '處理中...'
}

// 階段二：處理下載佇列
const processDownloadQueue = async () => {
  for (let i = 0; i < tasks.value.length; i++) {
    const task = tasks.value[i]
    if (task.status !== 'pending') continue

    task.status = 'downloading'
    task.statusText = '伺服器轉檔中...'

    try {
      const response = await fetch(`${HF_API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: task.url,
          format: settings.value.format,
          resolution: settings.value.resolution
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || '下載發生錯誤')
      }

      // 從 Header 提取伺服器決定好的檔案名稱
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `download.${settings.value.format}`
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = decodeURIComponent(contentDisposition.split('filename=')[1].replace(/"/g, ''))
      }

      task.statusText = '傳輸回本地...'
      
      // 將資料流轉為 Blob 並觸發瀏覽器下載
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)

      task.status = 'success'
      task.statusText = '下載完成'
    } catch (error) {
      task.status = 'error'
      task.statusText = error.message
    }
  }
}
</script>