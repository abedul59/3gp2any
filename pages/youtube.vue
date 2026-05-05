<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6 font-sans">
    <h1 class="text-3xl font-extrabold text-center text-gray-900 mb-8">YouTube 雲端下載神器</h1>
    
    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <label class="block text-sm font-semibold text-gray-700 mb-2">輸入 YouTube 網址 (每行一筆)</label>
      <textarea 
        v-model="urlInput" 
        rows="5" 
        class="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition"
        placeholder="https://www.youtube.com/watch?v=..."
        :disabled="isProcessing"
      ></textarea>
    </div>

    <div class="flex flex-col sm:flex-row items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 gap-4">
      <div class="flex gap-4 w-full sm:w-auto">
        <div class="flex flex-col">
          <label class="text-xs font-semibold text-gray-500 mb-1">下載格式</label>
          <select v-model="settings.format" class="border border-gray-300 p-2 rounded-md bg-white" :disabled="isProcessing">
            <option value="mp4">影片 (MP4)</option>
            <option value="mp3">音樂 (MP3)</option>
          </select>
        </div>
      </div>

      <button 
        @click="processInputUrls" 
        :disabled="isProcessing || !urlInput.trim()"
        class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-md transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {{ isProcessing ? statusMessage : '開始處理' }}
      </button>
    </div>

    <div v-if="tasks.length > 0" class="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
      <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 class="font-bold text-gray-700">任務佇列 (共 {{ tasks.length }} 筆)</h3>
      </div>
      <ul class="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        <li v-for="(task, index) in tasks" :key="index" class="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="truncate w-full sm:w-2/3">
            <p class="text-sm font-medium text-gray-900 truncate" :title="task.title">{{ task.title }}</p>
            <p class="text-xs text-gray-400 truncate">{{ task.url }}</p>
          </div>
          
          <div class="w-full sm:w-auto flex items-center justify-end">
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

const HF_API_BASE = 'https://lawxstudents168-yt-api.hf.space/api'
const COBALT_API = '/api/cobalt'


const urlInput = ref('')
const isProcessing = ref(false)
const statusMessage = ref('處理中...')
const settings = ref({ format: 'mp4' })
const tasks = ref([])

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

// 取得 YouTube 影片 ID
const getYoutubeId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

const processInputUrls = async () => {
  const rawUrls = urlInput.value.split('\n').map(u => u.trim()).filter(u => u)
  if (rawUrls.length === 0) return

  isProcessing.value = true
  tasks.value = rawUrls.map(url => ({
    url: url,
    title: '取得影片資訊中...',
    media_url: null,
    status: 'pending',
    statusText: '等待處理'
  }))

  statusMessage.value = '解析網址中...'

  // 階段一：由前端向 Cobalt API 請求真實媒體網址
  for (let i = 0; i < tasks.value.length; i++) {
    const task = tasks.value[i]
    task.status = 'parsing'
    task.statusText = '解析 YouTube...'
    
    try {
      const response = await fetch(COBALT_API, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: task.url,
          vCodec: 'h264',
          vQuality: '720',
          aFormat: 'mp3',
          isAudioOnly: settings.value.format === 'mp3'
        })
      })

      if (!response.ok) throw new Error('解析服務連線失敗')
      
      const data = await response.json()
      
      if (data.status === 'error' || !data.url) {
         throw new Error(data.text || '無法取得真實網址')
      }

      task.media_url = data.url
      task.title = `YouTube_Video_${getYoutubeId(task.url) || i}`
      task.status = 'pending'
      task.statusText = '準備轉檔'
      
    } catch (error) {
      task.status = 'error'
      task.statusText = error.message
    }
  }

  // 階段二：呼叫 HF 後端處理轉檔與下載
  statusMessage.value = '雲端轉檔中...'
  await processDownloadQueue()
  
  isProcessing.value = false
  statusMessage.value = '處理完畢'
}

const processDownloadQueue = async () => {
  for (let i = 0; i < tasks.value.length; i++) {
    const task = tasks.value[i]
    // 只有成功拿到 media_url 的任務才繼續
    if (task.status !== 'pending' || !task.media_url) continue

    task.status = 'downloading'
    task.statusText = '伺服器轉檔中...'

    try {
      const response = await fetch(`${HF_API_BASE}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_url: task.media_url,
          format: settings.value.format,
          title: task.title
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || '轉檔發生錯誤')
      }

      task.statusText = '下載至本地...'
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${task.title}.${settings.value.format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)

      task.status = 'success'
      task.statusText = '處理完成'
    } catch (error) {
      task.status = 'error'
      task.statusText = error.message
    }
  }
}
</script>