<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
    <div class="max-w-3xl mx-auto space-y-8">
      
      <!-- 標題區塊 -->
      <div class="text-center">
        <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
          3GP 語音轉檔神器
        </h1>
        <p class="mt-3 text-lg text-gray-500">
          支援 3GP / 3GPP 轉 MP3。自動為您選擇最快的轉檔路徑。
        </p>
      </div>

      <!-- 上傳區塊 -->
      <div 
        class="mt-8 flex justify-center px-6 pt-10 pb-12 border-2 border-gray-300 border-dashed rounded-xl bg-white hover:border-indigo-500 hover:bg-indigo-50 transition-colors duration-200"
      >
        <div class="space-y-1 text-center">
          <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="flex justify-center text-sm text-gray-600 mt-4">
            <label for="file-upload" class="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
              <span class="px-2">選擇多個檔案</span>
              <input 
                id="file-upload" 
                name="file-upload" 
                type="file" 
                class="sr-only" 
                accept=".3gp, .3gpp, audio/3gpp, video/3gpp" 
                multiple
                @change="handleFileChange"
              />
            </label>
            <p class="pl-1">或直接拖曳至此</p>
          </div>
          <p class="text-xs text-gray-500 mt-2">最高支援單檔 500MB</p>
        </div>
      </div>

      <!-- 核心載入狀態提示 -->
      <div v-if="!isFfmpegLoaded && !ffmpegLoadError" class="text-center text-sm text-blue-600 animate-pulse">
        正在初始化轉檔核心引擎，請稍候...
      </div>
      <div v-if="ffmpegLoadError" class="text-center text-sm text-red-600">
        核心引擎載入失敗，本地轉檔可能無法使用。
      </div>

      <!-- 檔案列表與進度區塊 -->
      <div v-if="fileList.length > 0" class="bg-white shadow sm:rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">轉檔佇列</h3>
          <ul class="divide-y divide-gray-200">
            <li v-for="item in fileList" :key="item.id" class="py-4">
              <div class="flex items-center justify-between">
                <div class="flex flex-col truncate w-1/2">
                  <span class="text-sm font-medium text-gray-900 truncate">{{ item.name }}</span>
                  <span class="text-xs text-gray-500">{{ item.size }} | {{ item.mode }}</span>
                </div>
                
                <!-- 狀態與下載按鈕 -->
                <div class="flex items-center space-x-4">
                  <span v-if="item.status === 'idle'" class="text-xs text-gray-400">等待中</span>
                  <span v-else-if="item.status === 'processing'" class="text-xs font-semibold text-blue-600 animate-pulse">轉檔中 {{ item.progress }}%</span>
                  <span v-else-if="item.status === 'error'" class="text-xs font-semibold text-red-600">失敗</span>
                  
                  <a v-if="item.status === 'done'" :href="item.url" :download="getDownloadName(item.name)" class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none">
                    下載 MP3
                  </a>
                </div>
              </div>

              <!-- 進度條 -->
              <div class="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  class="h-2.5 rounded-full transition-all duration-300"
                  :class="item.status === 'done' ? 'bg-green-600' : (item.status === 'error' ? 'bg-red-600' : 'bg-blue-600')"
                  :style="{ width: item.status === 'done' ? '100%' : item.progress + '%' }"
                ></div>
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
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util' // 確保引入 toBlobURL

// --- 狀態管理 ---
const fileList = ref([])
const isFfmpegLoaded = ref(false)
const ffmpegLoadError = ref(false)

let ffmpeg = null
let currentProcessingItem = null // 追蹤目前正在用 WASM 轉檔的物件

// --- 初始化 FFmpeg ---
onMounted(async () => {
  ffmpeg = new FFmpeg()
  
  // 監聽 WASM 轉檔進度
  ffmpeg.on('progress', ({ ratio }) => {
    if (currentProcessingItem && currentProcessingItem.status === 'processing') {
      currentProcessingItem.progress = Math.min(Math.round(ratio * 100), 99)
    }
  })
  
  try {
    // 定義 CDN 基礎網址
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    
    // 使用 toBlobURL 將遠端檔案轉為本機 Blob，完美繞過 Worker 的跨域限制
    const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
    const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    
    await ffmpeg.load({
      coreURL: coreURL,
      wasmURL: wasmURL,
    })
    
    isFfmpegLoaded.value = true
    console.log("✅ FFmpeg 核心載入成功！")
  } catch (error) {
    console.error("❌ FFmpeg 核心載入失敗:", error)
    ffmpegLoadError.value = true
  }
})

// --- 處理選擇檔案 ---
const handleFileChange = (event) => {
  const files = Array.from(event.target.files)
  if (files.length === 0) return

  // 將檔案加入佇列
  files.forEach(file => {
    fileList.value.push({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      rawFile: file,
      status: 'idle', // idle, processing, done, error
      progress: 0,
      mode: '等待分配...',
      url: null
    })
  })

  // 清空 input 讓下次選同檔也能觸發
  event.target.value = ''

  // 觸發佇列處理
  processQueue()
}

// 自動將副檔名改為 mp3
const getDownloadName = (originalName) => {
  return originalName.replace(/\.3gpp?$/i, '.mp3')
}

// --- 核心佇列處理器 (確保循序執行，防止記憶體崩潰) ---
let isQueueRunning = false
const processQueue = async () => {
  if (isQueueRunning) return
  isQueueRunning = true

  for (const item of fileList.value) {
    if (item.status !== 'idle') continue

    item.status = 'processing'
    item.progress = 0

    // 智慧分流判斷
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const isLargeFile = item.rawFile.size > 50 * 1024 * 1024 // 50MB 門檻

    try {
      if (isMobile || isLargeFile || !isFfmpegLoaded.value) {
        item.mode = '☁️ 雲端加速'
        await processOnHFServer(item)
      } else {
        item.mode = '💻 本機運算'
        await processOnWasm(item)
      }
      item.status = 'done'
      item.progress = 100
    } catch (error) {
      console.error(`檔案 ${item.name} 轉檔失敗:`, error)
      item.status = 'error'
    }
  }

  isQueueRunning = false
}

// --- 轉檔路徑 A: WASM (純前端) ---
const processOnWasm = async (item) => {
  currentProcessingItem = item
  
  // 強制更名為 input.3gp 寫入記憶體
  await ffmpeg.writeFile('input.3gp', await fetchFile(item.rawFile))
  
  // 執行轉檔 (-y 覆寫, -vn 去影像, -ar 採樣率, -ac 聲道, -b:a 位元率)
  await ffmpeg.exec(['-y', '-i', 'input.3gp', '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k', 'output.mp3'])
  
  // 讀取結果
  const data = await ffmpeg.readFile('output.mp3')
  const blob = new Blob([data.buffer], { type: 'audio/mpeg' })
  item.url = URL.createObjectURL(blob)
  
  currentProcessingItem = null
}

// --- 轉檔路徑 B: Hugging Face API (後端) ---
const processOnHFServer = async (item) => {
  // 模擬進度條提升 UX
  const progressInterval = setInterval(() => {
    if (item.progress < 90) item.progress += 5
  }, 1500)

  const formData = new FormData()
  formData.append('file', item.rawFile, 'input.3gp')

  try {
    // 🔴 記得把這裡替換成你 Hugging Face 的真實 Direct URL！
    // 範例：https://nickhwang-3gp2any.hf.space/api/convert
    const response = await fetch('https://lawxstudents168-3gp2mp3-api.hf.space/api/convert', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) throw new Error('伺服器回傳失敗')

    const blob = await response.blob()
    item.url = URL.createObjectURL(blob)
  } finally {
    clearInterval(progressInterval)
  }
}
</script>