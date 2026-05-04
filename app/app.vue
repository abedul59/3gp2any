<template>
  <div class="container">
    <h1>3GP/3GPP 轉 MP3 轉換器</h1>
    
    <!-- 限制選擇的檔案類型包含 .3gpp -->
    <input 
      type="file" 
      accept=".3gp, .3gpp, audio/3gpp, video/3gpp" 
      @change="handleFileChange"
      :disabled="isProcessing"
    />

    <div v-if="isProcessing">
      <p>處理中 ({{ processMode }})... 請勿關閉網頁</p>
      <!-- 如果是 WASM 模式可以顯示精準進度 -->
      <progress v-if="processMode === '本地運算'" :value="progress" max="100"></progress>
    </div>

    <div v-if="downloadUrl">
      <a :href="downloadUrl" download="converted_audio.mp3">
        <button>下載轉檔結果</button>
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

const isProcessing = ref(false)
const progress = ref(0)
const downloadUrl = ref(null)
const processMode = ref('') // '本地運算' 或 '伺服器運算'

let ffmpeg = null

// 初始化 WASM
onMounted(async () => {
  ffmpeg = new FFmpeg()
  ffmpeg.on('progress', ({ ratio }) => {
    progress.value = Math.round(ratio * 100)
  })
  // 從 CDN 載入核心，加快初次載入速度
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
  })
})

const handleFileChange = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  isProcessing.value = true
  downloadUrl.value = null
  progress.value = 0

  // 1. 智慧分流判斷邏輯
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const isLargeFile = file.size > 50 * 1024 * 1024 // 門檻設為 50MB

  try {
    if (isMobile || isLargeFile) {
      processMode.value = '伺服器運算'
      await processOnHFServer(file)
    } else {
      processMode.value = '本地運算'
      await processOnWasm(file)
    }
  } catch (error) {
    console.error("轉檔失敗:", error)
    alert("轉檔過程發生錯誤，請重試。")
  } finally {
    isProcessing.value = false
  }
}

// 處理路徑 A: WASM (純前端)
const processOnWasm = async (file) => {
  // 核心技巧：不管原檔名是 .3gpp 還是什麼，寫入 MEMFS 時一律叫 input.3gp
  await ffmpeg.writeFile('input.3gp', await fetchFile(file))
  
  // 執行轉檔
  await ffmpeg.exec(['-i', 'input.3gp', '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k', 'output.mp3'])
  
  const data = await ffmpeg.readFile('output.mp3')
  const blob = new Blob([data.buffer], { type: 'audio/mpeg' })
  downloadUrl.value = URL.createObjectURL(blob)
}

// 處理路徑 B: Hugging Face (後端 API)
const processOnHFServer = async (file) => {
  const formData = new FormData()
  // 核心技巧：在 FormData 附加檔案時，強制覆蓋檔名為 input.3gp
  formData.append('file', file, 'input.3gp')

  // 請替換為你 Hugging Face Space 的 Direct URL (不是外觀網址)
  // 通常格式為：https://你的帳號-專案名.hf.space/api/convert
  const response = await fetch('https://YOUR_HF_SPACE_URL/api/convert', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) throw new Error('伺服器轉檔失敗')

  const blob = await response.blob()
  downloadUrl.value = URL.createObjectURL(blob)
}
</script>