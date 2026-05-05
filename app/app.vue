<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
    <div class="max-w-3xl mx-auto space-y-8">
      
      <div class="text-center">
        <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
          3GP 語音轉檔神器
        </h1>
        <p class="mt-3 text-lg text-gray-500">
          支援 3GP / 3GPP 轉 MP3。由 Hugging Face 雲端伺服器強大算力支援。
        </p>
      </div>

      <div class="mt-8 flex justify-center px-6 pt-10 pb-12 border-2 border-gray-300 border-dashed rounded-xl bg-white hover:border-indigo-500 hover:bg-indigo-50 transition-colors duration-200">
        <div class="space-y-1 text-center">
          <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="flex justify-center text-sm text-gray-600 mt-4">
            <label for="file-upload" class="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
              <span class="px-2">選擇多個檔案</span>
              <input id="file-upload" type="file" class="sr-only" accept=".3gp, .3gpp, audio/3gpp, video/3gpp" multiple @change="handleFileChange" :disabled="!isServerAwake" />
            </label>
            <p class="pl-1">或直接拖曳至此</p>
          </div>
          <p class="text-xs mt-2" :class="isServerAwake ? 'text-green-600' : 'text-orange-500 animate-pulse'">
            {{ isServerAwake ? '雲端引擎已就緒，最高支援單檔 500MB' : '正在喚醒雲端轉檔引擎，請稍候...' }}
          </p>
        </div>
      </div>

      <div v-if="fileList.length > 0" class="bg-white shadow sm:rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">轉檔佇列</h3>
          <ul class="divide-y divide-gray-200">
            <li v-for="item in fileList" :key="item.id" class="py-4">
              <div class="flex items-center justify-between">
                <div class="flex flex-col truncate w-1/2">
                  <span class="text-sm font-medium text-gray-900 truncate">{{ item.name }}</span>
                  <span class="text-xs text-gray-500">{{ item.size }} | ☁️ 雲端處理</span>
                </div>
                
                <div class="flex items-center space-x-4">
                  <span v-if="item.status === 'idle'" class="text-xs text-gray-400">等待中</span>
                  <span v-else-if="item.status === 'processing'" class="text-xs font-semibold text-blue-600 animate-pulse">上傳與轉檔中 {{ item.progress }}%</span>
                  <span v-else-if="item.status === 'error'" class="text-xs font-semibold text-red-600">失敗</span>
                  
                  <a v-if="item.status === 'done'" :href="item.url" :download="getDownloadName(item.name)" class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                    下載 MP3
                  </a>
                </div>
              </div>

              <div class="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                <div class="h-2.5 rounded-full transition-all duration-300" :class="item.status === 'done' ? 'bg-green-600' : (item.status === 'error' ? 'bg-red-600' : 'bg-blue-600')" :style="{ width: item.status === 'done' ? '100%' : item.progress + '%' }"></div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const fileList = ref([])
const isServerAwake = ref(false)
const HF_API_URL = 'https://lawxstudents168-3gp2mp3-api.hf.space'

// 網頁載入時，先發送 GET 請求去喚醒 HF Space
onMounted(async () => {
  try {
    await fetch(HF_API_URL + '/')
    isServerAwake.value = true
  } catch (error) {
    console.error("無法連線到 Hugging Face 伺服器", error)
  }
})

const handleFileChange = (event) => {
  const files = Array.from(event.target.files)
  if (files.length === 0) return

  files.forEach(file => {
    fileList.value.push({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      rawFile: file,
      status: 'idle',
      progress: 0,
      url: null
    })
  })

  event.target.value = '' 
  processQueue()
}

const getDownloadName = (originalName) => originalName.replace(/\.3gpp?$/i, '.mp3')

let isQueueRunning = false
const processQueue = async () => {
  if (isQueueRunning) return
  isQueueRunning = true

  for (const item of fileList.value) {
    if (item.status !== 'idle') continue

    item.status = 'processing'
    item.progress = 0

    try {
      await processOnHFServer(item)
      item.status = 'done'
      item.progress = 100
    } catch (error) {
      console.error(`檔案轉檔失敗:`, error)
      item.status = 'error'
    }
  }
  isQueueRunning = false
}

const processOnHFServer = async (item) => {
  // 模擬進度條
  const progressInterval = setInterval(() => {
    if (item.progress < 95) item.progress += Math.floor(Math.random() * 5) + 1
  }, 1000)

  const formData = new FormData()
  formData.append('file', item.rawFile, 'input.3gp') // 強制更名解決 3gpp 問題

  try {
    const response = await fetch(HF_API_URL + '/api/convert', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`伺服器錯誤: ${response.status} - ${errText}`)
    }

    const blob = await response.blob()
    item.url = URL.createObjectURL(blob)
  } finally {
    clearInterval(progressInterval)
  }
}
</script>